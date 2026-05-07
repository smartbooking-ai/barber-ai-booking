import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type BarberRow = {
  id: string;
  name: string | null;
  is_active: boolean | null;
};

type CompletedAppointmentRow = {
  id: string;
  barber_id: string | null;
  starts_at: string;
  status: string;
  service:
    | {
        name: string | null;
        price: number | string | null;
      }
    | {
        name: string | null;
        price: number | string | null;
      }[]
    | null;
  barber:
    | {
        id: string;
        name: string | null;
      }
    | {
        id: string;
        name: string | null;
      }[]
    | null;
};

type BarberReportRow = {
  barberId: string;
  barberName: string;
  completedCount: number;
  totalRevenue: number;
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

function getCurrentMonthRange() {
  const now = new Date();

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  return {
    monthStart,
    nextMonthStart,
  };
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    month: "long",
    year: "numeric",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits: 0,
  }).format(value);
}

function buildBarberReports(params: {
  barbers: BarberRow[];
  completedAppointments: CompletedAppointmentRow[];
}) {
  const reportsMap = new Map<string, BarberReportRow>();

  params.barbers.forEach((barber) => {
    reportsMap.set(barber.id, {
      barberId: barber.id,
      barberName: barber.name || "Frizer fără nume",
      completedCount: 0,
      totalRevenue: 0,
    });
  });

  params.completedAppointments.forEach((appointment) => {
    const service = getSingleRelation(appointment.service);
    const barber = getSingleRelation(appointment.barber);

    const barberId = appointment.barber_id || barber?.id || "unknown";
    const barberName = barber?.name || "Frizer necunoscut";
    const price = Number(service?.price || 0);

    const currentReport =
      reportsMap.get(barberId) ||
      ({
        barberId,
        barberName,
        completedCount: 0,
        totalRevenue: 0,
      } satisfies BarberReportRow);

    currentReport.completedCount += 1;
    currentReport.totalRevenue += Number.isNaN(price) ? 0 : price;

    reportsMap.set(barberId, currentReport);
  });

  return Array.from(reportsMap.values()).sort((left, right) => {
    if (right.totalRevenue !== left.totalRevenue) {
      return right.totalRevenue - left.totalRevenue;
    }

    return right.completedCount - left.completedCount;
  });
}

export default async function ReportsPage() {
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
    redirect("/dashboard?error=Doar owner-ul poate vedea rapoartele.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const { monthStart, nextMonthStart } = getCurrentMonthRange();

  const [{ data: barbersData }, { data: completedAppointmentsData }] =
    await Promise.all([
      supabase
        .from("barbers")
        .select("id, name, is_active")
        .eq("organization_id", organization.id)
        .eq("is_active", true)
        .order("name", { ascending: true }),

      supabase
        .from("appointments")
        .select(
          `
            id,
            barber_id,
            starts_at,
            status,
            service:services (
              name,
              price
            ),
            barber:barbers (
              id,
              name
            )
          `,
        )
        .eq("organization_id", organization.id)
        .eq("status", "completed")
        .gte("starts_at", monthStart.toISOString())
        .lt("starts_at", nextMonthStart.toISOString())
        .order("starts_at", { ascending: false }),
    ]);

  const barbers = (barbersData || []) as BarberRow[];
  const completedAppointments =
    (completedAppointmentsData || []) as CompletedAppointmentRow[];

  const barberReports = buildBarberReports({
    barbers,
    completedAppointments,
  });

  const totalRevenue = barberReports.reduce((sum, report) => {
    return sum + report.totalRevenue;
  }, 0);

  const totalCompletedAppointments = barberReports.reduce((sum, report) => {
    return sum + report.completedCount;
  }, 0);

  const topBarber = barberReports.find((report) => report.totalRevenue > 0);

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Rapoarte
            </p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Bani
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                Încasări pe frizer.
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
            Calculul include doar rezervările marcate ca{" "}
            <span className="font-black text-stone-200">Gata</span> în luna{" "}
            {formatMonthLabel(monthStart)}.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-3">
              <p className="text-[11px] font-bold text-emerald-300">
                Total lună
              </p>
              <p className="mt-2 text-2xl font-black text-emerald-300">
                {formatMoney(totalRevenue)}
              </p>
              <p className="mt-1 text-[11px] font-bold text-emerald-200/70">
                lei
              </p>
            </div>

            <div className="rounded-2xl border border-sky-400/40 bg-sky-500/10 p-3">
              <p className="text-[11px] font-bold text-sky-300">Servicii</p>
              <p className="mt-2 text-2xl font-black text-sky-300">
                {totalCompletedAppointments}
              </p>
              <p className="mt-1 text-[11px] font-bold text-sky-200/70">
                gata
              </p>
            </div>

            <div className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3">
              <p className="text-[11px] font-bold text-amber-300">Frizeri</p>
              <p className="mt-2 text-2xl font-black text-amber-300">
                {barbers.length}
              </p>
              <p className="mt-1 text-[11px] font-bold text-amber-200/70">
                activi
              </p>
            </div>
          </div>

          {topBarber ? (
            <div className="mt-4 rounded-3xl border border-emerald-400/40 bg-emerald-400/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-emerald-300">
                    Top luna asta
                  </p>

                  <p className="mt-1 text-xs leading-5 text-stone-400">
                    {topBarber.barberName} · {topBarber.completedCount} servicii
                    finalizate
                  </p>
                </div>

                <span className="rounded-full bg-emerald-400 px-4 py-3 text-sm font-black text-stone-950">
                  {formatMoney(topBarber.totalRevenue)} lei
                </span>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black">Frizeri</p>
                <p className="mt-1 text-xs text-stone-500">
                  Totaluri din rezervările finalizate în luna curentă.
                </p>
              </div>

              <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
                {barberReports.length}
              </span>
            </div>

            {barberReports.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                <p className="text-sm font-bold text-stone-300">
                  Nu există frizeri activi.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {barberReports.map((report) => (
                  <article
                    key={report.barberId}
                    className="rounded-2xl border border-stone-800 bg-stone-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-stone-50">
                          {report.barberName}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-stone-500">
                          {report.completedCount === 1
                            ? "1 serviciu finalizat"
                            : `${report.completedCount} servicii finalizate`}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-xl font-black text-emerald-300">
                          {formatMoney(report.totalRevenue)}
                        </p>

                        <p className="mt-1 text-xs font-bold text-stone-500">
                          lei
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-900">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{
                          width:
                            totalRevenue > 0
                              ? `${Math.max(
                                  6,
                                  Math.round(
                                    (report.totalRevenue / totalRevenue) * 100,
                                  ),
                                )}%`
                              : "0%",
                        }}
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-sm font-black">Cum se calculează</p>

            <p className="mt-2 text-xs leading-5 text-stone-500">
              O rezervare intră în raport doar după ce este marcată{" "}
              <span className="font-black text-stone-300">Gata</span> în
              calendar. Suma vine din prețul serviciului salvat în momentul
              rezervării.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <a
              href="/dashboard/bookings"
              className="flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Mergi la rezervări
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