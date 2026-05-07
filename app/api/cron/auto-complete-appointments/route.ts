import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppointmentRow = {
  id: string;
  organization_id: string;
  status: string;
  starts_at: string;
  ends_at: string;
};

function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date);

  nextDate.setMinutes(nextDate.getMinutes() + minutes);

  return nextDate;
}

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const secretFromQuery = request.nextUrl.searchParams.get("secret");
  const authorizationHeader = request.headers.get("authorization");

  if (secretFromQuery === cronSecret) {
    return true;
  }

  if (authorizationHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

async function createAppointmentEvent(params: {
  appointmentId: string;
  note: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  await supabaseAdmin.from("appointment_events").insert({
    appointment_id: params.appointmentId,
    event_type: "completed",
    note: params.note,
    created_by: null,
  });
}

async function autoCompleteAppointments() {
  const supabaseAdmin = createSupabaseAdminClient();

  const now = new Date();

  // O rezervare se marchează automat Gata doar după 1 oră de la ora de final.
  const completeBefore = addMinutes(now, -60);

  const { data: appointmentsData, error: selectError } = await supabaseAdmin
    .from("appointments")
    .select("id, organization_id, status, starts_at, ends_at")
    .eq("status", "confirmed")
    .lte("ends_at", completeBefore.toISOString())
    .order("ends_at", { ascending: true })
    .limit(100);

  if (selectError) {
    return {
      ok: false,
      error: selectError.message,
      checked: 0,
      completed: 0,
    };
  }

  const appointments = (appointmentsData || []) as AppointmentRow[];

  if (appointments.length === 0) {
    return {
      ok: true,
      checked: 0,
      completed: 0,
    };
  }

  const appointmentIds = appointments.map((appointment) => appointment.id);

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({
      status: "completed",
    })
    .in("id", appointmentIds)
    .eq("status", "confirmed");

  if (updateError) {
    return {
      ok: false,
      error: updateError.message,
      checked: appointments.length,
      completed: 0,
    };
  }

  for (const appointment of appointments) {
    await createAppointmentEvent({
      appointmentId: appointment.id,
      note: "Rezervarea a fost marcată automat ca finalizată la 1 oră după ora de final.",
    });
  }

  return {
    ok: true,
    checked: appointments.length,
    completed: appointments.length,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const result = await autoCompleteAppointments();

  return NextResponse.json({
    ok: result.ok,
    ran_at: new Date().toISOString(),
    result,
  });
}