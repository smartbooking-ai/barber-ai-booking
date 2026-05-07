import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { saveWorkingHours } from "./actions";

type ScheduleSetupPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

type WorkingHourRow = {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
};

const days = [
  {
    value: 1,
    shortLabel: "Lun",
    label: "Luni",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
  },
  {
    value: 2,
    shortLabel: "Mar",
    label: "Marți",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
  },
  {
    value: 3,
    shortLabel: "Mie",
    label: "Miercuri",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
  },
  {
    value: 4,
    shortLabel: "Joi",
    label: "Joi",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
  },
  {
    value: 5,
    shortLabel: "Vin",
    label: "Vineri",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "18:00",
  },
  {
    value: 6,
    shortLabel: "Sâm",
    label: "Sâmbătă",
    defaultOpen: true,
    defaultStartTime: "09:00",
    defaultEndTime: "14:00",
  },
  {
    value: 7,
    shortLabel: "Dum",
    label: "Duminică",
    defaultOpen: false,
    defaultStartTime: "09:00",
    defaultEndTime: "14:00",
  },
];

function normalizeTime(value: string | null) {
  if (!value) {
    return "";
  }

  return value.slice(0, 5);
}

export default async function ScheduleSetupPage({
  searchParams,
}: ScheduleSetupPageProps) {
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
    redirect("/dashboard?error=Doar owner-ul poate modifica programul.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const { data: workingHours } = await supabase
    .from("working_hours")
    .select("day_of_week, is_open, start_time, end_time")
    .eq("organization_id", organization.id)
    .order("day_of_week", { ascending: true });

  const savedHours = (workingHours || []) as WorkingHourRow[];

  function getDaySettings(dayValue: number) {
    const dayConfig = days.find((day) => day.value === dayValue);
    const savedDay = savedHours.find((day) => day.day_of_week === dayValue);

    return {
      isOpen: savedDay?.is_open ?? dayConfig?.defaultOpen ?? true,
      startTime:
        normalizeTime(savedDay?.start_time || null) ||
        dayConfig?.defaultStartTime ||
        "09:00",
      endTime:
        normalizeTime(savedDay?.end_time || null) ||
        dayConfig?.defaultEndTime ||
        "18:00",
    };
  }

  const openDaysCount = days.filter((day) => {
    const settings = getDaySettings(day.value);

    return settings.isOpen;
  }).length;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              Program de lucru
            </p>
            <p className="mt-1 text-xs text-stone-500">{organization.name}</p>
          </div>
        </header>

        <form action={saveWorkingHours} className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Setup
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                Programul salonului.
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
            Clienții pot alege ore doar în zilele deschise și în intervalele
            setate aici.
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
                  Zile deschise
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-400">
                  Acesta este programul folosit pe pagina publică de rezervări.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-4 py-3 text-sm font-black text-stone-950">
                {openDaysCount}/7
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {days.map((day) => {
              const settings = getDaySettings(day.value);

              return (
                <details
                  key={day.value}
                  className="overflow-hidden rounded-3xl border border-stone-800 bg-stone-900"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xs font-black ${
                          settings.isOpen
                            ? "bg-amber-400 text-stone-950"
                            : "bg-stone-950 text-stone-500"
                        }`}
                      >
                        {day.shortLabel}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {day.label}
                        </p>

                        <p className="mt-1 text-xs text-stone-500">
                          {settings.isOpen
                            ? `${settings.startTime} - ${settings.endTime}`
                            : "Închis"}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                        settings.isOpen
                          ? "bg-emerald-400 text-stone-950"
                          : "bg-stone-950 text-stone-500"
                      }`}
                    >
                      {settings.isOpen ? "Deschis" : "Închis"}
                    </span>
                  </summary>

                  <div className="border-t border-stone-800 p-4">
                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                      <div>
                        <p className="text-sm font-black">Zi deschisă</p>
                        <p className="mt-1 text-xs leading-5 text-stone-500">
                          Debifează dacă salonul este închis.
                        </p>
                      </div>

                      <input
                        name={`isOpen-${day.value}`}
                        type="checkbox"
                        defaultChecked={settings.isOpen}
                        className="h-6 w-6 accent-amber-400"
                      />
                    </label>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor={`startTime-${day.value}`}
                          className="text-sm font-bold text-stone-200"
                        >
                          Deschide
                        </label>

                        <input
                          id={`startTime-${day.value}`}
                          name={`startTime-${day.value}`}
                          type="time"
                          defaultValue={settings.startTime}
                          className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`endTime-${day.value}`}
                          className="text-sm font-bold text-stone-200"
                        >
                          Închide
                        </label>

                        <input
                          id={`endTime-${day.value}`}
                          name={`endTime-${day.value}`}
                          type="time"
                          defaultValue={settings.endTime}
                          className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>

          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
          >
            Salvează programul
          </button>

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
        </form>
      </section>
    </main>
  );
}