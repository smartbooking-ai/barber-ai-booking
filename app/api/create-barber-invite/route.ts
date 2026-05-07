import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function cleanEmail(value: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getAppOrigin(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";

  const normalizedHost = host.startsWith("0.0.0.0")
    ? host.replace("0.0.0.0", "localhost")
    : host;

  const protocol = normalizedHost.includes("localhost") ? "http" : "https";

  return `${protocol}://${normalizedHost}`;
}

function redirectToBarbers(request: NextRequest, params?: { error?: string; success?: string }) {
  const url = new URL("/setup/barbers", getAppOrigin(request));

  if (params?.error) {
    url.searchParams.set("error", params.error);
  }

  if (params?.success) {
    url.searchParams.set("success", params.success);
  }

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    ok: true,
    route: "/api/create-barber-invite",
    origin: getAppOrigin(request),
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const barberId = cleanText(formData.get("barberId"));

  if (!barberId) {
    return redirectToBarbers(request, {
      error: "Frizer invalid.",
    });
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", getAppOrigin(request)));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return NextResponse.redirect(new URL("/login", getAppOrigin(request)));
  }

  if (profile.role !== "owner") {
    return redirectToBarbers(request, {
      error: "Doar owner-ul poate genera invitații.",
    });
  }

  const organizationId = profile.organization_id;

  const { data: barber, error: barberError } = await supabase
    .from("barbers")
    .select("id, name, email, user_id")
    .eq("id", barberId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .single();

  if (barberError || !barber) {
    return redirectToBarbers(request, {
      error: "Frizerul nu a fost găsit.",
    });
  }

  if (barber.user_id) {
    return redirectToBarbers(request, {
      error: "Frizerul are deja cont legat.",
    });
  }

  const barberEmail = cleanEmail(barber.email);

  if (!barberEmail || !isValidEmail(barberEmail)) {
    return redirectToBarbers(request, {
      error: "Frizerul trebuie să aibă email valid înainte de invitație.",
    });
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
    created_by: user.id,
  });

  if (inviteError) {
    return redirectToBarbers(request, {
      error: `Nu am putut genera invitația. Detalii: ${inviteError.message}`,
    });
  }

  return redirectToBarbers(request, {
    success: "Invitația a fost generată.",
  });
}