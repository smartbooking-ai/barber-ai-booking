"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanDuration(value: FormDataEntryValue | null) {
  const numberValue = Number(value || 0);

  if (Number.isNaN(numberValue) || numberValue <= 0) {
    return 30;
  }

  return numberValue;
}

function cleanPrice(value: FormDataEntryValue | null) {
  const rawValue = String(value || "").replace(",", ".").trim();
  const numberValue = Number(rawValue);

  if (Number.isNaN(numberValue) || numberValue < 0) {
    return 0;
  }

  return numberValue;
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
    redirect("/dashboard?error=Doar owner-ul poate administra serviciile.");
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  };
}

export async function addService(formData: FormData) {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const serviceName = cleanText(formData.get("serviceName"));
  const serviceDescription = cleanText(formData.get("serviceDescription"));
  const durationMinutes = cleanDuration(formData.get("serviceDuration"));
  const price = cleanPrice(formData.get("servicePrice"));

  if (!serviceName) {
    redirect("/setup/services?error=Completează numele serviciului.");
  }

  if (durationMinutes < 5) {
    redirect("/setup/services?error=Durata trebuie să fie minim 5 minute.");
  }

  const { error } = await supabase.from("services").insert({
    organization_id: organizationId,
    name: serviceName,
    description: serviceDescription,
    duration_minutes: durationMinutes,
    price,
    is_active: true,
  });

  if (error) {
    redirect(
      `/setup/services?error=${encodeURIComponent(
        `Nu am putut adăuga serviciul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/setup/services");
  revalidatePath("/setup");
  revalidatePath("/dashboard");

  redirect("/setup/services");
}

export async function deleteService(formData: FormData) {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const serviceId = cleanText(formData.get("serviceId"));

  if (!serviceId) {
    redirect("/setup/services?error=Serviciu invalid.");
  }

  const { error } = await supabase
    .from("services")
    .update({
      is_active: false,
    })
    .eq("id", serviceId)
    .eq("organization_id", organizationId);

  if (error) {
    redirect(
      `/setup/services?error=${encodeURIComponent(
        `Nu am putut dezactiva serviciul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/setup/services");
  revalidatePath("/setup");
  revalidatePath("/dashboard");

  redirect("/setup/services");
}