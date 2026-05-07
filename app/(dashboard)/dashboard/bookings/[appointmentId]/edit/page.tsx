import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateAppointment } from "./actions";

type UserRole = "owner" | "barber" | "staff";

type EditAppointmentPageProps = {
  params: Promise<{
    appointmentId: string;
  }>;
  searchParams: Promise<{
    error?: string;
  }>;
};

type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed"
  | "no_show";

type AppointmentRow = {
  id: string;
  client_id: string;
  service_id: string | null;
  barber_id: string | null;
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
};

type ServiceRow = {
  id: string;
  name: string | null;
  duration_minutes: number | null;
  price: number | string | null;
};

type BarberRow = {
  id: string;
  name: string | null;
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

function formatDateTimeLocal(dateValue: string) {
  const date = new Date(dateValue);

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function getStatusLabel(status: AppointmentStatus) {
  if (status === "pending") {
    return "În așteptare";
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
    return "bg-amber-400 text-stone-950";
  }

  if (status === "confirmed") {
    return "bg-emerald-400 text-stone-950";
  }

  if (status === "cancelled") {
    return "bg-red-500 text-white";
  }

  if (status === "completed") {
    return "bg-sky-400 text-stone-950";
  }

  return "bg-stone-700 text-stone-200";
}

export default async function EditAppointmentPage({
  params,
  searchParams,
}: EditAppointmentPageProps) {
  const { appointmentId } = await params;
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

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const role = profile.role as UserRole;
  const isBarber = role === "barber";

  let currentBarberId: string | null = null;

  if (isBarber) {
    const { data: currentBarber } = await supabase
      .from("barbers")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (!currentBarber) {
      redirect("/dashboard?error=Contul tău nu este legat de un frizer activ.");
    }

    currentBarberId = currentBarber.id;
  }

  let appointmentQuery = supabase
    .from("appointments")
    .select(
      `
        id,
        client_id,
        service_id,
        barber_id,
        starts_at,
        ends_at,
        status,
        client:clients (
          name,
          phone
        )
      `,
    )
    .eq("id", appointmentId)
    .eq("organization_id", organization.id);

  if (isBarber && currentBarberId) {
    appointmentQuery = appointmentQuery.eq("barber_id", currentBarberId);
  }

  const { data: appointmentData, error: appointmentError } =
    await appointmentQuery.single();

  if (appointmentError || !appointmentData) {
    redirect(
      "/dashboard/bookings?error=Rezervarea nu a fost găsită sau nu ai acces la ea.",
    );
  }

  const appointment = appointmentData as AppointmentRow;
  const client = getSingleRelation(appointment.client);

  const servicesQuery = supabase
    .from("services")
    .select("id, name, duration_minutes, price")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  let barbersQuery = supabase
    .from("barbers")
    .select("id, name")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (isBarber && currentBarberId) {
    barbersQuery = barbersQuery.eq("id", currentBarberId);
  }

  const [{ data: servicesData }, { data: barbersData }] = await Promise.all([
    servicesQuery,
    barbersQuery,
  ]);

  const services = (servicesData || []) as ServiceRow[];
  const barbers = (barbersData || []) as BarberRow[];

  const canEdit =
    appointment.status === "pending" || appointment.status === "confirmed";

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Editează rezervare
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {isBarber ? "Rezervarea ta" : organization.name}
            </p>
          </div>
        </header>

        <div className="py-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Rezervare
          </p>

          <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight">
            Modifică programarea.
          </h1>

          <div className="mt-4 flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-2 text-xs font-black ${getStatusClasses(
                appointment.status,
              )}`}
            >
              {getStatusLabel(appointment.status)}
            </span>

            <p className="text-xs font-bold text-stone-500">
              Poți edita doar rezervările pending sau confirmate.
            </p>
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          {!canEdit ? (
            <div className="mt-7 rounded-3xl border border-stone-800 bg-stone-900 p-4">
              <p className="text-sm font-black text-stone-200">
                Această rezervare nu mai poate fi editată.
              </p>

              <p className="mt-2 text-xs leading-5 text-stone-500">
                Rezervările anulate, finalizate sau no-show rămân în istoric.
              </p>

              <a
                href="/dashboard/bookings"
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950"
              >
                Înapoi la rezervări
              </a>
            </div>
          ) : (
            <form
              action={updateAppointment}
              className="mt-7 rounded-3xl border border-stone-800 bg-stone-900 p-4"
            >
              <input type="hidden" name="appointmentId" value={appointment.id} />

              {isBarber && currentBarberId ? (
                <input type="hidden" name="barberId" value={currentBarberId} />
              ) : null}

              <div className="space-y-4">
                <div className="rounded-3xl border border-stone-800 bg-stone-950 p-4">
                  <p className="text-sm font-black">Client</p>

                  <div className="mt-4 space-y-4">
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
                        defaultValue={client?.name || ""}
                        className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
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
                        defaultValue={client?.phone || ""}
                        className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="serviceId"
                    className="text-sm font-bold text-stone-200"
                  >
                    Serviciu
                  </label>

                  <select
                    id="serviceId"
                    name="serviceId"
                    defaultValue={appointment.service_id || ""}
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                  >
                    <option value="">Alege serviciul</option>

                    {services.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {service.duration_minutes} min ·{" "}
                        {Number(service.price || 0).toFixed(0)} lei
                      </option>
                    ))}
                  </select>
                </div>

                {isBarber ? (
                  <div className="rounded-2xl border border-stone-800 bg-stone-950 p-4">
                    <p className="text-xs font-bold text-stone-500">Frizer</p>

                    <p className="mt-1 text-sm font-black text-stone-100">
                      {barbers[0]?.name || "Frizer"}
                    </p>

                    <p className="mt-2 text-xs leading-5 text-stone-500">
                      Contul de frizer nu poate muta rezervarea pe alt frizer.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="barberId"
                      className="text-sm font-bold text-stone-200"
                    >
                      Frizer
                    </label>

                    <select
                      id="barberId"
                      name="barberId"
                      defaultValue={appointment.barber_id || ""}
                      className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                    >
                      <option value="">Alege frizerul</option>

                      {barbers.map((barber) => (
                        <option key={barber.id} value={barber.id}>
                          {barber.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="startsAt"
                    className="text-sm font-bold text-stone-200"
                  >
                    Data și ora
                  </label>

                  <input
                    id="startsAt"
                    name="startsAt"
                    type="datetime-local"
                    defaultValue={formatDateTimeLocal(appointment.starts_at)}
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Serverul verifică să fie în program și să nu se suprapună cu
                    altă rezervare la același frizer.
                  </p>
                </div>

                {appointment.status === "confirmed" ? (
                  <label className="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                    <input
                      name="notifyClient"
                      type="checkbox"
                      defaultChecked
                      className="mt-1 h-5 w-5 shrink-0 accent-amber-400"
                    />

                    <span className="text-xs font-bold leading-5 text-stone-300">
                      Trimite SMS clientului că rezervarea a fost modificată.
                    </span>
                  </label>
                ) : null}
              </div>

              <button
                type="submit"
                className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Salvează modificările
              </button>
            </form>
          )}

          <a
            href="/dashboard/bookings"
            className="mt-4 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
          >
            Înapoi la rezervări
          </a>
        </div>
      </section>
    </main>
  );
}