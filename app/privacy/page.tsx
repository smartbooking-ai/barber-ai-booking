export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-stone-950 text-stone-50">
      <section className="mx-auto max-w-md px-4 py-6">
        <a href="/" className="text-sm font-black text-amber-300">
          ← Înapoi
        </a>

        <h1 className="mt-6 text-4xl font-black leading-tight">
          Politica de confidențialitate
        </h1>

        <div className="mt-6 space-y-5 text-sm leading-7 text-stone-300">
          <p>
            Această aplicație este folosită de saloane și frizerii pentru
            gestionarea rezervărilor online.
          </p>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Ce date colectăm
            </h2>

            <p className="mt-2">
              Pentru o rezervare putem colecta nume, telefon, serviciu ales,
              frizer ales, data și ora rezervării, precum și istoricul mesajelor
              trimise pentru confirmări sau anulări.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              De ce folosim datele
            </h2>

            <p className="mt-2">
              Datele sunt folosite pentru crearea și gestionarea rezervării,
              notificări legate de rezervare, prevenirea suprapunerilor și
              administrarea activității salonului.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">SMS</h2>

            <p className="mt-2">
              Clientul poate primi mesaje SMS legate direct de rezervare, cum ar
              fi confirmarea, anularea sau reamintirea programării.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">Marketing</h2>

            <p className="mt-2">
              Mesajele promoționale se trimit doar dacă ai bifat acordul pentru
              marketing. Confirmările și anulările legate direct de rezervare nu
              sunt considerate marketing.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Drepturile tale
            </h2>

            <p className="mt-2">
              Poți cere acces la date, rectificare, ștergere, restricționare sau
              portabilitate, contactând salonul unde ai făcut rezervarea.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Unde sunt stocate datele
            </h2>

            <p className="mt-2">
              Datele sunt stocate în servicii folosite pentru funcționarea
              aplicației, cum ar fi baza de date, hosting-ul și furnizorul de SMS.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-stone-50">
              Sub-procesatori
            </h2>

            <p className="mt-2">
              Pentru funcționarea aplicației pot fi folosite servicii precum
              Supabase, Vercel și Twilio.
            </p>

            <a
              href="/subprocessors"
              className="mt-3 inline-block text-sm font-black text-amber-300"
            >
              Vezi lista sub-procesatorilor
            </a>
          </section>
        </div>
      </section>
    </main>
  );
}