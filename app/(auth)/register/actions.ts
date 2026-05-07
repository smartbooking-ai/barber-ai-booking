"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RegisterSalonResult = {
  success: boolean;
  error?: string;
};

function createSlugFromName(name: string) {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ă/g, "a")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/ș/g, "s")
    .replace(/ş/g, "s")
    .replace(/ț/g, "t")
    .replace(/ţ/g, "t")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function createUniqueSalonSlug(salonName: string) {
  const supabaseAdmin = createSupabaseAdminClient();

  const baseSlug = createSlugFromName(salonName) || "salon";
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return slug;
    }

    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export async function registerSalonAccount(formData: {
  salonName: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
}): Promise<RegisterSalonResult> {
  const salonName = formData.salonName.trim();
  const ownerName = formData.ownerName.trim();
  const phone = formData.phone.trim();
  const email = formData.email.trim().toLowerCase();
  const password = formData.password;

  if (!salonName) {
    return { success: false, error: "Completează numele salonului." };
  }

  if (!ownerName) {
    return { success: false, error: "Completează numele proprietarului." };
  }

  if (!phone) {
    return { success: false, error: "Completează telefonul salonului." };
  }

  if (!email || !email.includes("@")) {
    return { success: false, error: "Completează un email valid." };
  }

  if (password.length < 8) {
    return {
      success: false,
      error: "Parola trebuie să aibă minim 8 caractere.",
    };
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: createdUser, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: ownerName,
      },
    });

  if (createUserError) {
    return {
      success: false,
      error: createUserError.message,
    };
  }

  const userId = createdUser.user?.id;

  if (!userId) {
    return {
      success: false,
      error: "Nu am putut crea userul în Supabase Auth.",
    };
  }

  try {
    const slug = await createUniqueSalonSlug(salonName);

    const { data: organization, error: organizationError } =
      await supabaseAdmin
        .from("organizations")
        .insert({
          name: salonName,
          slug,
          phone,
          whatsapp_phone: phone,
          country: "Romania",
        })
        .select("id")
        .single();

    if (organizationError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return {
        success: false,
        error: organizationError.message,
      };
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      organization_id: organization.id,
      full_name: ownerName,
      phone,
      role: "owner",
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return {
        success: false,
        error: profileError.message,
      };
    }

    const { error: barberError } = await supabaseAdmin.from("barbers").insert({
      organization_id: organization.id,
      name: ownerName,
      phone,
      whatsapp_phone: phone,
      is_active: true,
    });

    if (barberError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);

      return {
        success: false,
        error: barberError.message,
      };
    }

    return { success: true };
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(userId);

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "A apărut o eroare la crearea contului.",
    };
  }
}