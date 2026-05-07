"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function redirectWithError(token: string, message: string): never {
  redirect(`/invite/${token}?error=${encodeURIComponent(message)}`);
}

function isExpired(dateValue: string) {
  return new Date(dateValue).getTime() < Date.now();
}

export async function acceptBarberInvite(formData: FormData) {
  const token = cleanText(formData.get("token"));
  const fullName = cleanText(formData.get("fullName"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const confirmPassword = cleanText(formData.get("confirmPassword"));

  if (!token) {
    redirect("/login");
  }

  if (!fullName) {
    redirectWithError(token, "Completează numele.");
  }

  if (!email) {
    redirectWithError(token, "Completează emailul.");
  }

  if (!password || password.length < 6) {
    redirectWithError(token, "Parola trebuie să aibă minim 6 caractere.");
  }

  if (password !== confirmPassword) {
    redirectWithError(token, "Parolele nu coincid.");
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: invite, error: inviteError } = await supabaseAdmin
    .from("staff_invites")
    .select(
      `
        id,
        organization_id,
        barber_id,
        email,
        role,
        token,
        status,
        expires_at,
        organization:organizations (
          name
        ),
        barber:barbers (
          id,
          name,
          user_id
        )
      `,
    )
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite) {
    redirectWithError(token, "Invitația nu există.");
  }

  if (invite.status !== "pending") {
    redirectWithError(token, "Invitația nu mai este activă.");
  }

  if (isExpired(invite.expires_at)) {
    await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "expired",
      })
      .eq("id", invite.id);

    redirectWithError(token, "Invitația a expirat.");
  }

  if (invite.email.toLowerCase() !== email) {
    redirectWithError(
      token,
      "Emailul introdus trebuie să fie același cu emailul invitației.",
    );
  }

  const barberRelation = Array.isArray(invite.barber)
    ? invite.barber[0]
    : invite.barber;

  if (barberRelation?.user_id) {
    redirectWithError(token, "Acest frizer are deja cont legat.");
  }

  const supabase = await createSupabaseServerClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });

  if (signUpError || !signUpData.user) {
    redirectWithError(
      token,
      signUpError?.message || "Nu am putut crea contul.",
    );
  }

  const userId = signUpData.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    organization_id: invite.organization_id,
    role: "barber",
  });

  if (profileError) {
    redirectWithError(
      token,
      `Contul a fost creat, dar profilul nu a putut fi legat. Detalii: ${profileError.message}`,
    );
  }

  const { error: barberUpdateError } = await supabaseAdmin
    .from("barbers")
    .update({
      user_id: userId,
      email,
      name: fullName,
    })
    .eq("id", invite.barber_id)
    .eq("organization_id", invite.organization_id);

  if (barberUpdateError) {
    redirectWithError(
      token,
      `Contul a fost creat, dar frizerul nu a putut fi legat. Detalii: ${barberUpdateError.message}`,
    );
  }

  const { error: inviteUpdateError } = await supabaseAdmin
    .from("staff_invites")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by: userId,
    })
    .eq("id", invite.id);

  if (inviteUpdateError) {
    redirectWithError(
      token,
      `Contul a fost creat, dar invitația nu a putut fi închisă. Detalii: ${inviteUpdateError.message}`,
    );
  }

  redirect("/login?success=Contul de frizer a fost creat. Te poți autentifica.");
}