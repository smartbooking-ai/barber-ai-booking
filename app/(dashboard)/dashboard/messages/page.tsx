import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  archiveSmsMessage,
  deleteSmsMessage,
  retrySmsMessage,
  unarchiveSmsMessage,
} from "./actions";

type MessagesPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    status?: string;
  }>;
};

type MessageRow = {
  id: string;
  channel: string | null;
  direction: string | null;
  sender_type: string | null;
  from_phone: string | null;
  to_phone: string | null;
  body: string | null;
  status: string | null;
  provider: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  message_type: string | null;
  created_at: string | null;
  sent_at: string | null;
  archived_at: string | null;
  client:
    | {
        id: string;
        name: string | null;
        phone: string | null;
      }
    | {
        id: string;
        name: string | null;
        phone: string | null;
      }[]
    | null;
  appointment:
    | {
        id: string;
        starts_at: string | null;
      }
    | {
        id: string;
        starts_at: string | null;
      }[]
    | null;
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
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function getStatusLabel(status: string | null) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "sent") {
    return "Trimis";
  }

  if (status === "failed") {
    return "Eșuat";
  }

  return status || "Necunoscut";
}

function getStatusClasses(status: string | null) {
  if (status === "pending") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  }

  if (status === "sent") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "failed") {
    return "border-red-400/40 bg-red-500/10 text-red-300";
  }

  return "border-stone-700 bg-stone-900 text-stone-300";
}

function getMessageTypeLabel(type: string | null) {
  if (type === "reminder_24h") {
    return "Reminder 24h";
  }

  if (type === "reminder_2h") {
    return "Reminder 2h";
  }

  if (type === "new_booking_pending_barber") {
    return "Rezervare nouă frizer";
  }

  if (!type) {
    return "Tranzacțional";
  }

  return type;
}

function StatusFilter({
  href,
  label,
  value,
  active = false,
  tone = "default",
}: {
  href: string;
  label: string;
  value: number;
  active?: boolean;
  tone?: "default" | "amber" | "red" | "green" | "blue";
}) {
  const toneClasses = {
  default: active
    ? "border-stone-700 bg-stone-800 text-stone-200"
    : "border-stone-800 bg-stone-900 text-stone-300",

  amber: active
    ? "border-amber-400 bg-amber-400 text-stone-950"
    : "border-amber-400/40 bg-amber-400/10 text-amber-300",

  red: active
    ? "border-red-400 bg-red-500 text-white"
    : "border-red-400/40 bg-red-500/10 text-red-300",

  green: active
    ? "border-emerald-400 bg-emerald-400 text-stone-950"
    : "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",

  blue: active
    ? "border-sky-400 bg-sky-500 text-white"
    : "border-sky-400/40 bg-sky-500/10 text-sky-300",
};

  return (
    <a
      href={href}
      className={`min-w-[96px] rounded-2xl border p-3 transition active:scale-[0.98] ${toneClasses[tone]}`}
    >
      <p className="text-[11px] font-bold">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </a>
  );
}

