import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

function isExpired(dateValue: string) {
  return new Date(dateValue).getTime() < Date.now();
}

function formatDate(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: invite } = await supabaseAdmin
    .from("staff_invites")
    .select(
      `
        id,
        email,
        role,
        status,
        expires_at,
        organization:organizations (
          name
        ),
        barber:barbers (
          name,
          user_id
        )
      `,
    )
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    notFound();
  }

  const organization = Array.isArray(invite.organization)
    ? invite.organization[0]
    : invite.organization;

  const barber = Array.isArray(invite.barber)
    ? invite.barber[0]
    : invite.barber;

  const inviteIsExpired = isExpired(invite.expires_at);
  const inviteIsUsable =
    invite.status === "pending" && !inviteIsExpired && !barber?.user_id;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
        <div className="rounded-[2rem] border border-stone-800 bg-stone-900 p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400 text-xl font-black text-stone-950">
            B
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Invitație frizer
          </p>

          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight">
            Intră în salon.
          </h1>

          <p className="mt-4 text-sm leading-6 text-stone-400">
            Ai fost invitat ca frizer în{" "}
            <span className="font-black text-stone-100">
              {organization?.name || "salon"}
            </span>
            .
          </p>

          <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-950 p-4">
            <p className="text-xs font-bold text-stone-500">Email invitație</p>

            <p className="mt-1 break-all text-sm font-black text-stone-100">
              {invite.email}
            </p>

            <p className="mt-4 text-xs font-bold text-stone-500">Frizer</p>

            <p className="mt-1 text-sm font-black text-stone-100">
              {barber?.name || "Frizer"}
            </p>

            <p className="mt-4 text-xs font-bold text-stone-500">Expiră</p>

            <p className="mt-1 text-sm font-black text-stone-100">
              {formatDate(invite.expires_at)}
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          {!inviteIsUsable ? (
            <div className="mt-5 rounded-3xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm font-black text-red-300">
                Invitația nu mai este disponibilă.
              </p>

              <p className="mt-2 text-xs leading-5 text-red-100/80">
                Poate fi expirată, acceptată deja sau revocată. Cere owner-ului
                salonului o invitație nouă.
              </p>

              <a
                href="/login"
                className="mt-4 flex w-full items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-4 text-center text-sm font-black text-red-200"
              >
                Mergi la login
              </a>
            </div>
          ) : (
            <form action="/api/accept-invite" method="post" className="mt-5">
              <input type="hidden" name="token" value={token} />

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="fullName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Numele tău
                  </label>

                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    defaultValue={barber?.name || ""}
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-bold text-stone-200"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={invite.email}
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Trebuie să fie același email ca în invitație.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-bold text-stone-200"
                  >
                    Parolă
                  </label>

                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="text-sm font-bold text-stone-200"
                  >
                    Confirmă parola
                  </label>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Creează cont frizer
              </button>
            </form>
          )}

          <a
            href="/login"
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Am deja cont
          </a>
        </div>
      </section>
    </main>
  );
}