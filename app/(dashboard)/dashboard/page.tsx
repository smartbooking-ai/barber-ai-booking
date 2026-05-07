import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type UserRole = "owner" | "barber" | "staff";

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

type AppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  client_id: string | null;
  client:
    | {
        name: string | null;
        phone: string | null;
      }
    | {
        name: string | null;
        phone: string | null;
      }[]
    | null;
  service:
    | {
        name: string | null;
      }
    | {
        name: string | null;
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

type BarberAccountRow = {
  id: string;
  name: string | null;
};

type CompletedAppointmentRow = {
  id: string;
  service:
    | {
        price: number | string | null;
      }
    | {
        price: number | string | null;
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

function formatHour(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function formatDateShort(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits: 0,
  }).format(value);
}

function getCurrentMonthRange() {
  const now = new Date();

  return {
    monthStart: new Date(now.getFullYear(), now.getMonth(), 1),
    nextMonthStart: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function getGdprLabel(params: {
  privacyContactEmail: string | null;
  dpaAcceptedAt: string | null;
}) {
  if (params.privacyContactEmail && params.dpaAcceptedAt) {
    return "OK";
  }

  return "Setup";
}

function QuickLink({
  href,
  title,
  description,
  badge,
  highlighted = false,
}: {
  href: string;
  title: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-3xl border p-4 transition active:scale-[0.99] ${
        highlighted
          ? "border-amber-400/50 bg-amber-400 text-stone-950 shadow-lg shadow-amber-950/30"
          : "border-stone-800 bg-stone-900 hover:border-amber-400"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p
            className={`text-base font-black ${
              highlighted ? "text-stone-950" : "text-stone-50"
            }`}
          >
            {title}
          </p>

          <p
            className={`mt-1 text-xs leading-5 ${
              highlighted ? "text-stone-800" : "text-stone-400"
            }`}
          >
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {badge ? (
            <span
              className={`rounded-full px-3 py-2 text-xs font-black ${
                highlighted
                  ? "bg-stone-950 text-amber-300"
                  : "bg-stone-950 text-stone-300"
              }`}
            >
              {badge}
            </span>
          ) : null}

          <span
            className={`text-2xl font-black ${
              highlighted ? "text-stone-950" : "text-amber-300"
            }`}
          >
            →
          </span>
        </div>
      </div>
    </a>
  );
}

function CompactStatusCard({
  href,
  title,
  value,
  description,
  tone = "default",
}: {
  href: string;
  title: string;
  value: string | number;
  description: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  const classes = {
    default: "border-stone-800 bg-stone-900 text-stone-50",
    green: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    red: "border-red-400/40 bg-red-500/10 text-red-300",
  };

  return (
    <a
      href={href}
      className={`block rounded-3xl border p-4 transition active:scale-[0.99] ${classes[tone]}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 truncate text-xs leading-5 text-stone-400">
            {description}
          </p>
        </div>

        <p className="shrink-0 text-2xl font-black">{value}</p>
      </div>
    </a>
  );
}

function MoneyInfoCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="block rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-emerald-300">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 truncate text-xs leading-5 text-stone-400">
            {description}
          </p>
        </div>

        <p className="shrink-0 text-2xl font-black">{value}</p>
      </div>
    </div>
  );
}

function NextAppointmentCompact({
  appointment,
}: {
  appointment: AppointmentRow | null;
}) {
  if (!appointment) {
    return (
      <CompactStatusCard
        href="/dashboard/bookings"
        title="Următoarea rezervare"
        value="-"
        description="Nu ai rezervări confirmate viitoare."
      />
    );
  }

  const client = getSingleRelation(appointment.client);
  const service = getSingleRelation(appointment.service);
  const barber = getSingleRelation(appointment.barber);

  return (
    <a
      href="/dashboard/bookings?section=today#today-section"
      className="block rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-emerald-300 transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black">Următoarea rezervare</p>

          <p className="mt-1 truncate text-xs leading-5 text-stone-400">
            {client?.name || "Client"} · {service?.name || "Serviciu"} ·{" "}
            {barber?.name || "Frizer"}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-black text-emerald-300">
            {formatHour(appointment.starts_at)}
          </p>

          <p className="mt-1 text-[11px] font-bold text-stone-500">
            {formatDateShort(appointment.starts_at)}
          </p>
        </div>
      </div>
    </a>
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Verificăm utilizatorul autentificat.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Luăm profilul, rolul și organizația.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
        full_name,
        role,
        organization:organizations (
          id,
          name,
          slug,
          phone,
          whatsapp_phone,
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

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const role = profile.role as UserRole;
  const isBarber = role === "barber";

  let currentBarber: BarberAccountRow | null = null;

  // Dacă userul este frizer, îl legăm de rândul lui din tabela barbers.
  if (isBarber) {
    const { data: barberData } = await supabase
      .from("barbers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!barberData) {
      return (
        <main className="min-h-screen bg-stone-950 text-stone-50">
          <section className="mx-auto min-h-screen max-w-md px-4 py-4">
            <div className="rounded-3xl border border-red-500/40 bg-red-500/10 p-5">
              <p className="text-sm font-black text-red-300">
                Contul tău nu este legat de un frizer activ.
              </p>

              <p className="mt-2 text-xs leading-5 text-red-100/80">
                Cere owner-ului salonului să verifice invitația sau să genereze
                una nouă.
              </p>

              <a
                href="/login"
                className="mt-4 flex w-full items-center justify-center rounded-2xl border border-red-500/40 px-6 py-4 text-sm font-black text-red-200"
              >
                Înapoi la login
              </a>
            </div>
          </section>
        </main>
      );
    }

    currentBarber = barberData;
  }

  const publicBookingUrl = `/${organization.slug}`;

  const now = new Date();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Query pentru rezervări. Owner vede toate, frizerul vede doar ale lui.
  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
        id,
        starts_at,
        ends_at,
        status,
        client_id,
        client:clients (
          name,
          phone
        ),
        service:services (
          name
        ),
        barber:barbers (
          name
        )
      `,
    )
    .eq("organization_id", organization.id)
    .gte("starts_at", todayStart.toISOString())
    .lte("starts_at", nextWeek.toISOString())
    .order("starts_at", { ascending: true });

  if (isBarber && currentBarber) {
    appointmentsQuery = appointmentsQuery.eq("barber_id", currentBarber.id);
  }

  const { monthStart, nextMonthStart } = getCurrentMonthRange();

  // Query pentru încasările lunii. Owner vede total salon, frizerul doar totalul lui.
  let completedMonthlyQuery = supabase
    .from("appointments")
    .select(
      `
        id,
        service:services (
          price
        )
      `,
    )
    .eq("organization_id", organization.id)
    .eq("status", "completed")
    .gte("starts_at", monthStart.toISOString())
    .lt("starts_at", nextMonthStart.toISOString());

  if (isBarber && currentBarber) {
    completedMonthlyQuery = completedMonthlyQuery.eq(
      "barber_id",
      currentBarber.id,
    );
  }

  const [
    { data: appointmentsData },
    { count: servicesCount },
    { count: barbersCount },
    { count: clientsCount },
    { count: pendingMessagesCount },
    { count: failedMessagesCount },
    { data: completedMonthlyData },
  ] = await Promise.all([
    appointmentsQuery,

    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),

    supabase
      .from("barbers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("is_active", true),

    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .is("anonymized_at", null),

    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .is("archived_at", null),

    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "failed")
      .is("archived_at", null),

    completedMonthlyQuery,
  ]);

  const appointments = (appointmentsData || []) as AppointmentRow[];
  const completedMonthly = (completedMonthlyData ||
    []) as CompletedAppointmentRow[];

  const monthlyRevenue = completedMonthly.reduce((sum, appointment) => {
    const service = getSingleRelation(appointment.service);
    const price = Number(service?.price || 0);

    return sum + (Number.isNaN(price) ? 0 : price);
  }, 0);

  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "pending",
  );

  const confirmedUpcomingAppointments = appointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);

    return (
      appointment.status === "confirmed" && startsAt.getTime() >= now.getTime()
    );
  });

  const nextAppointment = confirmedUpcomingAppointments[0] || null;

  const gdprLabel = getGdprLabel({
    privacyContactEmail: organization.privacy_contact_email,
    dpaAcceptedAt: organization.dpa_accepted_at,
  });

  const smsProblems = (pendingMessagesCount ?? 0) + (failedMessagesCount ?? 0);

  // Dashboard pentru frizer.
  if (isBarber && currentBarber) {
    return (
      <main className="min-h-screen bg-stone-950 text-stone-50">
        <section className="mx-auto min-h-screen max-w-md px-4 py-4">
          <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
              B
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-none">
                {currentBarber.name || profile.full_name || "Frizer"}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {organization.name} · cont frizer
              </p>
            </div>
          </header>

          <div className="py-7">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
              Panoul meu
            </p>

            <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
              Rezervările mele.
            </h1>

            <p className="mt-3 text-sm leading-6 text-stone-400">
              Vezi doar rezervările alocate pe numele tău.
            </p>

            <div className="mt-6">
              <NextAppointmentCompact appointment={nextAppointment} />
            </div>

            <div className="mt-4 grid gap-3">
              <MoneyInfoCard
                title="Încasările mele luna asta"
                value={`${formatMoney(monthlyRevenue)} lei`}
                description="Doar rezervările tale marcate ca Gata."
              />

              <QuickLink
                href="/dashboard/bookings"
                title="Calendarul meu"
                description="Acceptă, refuză și finalizează rezervările tale."
                badge={String(pendingAppointments.length)}
                highlighted
              />

              <CompactStatusCard
                href="/dashboard/bookings?section=pending#pending-section"
                title="Pending pentru mine"
                value={pendingAppointments.length}
                description="Rezervări noi care așteaptă răspunsul tău."
                tone={pendingAppointments.length > 0 ? "amber" : "default"}
              />

              <CompactStatusCard
                href="/dashboard/bookings?section=future#future-section"
                title="Confirmate"
                value={confirmedUpcomingAppointments.length}
                description="Rezervări confirmate în următoarele 7 zile."
                tone="green"
              />
            </div>
          </div>
        </section>
      </main>
    );
  }

  // Dashboard pentru owner.
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              {organization.name}
            </p>
            <p className="mt-1 text-xs text-stone-500">Dashboard owner</p>
          </div>
        </header>

        <div className="py-7">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Panou
          </p>

          <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
            Administrare salon.
          </h1>

          <p className="mt-3 text-sm leading-6 text-stone-400">
            Alege rapid ce vrei să administrezi.
          </p>

          <div className="mt-6">
            <NextAppointmentCompact appointment={nextAppointment} />
          </div>

          <div className="mt-4 grid gap-3">
            <QuickLink
              href="/dashboard/bookings"
              title="Rezervări și calendar"
              description="Acceptă, refuză, editează și finalizează rezervări."
              badge={String(pendingAppointments.length)}
              highlighted
            />

            <QuickLink
              href="/dashboard/reports"
              title="Încasări luna asta"
              description="Vezi totalul și banii făcuți de fiecare frizer."
              badge={`${formatMoney(monthlyRevenue)} lei`}
            />

            <QuickLink
              href="/dashboard/clients"
              title="Clienți"
              description="Istoric client, SMS-uri, export și anonimizare GDPR."
              badge={String(clientsCount ?? 0)}
            />

            <QuickLink
              href="/setup"
              title="Setup salon"
              description="Date salon, frizeri, servicii, prețuri și program."
              badge={`${barbersCount ?? 0}/${servicesCount ?? 0}`}
            />

            <QuickLink
              href="/dashboard/settings/privacy"
              title="GDPR & Privacy"
              description="DPA, email GDPR, retenție date și marketing SMS."
              badge={gdprLabel}
            />
          </div>

          <div className="mt-5">
            <CompactStatusCard
              href="/dashboard/messages"
              title="SMS probleme"
              value={smsProblems}
              description={`Pending: ${pendingMessagesCount ?? 0}, failed: ${
                failedMessagesCount ?? 0
              }`}
              tone={smsProblems > 0 ? "red" : "default"}
            />
          </div>

          <div className="mt-5 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-sm font-black">Pagina publică</p>

            <p className="mt-2 text-xs leading-5 text-stone-400">
              Linkul pe care îl dai clienților pentru rezervări.
            </p>

            <a
              href={publicBookingUrl}
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