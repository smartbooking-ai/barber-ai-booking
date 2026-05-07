"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
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
    userId: user.id,
    organizationId: profile.organization_id,
  };
}

async function verifyClientBelongsToOrganization(
  clientId: string,
  organizationId: string,
) {
  const { supabase } = await getCurrentOrganization();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  return Boolean(appointment);
}

export async function revokeClientMarketing(formData: FormData) {
  const clientId = cleanText(formData.get("clientId"));

  if (!clientId) {
    redirect("/dashboard/clients?error=Client invalid.");
  }

  const { supabase, organizationId } = await getCurrentOrganization();

  const canAccess = await verifyClientBelongsToOrganization(
    clientId,
    organizationId,
  );

  if (!canAccess) {
    redirect("/dashboard/clients?error=Clientul nu aparține acestei frizerii.");
  }

  const { error } = await supabase
    .from("clients")
    .update({
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_source: null,
    })
    .eq("id", clientId);

  if (error) {
    redirect(
      `/dashboard/clients/${clientId}?error=${encodeURIComponent(
        `Nu am putut revoca marketingul. Detalii: ${error.message}`,
      )}`,
    );
  }

  await supabase.from("consent_logs").insert({
    organization_id: organizationId,
    client_id: clientId,
    type: "marketing_sms",
    status: "revoked",
    source: "dashboard",
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);

  redirect(`/dashboard/clients/${clientId}?success=Marketingul a fost revocat.`);
}

export async function anonymizeClient(formData: FormData) {
  const clientId = cleanText(formData.get("clientId"));

  if (!clientId) {
    redirect("/dashboard/clients?error=Client invalid.");
  }

  const { supabase, organizationId } = await getCurrentOrganization();

  const canAccess = await verifyClientBelongsToOrganization(
    clientId,
    organizationId,
  );

  if (!canAccess) {
    redirect("/dashboard/clients?error=Clientul nu aparține acestei frizerii.");
  }

  const nowIso = new Date().toISOString();

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      name: "Client anonimizat",
      phone: null,
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_source: null,
      anonymized_at: nowIso,
      deleted_at: nowIso,
    })
    .eq("id", clientId);

  if (clientError) {
    redirect(
      `/dashboard/clients/${clientId}?error=${encodeURIComponent(
        `Nu am putut anonimiza clientul. Detalii: ${clientError.message}`,
      )}`,
    );
  }

  await supabase
    .from("messages")
    .update({
      to_phone: null,
      body: "[mesaj anonimizat]",
      error_message: null,
    })
    .eq("client_id", clientId)
    .eq("organization_id", organizationId);

  await supabase.from("consent_logs").insert({
    organization_id: organizationId,
    client_id: clientId,
    type: "marketing_sms",
    status: "revoked",
    source: "dashboard",
  });

  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/bookings");

  redirect(`/dashboard/clients/${clientId}?success=Clientul a fost anonimizat.`);
}