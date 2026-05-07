"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendSmsMessage } from "@/lib/sms/twilio";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function cleanText(value: FormDataEntryValue | null) {
  return String(value || "").trim();
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
    redirect("/dashboard?error=Doar owner-ul poate administra SMS-urile.");
  }

  return {
    supabase,
    organizationId: profile.organization_id,
  };
}

export async function retrySmsMessage(formData: FormData) {
  const messageId = cleanText(formData.get("messageId"));

  if (!messageId) {
    redirect("/dashboard/messages?error=Mesaj invalid.");
  }

  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("id, organization_id, status")
    .eq("id", messageId)
    .eq("organization_id", organizationId)
    .single();

  if (messageError || !message) {
    redirect("/dashboard/messages?error=Mesajul nu a fost găsit.");
  }

  await supabase
    .from("messages")
    .update({
      status: "pending",
      error_message: null,
      archived_at: null,
    })
    .eq("id", messageId)
    .eq("organization_id", organizationId);

  const result = await sendSmsMessage(messageId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messages");

  if (!result.ok) {
    redirect(
      `/dashboard/messages?error=${encodeURIComponent(
        `SMS-ul nu a putut fi retrimis. Detalii: ${result.error}`,
      )}`,
    );
  }

  redirect("/dashboard/messages?success=SMS-ul a fost retrimis.");
}

export async function archiveSmsMessage(formData: FormData) {
  const messageId = cleanText(formData.get("messageId"));

  if (!messageId) {
    redirect("/dashboard/messages?error=Mesaj invalid.");
  }

  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const { error } = await supabase
    .from("messages")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .eq("organization_id", organizationId);

  if (error) {
    redirect(
      `/dashboard/messages?error=${encodeURIComponent(
        `Nu am putut arhiva mesajul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messages");

  redirect("/dashboard/messages?success=Mesajul a fost arhivat.");
}

export async function unarchiveSmsMessage(formData: FormData) {
  const messageId = cleanText(formData.get("messageId"));

  if (!messageId) {
    redirect("/dashboard/messages?status=archived&error=Mesaj invalid.");
  }

  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const { error } = await supabase
    .from("messages")
    .update({
      archived_at: null,
    })
    .eq("id", messageId)
    .eq("organization_id", organizationId);

  if (error) {
    redirect(
      `/dashboard/messages?status=archived&error=${encodeURIComponent(
        `Nu am putut restaura mesajul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messages");

  redirect("/dashboard/messages?status=archived&success=Mesajul a fost restaurat.");
}

export async function deleteSmsMessage(formData: FormData) {
  const messageId = cleanText(formData.get("messageId"));
  const returnStatus = cleanText(formData.get("returnStatus")) || "problems";

  if (!messageId) {
    redirect(`/dashboard/messages?status=${returnStatus}&error=Mesaj invalid.`);
  }

  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("organization_id", organizationId);

  if (error) {
    redirect(
      `/dashboard/messages?status=${returnStatus}&error=${encodeURIComponent(
        `Nu am putut șterge mesajul. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messages");

  redirect(
    `/dashboard/messages?status=${returnStatus}&success=Mesajul a fost șters definitiv.`,
  );
}

export async function archiveAllFailedSmsMessages() {
  const { supabase, organizationId } = await getOwnerOrganizationContext();

  const { error } = await supabase
    .from("messages")
    .update({
      archived_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId)
    .eq("channel", "sms")
    .eq("status", "failed")
    .is("archived_at", null);

  if (error) {
    redirect(
      `/dashboard/messages?error=${encodeURIComponent(
        `Nu am putut arhiva mesajele eșuate. Detalii: ${error.message}`,
      )}`,
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/messages");

  redirect("/dashboard/messages?success=Mesajele eșuate au fost arhivate.");
}