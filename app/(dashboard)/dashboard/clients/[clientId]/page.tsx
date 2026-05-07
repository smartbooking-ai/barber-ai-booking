import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { anonymizeClient, revokeClientMarketing } from "./actions";

type ClientDetailsPageProps = {
  params: Promise<{
    clientId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  service:
    | {
        name: string | null;
        price: number | string | null;
      }
    | {
        name: string | null;
        price: number | string | null;
      }[]
    | null;
  barber:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type MessageRow = {
  id: string;
  channel: string | null;
  status: string | null;
  body: string | null;
  created_at: string | null;
  sent_at: string | null;
};

type ConsentLogRow = {
  id: string;
  type: string;
  status: string;
  source: string;
  created_at: string;
};

function getSingleRelation<T>(relation: T | T[] | null): T | null {
  if (!relation) {
    return null;
  }

  if (Array.isArray(relation)) {
    return relation[0] || null;
  }

  return relation;
}

function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Necunoscut";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function getStatusLabel(status: string | null) {
  if (status === "pending") {
    return "În așteptare";
  }

  if (status === "confirmed") {
    return "Confirmată";
  }

  if (status === "cancelled") {
    return "Anulată";
  }

  if (status === "completed") {
    return "Finalizată";
  }

  if (status === "no_show") {
    return "No-show";
  }

  if (status === "sent") {
    return "Trimis";
  }

  if (status === "failed") {
    return "Eșuat";
  }

  return status || "Necunoscut";
}

export default async function ClientDetailsPage({
  params,
  searchParams,
}: ClientDetailsPageProps) {
  const { clientId } = await params;
  const { error, success } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
        organization:organizations (
          id,
          name
        )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization) {
    redirect("/login");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const { data: allowedAppointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("client_id", clientId)
    .eq("organization_id", organization.id)
    .limit(1)
    .maybeSingle();

  if (!allowedAppointment) {
    redirect("/dashboard/clients");
  }

  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select(
      "id, name, phone, marketing_consent, marketing_consent_at, marketing_consent_source, created_at, anonymized_at, deleted_at",
    )
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    redirect("/dashboard/clients");
  }

  const [{ data: appointmentsData }, { data: messagesData }, { data: consentLogsData }] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          `
            id,
            starts_at,
            ends_at,
            status,
            service:services (
              name,
              price
            ),
            barber:barbers (
              name
            )
          `,
        )
        .eq("client_id", clientId)
        .eq("organization_id", organization.id)
        .order("starts_at", { ascending: false }),

      supabase
        .from("messages")
        .select("id, channel, status, body, created_at, sent_at")
        .eq("client_id", clientId)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),

      supabase
        .from("consent_logs")
        .select("id, type, status, source, created_at")
        .eq("client_id", clientId)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false }),
    ]);

  const appointments = (appointmentsData || []) as AppointmentRow[];
  const messages = (messagesData || []) as MessageRow[];
  const consentLogs = (consentLogsData || []) as ConsentLogRow[];

  const isAnonymized = Boolean(client.anonymized_at);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Detalii client
            </p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Client
          </p>

          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight">
            {client.name || "Client fără nume"}
          </h1>

          <p className="mt-4 text-sm leading-6 text-stone-400">
            Date client, rezervări, SMS-uri și acțiuni GDPR.
          </p>

          {success ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-bold text-emerald-300">{success}</p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          <div className="mt-7 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black">Date personale</p>

                <p className="mt-3 text-sm font-bold text-stone-300">
                  {client.phone || "Telefon șters"}
                </p>

                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Creat: {formatDateTime(client.created_at)}
                </p>

                {client.anonymized_at ? (
                  <p className="mt-2 text-xs leading-5 text-red-300">
                    Anonimizat: {formatDateTime(client.anonymized_at)}
                  </p>
                ) : null}
              </div>

              <span
                className={`rounded-full px-3 py-2 text-xs font-black ${
                  isAnonymized
                    ? "bg-stone-700 text-stone-300"
                    : client.marketing_consent
                      ? "bg-emerald-400 text-stone-950"
                      : "bg-amber-400 text-stone-950"
                }`}
              >
                {isAnonymized
                  ? "Anonimizat"
                  : client.marketing_consent
                    ? "Marketing OK"
                    : "Fără marketing"}
              </span>
            </div>
          </div>

          {!isAnonymized ? (
            <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
              <p className="text-sm font-black">Acțiuni client</p>

              <div className="mt-4 grid gap-3">
                <a
                  href={`/dashboard/clients/${client.id}/edit`}
                  className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 transition hover:bg-amber-300"
                >
                  Editează clientul
                </a>

                <a
                  href={`/dashboard/clients/${client.id}/export`}
                  className="flex w-full items-center justify-center rounded-2xl border border-stone-700 bg-stone-950 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
                >
                  Exportă date client
                </a>

                <form action={revokeClientMarketing}>
                  <input type="hidden" name="clientId" value={client.id} />

                  <button
                    type="submit"
                    disabled={!client.marketing_consent}
                    className="flex w-full items-center justify-center rounded-2xl border border-stone-700 bg-stone-950 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Revocă marketing
                  </button>
                </form>

                <details className="overflow-hidden rounded-2xl border border-red-500/40 bg-red-500/10">
                  <summary className="cursor-pointer list-none p-4 text-sm font-black text-red-300">
                    Anonimizează client
                  </summary>

                  <form
                    action={anonymizeClient}
                    className="border-t border-red-500/30 p-4"
                  >
                    <input type="hidden" name="clientId" value={client.id} />

                    <p className="text-xs leading-5 text-red-100/80">
                      Această acțiune șterge numele, telefonul și datele de
                      marketing. Rezervările rămân pentru statistici, dar nu mai
                      identifică persoana.
                    </p>

                    <button
                      type="submit"
                      className="mt-4 flex w-full items-center justify-center rounded-2xl bg-red-500 px-6 py-4 text-center text-sm font-black text-white transition hover:bg-red-400"
                    >
                      Confirmă anonimizarea
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black">Rezervări client</p>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {appointments.length}
              </span>
            </div>

            {appointments.length === 0 ? (
              <p className="mt-4 text-sm font-bold text-stone-500">
                Nu există rezervări.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {appointments.map((appointment) => {
                  const service = getSingleRelation(appointment.service);
                  const barber = getSingleRelation(appointment.barber);

                  return (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black">
                            {formatDateTime(appointment.starts_at)}
                          </p>

                          <p className="mt-1 text-xs leading-5 text-stone-500">
                            {service?.name || "Serviciu nesetat"} ·{" "}
                            {barber?.name || "Frizer nesetat"}
                          </p>
                        </div>

                        <span className="rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-300">
                          {getStatusLabel(appointment.status)}
                        </span>
                      </div>

                      {service?.price ? (
                        <p className="mt-3 text-right text-sm font-black text-amber-300">
                          {Number(service.price).toFixed(0)} lei
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <details className="mt-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-black">SMS-uri</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Confirmări, anulări și notificări.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {messages.length}
              </span>
            </summary>

            <div className="border-t border-stone-800 p-4">
              {messages.length === 0 ? (
                <p className="text-sm font-bold text-stone-500">
                  Nu există SMS-uri.
                </p>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase text-amber-300">
                          {message.channel || "sms"}
                        </p>

                        <span className="rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-300">
                          {getStatusLabel(message.status)}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-5 text-stone-400">
                        {message.body || "Mesaj gol"}
                      </p>

                      <p className="mt-3 text-xs text-stone-600">
                        Creat: {formatDateTime(message.created_at)}
                      </p>

                      {message.sent_at ? (
                        <p className="mt-1 text-xs text-stone-600">
                          Trimis: {formatDateTime(message.sent_at)}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <details className="mt-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-black">Consimțăminte</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Privacy notice și marketing SMS.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {consentLogs.length}
              </span>
            </summary>

            <div className="border-t border-stone-800 p-4">
              {consentLogs.length === 0 ? (
                <p className="text-sm font-bold text-stone-500">
                  Nu există consimțăminte.
                </p>
              ) : (
                <div className="space-y-3">
                  {consentLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-black">{log.type}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            Sursă: {log.source}
                          </p>
                        </div>

                        <span className="rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-300">
                          {log.status}
                        </span>
                      </div>

                      <p className="mt-3 text-xs text-stone-600">
                        {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          <div className="mt-4 grid gap-3">
            <a
              href="/dashboard/clients"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la clienți
            </a>

            <a
              href="/dashboard"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi în dashboard
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}