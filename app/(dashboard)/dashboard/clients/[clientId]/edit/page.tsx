import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateClient } from "./actions";

type EditClientPageProps = {
  params: Promise<{
    clientId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

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

export default async function EditClientPage({
  params,
  searchParams,
}: EditClientPageProps) {
  const { clientId } = await params;
  const { error } = await searchParams;

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
      "id, name, phone, marketing_consent, marketing_consent_at, marketing_consent_source, created_at, anonymized_at",
    )
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    redirect("/dashboard/clients");
  }

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
              Editează client
            </p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Client
          </p>

          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight">
            Date client.
          </h1>

          <p className="mt-4 text-sm leading-6 text-stone-400">
            Modifică numele, telefonul și acordul pentru marketing SMS.
          </p>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          {isAnonymized ? (
            <div className="mt-7 rounded-3xl border border-red-500/40 bg-red-500/10 p-4">
              <p className="text-sm font-black text-red-300">
                Client anonimizat
              </p>

              <p className="mt-2 text-xs leading-5 text-red-100/80">
                Acest client a fost anonimizat la{" "}
                {formatDateTime(client.anonymized_at)} și nu mai poate fi
                editat.
              </p>

              <a
                href={`/dashboard/clients/${client.id}`}
                className="mt-4 flex w-full items-center justify-center rounded-2xl border border-red-500/40 bg-red-500/10 px-6 py-4 text-center text-sm font-black text-red-200"
              >
                Înapoi la client
              </a>
            </div>
          ) : (
            <form
              action={updateClient}
              className="mt-7 rounded-3xl border border-stone-800 bg-stone-900 p-4"
            >
              <input type="hidden" name="clientId" value={client.id} />

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="clientName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Nume client
                  </label>

                  <input
                    id="clientName"
                    name="clientName"
                    type="text"
                    defaultValue={client.name || ""}
                    placeholder="Andrei Popescu"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="clientPhone"
                    className="text-sm font-bold text-stone-200"
                  >
                    Telefon client
                  </label>

                  <input
                    id="clientPhone"
                    name="clientPhone"
                    type="tel"
                    defaultValue={client.phone || ""}
                    placeholder="0722 123 456"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Acceptăm 0722..., +40722... sau 0040722...
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                  <input
                    name="marketingConsent"
                    type="checkbox"
                    defaultChecked={Boolean(client.marketing_consent)}
                    className="mt-1 h-5 w-5 shrink-0 accent-amber-400"
                  />

                  <span>
                    <span className="block text-sm font-black text-stone-100">
                      Marketing SMS permis
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-stone-500">
                      Clientul poate primi mesaje promoționale doar dacă există
                      acord. SMS-urile de rezervare rămân tranzacționale.
                    </span>
                  </span>
                </label>

                <div className="rounded-2xl border border-stone-800 bg-stone-950 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-stone-500">
                    Info
                  </p>

                  <p className="mt-2 text-xs leading-5 text-stone-400">
                    Creat: {formatDateTime(client.created_at)}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-stone-400">
                    Marketing source:{" "}
                    {client.marketing_consent_source || "nesetat"}
                  </p>

                  <p className="mt-1 text-xs leading-5 text-stone-400">
                    Marketing setat la:{" "}
                    {formatDateTime(client.marketing_consent_at)}
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Salvează clientul
              </button>
            </form>
          )}

          <div className="mt-4 grid gap-3">
            <a
              href={`/dashboard/clients/${client.id}`}
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la client
            </a>

            <a
              href="/dashboard/clients"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la clienți
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}