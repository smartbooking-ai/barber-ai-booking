import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SetupCardProps = {
  href: string;
  title: string;
  description: string;
  badge: string;
  tone?: "default" | "amber" | "green" | "red" | "blue";
};

function SetupCard({
  href,
  title,
  description,
  badge,
  tone = "default",
}: SetupCardProps) {
  const toneClasses = {
    default: "border-stone-800 bg-stone-900 text-stone-300",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    green: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    red: "border-red-400/40 bg-red-500/10 text-red-300",
    blue: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  };

  return (
    <a
      href={href}
      className="block rounded-3xl border border-stone-800 bg-stone-900 p-4 transition active:scale-[0.99] hover:border-amber-400/60"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-base font-black text-stone-50">{title}</p>

          <p className="mt-1 text-xs leading-5 text-stone-500">
            {description}
          </p>
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black ${toneClasses[tone]}`}
        >
          {badge}
        </span>
      </div>
    </a>
  );
}

function isSalonReady(organization: {
  name: string | null;
  phone: string | null;
}) {
  return Boolean(organization.name && organization.phone);
}

export default async function SetupPage() {
  const supabase = await createSupabaseServerClient();

  // Verificăm utilizatorul autentificat.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Luăm organizația și rolul. Setup-ul este doar pentru owner.
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
          privacy_contact_email,
          dpa_accepted_at
        )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate accesa setup-ul salonului.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  // Calculăm rapid starea setup-ului.
  const [
    { count: barbersCount },
    { count: linkedBarbersCount },
    { count: servicesCount },
    { count: openDaysCount },
  ] = await Promise.all([
    supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),

    supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .not("user_id", "is", null),

    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),

    supabase
      .from("working_hours")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_open", true),
  ]);

  const salonReady = isSalonReady(organization);
  const gdprReady = Boolean(
    organization.privacy_contact_email && organization.dpa_accepted_at,
  );

  const hasBarbers = (barbersCount ?? 0) > 0;
  const hasServices = (servicesCount ?? 0) > 0;
  const hasSchedule = (openDaysCount ?? 0) > 0;

  const completedSteps = [
    salonReady,
    hasBarbers,
    hasServices,
    hasSchedule,
    gdprReady,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Setup salon
            </p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Configurare
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                Setările salonului.
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
            Configurează datele salonului, frizerii, serviciile, programul și
            setările GDPR.
          </p>

          <div className="mt-6 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-amber-300">
                  Progres setup
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-400">
                  {completedSteps} din 5 zone configurate.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-4 py-3 text-sm font-black text-stone-950">
                {completedSteps}/5
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <SetupCard
              href="/setup/salon"
              title="Date salon"
              description="Nume, telefon, oraș și adresă."
              badge={salonReady ? "OK" : "Lipsește"}
              tone={salonReady ? "green" : "amber"}
            />

            <SetupCard
              href="/setup/barbers"
              title="Frizeri"
              description="Adaugă frizeri și generează invitații pentru conturi."
              badge={`${linkedBarbersCount ?? 0}/${barbersCount ?? 0}`}
              tone={hasBarbers ? "green" : "amber"}
            />

            <SetupCard
              href="/setup/services"
              title="Servicii"
              description="Servicii, durată și prețuri afișate pe pagina publică."
              badge={String(servicesCount ?? 0)}
              tone={hasServices ? "green" : "amber"}
            />

            <SetupCard
              href="/setup/schedule"
              title="Program"
              description="Zile deschise și intervale de lucru."
              badge={`${openDaysCount ?? 0} zile`}
              tone={hasSchedule ? "green" : "amber"}
            />

            <SetupCard
              href="/dashboard/settings/privacy"
              title="GDPR & Privacy"
              description="Email GDPR, retenție date, DPA și texte legale."
              badge={gdprReady ? "OK" : "Setup"}
              tone={gdprReady ? "green" : "blue"}
            />
          </div>

          <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-sm font-black">Pagina publică</p>

            <p className="mt-2 text-xs leading-5 text-stone-500">
              Linkul pentru clienți, disponibil după ce ai servicii, frizeri și
              program.
            </p>

            <a
              href={`/${organization.slug}`}
              className="mt-4 flex w-full items-center justify-center rounded-2xl bg-stone-950 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:text-amber-300"
            >
              Deschide pagina publică
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}