"use server";

import { redirect } from "next/navigation";
import { normalizeRomanianPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

async function getOwnerOrganizationContext() {
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

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate modifica datele salonului.");
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  };
}

export async function saveSalonDetails(formData: FormData) {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const salonName = cleanText(formData.get("salonName"));
  const rawSalonPhone = cleanText(formData.get("salonPhone"));
  const rawWhatsappPhone = cleanText(formData.get("whatsappPhone"));
  const city = cleanText(formData.get("city"));
  const address = cleanText(formData.get("address"));

  if (!salonName) {
    redirect("/setup/salon?error=Completează numele salonului.");
  }

  if (!rawSalonPhone) {
    redirect("/setup/salon?error=Completează telefonul salonului.");
  }

  const salonPhoneResult = normalizeRomanianPhone(rawSalonPhone);

  if (!salonPhoneResult.isValid) {
    redirect(
      `/setup/salon?error=${encodeURIComponent(
        salonPhoneResult.error || "Telefonul salonului nu este valid.",
      )}`,
    );
  }

  const whatsappPhoneResult = rawWhatsappPhone
    ? normalizeRomanianPhone(rawWhatsappPhone)
    : salonPhoneResult;

  if (!whatsappPhoneResult.isValid) {
    redirect(
      `/setup/salon?error=${encodeURIComponent(
        whatsappPhoneResult.error || "Numărul de WhatsApp nu este valid.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: salonName,
      phone: salonPhoneResult.normalizedPhone,
      whatsapp_phone: whatsappPhoneResult.normalizedPhone,
      city,
      address,
    })
    .eq("id", organizationId);

  if (error) {
    redirect(
      `/setup/salon?error=${encodeURIComponent(
        `Nu am putut salva datele salonului. Detalii: ${error.message}`,
      )}`,
    );
  }

  redirect("/setup");
}