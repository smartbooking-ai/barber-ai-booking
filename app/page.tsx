export default function HomePage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-4 sm:px-6">
        <header className="flex items-center gap-3 rounded-3xl border border-stone-800 bg-stone-900/70 px-4 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-stone-950">
            B
          </div>

          <div>
            <p className="text-sm font-black leading-none">Barber AI Booking</p>
            <p className="mt-1 text-xs text-stone-500">Pentru frizerii</p>
          </div>
        </header>

        <div className="flex flex-1 flex-col justify-center py-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-400">
            Aplicație pentru saloane
          </p>

          <h1 className="mt-5 text-4xl font-black leading-[1.05] tracking-tight text-stone-50 sm:text-6xl">
            Rezervări online pentru frizeria ta.
          </h1>

          <div className="mt-7 grid gap-3">
            <div className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3">
              <p className="text-sm font-bold">Programări rapide</p>
              <p className="mt-1 text-xs text-stone-400">
                Clienții aleg serviciul, frizerul și ora liberă.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3">
              <p className="text-sm font-bold">Confirmări și remindere</p>
              <p className="mt-1 text-xs text-stone-400">
                Mesaje automate pentru rezervări și anulări.
              </p>
            </div>

            <div className="rounded-2xl border border-stone-800 bg-stone-900 px-4 py-3">
              <p className="text-sm font-bold">WhatsApp + AI</p>
              <p className="mt-1 text-xs text-stone-400">
                Mai târziu, AI-ul va răspunde și va face rezervări.
              </p>
            </div>
          </div>

          <a
            href="/login"
            className="mt-7 flex w-full items-center justify-center rounded-2xl bg-amber-400 px-6 py-4 text-center text-sm font-black text-stone-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-300 sm:w-fit"
          >
            Începe cu salonul tău
          </a>
        </div>
      </section>
    </main>
  );
}