import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveSalonDetails } from "./actions";

type SalonSetupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SalonSetupPage({
  searchParams,
}: SalonSetupPageProps) {
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
          name,
          slug,
          phone,
          whatsapp_phone,
          city,
          address
        )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate modifica datele salonului.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const hasPhone = Boolean(organization.phone);
  const hasName = Boolean(organization.name);
  const salonReady = hasName && hasPhone;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Date salon
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {organization.name || "Salon neconfigurat"}
            </p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Setup
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                Datele salonului.
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
            Aceste date apar în dashboard și pe pagina publică de rezervări.
          </p>

          <div
            className={`mt-6 rounded-3xl border p-4 ${
              salonReady
                ? "border-emerald-400/40 bg-emerald-400/10"
                : "border-amber-400/40 bg-amber-400/10"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p
                  className={`text-sm font-black ${
                    salonReady ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  Status salon
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-400">
                  {salonReady
                    ? "Datele principale sunt completate."
                    : "Completează numele și telefonul salonului."}
                </p>
              </div>

              <span
                className={`rounded-full px-4 py-3 text-sm font-black ${
                  salonReady
                    ? "bg-emerald-400 text-stone-950"
                    : "bg-amber-400 text-stone-950"
                }`}
              >
                {salonReady ? "OK" : "Setup"}
              </span>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          <form
            action={saveSalonDetails}
            className="mt-5 rounded-3xl border border-stone-800 bg-stone-900 p-4"
          >
            <p className="text-sm font-black">Informații salon</p>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="salonName"
                  className="text-sm font-bold text-stone-200"
                >
                  Nume salon
                </label>

                <input
                  id="salonName"
                  name="salonName"
                  type="text"
                  defaultValue={organization.name || ""}
                  placeholder="Frizeria Vasi"
                  className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="salonPhone"
                  className="text-sm font-bold text-stone-200"
                >
                  Telefon salon
                </label>

                <input
                  id="salonPhone"
                  name="salonPhone"
                  type="tel"
                  defaultValue={organization.phone || ""}
                  placeholder="07xx xxx xxx"
                  className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                />

                <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                  Apare pe pagina publică la butonul „Sună salonul”.
                </p>
              </div>

              <div>
                <label
                  htmlFor="whatsappPhone"
                  className="text-sm font-bold text-stone-200"
                >
                  Telefon WhatsApp / notificări
                </label>

                <input
                  id="whatsappPhone"
                  name="whatsappPhone"
                  type="tel"
                  defaultValue={
                    organization.whatsapp_phone || organization.phone || ""
                  }
                  placeholder="07xx xxx xxx"
                  className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                />

                <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                  Momentan folosim SMS pentru confirmări. Câmpul rămâne pregătit
                  pentru WhatsApp mai târziu.
                </p>
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="text-sm font-bold text-stone-200"
                >
                  Oraș
                </label>

                <input
                  id="city"
                  name="city"
                  type="text"
                  defaultValue={organization.city || ""}
                  placeholder="Timișoara"
                  className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="address"
                  className="text-sm font-bold text-stone-200"
                >
                  Adresă
                </label>

                <textarea
                  id="address"
                  name="address"
                  defaultValue={organization.address || ""}
                  placeholder="Strada, număr, zonă"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
            >
              Salvează datele salonului
            </button>
          </form>

          <div className="mt-4 grid gap-3">
            <a
              href={`/${organization.slug}`}
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Vezi pagina publică
            </a>

            <a
              href="/setup"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Înapoi la setup
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}