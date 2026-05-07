"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendSmsMessage } from "@/lib/sms/twilio";

type UserRole = "owner" | "barber";

type AppointmentStatus = "confirmed" | "cancelled" | "completed" | "no_show";

type CurrentUserContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  organizationId: string;
  role: UserRole;
  barberId: string | null;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
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

async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/login");
  }

  const role = profile.role as UserRole;

  let barberId: string | null = null;

  if (role === "barber") {
    const { data: barber } = await supabase
      .from("barbers")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!barber) {
      redirect("/dashboard?error=Contul tău nu este legat de un frizer activ.");
    }

    barberId = barber.id;
  }

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
    role,
    barberId,
  };
}

async function getAppointmentDetails(params: {
  supabase: CurrentUserContext["supabase"];
  appointmentId: string;
  organizationId: string;
  role: UserRole;
  barberId: string | null;
}) {
  let appointmentQuery = params.supabase
    .from("appointments")
    .select(
      `
        id,
        organization_id,
        client_id,
        service_id,
        barber_id,
        starts_at,
        ends_at,
        status
      `,
    )
    .eq("id", params.appointmentId)
    .eq("organization_id", params.organizationId);

  if (params.role === "barber") {
    if (!params.barberId) {
      return null;
    }

    appointmentQuery = appointmentQuery.eq("barber_id", params.barberId);
  }

  const { data: appointment, error: appointmentError } =
    await appointmentQuery.single();

  if (appointmentError || !appointment) {
    return null;
  }

  const [
    { data: organization },
    { data: client },
    { data: service },
    { data: barber },
  ] = await Promise.all([
    params.supabase
      .from("organizations")
      .select("id, name, phone, whatsapp_phone")
      .eq("id", appointment.organization_id)
      .single(),

    params.supabase
      .from("clients")
      .select("id, name, phone")
      .eq("id", appointment.client_id)
      .single(),

    appointment.service_id
      ? params.supabase
          .from("services")
          .select("id, name, duration_minutes, price")
          .eq("id", appointment.service_id)
          .single()
      : Promise.resolve({ data: null }),

    appointment.barber_id
      ? params.supabase
          .from("barbers")
          .select("id, name, phone")
          .eq("id", appointment.barber_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);

  return {
    appointment,
    organization,
    client,
    service,
    barber,
  };
}

async function createAppointmentEvent(params: {
  supabase: CurrentUserContext["supabase"];
  appointmentId: string;
  userId: string;
  eventType: string;
  note: string;
}) {
  await params.supabase.from("appointment_events").insert({
    appointment_id: params.appointmentId,
    event_type: params.eventType,
    note: params.note,
    created_by: params.userId,
  });
}

async function createSmsMessage(params: {
  supabase: CurrentUserContext["supabase"];
  organizationId: string;
  clientId: string | null;
  appointmentId: string;
  toPhone: string | null;
  body: string;
}) {
  if (!params.toPhone) {
    return;
  }

  const { data: message, error } = await params.supabase
    .from("messages")
    .insert({
      organization_id: params.organizationId,
      client_id: params.clientId,
      appointment_id: params.appointmentId,
      channel: "sms",
      direction: "outbound",
      sender_type: "system",
      from_phone: null,
      to_phone: params.toPhone,
      body: params.body,
      status: "pending",
      provider: "twilio",
    })
    .select("id")
    .single();

  if (error || !message) {
    return;
  }

  await sendSmsMessage(message.id);
}

async function updateAppointmentStatus(
  formData: FormData,
  status: AppointmentStatus,
) {
  const appointmentId = cleanText(formData.get("appointmentId"));

  if (!appointmentId) {
    redirect("/dashboard/bookings?error=Rezervare invalidă.");
  }

  const { supabase, userId, organizationId, role, barberId } =
    await getCurrentUserContext();

  const details = await getAppointmentDetails({
    supabase,
    appointmentId,
    organizationId,
    role,
    barberId,
  });

  if (!details) {
    redirect(
      "/dashboard/bookings?error=Rezervarea nu a fost găsită sau nu ai acces la ea.",
    );
  }

  const nowIso = new Date().toISOString();

  const updatePayload: {
    status: AppointmentStatus;
    cancelled_at?: string | null;
    cancellation_reason?: string | null;
  } = {
    status,
  };

  if (status === "cancelled") {
    updatePayload.cancelled_at = nowIso;
    updatePayload.cancellation_reason =
      role === "barber"
        ? "Refuzată sau anulată de frizer."
        : "Refuzată sau anulată de salon.";
  }

  let updateQuery = supabase
    .from("appointments")
    .update(updatePayload)
    .eq("id", appointmentId)
    .eq("organization_id", organizationId);

  if (role === "barber") {
    if (!barberId) {
      redirect("/dashboard/bookings?error=Cont frizer invalid.");
    }

    updateQuery = updateQuery.eq("barber_id", barberId);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) {
    redirect(
      `/dashboard/bookings?error=${encodeURIComponent(
        `Nu am putut actualiza rezervarea. Detalii: ${updateError.message}`,
      )}`,
    );
  }

  const salonName = details.organization?.name || "Salonul";
  const clientPhone = details.client?.phone || null;
  const clientName = details.client?.name || "client";
  const serviceName = details.service?.name || "serviciul ales";
  const barberName = details.barber?.name || "frizerul ales";
  const appointmentDate = formatAppointmentDate(details.appointment.starts_at);

  if (status === "confirmed") {
    await createAppointmentEvent({
      supabase,
      appointmentId,
      userId,
      eventType: "confirmed",
      note:
        role === "barber"
          ? "Rezervarea a fost confirmată de frizer."
          : "Rezervarea a fost confirmată de salon.",
    });

    await createSmsMessage({
      supabase,
      organizationId,
      clientId: details.client?.id || null,
      appointmentId,
      toPhone: clientPhone,
      body: `Salut, ${clientName}! Rezervarea ta la ${salonName} pentru ${serviceName}, la ${barberName}, în ${appointmentDate}, a fost confirmată.`,
    });
  }

  if (status === "cancelled") {
    await createAppointmentEvent({
      supabase,
      appointmentId,
      userId,
      eventType: "cancelled",
      note:
        role === "barber"
          ? "Rezervarea a fost refuzată sau anulată de frizer."
          : "Rezervarea a fost refuzată sau anulată de salon.",
    });

    await createSmsMessage({
      supabase,
      organizationId,
      clientId: details.client?.id || null,
      appointmentId,
      toPhone: clientPhone,
      body: `Salut, ${clientName}. Rezervarea ta la ${salonName} pentru ${appointmentDate} a fost anulată. Te rugăm să alegi altă oră disponibilă.`,
    });
  }

  if (status === "completed") {
    await createAppointmentEvent({
      supabase,
      appointmentId,
      userId,
      eventType: "completed",
      note: "Rezervarea a fost marcată ca finalizată.",
    });
  }

  if (status === "no_show") {
    await createAppointmentEvent({
      supabase,
      appointmentId,
      userId,
      eventType: "no_show",
      note: "Clientul nu s-a prezentat.",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");

  redirect("/dashboard/bookings");
}

export async function confirmAppointment(formData: FormData) {
  await updateAppointmentStatus(formData, "confirmed");
}

export async function cancelAppointment(formData: FormData) {
  await updateAppointmentStatus(formData, "cancelled");
}

export async function completeAppointment(formData: FormData) {
  await updateAppointmentStatus(formData, "completed");
}

export async function markNoShowAppointment(formData: FormData) {
  await updateAppointmentStatus(formData, "no_show");
}