function MessageCard({
  message,
  selectedStatus,
}: {
  message: MessageRow;
  selectedStatus: string;
}) {
  const client = getSingleRelation(message.client);
  const appointment = getSingleRelation(message.appointment);

  const isArchived = Boolean(message.archived_at);
  const canRetry =
    !isArchived && (message.status === "failed" || message.status === "pending");

  return (
    <article className="rounded-3xl border border-stone-800 bg-stone-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">
            {client?.name || "Client necunoscut"}
          </p>

          <p className="mt-1 truncate text-xs font-bold text-amber-300">
            {message.to_phone || client?.phone || "Telefon lipsă"}
          </p>

          <p className="mt-2 text-xs text-stone-500">
            Creat: {formatDateTime(message.created_at)}
          </p>
        </div>

        <div className="shrink-0 space-y-2 text-right">
          <span
            className={`inline-flex rounded-full border px-3 py-2 text-[11px] font-black ${getStatusClasses(
              message.status,
            )}`}
          >
            {getStatusLabel(message.status)}
          </span>

          {isArchived ? (
            <p className="text-[11px] font-black text-stone-500">Arhivat</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-stone-800 bg-stone-900 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-stone-500">
            {getMessageTypeLabel(message.message_type)}
          </p>

          <p className="text-xs font-bold text-stone-500">
            {message.provider || "provider nesetat"}
          </p>
        </div>

        <p className="mt-3 text-xs leading-5 text-stone-300">
          {message.body || "Mesaj gol"}
        </p>
      </div>

      {message.error_message ? (
        <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3">
          <p className="text-xs font-black text-red-300">Eroare</p>
          <p className="mt-1 text-xs leading-5 text-red-100/80">
            {message.error_message}
          </p>
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-3">
          <p className="font-bold text-stone-500">Trimis la</p>
          <p className="mt-1 font-black text-stone-200">
            {formatDateTime(message.sent_at)}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-3">
          <p className="font-bold text-stone-500">Rezervare</p>
          <p className="mt-1 font-black text-stone-200">
            {appointment?.starts_at
              ? formatDateTime(appointment.starts_at)
              : "Nesetată"}
          </p>
        </div>
      </div>

      {message.provider_message_id ? (
        <p className="mt-3 break-all rounded-2xl border border-stone-800 bg-stone-900 p-3 text-xs leading-5 text-stone-500">
          Twilio ID: {message.provider_message_id}
        </p>
      ) : null}

      <div className="mt-3 grid gap-2">
        {canRetry ? (
          <form action={retrySmsMessage}>
            <input type="hidden" name="messageId" value={message.id} />

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black text-stone-950"
            >
              Retrimite SMS
            </button>
          </form>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {isArchived ? (
            <form action={unarchiveSmsMessage}>
              <input type="hidden" name="messageId" value={message.id} />

              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-xs font-black text-emerald-300"
              >
                Restaurează
              </button>
            </form>
          ) : (
            <form action={archiveSmsMessage}>
              <input type="hidden" name="messageId" value={message.id} />

              <button
                type="submit"
                className="flex w-full items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 px-4 py-3 text-xs font-black text-stone-300"
              >
                Arhivează
              </button>
            </form>
          )}

          <form action={deleteSmsMessage}>
            <input type="hidden" name="messageId" value={message.id} />
            <input type="hidden" name="returnStatus" value={selectedStatus} />

            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-xs font-black text-red-300"
            >
              Șterge
            </button>
          </form>
        </div>
      </div>
    </article>
  );
}

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const { error, success, status } = await searchParams;

  const selectedStatus = status || "problems";

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
        role,
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

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate accesa SMS-urile.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const [
    { count: pendingCount },
    { count: failedCount },
    { count: sentCount },
    { count: archivedCount },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("channel", "sms")
      .eq("status", "pending")
      .is("archived_at", null),

    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("channel", "sms")
      .eq("status", "failed")
      .is("archived_at", null),

    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("channel", "sms")
      .eq("status", "sent")
      .is("archived_at", null),

    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("channel", "sms")
      .not("archived_at", "is", null),
  ]);

  let messagesQuery = supabase
    .from("messages")
    .select(
      `
        id,
        channel,
        direction,
        sender_type,
        from_phone,
        to_phone,
        body,
        status,
        provider,
        provider_message_id,
        error_message,
        message_type,
        created_at,
        sent_at,
        archived_at,
        client:clients (
          id,
          name,
          phone
        ),
        appointment:appointments (
          id,
          starts_at
        )
      `,
    )
    .eq("organization_id", organization.id)
    .eq("channel", "sms")
    .order("created_at", { ascending: false })
    .limit(10);

  if (selectedStatus === "archived") {
    messagesQuery = messagesQuery.not("archived_at", "is", null);
  } else {
    messagesQuery = messagesQuery.is("archived_at", null);
  }

  if (selectedStatus === "problems") {
    messagesQuery = messagesQuery.in("status", ["pending", "failed"]);
  }

  if (selectedStatus === "pending") {
    messagesQuery = messagesQuery.eq("status", "pending");
  }

  if (selectedStatus === "failed") {
    messagesQuery = messagesQuery.eq("status", "failed");
  }

  if (selectedStatus === "sent") {
    messagesQuery = messagesQuery.eq("status", "sent");
  }

  const { data: messagesData } = await messagesQuery;

  const messages = (messagesData || []) as MessageRow[];

  const problemsCount = (pendingCount ?? 0) + (failedCount ?? 0);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">SMS-uri</p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Mesaje
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                SMS-uri.
              </h1>
            </div>

            <a
              href="/dashboard"
              className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-xs font-black text-stone-300"
            >
              Dashboard
            </a>
          </div>

          <p className="mt-3 text-sm leading-6 text-stone-400">
            Default vezi doar ultimele 10 probleme active. Mesajele arhivate nu
            apar aici decât în filtrul Arhivate.
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

          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            <StatusFilter
  href="/dashboard/messages?status=problems"
  label="Probleme"
  value={problemsCount}
  active={selectedStatus === "problems"}
  tone="red"
/>

            <StatusFilter
              href="/dashboard/messages?status=pending"
              label="Pending"
              value={pendingCount ?? 0}
              active={selectedStatus === "pending"}
              tone="amber"
            />

            

            <StatusFilter
              href="/dashboard/messages?status=sent"
              label="Sent"
              value={sentCount ?? 0}
              active={selectedStatus === "sent"}
              tone="green"
            />

            <StatusFilter
  href="/dashboard/messages?status=archived"
  label="Arhivate"
  value={archivedCount ?? 0}
  active={selectedStatus === "archived"}
  tone="blue"
/>
          </div>

          {(failedCount ?? 0) > 0 ? (
  <form action="/api/archive-failed-messages" method="post" className="mt-4">
    <button
      type="submit"
      className="flex w-full items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-black text-red-300"
    >
      Arhivează toate eșuate
    </button>
  </form>
) : null}

          <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black">Lista SMS</p>
                <p className="mt-1 text-xs text-stone-500">
                  Se afișează maximum 10 mesaje pentru filtrul ales.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {messages.length}
              </span>
            </div>

            {messages.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm font-bold text-stone-300">
                  Nu există SMS-uri pentru filtrul ales.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {messages.map((message) => (
                  <MessageCard
                    key={message.id}
                    message={message}
                    selectedStatus={selectedStatus}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}