import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addBarber, deleteBarber } from "./actions";

type BarbersSetupPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type BarberRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  user_id: string | null;
};

type InviteRow = {
  id: string;
  barber_id: string | null;
  email: string;
  token: string;
  status: string;
  expires_at: string;
  created_at: string;
};

function getInviteLink(origin: string, token: string) {
  return `${origin}/invite/${token}`;
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function BarberStatusBadge({
  barber,
  invite,
}: {
  barber: BarberRow;
  invite: InviteRow | undefined;
}) {
  if (barber.user_id) {
    return (
      <span className="shrink-0 rounded-full bg-emerald-400 px-3 py-2 text-xs font-black text-stone-950">
        Cont legat
      </span>
    );
  }

  if (invite) {
    return (
      <span className="shrink-0 rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-stone-950">
        Invitat
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-300">
      Fără cont
    </span>
  );
}

export default async function BarbersSetupPage({
  searchParams,
}: BarbersSetupPageProps) {
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
    redirect("/dashboard?error=Doar owner-ul poate administra frizerii.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const [{ data: barbersData }, { data: invitesData }] = await Promise.all([
    supabase
      .from("barbers")
      .select("id, name, phone, email, user_id")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),

    supabase
      .from("staff_invites")
      .select("id, barber_id, email, token, status, expires_at, created_at")
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const activeBarbers = (barbersData || []) as BarberRow[];
  const pendingInvites = (invitesData || []) as InviteRow[];

  const linkedBarbersCount = activeBarbers.filter(
    (barber) => barber.user_id,
  ).length;

  const invitedBarbersCount = activeBarbers.filter((barber) =>
    pendingInvites.some((invite) => invite.barber_id === barber.id),
  ).length;

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">Frizeri</p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Setup
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                Frizerii salonului.
              </h1>
            </div>

            <a
              href="/setup"
              className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-xs font-black text-stone-300"
            >
              Setup
            </a>
          </div>

          <p className="mt-3 text-sm leading-6 text-stone-400">
            Adaugi frizeri, le pui email și generezi invitații pentru conturile
            lor.
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

          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-stone-800 bg-stone-900 p-3">
              <p className="text-[11px] font-bold text-stone-500">Activi</p>
              <p className="mt-2 text-2xl font-black text-stone-50">
                {activeBarbers.length}
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-3">
              <p className="text-[11px] font-bold text-emerald-300">Conturi</p>
              <p className="mt-2 text-2xl font-black text-emerald-300">
                {linkedBarbersCount}
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3">
              <p className="text-[11px] font-bold text-amber-300">Invitați</p>
              <p className="mt-2 text-2xl font-black text-amber-300">
                {invitedBarbersCount}
              </p>
            </div>
          </div>

          <details className="mt-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-black">Adaugă frizer</p>
                <p className="mt-1 text-xs text-stone-500">
                  Nume, telefon și email pentru invitație.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-stone-950">
                +
              </span>
            </summary>

            <form action={addBarber} className="border-t border-stone-800 p-4">
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor="barberName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Nume frizer
                  </label>

                  <input
                    id="barberName"
                    name="barberName"
                    type="text"
                    placeholder="Vasi"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="barberPhone"
                    className="text-sm font-bold text-stone-200"
                  >
                    Telefon frizer
                  </label>

                  <input
                    id="barberPhone"
                    name="barberPhone"
                    type="tel"
                    placeholder="07xx xxx xxx"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Pe acest număr primește SMS când apare o rezervare nouă.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="barberEmail"
                    className="text-sm font-bold text-stone-200"
                  >
                    Email frizer
                  </label>

                  <input
                    id="barberEmail"
                    name="barberEmail"
                    type="email"
                    placeholder="frizer@email.com"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Pe acest email se creează contul frizerului prin invitație.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Adaugă frizer
              </button>
            </form>
          </details>

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black">Frizeri activi</p>
                <p className="mt-1 text-xs text-stone-500">
                  Linkul de invitație apare sub frizer după generare.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {activeBarbers.length}
              </span>
            </div>

            {activeBarbers.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm font-bold text-stone-300">
                  Nu ai adăugat frizeri încă.
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Deschide formularul de mai sus și adaugă primul frizer.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {activeBarbers.map((barber) => {
                  const invite = pendingInvites.find(
                    (item) => item.barber_id === barber.id,
                  );

                  const inviteLink = invite
                    ? getInviteLink(origin, invite.token)
                    : "";

                  return (
                    <article
                      key={barber.id}
                      className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-stone-50">
                            {barber.name || "Frizer fără nume"}
                          </p>

                          <p className="mt-1 truncate text-xs text-stone-500">
                            {barber.phone || "Fără telefon"}
                          </p>

                          <p className="mt-1 truncate text-xs text-stone-500">
                            {barber.email || "Fără email"}
                          </p>
                        </div>

                        <BarberStatusBadge barber={barber} invite={invite} />
                      </div>

                      {invite ? (
                        <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3">
                          <p className="text-xs font-black text-amber-300">
                            Link invitație
                          </p>

                          <p className="mt-2 break-all text-xs leading-5 text-amber-100/80">
                            {inviteLink}
                          </p>

                          <p className="mt-2 text-xs text-stone-500">
                            Expiră: {formatDate(invite.expires_at)}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {!barber.user_id ? (
                          <form
                            action="/api/create-barber-invite"
                            method="post"
                          >
                            <input
                              type="hidden"
                              name="barberId"
                              value={barber.id}
                            />

                            <button
                              type="submit"
                              disabled={!barber.email}
                              className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-3 py-3 text-xs font-black text-stone-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Generează invitație
                            </button>
                          </form>
                        ) : (
                          <div className="flex w-full items-center justify-center rounded-2xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-3 text-xs font-black text-emerald-300">
                            Activ
                          </div>
                        )}

                        <form action={deleteBarber}>
                          <input
                            type="hidden"
                            name="barberId"
                            value={barber.id}
                          />

                          <button
                            type="submit"
                            className="flex w-full items-center justify-center rounded-2xl border border-red-500/40 px-3 py-3 text-xs font-black text-red-300 transition hover:bg-red-500/10"
                          >
                            Dezactivează
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <a
              href="/setup"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la setup
            </a>

            <a
              href="/dashboard"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la dashboard
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}