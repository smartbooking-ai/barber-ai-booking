import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MessageRow = {
  id: string;
  to_phone: string | null;
  body: string | null;
};

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    return {
      isConfigured: false,
      accountSid: "",
      authToken: "",
      fromPhone: "",
    };
  }

  return {
    isConfigured: true,
    accountSid,
    authToken,
    fromPhone,
  };
}

function createBasicAuthHeader(accountSid: string, authToken: string) {
  const token = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  return `Basic ${token}`;
}

export async function sendSmsMessage(messageId: string) {
  const supabaseAdmin = createSupabaseAdminClient();

  const { data: message, error: messageError } = await supabaseAdmin
    .from("messages")
    .select("id, to_phone, body")
    .eq("id", messageId)
    .single<MessageRow>();

  if (messageError || !message) {
    return {
      ok: false,
      error: messageError?.message || "Mesajul nu a fost găsit.",
    };
  }

  const twilioConfig = getTwilioConfig();

  if (!twilioConfig.isConfigured) {
    await supabaseAdmin
      .from("messages")
      .update({
        status: "pending",
        provider: "twilio",
        error_message:
          "Twilio nu este configurat încă în .env.local. Mesajul a rămas pending.",
      })
      .eq("id", message.id);

    return {
      ok: false,
      error: "Twilio nu este configurat.",
    };
  }

  if (!message.to_phone) {
    await supabaseAdmin
      .from("messages")
      .update({
        status: "failed",
        provider: "twilio",
        error_message: "Lipsește numărul destinatarului.",
      })
      .eq("id", message.id);

    return {
      ok: false,
      error: "Lipsește numărul destinatarului.",
    };
  }

  if (!message.body) {
    await supabaseAdmin
      .from("messages")
      .update({
        status: "failed",
        provider: "twilio",
        error_message: "Lipsește corpul mesajului.",
      })
      .eq("id", message.id);

    return {
      ok: false,
      error: "Lipsește corpul mesajului.",
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Messages.json`;

  const requestBody = new URLSearchParams({
    From: twilioConfig.fromPhone,
    To: message.to_phone,
    Body: message.body,
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: createBasicAuthHeader(
          twilioConfig.accountSid,
          twilioConfig.authToken,
        ),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: requestBody,
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMessage =
        responseData?.message ||
        responseData?.error_message ||
        "Twilio a respins mesajul.";

      await supabaseAdmin
        .from("messages")
        .update({
          status: "failed",
          provider: "twilio",
          from_phone: twilioConfig.fromPhone,
          error_message: errorMessage,
        })
        .eq("id", message.id);

      return {
        ok: false,
        error: errorMessage,
      };
    }

    await supabaseAdmin
      .from("messages")
      .update({
        status: "sent",
        provider: "twilio",
        from_phone: twilioConfig.fromPhone,
        provider_message_id: responseData?.sid || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", message.id);

    return {
      ok: true,
      providerMessageId: responseData?.sid || null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Eroare necunoscută Twilio.";

    await supabaseAdmin
      .from("messages")
      .update({
        status: "failed",
        provider: "twilio",
        from_phone: twilioConfig.fromPhone,
        error_message: errorMessage,
      })
      .eq("id", message.id);

    return {
      ok: false,
      error: errorMessage,
    };
  }
}