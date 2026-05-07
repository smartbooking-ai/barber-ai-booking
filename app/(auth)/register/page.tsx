"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { registerSalonAccount } from "./actions";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [salonName, setSalonName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setSuccessMessage("");
    setIsSubmitting(true);

    const result = await registerSalonAccount({
      salonName,
      ownerName,
      phone,
      email,
      password,
    });

    if (!result.success) {
      setError(result.error || "Nu am putut crea contul.");
      setIsSubmitting(false);
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (loginError) {
      setSuccessMessage(
        "Contul a fost creat. Login-ul automat a eșuat, dar poți intra manual cu emailul și parola.",
      );

      setError(`Eroare login Supabase: ${loginError.message}`);
      setIsSubmitting(false);
      return;
    }

    router.replace("/setup");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-4">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div>
            <p className="text-sm font-black leading-none">Barber AI Booking</p>
            <p className="mt-1 text-xs text-stone-500">Creează salon</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="rounded-[1.75rem] border border-stone-800 bg-stone-900 p-4 shadow-2xl shadow-black/30">
            <div className="rounded-[1.35rem] bg-stone-950 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Cont nou
              </p>

              <h1 className="mt-4 text-3xl font-black tracking-tight">
                Creează salonul tău
              </h1>

              <p className="mt-3 text-sm leading-6 text-stone-400">
                Completează datele salonului. Contul se creează real în
                Supabase.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label
                    htmlFor="salonName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Nume salon
                  </label>

                  <input
                    id="salonName"
                    type="text"
                    value={salonName}
                    onChange={(event) => setSalonName(event.target.value)}
                    placeholder="Frizeria Vasi"
                    autoComplete="organization"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ownerName"
                    className="text-sm font-bold text-stone-200"
                  >
                    Nume proprietar
                  </label>

                  <input
                    id="ownerName"
                    type="text"
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Vasi Popescu"
                    autoComplete="name"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="text-sm font-bold text-stone-200"
                  >
                    Telefon salon
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="07xx xxx xxx"
                    autoComplete="tel"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="text-sm font-bold text-stone-200"
                  >
                    Email
                  </label>

                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="salon@email.com"
                    autoComplete="email"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-bold text-stone-200"
                  >
                    Parolă
                  </label>

                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minim 8 caractere"
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
                    <p className="text-sm font-bold text-emerald-300">
                      {successMessage}
                    </p>
                  </div>
                ) : null}

                {error ? (
                  <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3">
                    <p className="text-sm font-bold text-red-300">{error}</p>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Se creează contul..." : "Creează cont"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-stone-800 bg-stone-900 p-4 text-center">
                <p className="text-sm text-stone-400">Ai deja cont?</p>

                <a
                  href="/login"
                  className="mt-3 flex w-full items-center justify-center rounded-2xl border border-amber-400/60 px-6 py-4 text-center text-sm font-black text-amber-300 transition hover:bg-amber-400 hover:text-stone-950"
                >
                  Intră în aplicație
                </a>
              </div>

              <a
                href="/"
                className="mt-4 flex w-full items-center justify-center rounded-2xl border border-stone-800 bg-stone-900 px-6 py-4 text-center text-sm font-black text-stone-200 transition hover:border-amber-400 hover:text-amber-300"
              >
                Înapoi
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}