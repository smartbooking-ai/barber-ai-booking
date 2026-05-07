import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: FormDataEntryValue | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isExpired(dateValue: string) {
  return new Date(dateValue).getTime() < Date.now();
}

function redirectWithError(request: NextRequest, token: string, message: string) {
  return NextResponse.redirect(
    new URL(`/invite/${token}?error=${encodeURIComponent(message)}`, request.url),
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;

  const formData = await request.formData();

  const fullName = cleanText(formData.get("fullName"));
  const email = cleanEmail(formData.get("email"));
  const password = cleanText(formData.get("password"));
  const confirmPassword = cleanText(formData.get("confirmPassword"));

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!fullName) {
    return redirectWithError(request, token, "Completează numele.");
  }

  if (!email) {
    return redirectWithError(request, token, "Completează emailul.");
  }

  if (!password || password.length < 6) {
    return redirectWithError(
      request,
      token,
      "Parola trebuie să aibă minim 6 caractere.",
    );
  }

  if (password !== confirmPassword) {
    return redirectWithError(request, token, "Parolele nu coincid.");
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
    return redirectWithError(request, token, "Invitația nu există.");
  }

  if (invite.status !== "pending") {
    return redirectWithError(request, token, "Invitația nu mai este activă.");
  }

  if (isExpired(invite.expires_at)) {
    await supabaseAdmin
      .from("staff_invites")
      .update({
        status: "expired",
      })
      .eq("id", invite.id);

    return redirectWithError(request, token, "Invitația a expirat.");
  }

  if (invite.email.toLowerCase() !== email) {
    return redirectWithError(
      request,
      token,
      "Emailul introdus trebuie să fie același cu emailul invitației.",
    );
  }

  const barberRelation = Array.isArray(invite.barber)
    ? invite.barber[0]
    : invite.barber;

  if (barberRelation?.user_id) {
    return redirectWithError(
      request,
      token,
      "Acest frizer are deja cont legat.",
    );
  }

  const { data: createdUserData, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (createUserError || !createdUserData.user) {
    return redirectWithError(
      request,
      token,
      createUserError?.message || "Nu am putut crea contul.",
    );
  }

  const userId = createdUserData.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    full_name: fullName,
    organization_id: invite.organization_id,
    role: "barber",
  });

  if (profileError) {
    return redirectWithError(
      request,
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
    return redirectWithError(
      request,
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
    return redirectWithError(
      request,
      token,
      `Contul a fost creat, dar invitația nu a putut fi închisă. Detalii: ${inviteUpdateError.message}`,
    );
  }

  return NextResponse.redirect(
    new URL(
      "/login?success=Contul de frizer a fost creat. Te poți autentifica.",
      request.url,
    ),
  );
}