"use server";

import { redirect } from "next/navigation";
import { normalizeRomanianPhone } from "@/lib/phone";
import { sendSmsMessage } from "@/lib/sms/twilio";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function buildErrorUrl(salonSlug: string, message: string) {
  return `/${salonSlug}?error=${encodeURIComponent(message)}`;
}

function redirectWithError(salonSlug: string, message: string): never {
  redirect(buildErrorUrl(salonSlug, message));
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

async function saveClientGdprData(params: {
  organizationId: string;
  clientId: string;
  marketingConsent: boolean;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const consentTime = new Date().toISOString();

  await supabaseAdmin
    .from("clients")
    .update({
      marketing_consent: params.marketingConsent,
      marketing_consent_at: params.marketingConsent ? consentTime : null,
      marketing_consent_source: params.marketingConsent
        ? "public_booking"
        : null,
    })
    .eq("id", params.clientId);

  await supabaseAdmin.from("consent_logs").insert({
    organization_id: params.organizationId,
    client_id: params.clientId,
    type: "privacy_notice",
    status: "shown",
    source: "public_booking",
  });

  await supabaseAdmin.from("consent_logs").insert({
    organization_id: params.organizationId,
    client_id: params.clientId,
    type: "marketing_sms",
    status: params.marketingConsent ? "granted" : "revoked",
    source: "public_booking",
  });
}

async function createAndSendSmsMessage(params: {
  organizationId: string;
  clientId: string | null;
  appointmentId: string;
  toPhone: string | null;
  body: string;
  messageType: string;
}) {
  if (!params.toPhone) {
    return;
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: message } = await supabaseAdmin
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
      message_type: params.messageType,
    })
    .select("id")
    .single();

  if (message?.id) {
    await sendSmsMessage(message.id);
  }
}

