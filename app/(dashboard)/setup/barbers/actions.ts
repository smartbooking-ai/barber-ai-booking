"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeRomanianPhone } from "@/lib/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getCurrentOrganizationContext() {
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
    redirect("/dashboard?error=Doar owner-ul poate administra frizerii.");
  }

  return {
    supabase,
    userId: user.id,
    organizationId: profile.organization_id,
  };
}

export async function addBarber(formData: FormData) {
  const { supabase, organizationId } = await getCurrentOrganizationContext();

  const barberName = cleanText(formData.get("barberName"));
  const rawBarberPhone = cleanText(formData.get("barberPhone"));
  const barberEmail = cleanEmail(formData.get("barberEmail"));

  if (!barberName) {
    redirect("/setup/barbers?error=Completează numele frizerului.");
  }

  const phoneResult = normalizeRomanianPhone(rawBarberPhone);

  if (!phoneResult.isValid) {
    redirect(
      `/setup/barbers?error=${encodeURIComponent(
        phoneResult.error || "Numărul de telefon nu este valid.",
      )}`,
    );
  }

  if (barberEmail && !isValidEmail(barberEmail)) {
    redirect("/setup/barbers?error=Emailul frizerului nu este valid.");
  }

  const { error } = await supabase.from("barbers").insert({
    organization_id: organizationId,
    name: barberName,
    phone: phoneResult.normalizedPhone,
    whatsapp_phone: phoneResult.normalizedPhone,
    email: barberEmail || null,
    is_active: true,
  });

  if (error) {
    redirect(
      `/setup/barbers?error=${encodeURIComponent(
        `Nu am putut adăuga frizerul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/setup/barbers");
  revalidatePath("/setup");
  revalidatePath("/dashboard");

  redirect("/setup/barbers");
}

export async function deleteBarber(formData: FormData) {
  const { supabase, organizationId } = await getCurrentOrganizationContext();

  const barberId = cleanText(formData.get("barberId"));

  if (!barberId) {
    redirect("/setup/barbers?error=Frizer invalid.");
  }

  const { error } = await supabase
    .from("barbers")
    .update({
      is_active: false,
    })
    .eq("id", barberId)
    .eq("organization_id", organizationId);

  if (error) {
    redirect(
      `/setup/barbers?error=${encodeURIComponent(
        `Nu am putut dezactiva frizerul. Detalii: ${error.message}`,
      )}`,
    );
  }

  await supabase
    .from("staff_invites")
    .update({
      status: "revoked",
    })
    .eq("barber_id", barberId)
    .eq("organization_id", organizationId)
    .eq("status", "pending");

  revalidatePath("/setup/barbers");
  revalidatePath("/setup");
  revalidatePath("/dashboard");

  redirect("/setup/barbers");
}

export async function createBarberInvite(formData: FormData) {
  const { supabase, userId, organizationId } =
    await getCurrentOrganizationContext();

  const barberId = cleanText(formData.get("barberId"));

  if (!barberId) {
    redirect("/setup/barbers?error=Frizer invalid.");
  }

  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("id, name, email, user_id")
    .eq("id", barberId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (barberError || !barber) {
    redirect("/setup/barbers?error=Frizerul nu a fost găsit.");
  }

  if (barber.user_id) {
    redirect("/setup/barbers?error=Frizerul are deja cont legat.");
  }

  const barberEmail = cleanEmail(barber.email);

  if (!barberEmail || !isValidEmail(barberEmail)) {
    redirect(
      "/setup/barbers?error=Frizerul trebuie să aibă email valid înainte de invitație.",
    );
  }

  await supabase
    .from("staff_invites")
    .update({
      status: "revoked",
    })
    .eq("organization_id", organizationId)
    .eq("email", barberEmail)
    .eq("status", "pending");

  const token = `${randomUUID()}-${randomUUID()}`;

  const { error: inviteError } = await supabase.from("staff_invites").insert({
    organization_id: organizationId,
    barber_id: barber.id,
    email: barberEmail,
    role: "barber",
    token,
    status: "pending",
    created_by: userId,
  });

  if (inviteError) {
    redirect(
      `/setup/barbers?error=${encodeURIComponent(
        `Nu am putut genera invitația. Detalii: ${inviteError.message}`,
      )}`,
    );
  }

  revalidatePath("/setup/barbers");

  redirect("/setup/barbers?success=Invitația a fost generată.");
}