"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanRetentionMonths(value: FormDataEntryValue | null) {
  const numberValue = Number(value || 24);

  if (Number.isNaN(numberValue)) {
    return 24;
  }

  if (numberValue < 1) {
    return 1;
  }

  if (numberValue > 120) {
    return 120;
  }

  return numberValue;
}

function redirectWithError(message: string): never {
  redirect(`/dashboard/settings/privacy?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(
    `/dashboard/settings/privacy?success=${encodeURIComponent(message)}`,
  );
}

async function getOwnerOrganizationContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate modifica setările GDPR.");
  }

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
  };
}

export async function savePrivacySettings(formData: FormData) {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const privacyContactEmail = cleanText(formData.get("privacyContactEmail"));
  const privacyContactPhone = cleanText(formData.get("privacyContactPhone"));
  const dataRetentionMonths = cleanRetentionMonths(
    formData.get("dataRetentionMonths"),
  );
  const marketingSmsEnabled =
    cleanText(formData.get("marketingSmsEnabled")) === "on";
  const privacyPolicyText = cleanText(formData.get("privacyPolicyText"));
  const termsText = cleanText(formData.get("termsText"));

  if (!privacyContactEmail) {
    redirectWithError("Completează emailul de contact GDPR.");
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      privacy_contact_email: privacyContactEmail,
      privacy_contact_phone: privacyContactPhone || null,
      data_retention_months: dataRetentionMonths,
      marketing_sms_enabled: marketingSmsEnabled,
      privacy_policy_text: privacyPolicyText || null,
      terms_text: termsText || null,
    })
    .eq("id", organizationId);

  if (error) {
    redirectWithError(
      `Nu am putut salva setările GDPR. Detalii: ${error.message}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/privacy");

  redirectWithSuccess("Setările GDPR au fost salvate.");
}

export async function acceptDpa() {
  const { supabase, userId, organizationId } =
    await getOwnerOrganizationContext();

  const { error } = await supabase
    .from("organizations")
    .update({
      dpa_accepted_at: new Date().toISOString(),
      dpa_accepted_by: userId,
    })
    .eq("id", organizationId);

  if (error) {
    redirectWithError(
      `Nu am putut marca DPA ca acceptat. Detalii: ${error.message}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings/privacy");

  redirectWithSuccess("DPA a fost acceptat.");
}