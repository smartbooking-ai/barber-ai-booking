import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptDpa, savePrivacySettings } from "./actions";

type PrivacySettingsPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type OrganizationPrivacyRow = {
  id: string;
  name: string | null;
  privacy_contact_email: string | null;
  privacy_contact_phone: string | null;
  data_retention_months: number | null;
  marketing_sms_enabled: boolean | null;
  privacy_policy_text: string | null;
  terms_text: string | null;
  dpa_accepted_at: string | null;
};

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Neacceptat";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest",
  }).format(new Date(dateValue));
}

function StatusBadge({
  label,
  ready,
}: {
  label: string;
  ready: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        ready
          ? "border-emerald-400/40 bg-emerald-400/10"
          : "border-amber-400/40 bg-amber-400/10"
      }`}
    >
      <p
        className={`text-[11px] font-bold ${
          ready ? "text-emerald-300" : "text-amber-300"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-black ${
          ready ? "text-emerald-300" : "text-amber-300"
        }`}
      >
        {ready ? "OK" : "Setup"}
      </p>
    </div>
  );
}

export default async function PrivacySettingsPage({
  searchParams,
}: PrivacySettingsPageProps) {
  const { error, success } = await searchParams;

  const supabase = await createSupabaseServerClient();

  // Verificăm utilizatorul autentificat.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Luăm organizația și rolul. GDPR settings este doar pentru owner.
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
        role,
        organization:organizations (
          id,
          name,
          privacy_contact_email,
          privacy_contact_phone,
          data_retention_months,
          marketing_sms_enabled,
          privacy_policy_text,
          terms_text,
          dpa_accepted_at
        )
      `,
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.organization) {
    redirect("/login");
  }

  if (profile.role !== "owner") {
    redirect("/dashboard?error=Doar owner-ul poate modifica setările GDPR.");
  }

  const organization = Array.isArray(profile.organization)
    ? profile.organization[0]
    : profile.organization;

  if (!organization) {
    redirect("/login");
  }

  const privacySettings = organization as OrganizationPrivacyRow;

  const hasPrivacyEmail = Boolean(privacySettings.privacy_contact_email);
  const hasRetention = Boolean(privacySettings.data_retention_months);
  const hasDpa = Boolean(privacySettings.dpa_accepted_at);
  const hasLegalTexts = Boolean(
    privacySettings.privacy_policy_text && privacySettings.terms_text,
  );

  const completedItems = [
    hasPrivacyEmail,
    hasRetention,
    hasDpa,
    hasLegalTexts,
  ].filter(Boolean).length;

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto min-h-screen max-w-md px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-black leading-none">
              GDPR & Privacy
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {privacySettings.name || "Salon"}
            </p>
          </div>
        </header>

        <div className="py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Setări
              </p>

              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-tight">
                GDPR & Privacy.
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
            Setările de aici sunt folosite pentru pagina publică, retenția
            datelor și consimțământul de marketing.
          </p>

          {success ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-bold text-emerald-300">{success}</p>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
              <p className="text-sm font-bold text-red-300">{error}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-3xl border border-amber-400/40 bg-amber-400/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-amber-300">
                  Progres GDPR
                </p>

                <p className="mt-1 text-xs leading-5 text-stone-400">
                  {completedItems} din 4 zone configurate.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-4 py-3 text-sm font-black text-stone-950">
                {completedItems}/4
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <StatusBadge label="Contact GDPR" ready={hasPrivacyEmail} />
            <StatusBadge label="Retenție" ready={hasRetention} />
            <StatusBadge label="DPA" ready={hasDpa} />
            <StatusBadge label="Texte legale" ready={hasLegalTexts} />
          </div>

          <details className="mt-4 overflow-hidden rounded-3xl border border-stone-800 bg-stone-900" open>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-black">Setări principale</p>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Contact GDPR, retenție date și marketing SMS.
                </p>
              </div>

              <span className="rounded-full bg-amber-400 px-3 py-2 text-xs font-black text-stone-950">
                edit
              </span>
            </summary>

            <form
              action={savePrivacySettings}
              className="border-t border-stone-800 p-4"
            >
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="privacyContactEmail"
                    className="text-sm font-bold text-stone-200"
                  >
                    Email contact GDPR
                  </label>

                  <input
                    id="privacyContactEmail"
                    name="privacyContactEmail"
                    type="email"
                    defaultValue={privacySettings.privacy_contact_email || ""}
                    placeholder="contact@salon.ro"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    Emailul la care clienții pot cere acces, ștergere sau
                    modificare date.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="privacyContactPhone"
                    className="text-sm font-bold text-stone-200"
                  >
                    Telefon contact GDPR
                  </label>

                  <input
                    id="privacyContactPhone"
                    name="privacyContactPhone"
                    type="tel"
                    defaultValue={privacySettings.privacy_contact_phone || ""}
                    placeholder="07xx xxx xxx"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="dataRetentionMonths"
                    className="text-sm font-bold text-stone-200"
                  >
                    Păstrare date rezervări
                  </label>

                  <select
                    id="dataRetentionMonths"
                    name="dataRetentionMonths"
                    defaultValue={String(
                      privacySettings.data_retention_months || 24,
                    )}
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-950 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition focus:border-amber-400"
                  >
                    <option value="6">6 luni</option>
                    <option value="12">12 luni</option>
                    <option value="24">24 luni</option>
                    <option value="36">36 luni</option>
                    <option value="60">60 luni</option>
                  </select>

                  <p className="mt-2 px-1 text-xs leading-5 text-stone-500">
                    După această perioadă, datele personale pot fi anonimizate
                    prin jobul de retenție.
                  </p>
                </div>

                <label className="flex items-start gap-3 rounded-2xl border border-stone-800 bg-stone-950 p-4">
                  <input
                    name="marketingSmsEnabled"
                    type="checkbox"
                    defaultChecked={Boolean(
                      privacySettings.marketing_sms_enabled,
                    )}
                    className="mt-1 h-5 w-5 shrink-0 accent-amber-400"
                  />

                  <span className="text-xs font-bold leading-5 text-stone-300">
                    Permite marketing SMS doar pentru clienții care au bifat
                    consimțământul separat.
                  </span>
                </label>

                <details className="overflow-hidden rounded-2xl border border-stone-800 bg-stone-950">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4">
                    <div>
                      <p className="text-sm font-black">Texte legale</p>
                      <p className="mt-1 text-xs text-stone-500">
                        Opțional, pentru personalizare.
                      </p>
                    </div>

                    <span className="rounded-full bg-stone-900 px-3 py-2 text-xs font-black text-stone-300">
                      deschide
                    </span>
                  </summary>

                  <div className="space-y-4 border-t border-stone-800 p-4">
                    <div>
                      <label
                        htmlFor="privacyPolicyText"
                        className="text-sm font-bold text-stone-200"
                      >
                        Text privacy personalizat
                      </label>

                      <textarea
                        id="privacyPolicyText"
                        name="privacyPolicyText"
                        defaultValue={
                          privacySettings.privacy_policy_text || ""
                        }
                        rows={5}
                        placeholder="Text opțional pentru pagina publică..."
                        className="mt-2 w-full resize-none rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="termsText"
                        className="text-sm font-bold text-stone-200"
                      >
                        Termeni personalizați
                      </label>

                      <textarea
                        id="termsText"
                        name="termsText"
                        defaultValue={privacySettings.terms_text || ""}
                        rows={5}
                        placeholder="Text opțional pentru termeni..."
                        className="mt-2 w-full resize-none rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm font-bold text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                      />
                    </div>
                  </div>
                </details>
              </div>

              <button
                type="submit"
                className="mt-5 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300"
              >
                Salvează setările GDPR
              </button>
            </form>
          </details>

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-black">DPA</p>

                <p className="mt-1 text-xs leading-5 text-stone-500">
                  Acordul de procesare date dintre aplicație și salon.
                </p>

                <p className="mt-3 text-xs font-bold text-stone-400">
                  Status:{" "}
                  <span
                    className={
                      hasDpa ? "text-emerald-300" : "text-amber-300"
                    }
                  >
                    {hasDpa
                      ? `Acceptat la ${formatDate(
                          privacySettings.dpa_accepted_at,
                        )}`
                      : "Neacceptat"}
                  </span>
                </p>
              </div>

              <span
                className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${
                  hasDpa
                    ? "bg-emerald-400 text-stone-950"
                    : "bg-amber-400 text-stone-950"
                }`}
              >
                {hasDpa ? "OK" : "Setup"}
              </span>
            </div>

            {!hasDpa ? (
              <form action={acceptDpa} className="mt-4">
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/10 px-6 py-4 text-center text-sm font-black text-amber-300"
                >
                  Accept DPA
                </button>
              </form>
            ) : null}

            <a
              href="/dpa"
              className="mt-3 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
            >
              Vezi DPA
            </a>
          </div>

          <div className="mt-4 rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-sm font-black">Pagini legale</p>

            <p className="mt-2 text-xs leading-5 text-stone-500">
              Linkuri publice pentru clienți și saloane.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href="/privacy"
                className="flex items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-xs font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                Privacy
              </a>

              <a
                href="/terms"
                className="flex items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-xs font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                Terms
              </a>

              <a
                href="/dpa"
                className="flex items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-xs font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                DPA
              </a>

              <a
                href="/subprocessors"
                className="flex items-center justify-center rounded-2xl border border-stone-800 bg-stone-950 px-4 py-3 text-xs font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                Subprocessors
              </a>
            </div>
          </div>

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
        </div>
      </section>
    </main>
  );
}