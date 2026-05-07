import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type OrganizationRow = {
  id: string;
  name: string | null;
  data_retention_months: number | null;
};

type AppointmentRow = {
  id: string;
  organization_id: string;
  client_id: string | null;
  starts_at: string;
};

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  anonymized_at: string | null;
  deleted_at: string | null;
};

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const secretFromQuery = request.nextUrl.searchParams.get("secret");
  const authorizationHeader = request.headers.get("authorization");

  if (secretFromQuery === cronSecret) {
    return true;
  }

  if (authorizationHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return false;
}

function subtractMonths(date: Date, months: number) {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() - months);

  return nextDate;
}

function normalizeRetentionMonths(value: number | null) {
  if (!value || Number.isNaN(value)) {
    return 24;
  }

  if (value < 1) {
    return 1;
  }

  if (value > 120) {
    return 120;
  }

  return value;
}

async function getOrganizations() {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, data_retention_months")
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false,
      error: error.message,
      organizations: [] as OrganizationRow[],
    };
  }

  return {
    ok: true,
    error: null,
    organizations: (data || []) as OrganizationRow[],
  };
}

async function getOldAppointmentClientIds(params: {
  organizationId: string;
  cutoffIso: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id, organization_id, client_id, starts_at")
    .eq("organization_id", params.organizationId)
    .lt("starts_at", params.cutoffIso)
    .not("client_id", "is", null);

  if (error) {
    return {
      ok: false,
      error: error.message,
      clientIds: [] as string[],
    };
  }

  const appointments = (data || []) as AppointmentRow[];

  const clientIds = Array.from(
    new Set(
      appointments
        .map((appointment) => appointment.client_id)
        .filter((clientId): clientId is string => Boolean(clientId)),
    ),
  );

  return {
    ok: true,
    error: null,
    clientIds,
  };
}

async function clientHasRecentOrFutureAppointments(params: {
  organizationId: string;
  clientId: string;
  cutoffIso: string;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("client_id", params.clientId)
    .gte("starts_at", params.cutoffIso)
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message,
      hasRecentOrFuture: true,
    };
  }

  return {
    ok: true,
    error: null,
    hasRecentOrFuture: Boolean(data),
  };
}

async function getClient(params: { clientId: string }) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, phone, anonymized_at, deleted_at")
    .eq("id", params.clientId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: error.message,
      client: null as ClientRow | null,
    };
  }

  return {
    ok: true,
    error: null,
    client: data as ClientRow | null,
  };
}

async function anonymizeClient(params: {
  organizationId: string;
  clientId: string;
  dryRun: boolean;
}) {
  const supabaseAdmin = createSupabaseAdminClient();

  const nowIso = new Date().toISOString();

  if (params.dryRun) {
    return {
      ok: true,
      anonymized: false,
      dryRun: true,
      error: null,
    };
  }

  const { error: clientError } = await supabaseAdmin
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
    .eq("id", params.clientId);

  if (clientError) {
    return {
      ok: false,
      anonymized: false,
      dryRun: false,
      error: clientError.message,
    };
  }

  await supabaseAdmin
    .from("messages")
    .update({
      to_phone: null,
      body: "[mesaj anonimizat]",
      error_message: null,
    })
    .eq("client_id", params.clientId)
    .eq("organization_id", params.organizationId);

  await supabaseAdmin.from("consent_logs").insert({
    organization_id: params.organizationId,
    client_id: params.clientId,
    type: "marketing_sms",
    status: "revoked",
    source: "retention_cron",
  });

  return {
    ok: true,
    anonymized: true,
    dryRun: false,
    error: null,
  };
}

async function processOrganization(params: {
  organization: OrganizationRow;
  dryRun: boolean;
}) {
  const retentionMonths = normalizeRetentionMonths(
    params.organization.data_retention_months,
  );

  const cutoffDate = subtractMonths(new Date(), retentionMonths);
  const cutoffIso = cutoffDate.toISOString();

  const oldClientIdsResult = await getOldAppointmentClientIds({
    organizationId: params.organization.id,
    cutoffIso,
  });

  if (!oldClientIdsResult.ok) {
    return {
      organizationId: params.organization.id,
      organizationName: params.organization.name,
      ok: false,
      error: oldClientIdsResult.error,
      retentionMonths,
      cutoffIso,
      checkedClients: 0,
      eligibleClients: 0,
      anonymizedClients: 0,
      skippedClients: 0,
      dryRun: params.dryRun,
    };
  }

  let checkedClients = 0;
  let eligibleClients = 0;
  let anonymizedClients = 0;
  let skippedClients = 0;
  const errors: string[] = [];

  for (const clientId of oldClientIdsResult.clientIds) {
    checkedClients += 1;

    const clientResult = await getClient({ clientId });

    if (!clientResult.ok || !clientResult.client) {
      skippedClients += 1;

      if (clientResult.error) {
        errors.push(`Client ${clientId}: ${clientResult.error}`);
      }

      continue;
    }

    if (clientResult.client.anonymized_at || clientResult.client.deleted_at) {
      skippedClients += 1;
      continue;
    }

    const recentCheck = await clientHasRecentOrFutureAppointments({
      organizationId: params.organization.id,
      clientId,
      cutoffIso,
    });

    if (!recentCheck.ok) {
      skippedClients += 1;
      errors.push(`Client ${clientId}: ${recentCheck.error}`);
      continue;
    }

    if (recentCheck.hasRecentOrFuture) {
      skippedClients += 1;
      continue;
    }

    eligibleClients += 1;

    const anonymizeResult = await anonymizeClient({
      organizationId: params.organization.id,
      clientId,
      dryRun: params.dryRun,
    });

    if (!anonymizeResult.ok) {
      skippedClients += 1;
      errors.push(`Client ${clientId}: ${anonymizeResult.error}`);
      continue;
    }

    if (anonymizeResult.anonymized || params.dryRun) {
      anonymizedClients += 1;
    }
  }

  return {
    organizationId: params.organization.id,
    organizationName: params.organization.name,
    ok: errors.length === 0,
    errors,
    retentionMonths,
    cutoffIso,
    checkedClients,
    eligibleClients,
    anonymizedClients,
    skippedClients,
    dryRun: params.dryRun,
  };
}

async function handleRetentionRequest(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";

  const organizationsResult = await getOrganizations();

  if (!organizationsResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: organizationsResult.error,
      },
      {
        status: 500,
      },
    );
  }

  const results = [];

  for (const organization of organizationsResult.organizations) {
    const result = await processOrganization({
      organization,
      dryRun,
    });

    results.push(result);
  }

  const totalCheckedClients = results.reduce(
    (sum, result) => sum + result.checkedClients,
    0,
  );

  const totalEligibleClients = results.reduce(
    (sum, result) => sum + result.eligibleClients,
    0,
  );

  const totalAnonymizedClients = results.reduce(
    (sum, result) => sum + result.anonymizedClients,
    0,
  );

  return NextResponse.json({
    ok: true,
    dryRun,
    ran_at: new Date().toISOString(),
    totals: {
      organizations: results.length,
      checkedClients: totalCheckedClients,
      eligibleClients: totalEligibleClients,
      anonymizedClients: totalAnonymizedClients,
    },
    results,
  });
}

export async function GET(request: NextRequest) {
  return handleRetentionRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRetentionRequest(request);
}