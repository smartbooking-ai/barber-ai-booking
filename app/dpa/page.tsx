export default function DpaPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-md px-4 py-6">
        <a href="/" className="text-sm font-black text-amber-300">
          ← Înapoi
        </a>

        <h1 className="mt-6 text-4xl font-black leading-tight">
          DPA - Acord de prelucrare date
        </h1>

        <div className="mt-6 space-y-5 text-sm leading-7 text-stone-300">
          <p>
            Acest document descrie relația dintre salon/frizerie, ca operator de
            date, și aplicație, ca procesator al datelor folosite pentru
            rezervări.
          </p>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Date procesate
            </h2>
            <p className="mt-2">
              Nume client, telefon, rezervări, servicii, frizer ales, mesaje
              tranzacționale și consimțăminte.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Scop
            </h2>
            <p className="mt-2">
              Datele sunt procesate pentru gestionarea rezervărilor și
              notificărilor asociate.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Sub-procesatori
            </h2>
            <p className="mt-2">
              Aplicația poate folosi furnizori pentru hosting, bază de date,
              autentificare și SMS.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}