"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkingHourUpsert = {
  organization_id: string;
  day_of_week: number;
  is_open: boolean;
  start_time: string;
  end_time: string;
  updated_at: string;
};

const dayValues = [1, 2, 3, 4, 5, 6, 7];

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

async function getOwnerOrganizationContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate modifica programul.");
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  };
}

export async function saveWorkingHours(formData: FormData) {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const rows: WorkingHourUpsert[] = [];

  dayValues.forEach((day) => {
    const isOpen = cleanText(formData.get(`isOpen-${day}`)) === "on";
    const startTime = cleanText(formData.get(`startTime-${day}`)) || "09:00";
    const endTime = cleanText(formData.get(`endTime-${day}`)) || "18:00";

    if (isOpen) {
      if (!isValidTime(startTime) || !isValidTime(endTime)) {
        redirect(
          `/setup/schedule?error=${encodeURIComponent(
            "Ora de deschidere sau închidere nu este validă.",
          )}`,
        );
      }

      if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
        redirect(
          `/setup/schedule?error=${encodeURIComponent(
            "Ora de închidere trebuie să fie după ora de deschidere.",
          )}`,
        );
      }
    }

    rows.push({
      organization_id: organizationId,
      day_of_week: day,
      is_open: isOpen,
      start_time: startTime,
      end_time: endTime,
      updated_at: new Date().toISOString(),
    });
  });

  const { error } = await supabase.from("working_hours").upsert(rows, {
    onConflict: "organization_id,day_of_week",
  });

  if (error) {
    redirect(
      `/setup/schedule?error=${encodeURIComponent(
        `Nu am putut salva programul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/setup/schedule");
  revalidatePath("/setup");
  revalidatePath("/dashboard");

  redirect("/setup");
}