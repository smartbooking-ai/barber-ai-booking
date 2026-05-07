import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addService, deleteService } from "./actions";

type ServicesSetupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

type ServiceRow = {
  id: string;
  name: string | null;
  description: string | null;
  duration_minutes: number | null;
  price: number | string | null;
};

export default async function ServicesSetupPage({
  searchParams,
}: ServicesSetupPageProps) {
  const { error } = await searchParams;

  const supabase = await createSupabaseServerClient();

  // Verificăm utilizatorul autentificat.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Luăm profilul și organizația. Setup-ul este doar pentru owner.
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
    redirect("/dashboard?error=Doar owner-ul poate administra serviciile.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const activeServices = (services || []) as ServiceRow[];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Servicii și prețuri
            </p>
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
                Serviciile salonului.
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
            Serviciile apar pe pagina publică. Clientul alege serviciul, apoi
            frizerul și ora liberă.
          </p>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-amber-300">
                  Servicii active
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-400">
                  Aceste servicii sunt vizibile pe pagina publică de rezervări.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-4 py-3 text-sm font-black text-stone-950">
                {activeServices.length}
              </span>
            </div>
          </div>

          <details className="mt-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-black">Adaugă serviciu</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Nume, durată și preț pentru pagina publică.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-stone-950">
                +
              </span>
            </summary>

            <form action={addService} className="border-t border-stone-800 p-4">
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="serviceName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Nume serviciu
                  </label>

                  <input
                    id="serviceName"
                    name="serviceName"
                    type="text"
                    placeholder="Tuns"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="serviceDescription"
                    className="text-sm font-bold text-stone-200"
                  >
                    Descriere scurtă
                  </label>

                  <input
                    id="serviceDescription"
                    name="serviceDescription"
                    type="text"
                    placeholder="Opțional"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="serviceDuration"
                      className="text-sm font-bold text-stone-200"
                    >
                      Durată
                    </label>

                    <input
                      id="serviceDuration"
                      name="serviceDuration"
                      type="number"
                      min="5"
                      step="5"
                      defaultValue={30}
                      placeholder="30"
                      className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                    />

                    <p className="mt-2 px-1 text-xs font-bold text-stone-500">
                      minute
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="servicePrice"
                      className="text-sm font-bold text-stone-200"
                    >
                      Preț
                    </label>

                    <input
                      id="servicePrice"
                      name="servicePrice"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="50"
                      className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                    />

                    <p className="mt-2 px-1 text-xs font-bold text-stone-500">
                      lei
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Adaugă serviciu
              </button>
            </form>
          </details>

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black">Lista serviciilor</p>
                <p className="mt-1 text-xs text-stone-500">
                  Serviciile active din salon.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {activeServices.length}
              </span>
            </div>

            {activeServices.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm font-bold text-stone-300">
                  Nu ai adăugat servicii încă.
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Deschide formularul de mai sus și adaugă primul serviciu.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {activeServices.map((service) => (
                  <article
                    key={service.id}
                    className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-50">
                          {service.name || "Serviciu fără nume"}
                        </p>

                        {service.description ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">
                            {service.description}
                          </p>
                        ) : null}

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-300">
                            {service.duration_minutes || 0} min
                          </span>

                          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300">
                            {Number(service.price || 0).toFixed(0)} lei
                          </span>
                        </div>
                      </div>

                      <form action={deleteService} className="shrink-0">
                        <input
                          type="hidden"
                          name="serviceId"
                          value={service.id}
                        />

                        <button
                          type="submit"
                          className="rounded-2xl border border-red-500/40 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/10"
                        >
                          Dezactivează
                        </button>
                      </form>
                    </div>
                  </article>
                ))}
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