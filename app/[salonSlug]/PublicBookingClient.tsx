"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicAppointment } from "./actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
};

type Barber = {
  id: string;
  name: string;
};

type WorkingHour = {
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
};

type Appointment = {
  barber_id: string;
  starts_at: string;
  ends_at: string;
  status: string;
};

type PublicBookingClientProps = {
  salonSlug: string;
  salonName: string;
  services: Service[];
  barbers: Barber[];
  workingHours: WorkingHour[];
  appointments: Appointment[];
};

type Slot = {
  label: string;
  value: string;
};

type SlotGroup = {
  dayKey: string;
  dayLabel: string;
  dayShortLabel: string;
  dateLabel: string;
  slots: Slot[];
};

function timeToMinutes(value: string) {
  const cleanValue = value.slice(0, 5);
  const [hours, minutes] = cleanValue.split(":").map(Number);

  return hours * 60 + minutes;
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

function getRomanianDayOfWeek(date: Date) {
  const jsDay = date.getDay();

  if (jsDay === 0) {
    return 7;
  }

  return jsDay;
}

function isSameCalendarDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);

  if (isSameCalendarDay(date, today)) {
    return "Azi";
  }

  if (isSameCalendarDay(date, tomorrow)) {
    return "Mâine";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "long",
  }).format(date);
}

function formatDayShortLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();

  tomorrow.setDate(today.getDate() + 1);

  if (isSameCalendarDay(date, today)) {
    return "Azi";
  }

  if (isSameCalendarDay(date, tomorrow)) {
    return "Mâine";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
  }).format(date);
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function doesOverlap(
  slotStartIso: string,
  slotEndIso: string,
  appointmentStartIso: string,
  appointmentEndIso: string,
) {
  const slotStart = new Date(slotStartIso).getTime();
  const slotEnd = new Date(slotEndIso).getTime();
  const appointmentStart = new Date(appointmentStartIso).getTime();
  const appointmentEnd = new Date(appointmentEndIso).getTime();

  return slotStart < appointmentEnd && slotEnd > appointmentStart;
}

function createSlotIso(date: Date, timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number);

  const slotDate = new Date(date);

  slotDate.setHours(hours, minutes, 0, 0);

  return slotDate.toISOString();
}

function addMinutes(dateIso: string, minutesToAdd: number) {
  const date = new Date(dateIso);

  date.setMinutes(date.getMinutes() + minutesToAdd);

  return date.toISOString();
}

function generateSlots({
  selectedService,
  selectedBarberId,
  workingHours,
  appointments,
}: {
  selectedService: Service | undefined;
  selectedBarberId: string;
  workingHours: WorkingHour[];
  appointments: Appointment[];
}) {
  if (!selectedService || !selectedBarberId) {
    return [];
  }

  const groups: SlotGroup[] = [];
  const now = new Date();

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const date = new Date();

    date.setDate(now.getDate() + dayOffset);

    const dayOfWeek = getRomanianDayOfWeek(date);

    const workingHour = workingHours.find(
      (item) => item.day_of_week === dayOfWeek,
    );

    if (!workingHour || !workingHour.is_open) {
      continue;
    }

    const startMinutes = timeToMinutes(workingHour.start_time);
    const endMinutes = timeToMinutes(workingHour.end_time);
    const duration = selectedService.duration_minutes || 30;

    const slots: Slot[] = [];

    for (
      let currentMinute = startMinutes;
      currentMinute + duration <= endMinutes;
      currentMinute += 30
    ) {
      const timeLabel = minutesToTime(currentMinute);
      const slotStartIso = createSlotIso(date, timeLabel);
      const slotEndIso = addMinutes(slotStartIso, duration);

      if (new Date(slotStartIso).getTime() <= now.getTime()) {
        continue;
      }

      const isOccupied = appointments.some((appointment) => {
        if (appointment.barber_id !== selectedBarberId) {
          return false;
        }

        if (
          appointment.status === "cancelled" ||
          appointment.status === "completed" ||
          appointment.status === "no_show"
        ) {
          return false;
        }

        return doesOverlap(
          slotStartIso,
          slotEndIso,
          appointment.starts_at,
          appointment.ends_at,
        );
      });

      if (!isOccupied) {
        slots.push({
          label: timeLabel,
          value: slotStartIso,
        });
      }
    }

    if (slots.length > 0) {
      groups.push({
        dayKey: getDayKey(date),
        dayLabel: formatDayLabel(date),
        dayShortLabel: formatDayShortLabel(date),
        dateLabel: formatDateLabel(date),
        slots,
      });
    }
  }

  return groups;
}

