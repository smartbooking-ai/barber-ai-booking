"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeRomanianPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function redirectWithError(clientId: string, message: string): never {
  redirect(
    `/dashboard/clients/${clientId}/edit?error=${encodeURIComponent(message)}`,
  );
}

async function getCurrentOrganization() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/login");
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  };
}

async function verifyClientBelongsToOrganization(params: {
  clientId: string;
  organizationId: string;
}) {
  const { supabase } = await getCurrentOrganization();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", params.clientId)
    .eq("organization_id", params.organizationId)
    .limit(1)
    .maybeSingle();

  return Boolean(appointment);
}

export async function updateClient(formData: FormData) {
  const clientId = cleanText(formData.get("clientId"));
  const clientName = cleanText(formData.get("clientName"));
  const rawClientPhone = cleanText(formData.get("clientPhone"));
  const marketingConsent = cleanText(formData.get("marketingConsent")) === "on";

  if (!clientId) {
    redirect("/dashboard/clients?error=Client invalid.");
  }

  if (!clientName) {
    redirectWithError(clientId, "Completează numele clientului.");
  }

  if (!rawClientPhone) {
    redirectWithError(clientId, "Completează telefonul clientului.");
  }

  const phoneResult = normalizeRomanianPhone(rawClientPhone);

  if (!phoneResult.isValid) {
    redirectWithError(
      clientId,
      phoneResult.error || "Telefonul clientului nu este valid.",
    );
  }

  const { supabase, organizationId } = await getCurrentOrganization();

  const canAccess = await verifyClientBelongsToOrganization({
    clientId,
    organizationId,
  });

  if (!canAccess) {
    redirect("/dashboard/clients?error=Clientul nu aparține acestei frizerii.");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, marketing_consent, anonymized_at")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    redirect("/dashboard/clients?error=Clientul nu a fost găsit.");
  }

  if (client.anonymized_at) {
    redirectWithError(clientId, "Clientul anonimizat nu mai poate fi editat.");
  }

  const marketingWasChanged =
    Boolean(client.marketing_consent) !== marketingConsent;

  const { error: updateError } = await supabase
    .from("clients")
    .update({
      name: clientName,
      phone: phoneResult.normalizedPhone,
      marketing_consent: marketingConsent,
      marketing_consent_at: marketingConsent ? new Date().toISOString() : null,
      marketing_consent_source: marketingConsent ? "dashboard" : null,
    })
    .eq("id", clientId);

  if (updateError) {
    redirectWithError(
      clientId,
      `Nu am putut actualiza clientul. Detalii: ${updateError.message}`,
    );
  }

  if (marketingWasChanged) {
    await supabase.from("consent_logs").insert({
      organization_id: organizationId,
      client_id: clientId,
      type: "marketing_sms",
      status: marketingConsent ? "granted" : "revoked",
      source: "dashboard",
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath(`/dashboard/clients/${clientId}/edit`);
  revalidatePath("/dashboard/bookings");

  redirect(`/dashboard/clients/${clientId}?success=Clientul a fost actualizat.`);
}