"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeRomanianPhone } from "@/lib/phone";
import { sendSmsMessage } from "@/lib/sms/twilio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UserRole = "owner" | "barber" | "staff";

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

function redirectWithError(appointmentId: string, message: string): never {
  redirect(
    `/dashboard/bookings/${appointmentId}/edit?error=${encodeURIComponent(
      message,
    )}`,
  );
}

function getAppointmentEndTime(startsAt: string, durationMinutes: number) {
  const startDate = new Date(startsAt);
  const endDate = new Date(startDate);

  endDate.setMinutes(endDate.getMinutes() + durationMinutes);

  return endDate.toISOString();
}

function timeToMinutes(value: string) {
  const cleanValue = value.slice(0, 5);
  const [hours, minutes] = cleanValue.split(":").map(Number);

  return hours * 60 + minutes;
}

function getBucharestDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value || "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);

  const weekdayMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };

  return {
    dayOfWeek: weekdayMap[weekday] || 1,
    minutesFromMidnight: hour * 60 + minute,
  };
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

  const { data: message } = await params.supabase
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

  if (message?.id) {
    await sendSmsMessage(message.id);
  }
}

export async function updateAppointment(formData: FormData) {
  const appointmentId = cleanText(formData.get("appointmentId"));

  if (!appointmentId) {
    redirect("/dashboard/bookings?error=Rezervare invalidă.");
  }

  const { supabase, userId, organizationId, role, barberId: currentBarberId } =
    await getCurrentUserContext();

  const clientName = cleanText(formData.get("clientName"));
  const rawClientPhone = cleanText(formData.get("clientPhone"));
  const serviceId = cleanText(formData.get("serviceId"));
  const rawSubmittedBarberId = cleanText(formData.get("barberId"));
  const rawStartsAt = cleanText(formData.get("startsAt"));
  const notifyClient = cleanText(formData.get("notifyClient")) === "on";

  if (!clientName) {
    redirectWithError(appointmentId, "Completează numele clientului.");
  }

  if (!rawClientPhone) {
    redirectWithError(appointmentId, "Completează telefonul clientului.");
  }

  const phoneResult = normalizeRomanianPhone(rawClientPhone);

  if (!phoneResult.isValid) {
    redirectWithError(
      appointmentId,
      phoneResult.error || "Telefonul nu este valid.",
    );
  }

  if (!serviceId) {
    redirectWithError(appointmentId, "Alege serviciul.");
  }

  if (!rawStartsAt) {
    redirectWithError(appointmentId, "Alege data și ora.");
  }

  const parsedStartDate = new Date(rawStartsAt);

  if (Number.isNaN(parsedStartDate.getTime())) {
    redirectWithError(appointmentId, "Data și ora nu sunt valide.");
  }

  let appointmentQuery = supabase
    .from("appointments")
    .select("id, client_id, organization_id, status, barber_id")
    .eq("id", appointmentId)
    .eq("organization_id", organizationId);

  if (role === "barber") {
    if (!currentBarberId) {
      redirectWithError(appointmentId, "Cont frizer invalid.");
    }

    appointmentQuery = appointmentQuery.eq("barber_id", currentBarberId);
  }

  const { data: existingAppointment, error: appointmentError } =
    await appointmentQuery.single();

  if (appointmentError || !existingAppointment) {
    redirect(
      "/dashboard/bookings?error=Rezervarea nu a fost găsită sau nu ai acces la ea.",
    );
  }

  if (
    existingAppointment.status !== "pending" &&
    existingAppointment.status !== "confirmed"
  ) {
    redirectWithError(
      appointmentId,
      "Poți edita doar rezervări pending sau confirmate.",
    );
  }

  const finalBarberId =
    role === "barber" ? currentBarberId : rawSubmittedBarberId;

  if (!finalBarberId) {
    redirectWithError(appointmentId, "Alege frizerul.");
  }

  if (role === "barber" && finalBarberId !== existingAppointment.barber_id) {
    redirectWithError(
      appointmentId,
      "Nu poți muta rezervarea pe alt frizer.",
    );
  }

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", serviceId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (serviceError || !service) {
    redirectWithError(appointmentId, "Serviciul nu este valid.");
  }

  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("id, name")
    .eq("id", finalBarberId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (barberError || !barber) {
    redirectWithError(appointmentId, "Frizerul nu este valid.");
  }

  const startsAt = parsedStartDate.toISOString();
  const durationMinutes = Number(service.duration_minutes || 30);
  const endsAt = getAppointmentEndTime(startsAt, durationMinutes);

  const { dayOfWeek, minutesFromMidnight } =
    getBucharestDateParts(parsedStartDate);

  const { data: workingHour, error: workingHourError } = await supabase
    .from("working_hours")
    .select("is_open, start_time, end_time")
    .eq("organization_id", organizationId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (workingHourError) {
    redirectWithError(
      appointmentId,
      `Nu am putut verifica programul. Detalii: ${workingHourError.message}`,
    );
  }

  if (!workingHour || !workingHour.is_open) {
    redirectWithError(appointmentId, "Salonul este închis la ora aleasă.");
  }

  const salonStartMinutes = timeToMinutes(workingHour.start_time);
  const salonEndMinutes = timeToMinutes(workingHour.end_time);
  const appointmentEndMinutes = minutesFromMidnight + durationMinutes;

  if (
    minutesFromMidnight < salonStartMinutes ||
    appointmentEndMinutes > salonEndMinutes
  ) {
    redirectWithError(
      appointmentId,
      "Ora aleasă este în afara programului salonului.",
    );
  }

  const { data: overlappingAppointments, error: overlapError } = await supabase
    .from("appointments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("barber_id", finalBarberId)
    .in("status", ["pending", "confirmed"])
    .neq("id", appointmentId)
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);

  if (overlapError) {
    redirectWithError(
      appointmentId,
      `Nu am putut verifica disponibilitatea. Detalii: ${overlapError.message}`,
    );
  }

  if (overlappingAppointments && overlappingAppointments.length > 0) {
    redirectWithError(
      appointmentId,
      "Slotul ales este deja ocupat la acest frizer.",
    );
  }

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      name: clientName,
      phone: phoneResult.normalizedPhone,
    })
    .eq("id", existingAppointment.client_id);

  if (clientError) {
    redirectWithError(
      appointmentId,
      `Nu am putut actualiza clientul. Detalii: ${clientError.message}`,
    );
  }

  let updateQuery = supabase
    .from("appointments")
    .update({
      service_id: serviceId,
      barber_id: finalBarberId,
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .eq("id", appointmentId)
    .eq("organization_id", organizationId);

  if (role === "barber") {
    updateQuery = updateQuery.eq("barber_id", currentBarberId);
  }

  const { error: updateError } = await updateQuery;

  if (updateError) {
    redirectWithError(
      appointmentId,
      `Nu am putut actualiza rezervarea. Detalii: ${updateError.message}`,
    );
  }

  await createAppointmentEvent({
    supabase,
    appointmentId,
    userId,
    eventType: "updated",
    note:
      role === "barber"
        ? "Rezervarea a fost modificată de frizer."
        : "Rezervarea a fost modificată din dashboard.",
  });

  if (notifyClient && existingAppointment.status === "confirmed") {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single();

    await createSmsMessage({
      supabase,
      organizationId,
      clientId: existingAppointment.client_id,
      appointmentId,
      toPhone: phoneResult.normalizedPhone,
      body: `Salut, ${clientName}! Rezervarea ta la ${
        organization?.name || "salon"
      } a fost modificată: ${service.name}, la ${
        barber.name
      }, în ${formatAppointmentDate(startsAt)}.`,
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath(`/dashboard/bookings/${appointmentId}/edit`);

  redirect("/dashboard/bookings");
}