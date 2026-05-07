import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import PublicBookingClient from "./PublicBookingClient";

type PublicSalonPageProps = {
  params: Promise<{
    salonSlug: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
};

type BarberRow = {
  id: string;
  name: string;
};

type WorkingHourRow = {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
};

type AppointmentRow = {
  barber_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

function formatPhoneHref(phone: string | null) {
  if (!phone) {
    return "";
  }

  return `tel:${phone.replace(/\s+/g, "")}`;
}

export default async function PublicSalonPage({
  params,
  searchParams,
}: PublicSalonPageProps) {
  const { salonSlug } = await params;
  const { error, success } = await searchParams;

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: organization } = await supabaseAdmin
    .from("organizations")
    .select(
      "id, name, slug, phone, privacy_contact_email, privacy_policy_text, terms_text",
    )
    .eq("slug", salonSlug)
    .single();

  if (!organization) {
    notFound();
  }

  const now = new Date();
  const maxDate = new Date();

  maxDate.setDate(now.getDate() + 21);

  const [
    { data: servicesData },
    { data: barbersData },
    { data: workingHoursData },
    { data: appointmentsData },
  ] = await Promise.all([
    supabaseAdmin
      .from("services")
      .select("id, name, description, duration_minutes, price")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("barbers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),

    supabaseAdmin
      .from("working_hours")
      .select("day_of_week, is_open, start_time, end_time")
      .eq("organization_id", organization.id)
      .order("day_of_week", { ascending: true }),

    supabaseAdmin
      .from("appointments")
      .select("barber_id, starts_at, ends_at, status")
      .eq("organization_id", organization.id)
      .gte("starts_at", now.toISOString())
      .lte("starts_at", maxDate.toISOString())
      .in("status", ["pending", "confirmed"]),
  ]);

  const services = (servicesData || []) as ServiceRow[];
  const barbers = (barbersData || []) as BarberRow[];
  const workingHours = (workingHoursData || []) as WorkingHourRow[];
  const appointments = (appointmentsData || []) as AppointmentRow[];

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="rounded-[2rem] border border-stone-800 bg-stone-900/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
              {organization.name.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-base font-black">
                {organization.name}
              </p>

              <p className="mt-1 text-xs font-bold text-stone-500">
                Rezervări online
              </p>
            </div>
          </div>

          {organization.phone ? (
            <a
              href={formatPhoneHref(organization.phone)}
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-xs font-black text-stone-200"
            >
              Sună salonul
            </a>
          ) : null}
        </header>

        {success ? (
          <div className="mt-4 rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-4">
            <p className="text-sm font-black text-emerald-300">
              Rezervarea a fost trimisă
            </p>

            <p className="mt-2 text-xs leading-5 text-emerald-100/80">
              Salonul o va verifica și vei primi SMS când este confirmată.
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-3xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="text-sm font-black text-red-300">
              Nu am putut trimite rezervarea
            </p>

            <p className="mt-2 text-xs leading-5 text-red-100/80">{error}</p>
          </div>
        ) : null}

        {services.length === 0 || barbers.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-4">
            <p className="text-sm font-black text-amber-300">
              Rezervările nu sunt disponibile încă
            </p>

            <p className="mt-2 text-xs leading-5 text-amber-100/80">
              Salonul trebuie să configureze serviciile și frizerii înainte ca
              pagina publică să poată primi rezervări.
            </p>
          </div>
        ) : (
          <PublicBookingClient
            salonSlug={salonSlug}
            services={services}
            barbers={barbers}
            workingHours={workingHours}
            appointments={appointments}
            salonName={organization.name}
          />
        )}

        <footer className="pb-6 pt-4">
          <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-xs leading-5 text-stone-500">
              Datele introduse sunt folosite pentru gestionarea rezervării și
              notificări legate de aceasta.
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-xs font-black">
              <a href="/privacy" className="text-amber-300">
                Confidențialitate
              </a>

              <a href="/terms" className="text-amber-300">
                Termeni
              </a>
            </div>
          </div>
        </footer>
      </section>
    </main>
  );
}