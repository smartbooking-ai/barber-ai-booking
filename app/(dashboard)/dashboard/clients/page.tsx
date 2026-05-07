import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type ClientRow = {
  id: string;
  name: string | null;
  phone: string | null;
  marketing_consent: boolean | null;
  anonymized_at: string | null;
  created_at: string | null;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Necunoscut";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { q } = await searchParams;
  const searchQuery = String(q || "").trim();

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

  let clientsQuery = supabase
    .from("clients")
    .select("id, name, phone, marketing_consent, anonymized_at, created_at")
    .order("created_at", { ascending: false });

  if (searchQuery) {
    clientsQuery = clientsQuery.or(
      `name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`,
    );
  }

  const { data: clientsData } = await clientsQuery;

  const clients = (clientsData || []) as ClientRow[];

  const activeClients = clients.filter((client) => !client.anonymized_at);
  const anonymizedClients = clients.filter((client) => client.anonymized_at);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">Clienți</p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            CRM
          </p>

          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight">
            Clienții salonului.
          </h1>

          <p className="mt-4 text-sm leading-6 text-stone-400">
            Vezi clienții, istoricul rezervărilor, SMS-urile și acțiunile GDPR.
          </p>

          <form className="mt-7">
            <input
              name="q"
              defaultValue={searchQuery}
              placeholder="Caută după nume sau telefon"
              className="w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
            />
          </form>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
              <p className="text-xs font-bold text-stone-500">Activi</p>
              <p className="mt-3 text-4xl font-black">{activeClients.length}</p>
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
              <p className="text-xs font-bold text-stone-500">Anonimizați</p>
              <p className="mt-3 text-4xl font-black">
                {anonymizedClients.length}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-black">Lista clienți</p>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {clients.length}
              </span>
            </div>

            {clients.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm font-bold text-stone-300">
                  Nu există clienți încă.
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Când cineva face o rezervare publică, apare aici.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {clients.map((client) => (
                  <a
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className="block rounded-2xl border border-stone-800 bg-stone-950 p-4 transition hover:border-amber-400"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {client.name || "Client fără nume"}
                        </p>

                        <p className="mt-1 truncate text-xs font-bold text-stone-500">
                          {client.phone || "Telefon șters"}
                        </p>

                        <p className="mt-2 text-xs text-stone-600">
                          Creat: {formatDate(client.created_at)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {client.anonymized_at ? (
                          <span className="rounded-full border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-black text-stone-400">
                            Anonimizat
                          </span>
                        ) : client.marketing_consent ? (
                          <span className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-black text-stone-950">
                            Marketing
                          </span>
                        ) : (
                          <span className="rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-400">
                            Fără marketing
                          </span>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <a
            href="/dashboard"
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Înapoi în dashboard
          </a>
        </div>
      </section>
    </main>
  );
}