function ServiceCompactCard({
  service,
  selected,
  onSelect,
}: {
  service: Service;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-3 text-left transition ${
        selected
          ? "border-amber-400 bg-amber-400 text-stone-950"
          : "border-stone-800 bg-stone-950 text-stone-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black">{service.name}</p>

          <p
            className={`mt-1 text-xs font-bold ${
              selected ? "text-stone-800" : "text-stone-500"
            }`}
          >
            {service.duration_minutes} min
          </p>
        </div>

        <p className="shrink-0 text-sm font-black">
          {Number(service.price).toFixed(0)} lei
        </p>
      </div>

      {service.description ? (
        <p
          className={`mt-2 line-clamp-2 text-xs leading-5 ${
            selected ? "text-stone-800" : "text-stone-500"
          }`}
        >
          {service.description}
        </p>
      ) : null}
    </button>
  );
}

export default function PublicBookingClient({
  salonSlug,
  salonName,
  services,
  barbers,
  workingHours,
  appointments,
}: PublicBookingClientProps) {
  const [selectedServiceId, setSelectedServiceId] = useState(
    services[0]?.id || "",
  );
  const [selectedBarberId, setSelectedBarberId] = useState("");
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const selectedService = services.find(
    (service) => service.id === selectedServiceId,
  );

  const selectedBarber = barbers.find((barber) => barber.id === selectedBarberId);

  const slotGroups = useMemo(
    () =>
      generateSlots({
        selectedService,
        selectedBarberId,
        workingHours,
        appointments,
      }),
    [selectedService, selectedBarberId, workingHours, appointments],
  );

  const selectedDay =
    slotGroups.find((group) => group.dayKey === selectedDayKey) ||
    slotGroups[0] ||
    null;

  useEffect(() => {
    if (!slotGroups.length) {
      setSelectedDayKey("");
      setSelectedSlot("");
      return;
    }

    const dayStillExists = slotGroups.some(
      (group) => group.dayKey === selectedDayKey,
    );

    if (!selectedDayKey || !dayStillExists) {
      setSelectedDayKey(slotGroups[0].dayKey);
      setSelectedSlot("");
    }
  }, [slotGroups, selectedDayKey]);

  return (
    <div className="mt-4 space-y-4">
      <details className="overflow-hidden rounded-[2rem] border border-stone-800 bg-stone-900">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-black">Servicii și prețuri</p>

            <p className="mt-1 text-xs leading-5 text-stone-500">
              {selectedService
                ? `${selectedService.name} · ${selectedService.duration_minutes} min · ${Number(
                    selectedService.price,
                  ).toFixed(0)} lei`
                : `${services.length} servicii disponibile`}
            </p>
          </div>

          <span className="rounded-full bg-stone-950 px-3 py-2 text-xs font-black text-stone-300">
            alege
          </span>
        </summary>

        <div className="border-t border-stone-800 p-4">
          <div className="grid gap-2">
            {services.map((service) => (
              <ServiceCompactCard
                key={service.id}
                service={service}
                selected={selectedServiceId === service.id}
                onSelect={() => {
                  setSelectedServiceId(service.id);
                  setSelectedDayKey("");
                  setSelectedSlot("");
                }}
              />
            ))}
          </div>
        </div>
      </details>

      <details
        id="booking-form"
        className="overflow-hidden rounded-[2rem] border border-amber-400/40 bg-amber-400/10"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
          <div>
            <p className="text-sm font-black text-amber-300">Fă rezervare</p>

            <p className="mt-1 text-xs leading-5 text-stone-400">
              {selectedService
                ? `Pentru ${selectedService.name}`
                : "Alege întâi un serviciu"}
            </p>
          </div>

          <span className="rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-stone-950">
            deschide
          </span>
        </summary>

        <form
          action={createPublicAppointment}
          className="border-t border-amber-400/20 bg-stone-900 p-4"
        >
          <input type="hidden" name="salonSlug" value={salonSlug} />
          <input type="hidden" name="startsAt" value={selectedSlot} />
          <input type="hidden" name="serviceId" value={selectedServiceId} />

          <div className="rounded-3xl border border-stone-800 bg-stone-950 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold text-stone-500">
                  Serviciu ales
                </p>

                <p className="mt-1 truncate text-base font-black text-stone-50">
                  {selectedService?.name || "Nesetat"}
                </p>

                {selectedService ? (
                  <p className="mt-1 text-xs font-black text-amber-300">
                    {selectedService.duration_minutes} min ·{" "}
                    {Number(selectedService.price).toFixed(0)} lei
                  </p>
                ) : null}
              </div>

              <a
                href="#"
                className="shrink-0 rounded-full border border-stone-700 px-3 py-2 text-xs font-black text-stone-300"
              >
                sus
              </a>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="barberId"
                className="text-sm font-black text-stone-100"
              >
                Frizer
              </label>

              <select
                id="barberId"
                name="barberId"
                value={selectedBarberId}
                onChange={(event) => {
                  setSelectedBarberId(event.target.value);
                  setSelectedDayKey("");
                  setSelectedSlot("");
                }}
                className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-base font-bold text-stone-50 outline-none transition focus:border-amber-400"
              >
                <option value="">Selectează frizerul</option>

                {barbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-950 p-3">
              <p className="text-sm font-black text-stone-100">Alege ora</p>

              {!selectedServiceId || !selectedBarberId ? (
                <div className="mt-3 rounded-2xl border border-stone-800 bg-stone-900 p-4">
                  <p className="text-sm font-bold text-stone-300">
                    Alege serviciul și frizerul.
                  </p>
                </div>
              ) : slotGroups.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-4">
                  <p className="text-sm font-black text-red-300">
                    Nu există ore libere.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-red-200/70">
                    Încearcă alt frizer sau alt serviciu.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {slotGroups.map((group) => {
                      const isSelected = selectedDay?.dayKey === group.dayKey;

                      return (
                        <button
                          key={group.dayKey}
                          type="button"
                          onClick={() => {
                            setSelectedDayKey(group.dayKey);
                            setSelectedSlot("");
                          }}
                          className={`min-w-[76px] rounded-2xl border px-3 py-3 text-center transition ${
                            isSelected
                              ? "border-amber-400 bg-amber-400 text-stone-950"
                              : "border-stone-800 bg-stone-900 text-stone-200"
                          }`}
                        >
                          <p className="text-xs font-black uppercase">
                            {group.dayShortLabel}
                          </p>

                          <p
                            className={`mt-1 text-[11px] font-bold ${
                              isSelected ? "text-stone-800" : "text-stone-500"
                            }`}
                          >
                            {group.dateLabel}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  {selectedDay ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                          {selectedDay.dayLabel}
                        </p>

                        <p className="text-xs font-bold text-stone-500">
                          {selectedDay.slots.length} ore libere
                        </p>
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-2">
                        {selectedDay.slots.map((slot) => {
                          const isSelected = selectedSlot === slot.value;

                          return (
                            <button
                              key={slot.value}
                              type="button"
                              onClick={() => setSelectedSlot(slot.value)}
                              className={`rounded-xl border px-2 py-3 text-sm font-black transition ${
                                isSelected
                                  ? "border-amber-400 bg-amber-400 text-stone-950"
                                  : "border-stone-800 bg-stone-900 text-stone-200 hover:border-amber-400 hover:text-amber-300"
                              }`}
                            >
                              {slot.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="rounded-3xl border border-stone-800 bg-stone-950 p-4">
              <p className="text-sm font-black text-stone-100">Date client</p>

              <div className="mt-4 space-y-4">
                <div>
                  <label
                    htmlFor="clientName"
                    className="text-sm font-bold text-stone-300"
                  >
                    Nume
                  </label>

                  <input
                    id="clientName"
                    name="clientName"
                    type="text"
                    placeholder="Numele tău"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-base font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="clientPhone"
                    className="text-sm font-bold text-stone-300"
                  >
                    Telefon
                  </label>

                  <input
                    id="clientPhone"
                    name="clientPhone"
                    type="tel"
                    placeholder="0722 123 456"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-base font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 text-xs leading-5 text-stone-500">
                    Vei primi SMS când rezervarea este confirmată.
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-900 p-4">
                  <input
                    name="marketingConsent"
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0 accent-amber-400"
                  />

                  <span className="text-xs font-bold leading-5 text-stone-300">
                    Vreau să primesc oferte și mesaje promoționale prin SMS. Pot
                    renunța oricând.
                  </span>
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!selectedServiceId || !selectedBarberId || !selectedSlot}
            className="mt-5 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-5 text-center text-base font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trimite rezervarea
          </button>

          <p className="mt-3 text-center text-xs leading-5 text-stone-500">
            Rezervarea intră în așteptare. {salonName} o confirmă prin SMS.
          </p>
        </form>
      </details>
    </div>
  );
}