export async function createPublicAppointment(formData: FormData) {
  const supabaseAdmin = createSupabaseAdminClient();

  const salonSlug = cleanText(formData.get("salonSlug"));
  const clientName = cleanText(formData.get("clientName"));
  const rawClientPhone = cleanText(formData.get("clientPhone"));
  const barberId = cleanText(formData.get("barberId"));
  const serviceId = cleanText(formData.get("serviceId"));
  const rawStartsAt = cleanText(formData.get("startsAt"));
  const marketingConsent = cleanText(formData.get("marketingConsent")) === "on";

  if (!salonSlug) {
    redirect("/");
  }

  if (!clientName) {
    redirectWithError(salonSlug, "Completează numele.");
  }

  if (!rawClientPhone) {
    redirectWithError(salonSlug, "Completează telefonul.");
  }

  const phoneResult = normalizeRomanianPhone(rawClientPhone);

  if (!phoneResult.isValid) {
    redirectWithError(
      salonSlug,
      phoneResult.error || "Telefonul nu este valid.",
    );
  }

  if (!serviceId) {
    redirectWithError(salonSlug, "Alege serviciul.");
  }

  if (!barberId) {
    redirectWithError(salonSlug, "Alege frizerul.");
  }

  if (!rawStartsAt) {
    redirectWithError(salonSlug, "Alege un slot liber.");
  }

  const parsedStartDate = new Date(rawStartsAt);

  if (Number.isNaN(parsedStartDate.getTime())) {
    redirectWithError(salonSlug, "Slotul ales nu este valid.");
  }

  const { data: organization, error: organizationError } = await supabaseAdmin
    .from("organizations")
    .select("id, name")
    .eq("slug", salonSlug)
    .single();

  if (organizationError || !organization) {
    redirectWithError(
      salonSlug,
      `Salonul nu a fost găsit. Detalii: ${
        organizationError?.message || "Nu există organizația."
      }`,
    );
  }

  const { data: service, error: serviceError } = await supabaseAdmin
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", serviceId)
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .single();

  if (serviceError || !service) {
    redirectWithError(
      salonSlug,
      `Serviciul nu este valid. Detalii: ${
        serviceError?.message || "Nu există serviciul."
      }`,
    );
  }

  const { data: barber, error: barberError } = await supabaseAdmin
    .from("barbers")
    .select("id, name, phone")
    .eq("id", barberId)
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .single();

  if (barberError || !barber) {
    redirectWithError(
      salonSlug,
      `Frizerul nu este valid. Detalii: ${
        barberError?.message || "Nu există frizerul."
      }`,
    );
  }

  const startsAt = parsedStartDate.toISOString();
  const serviceDuration = Number(service.duration_minutes || 30);
  const endsAt = getAppointmentEndTime(startsAt, serviceDuration);

  const { dayOfWeek, minutesFromMidnight } =
    getBucharestDateParts(parsedStartDate);

  const { data: workingHour, error: workingHourError } = await supabaseAdmin
    .from("working_hours")
    .select("is_open, start_time, end_time")
    .eq("organization_id", organization.id)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (workingHourError) {
    redirectWithError(
      salonSlug,
      `Nu am putut verifica programul salonului. Detalii: ${workingHourError.message}`,
    );
  }

  if (!workingHour || !workingHour.is_open) {
    redirectWithError(salonSlug, "Salonul este închis la ora aleasă.");
  }

  const appointmentEndMinutes = minutesFromMidnight + serviceDuration;
  const salonStartMinutes = timeToMinutes(workingHour.start_time);
  const salonEndMinutes = timeToMinutes(workingHour.end_time);

  if (
    minutesFromMidnight < salonStartMinutes ||
    appointmentEndMinutes > salonEndMinutes
  ) {
    redirectWithError(
      salonSlug,
      "Slotul ales este în afara programului salonului.",
    );
  }

  const { data: overlappingAppointments, error: overlapError } =
    await supabaseAdmin
      .from("appointments")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("barber_id", barber.id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", endsAt)
      .gt("ends_at", startsAt);

  if (overlapError) {
    redirectWithError(
      salonSlug,
      `Nu am putut verifica disponibilitatea. Detalii: ${overlapError.message}`,
    );
  }

  if (overlappingAppointments && overlappingAppointments.length > 0) {
    redirectWithError(
      salonSlug,
      "Slotul ales tocmai a fost ocupat. Alege altă oră.",
    );
  }

  const { data: existingClient, error: existingClientError } =
    await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("phone", phoneResult.normalizedPhone)
      .maybeSingle();

  if (existingClientError) {
    redirectWithError(
      salonSlug,
      `Nu am putut verifica clientul. Detalii: ${existingClientError.message}`,
    );
  }

  let clientId = existingClient?.id;

  if (clientId) {
    const { error: updateClientError } = await supabaseAdmin
      .from("clients")
      .update({
        name: clientName,
        phone: phoneResult.normalizedPhone,
      })
      .eq("id", clientId);

    if (updateClientError) {
      redirectWithError(
        salonSlug,
        `Nu am putut actualiza clientul. Detalii: ${updateClientError.message}`,
      );
    }
  } else {
    const { data: createdClient, error: createClientError } =
      await supabaseAdmin
        .from("clients")
        .insert({
          name: clientName,
          phone: phoneResult.normalizedPhone,
        })
        .select("id")
        .single();

    if (createClientError || !createdClient) {
      redirectWithError(
        salonSlug,
        `Nu am putut salva clientul. Detalii: ${
          createClientError?.message ||
          "Clientul nu a fost returnat după insert."
        }`,
      );
    }

    clientId = createdClient.id;
  }

  if (!clientId) {
    redirectWithError(
      salonSlug,
      "Nu am putut identifica clientul pentru rezervare.",
    );
  }

  const { data: createdAppointment, error: appointmentError } =
    await supabaseAdmin
      .from("appointments")
      .insert({
        organization_id: organization.id,
        client_id: clientId,
        barber_id: barber.id,
        service_id: service.id,
        starts_at: startsAt,
        ends_at: endsAt,
        status: "pending",
      })
      .select("id")
      .single();

  if (appointmentError || !createdAppointment) {
    redirectWithError(
      salonSlug,
      `Clientul a fost salvat, dar rezervarea nu s-a putut crea. Detalii: ${
        appointmentError?.message || "Rezervarea nu a fost returnată."
      }`,
    );
  }

  await saveClientGdprData({
    organizationId: organization.id,
    clientId,
    marketingConsent,
  });

  await createAndSendSmsMessage({
    organizationId: organization.id,
    clientId,
    appointmentId: createdAppointment.id,
    toPhone: barber.phone,
    messageType: "new_booking_pending_barber",
    body: `Salut, ${barber.name || "frizer"}! Ai o rezervare nouă pending la ${
      organization.name
    }: ${clientName}, ${service.name || "serviciu"}, ${formatAppointmentDate(
      startsAt,
    )}. Intră în dashboard ca să o accepți sau refuzi.`,
  });

  redirect(
    `/${salonSlug}?success=${encodeURIComponent(
      "Rezervarea a fost trimisă.",
    )}`,
  );
}