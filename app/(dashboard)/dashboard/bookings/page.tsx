import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  markNoShowAppointment,
} from "./actions";

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
        duration_minutes: number | null;
        price: number | string | null;
      }
    | {
        name: string | null;
        duration_minutes: number | null;
        price: number | string | null;
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

type BookingsPageProps = {
  searchParams: Promise<{
    error?: string;
    section?: string;
  }>;
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

function formatDayShort(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function formatDayLong(dateValue: string) {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isTomorrow(date: Date) {
  const tomorrow = new Date();

  tomorrow.setDate(tomorrow.getDate() + 1);

  return isSameDay(date, tomorrow);
}

function getStatusLabel(status: AppointmentStatus) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "confirmed") {
    return "Confirmată";
  }

  if (status === "cancelled") {
    return "Anulată";
  }

  if (status === "completed") {
    return "Finalizată";
  }

  if (status === "no_show") {
    return "No-show";
  }

  return status;
}

function getStatusClasses(status: AppointmentStatus) {
  if (status === "pending") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  }

  if (status === "confirmed") {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (status === "cancelled") {
    return "border-red-400/40 bg-red-500/10 text-red-300";
  }

  if (status === "completed") {
    return "border-sky-400/40 bg-sky-400/10 text-sky-300";
  }

  return "border-stone-700 bg-stone-900 text-stone-300";
}

function groupAppointmentsByDay(appointments: AppointmentRow[]) {
  const groups = new Map<string, AppointmentRow[]>();

  appointments.forEach((appointment) => {
    const dayLabel = formatDayLong(appointment.starts_at);
    const currentAppointments = groups.get(dayLabel) || [];

    currentAppointments.push(appointment);
    groups.set(dayLabel, currentAppointments);
  });

  return Array.from(groups.entries()).map(([dayLabel, dayAppointments]) => ({
    dayLabel,
    appointments: dayAppointments,
  }));
}

function PendingActions({ appointment }: { appointment: AppointmentRow }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <form action={confirmAppointment}>
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-3 text-xs font-black text-stone-950"
        >
          Acceptă
        </button>
      </form>

      <form action={cancelAppointment}>
        <input type="hidden" name="appointmentId" value={appointment.id} />

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 px-4 py-3 text-xs font-black text-red-300"
        >
          Refuză
        </button>
      </form>
    </div>
  );
}

function ConfirmedActions({ appointment }: { appointment: AppointmentRow }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <form action={completeAppointment}>
          <input type="hidden" name="appointmentId" value={appointment.id} />

          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-2xl bg-sky-400 px-3 py-3 text-xs font-black text-stone-950"
          >
            Gata
          </button>
        </form>

        <form action={markNoShowAppointment}>
          <input type="hidden" name="appointmentId" value={appointment.id} />

          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 px-3 py-3 text-xs font-black text-stone-300"
          >
            No-show
          </button>
        </form>

        <form action={cancelAppointment}>
          <input type="hidden" name="appointmentId" value={appointment.id} />

          <button
            type="submit"
            className="flex w-full items-center justify-center rounded-2xl border border-red-500/50 bg-red-500/10 px-3 py-3 text-xs font-black text-red-300"
          >
            Anulează
          </button>
        </form>
      </div>

      <a
        href={`/dashboard/bookings/${appointment.id}/edit`}
        className="flex w-full items-center justify-center rounded-2xl border border-stone-700 bg-stone-900 px-4 py-3 text-xs font-black text-stone-300"
      >
        Editează rezervarea
      </a>
    </div>
  );
}

