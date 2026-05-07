import { NextRequest, NextResponse } from "next/server";
import { sendSmsMessage } from "@/lib/sms/twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AppointmentRow = {
  id: string;
  organization_id: string;
  client_id: string | null;
  service_id: string | null;
  barber_id: string | null;
  starts_at: string;
  ends_at: string;
};

type ReminderType = "reminder_24h" | "reminder_2h";

function addMinutes(date: Date, minutes: number) {
  const nextDate = new Date(date);
  nextDate.setMinutes(nextDate.getMinutes() + minutes);

  return nextDate;
}

function formatAppointmentDate(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
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

function getReminderWindow(type: ReminderType) {
  const now = new Date();

  const reminderOffsetMinutes = type === "reminder_24h" ? 24 * 60 : 2 * 60;

  const windowStart = addMinutes(now, reminderOffsetMinutes);
  const windowEnd = addMinutes(windowStart, 15);

  return {
    windowStart,
    windowEnd,
  };
}

async function getClient(params: { clientId: string | null }) {
  if (!params.clientId) {
    return null;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data } = await supabaseAdmin
    .from("clients")
    .select("id, name, phone, anonymized_at")
    .eq("id", params.clientId)
    .maybeSingle();

  return data;
}

async function getOrganization(params: { organizationId: string }) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("id", params.organizationId)
    .maybeSingle();

  return data;
}

async function getService(params: { serviceId: string | null }) {
  if (!params.serviceId) {
    return null;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data } = await supabaseAdmin
    .from("services")
    .select("id, name")
    .eq("id", params.serviceId)
    .maybeSingle();

  return data;
}

async function getBarber(params: { barberId: string | null }) {
  if (!params.barberId) {
    return null;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data } = await supabaseAdmin
    .from("barbers")
    .select("id, name")
    .eq("id", params.barberId)
    .maybeSingle();

  return data;
}

async function reminderAlreadyExists(params: {
  appointmentId: string;
  reminderType: ReminderType;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data } = await supabaseAdmin
    .from("messages")
    .select("id")
    .eq("appointment_id", params.appointmentId)
    .eq("message_type", params.reminderType)
    .maybeSingle();

  return Boolean(data);
}

async function createReminderMessage(params: {
  appointment: AppointmentRow;
  reminderType: ReminderType;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const alreadyExists = await reminderAlreadyExists({
    appointmentId: params.appointment.id,
    reminderType: params.reminderType,
  });

  if (alreadyExists) {
    return {
      created: false,
      sent: false,
      reason: "duplicate",
    };
  }

  const [organization, client, service, barber] = await Promise.all([
    getOrganization({
      organizationId: params.appointment.organization_id,
    }),
    getClient({
      clientId: params.appointment.client_id,
    }),
    getService({
      serviceId: params.appointment.service_id,
    }),
    getBarber({
      barberId: params.appointment.barber_id,
    }),
  ]);

  if (!client?.phone || client.anonymized_at) {
    return {
      created: false,
      sent: false,
      reason: "missing_client_phone_or_anonymized",
    };
  }

  const salonName = organization?.name || "salon";
  const clientName = client.name || "client";
  const serviceName = service?.name || "serviciul ales";
  const barberName = barber?.name || "frizerul ales";
  const appointmentDate = formatAppointmentDate(params.appointment.starts_at);

  const body =
    params.reminderType === "reminder_24h"
      ? `Salut, ${clientName}! Îți reamintim că mâine ai rezervare la ${salonName}: ${serviceName}, la ${barberName}, în ${appointmentDate}.`
      : `Salut, ${clientName}! Îți reamintim că în aproximativ 2 ore ai rezervare la ${salonName}: ${serviceName}, la ${barberName}, în ${appointmentDate}.`;

  const { data: message, error } = await supabaseAdmin
    .from("messages")
    .insert({
      organization_id: params.appointment.organization_id,
      client_id: params.appointment.client_id,
      appointment_id: params.appointment.id,
      channel: "sms",
      direction: "outbound",
      sender_type: "system",
      from_phone: null,
      to_phone: client.phone,
      body,
      status: "pending",
      provider: "twilio",
      message_type: params.reminderType,
    })
    .select("id")
    .single();

  if (error || !message) {
    return {
      created: false,
      sent: false,
      reason: error?.message || "message_insert_failed",
    };
  }

  const sendResult = await sendSmsMessage(message.id);

  return {
    created: true,
    sent: sendResult.ok,
    reason: sendResult.ok ? "sent" : sendResult.error,
  };
}

async function processReminderType(reminderType: ReminderType) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { windowStart, windowEnd } = getReminderWindow(reminderType);

  const { data: appointmentsData, error } = await supabaseAdmin
    .from("appointments")
    .select(
      "id, organization_id, client_id, service_id, barber_id, starts_at, ends_at",
    )
    .eq("status", "confirmed")
    .gte("starts_at", windowStart.toISOString())
    .lt("starts_at", windowEnd.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    return {
      reminderType,
      ok: false,
      error: error.message,
      checked: 0,
      created: 0,
      sent: 0,
      skipped: 0,
    };
  }

  const appointments = (appointmentsData || []) as AppointmentRow[];

  let created = 0;
  let sent = 0;
  let skipped = 0;

  for (const appointment of appointments) {
    const result = await createReminderMessage({
      appointment,
      reminderType,
    });

    if (result.created) {
      created += 1;
    } else {
      skipped += 1;
    }

    if (result.sent) {
      sent += 1;
    }
  }

  return {
    reminderType,
    ok: true,
    checked: appointments.length,
    created,
    sent,
    skipped,
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

  const reminder24hResult = await processReminderType("reminder_24h");
  const reminder2hResult = await processReminderType("reminder_2h");

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    results: [reminder24hResult, reminder2hResult],
  });
}