export default function TermsPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-md px-4 py-6">
        <a href="/" className="text-sm font-black text-amber-300">
          ← Înapoi
        </a>

        <h1 className="mt-6 text-4xl font-black leading-tight">
          Termeni și condiții
        </h1>

        <div className="mt-6 space-y-5 text-sm leading-7 text-stone-300">
          <p>
            Aplicația permite clienților să trimită cereri de rezervare către
            saloane și frizerii.
          </p>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Rezervări
            </h2>
            <p className="mt-2">
              O rezervare poate intra inițial în status de așteptare. Salonul o
              poate confirma sau refuza. Confirmarea finală este făcută de salon.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Notificări
            </h2>
            <p className="mt-2">
              Clientul poate primi SMS-uri legate de confirmarea, anularea sau
              modificarea rezervării.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Responsabilitatea salonului
            </h2>
            <p className="mt-2">
              Salonul este responsabil pentru corectitudinea serviciilor,
              prețurilor, programului și pentru administrarea rezervărilor.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}