function AppointmentCard({ appointment }: { appointment: AppointmentRow }) {
  const client = getSingleRelation(appointment.client);
  const service = getSingleRelation(appointment.service);
  const barber = getSingleRelation(appointment.barber);

  return (
    <article className="rounded-3xl border border-stone-800 bg-stone-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <p className="text-2xl font-black leading-none text-stone-50">
              {formatHour(appointment.starts_at)}
            </p>

            <p className="text-xs font-bold text-stone-500">
              {formatDayShort(appointment.starts_at)}
            </p>
          </div>

          <p className="mt-2 truncate text-sm font-black">
            {client?.name || "Client fără nume"}
          </p>

          {client?.phone ? (
            <a
              href={`tel:${client.phone}`}
              className="mt-1 block text-xs font-bold text-amber-300"
            >
              {client.phone}
            </a>
          ) : (
            <p className="mt-1 text-xs font-bold text-stone-500">
              Fără telefon
            </p>
          )}
        </div>

        <span
          className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black ${getStatusClasses(
            appointment.status,
          )}`}
        >
          {getStatusLabel(appointment.status)}
        </span>
      </div>

      <div className="mt-3 rounded-2xl border border-stone-800 bg-stone-900 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-black text-stone-200">
              {service?.name || "Serviciu nesetat"}
            </p>

            <p className="mt-1 truncate text-xs text-stone-500">
              {barber?.name || "Frizer nesetat"} · până la{" "}
              {formatHour(appointment.ends_at)}
            </p>
          </div>

          {service?.price ? (
            <p className="shrink-0 text-xs font-black text-amber-300">
              {Number(service.price).toFixed(0)} lei
            </p>
          ) : null}
        </div>
      </div>

      {appointment.status === "pending" ? (
        <PendingActions appointment={appointment} />
      ) : null}

      {appointment.status === "confirmed" ? (
        <ConfirmedActions appointment={appointment} />
      ) : null}
    </article>
  );
}

function BookingSection({
  id,
  title,
  count,
  appointments,
  emptyText,
  highlight = false,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  count: number;
  appointments: AppointmentRow[];
  emptyText: string;
  highlight?: boolean;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className={`scroll-mt-6 overflow-hidden rounded-3xl border ${
        highlight ? "border-amber-400/40" : "border-stone-800"
      } bg-stone-900`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <div>
          <p
            className={`text-sm font-black ${
              highlight ? "text-amber-300" : "text-stone-50"
            }`}
          >
            {title}
          </p>

          <p className="mt-1 text-xs text-stone-500">
            {count === 1 ? "1 rezervare" : `${count} rezervări`}
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-2 text-xs font-black ${
            highlight
              ? "bg-amber-400 text-stone-950"
              : "bg-stone-950 text-stone-300"
          }`}
        >
          {count}
        </span>
      </summary>

      <div className="border-t border-stone-800 p-4">
        {appointments.length === 0 ? (
          <div className="rounded-2xl border border-stone-800 bg-stone-950 p-4">
            <p className="text-sm font-bold text-stone-300">{emptyText}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function GroupedBookingSection({
  id,
  title,
  count,
  groupedAppointments,
  emptyText,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  count: number;
  groupedAppointments: {
    dayLabel: string;
    appointments: AppointmentRow[];
  }[];
  emptyText: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="scroll-mt-6 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
        <div>
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs text-stone-500">
            {count === 1 ? "1 rezervare" : `${count} rezervări`}
          </p>
        </div>

        <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
          {count}
        </span>
      </summary>

      <div className="border-t border-stone-800 p-4">
        {groupedAppointments.length === 0 ? (
          <p className="text-sm font-bold text-stone-500">{emptyText}</p>
        ) : (
          <div className="space-y-5">
            {groupedAppointments.map((group) => (
              <div key={group.dayLabel}>
                <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-stone-500">
                  {group.dayLabel}
                </p>

                <div className="space-y-3">
                  {group.appointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function StatLink({
  href,
  label,
  value,
  highlight = false,
}: {
  href: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <a
      href={href}
      className={`rounded-2xl border p-3 transition active:scale-[0.98] ${
        highlight
          ? "border-amber-400/40 bg-amber-400/10"
          : "border-stone-800 bg-stone-900"
      }`}
    >
      <p
        className={`text-[11px] font-bold ${
          highlight ? "text-amber-300" : "text-stone-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-2xl font-black ${
          highlight ? "text-amber-300" : "text-stone-50"
        }`}
      >
        {value}
      </p>
    </a>
  );
}

export default async function BookingsPage({ searchParams }: BookingsPageProps) {
  const { error, section } = await searchParams;

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
          name,
          slug
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

  if (isBarber) {
    const { data: barberData } = await supabase
      .from("barbers")
      .select("id, name")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!barberData) {
      redirect("/dashboard");
    }

    currentBarber = barberData;
  }

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      `
        id,
        starts_at,
        ends_at,
        status,
        client:clients (
          name,
          phone
        ),
        service:services (
          name,
          duration_minutes,
          price
        ),
        barber:barbers (
          name
        )
      `,
    )
    .eq("organization_id", organization.id)
    .order("starts_at", { ascending: true });

  if (isBarber && currentBarber) {
    appointmentsQuery = appointmentsQuery.eq("barber_id", currentBarber.id);
  }

  const { data: appointmentsData } = await appointmentsQuery;

  const appointments = (appointmentsData || []) as AppointmentRow[];

  const now = new Date();
  const sevenDaysAgo = new Date();

  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const pendingAppointments = appointments.filter(
    (appointment) => appointment.status === "pending",
  );

  const confirmedAppointments = appointments.filter(
    (appointment) => appointment.status === "confirmed",
  );

  const todayAppointments = confirmedAppointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);

    return isSameDay(startsAt, now);
  });

  const tomorrowAppointments = confirmedAppointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);

    return isTomorrow(startsAt);
  });

  const futureAppointments = confirmedAppointments.filter((appointment) => {
    const startsAt = new Date(appointment.starts_at);

    return (
      startsAt.getTime() > now.getTime() &&
      !isSameDay(startsAt, now) &&
      !isTomorrow(startsAt)
    );
  });

  const recentHistoryAppointments = appointments
    .filter((appointment) => {
      const startsAt = new Date(appointment.starts_at);
      const isHistoryStatus =
        appointment.status === "cancelled" ||
        appointment.status === "completed" ||
        appointment.status === "no_show";

      const isPastAppointment = startsAt.getTime() < now.getTime();

      return (
        startsAt.getTime() >= sevenDaysAgo.getTime() &&
        (isPastAppointment || isHistoryStatus)
      );
    })
    .reverse();

  const groupedFutureAppointments = groupAppointmentsByDay(futureAppointments);
  const groupedHistoryAppointments = groupAppointmentsByDay(
    recentHistoryAppointments,
  );

  const pageTitle = isBarber ? "Rezervările mele." : "Rezervări.";
  const pageSubtitle = isBarber
    ? currentBarber?.name || "Cont frizer"
    : organization.name;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              {isBarber ? "Calendarul meu" : "Rezervări"}
            </p>
            <p className="mt-1 text-xs text-stone-500">{pageSubtitle}</p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Calendar
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                {pageTitle}
              </h1>
            </div>

            <a
              href="/dashboard"
              className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3 text-xs font-black text-stone-300"
            >
              Dashboard
            </a>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          <div className="mt-6 grid grid-cols-4 gap-2">
            <StatLink
              href="/dashboard/bookings?section=pending#pending-section"
              label="Pending"
              value={pendingAppointments.length}
              highlight
            />

            <StatLink
              href="/dashboard/bookings?section=today#today-section"
              label="Azi"
              value={todayAppointments.length}
            />

            <StatLink
              href="/dashboard/bookings?section=tomorrow#tomorrow-section"
              label="Mâine"
              value={tomorrowAppointments.length}
            />

            <StatLink
              href="/dashboard/bookings?section=future#future-section"
              label="Confirmate"
              value={confirmedAppointments.length}
            />
          </div>

          <div className="mt-5 space-y-3">
            <BookingSection
              id="pending-section"
              title="În așteptare"
              count={pendingAppointments.length}
              appointments={pendingAppointments}
              emptyText="Nu ai rezervări pending."
              highlight
              defaultOpen={section === "pending"}
            />

            <BookingSection
              id="today-section"
              title="Azi"
              count={todayAppointments.length}
              appointments={todayAppointments}
              emptyText="Nu ai rezervări confirmate azi."
              defaultOpen={section === "today"}
            />

            <BookingSection
              id="tomorrow-section"
              title="Mâine"
              count={tomorrowAppointments.length}
              appointments={tomorrowAppointments}
              emptyText="Nu ai rezervări confirmate mâine."
              defaultOpen={section === "tomorrow"}
            />

            <GroupedBookingSection
              id="future-section"
              title="Următoarele zile"
              count={futureAppointments.length}
              groupedAppointments={groupedFutureAppointments}
              emptyText="Nu ai rezervări confirmate viitoare."
              defaultOpen={section === "future"}
            />

            <GroupedBookingSection
              id="history-section"
              title="Istoric 7 zile"
              count={recentHistoryAppointments.length}
              groupedAppointments={groupedHistoryAppointments}
              emptyText="Nu există istoric în ultimele 7 zile."
              defaultOpen={section === "history"}
            />
          </div>
        </div>
      </section>
    </main>
  );
}