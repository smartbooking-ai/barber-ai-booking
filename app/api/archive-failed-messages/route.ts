import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function getAppOrigin(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";

  const normalizedHost = host.startsWith("0.0.0.0")
    ? host.replace("0.0.0.0", "localhost")
    : host;

  const protocol = normalizedHost.includes("localhost") ? "http" : "https";

  return `${protocol}://${normalizedHost}`;
}

function redirectToMessages(
  request: NextRequest,
  params?: {
    error?: string;
    success?: string;
  },
) {
  const url = new URL("/dashboard/messages", getAppOrigin(request));

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
    route: "/api/archive-failed-messages",
    origin: getAppOrigin(request),
  });
}

export async function POST(request: NextRequest) {
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
    return redirectToMessages(request, {
      error: "Doar owner-ul poate administra SMS-urile.",
    });
  }

  const { error } = await supabase
    .from("messages")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("organization_id", profile.organization_id)
    .eq("channel", "sms")
    .eq("status", "failed")
    .is("archived_at", null);

  if (error) {
    return redirectToMessages(request, {
      error: `Nu am putut arhiva mesajele eșuate. Detalii: ${error.message}`,
    });
  }

  return redirectToMessages(request, {
    success: "Mesajele eșuate au fost arhivate.",
  });
}