import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ExportRouteProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export async function GET(_request: Request, { params }: ExportRouteProps) {
  const { clientId } = await params;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Neautentificat.",
      },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    return NextResponse.json(
      {
        error: "Profil invalid.",
      },
      { status: 403 },
    );
  }

  const organizationId = profile.organization_id;

  const { data: allowedAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle();

  if (!allowedAppointment) {
    return NextResponse.json(
      {
        error: "Clientul nu aparține acestei frizerii.",
      },
      { status: 403 },
    );
  }

  const [
    { data: client },
    { data: appointments },
    { data: messages },
    { data: consentLogs },
  ] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).single(),

    supabase
      .from("appointments")
      .select("*")
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .order("starts_at", { ascending: false }),

    supabase
      .from("messages")
      .select("*")
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),

    supabase
      .from("consent_logs")
      .select("*")
      .eq("client_id", clientId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  const exportData = {
    exported_at: new Date().toISOString(),
    organization_id: organizationId,
    client,
    appointments: appointments || [],
    messages: messages || [],
    consent_logs: consentLogs || [],
  };

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="client-${clientId}-export.json"`,
    },
  });
}