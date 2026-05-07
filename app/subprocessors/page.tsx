export default function SubprocessorsPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-md px-4 py-6">
        <a href="/" className="text-sm font-black text-amber-300">
          ← Înapoi
        </a>

        <h1 className="mt-6 text-4xl font-black leading-tight">
          Sub-procesatori
        </h1>

        <div className="mt-6 space-y-4">
          <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-lg font-black">Supabase</p>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Bază de date, autentificare și API.
            </p>
          </div>

          <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-lg font-black">Vercel</p>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Hosting aplicație web.
            </p>
          </div>

          <div className="rounded-3xl border border-stone-800 bg-stone-900 p-4">
            <p className="text-lg font-black">Twilio</p>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              Trimitere SMS pentru confirmări, anulări și notificări.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}