"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    if (!email.trim() || !email.includes("@")) {
      setError("Completează un email valid.");
      setIsSubmitting(false);
      return;
    }

    if (!password) {
      setError("Completează parola.");
      setIsSubmitting(false);
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (loginError) {
      setError("Email sau parolă greșită.");
      setIsSubmitting(false);
      return;
    }

    router.replace("/dashboard");
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
            <p className="mt-1 text-xs text-stone-500">Intrare salon</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="rounded-[1.75rem] border border-stone-800 bg-stone-900 p-4 shadow-2xl shadow-black/30">
            <div className="rounded-[1.35rem] bg-stone-950 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
                Login
              </p>

              <h1 className="mt-4 text-3xl font-black tracking-tight">
                Intră în aplicație
              </h1>

              <p className="mt-3 text-sm leading-6 text-stone-400">
                Autentificare reală cu Supabase Auth.
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
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
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="mt-2 w-full rounded-2xl border border-stone-800 bg-stone-900 px-4 py-4 text-sm text-stone-50 outline-none transition placeholder:text-stone-600 focus:border-amber-400"
                  />
                </div>

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
                  {isSubmitting ? "Se verifică..." : "Intră în dashboard"}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-stone-800 bg-stone-900 p-4 text-center">
                <p className="text-sm text-stone-400">Nu ai cont încă?</p>

                <a
                  href="/register"
                  className="mt-3 flex w-full items-center justify-center rounded-2xl border border-amber-400/60 px-6 py-4 text-center text-sm font-black text-amber-300 transition hover:bg-amber-400 hover:text-stone-950"
                >
                  Creează salon
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