import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Archive" };

function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-CA", { dateStyle: "long" });
}

export default async function ArchivePage() {
  const supabase = await createClient();
  const { data: editions } = await supabase
    .from("editions")
    .select("id, name, year, event_at, venue_name")
    .eq("state", "ARCHIVED")
    .order("year", { ascending: false });
  const list = editions ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Les Brunos</p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">Archive</h1>
        <p className="text-ivoire-muted font-sans text-sm">
          Les galas passés — palmarès par catégorie et présentations rejouables.
        </p>
        {list.length > 0 && (
          <Link
            href="/archive/stats"
            className="text-or-300 hover:text-or-400 mt-2 font-sans text-sm transition"
          >
            Statistiques inter-éditions →
          </Link>
        )}
      </header>

      {list.length === 0 ? (
        <div className="border-or-400/15 bg-noir-700/40 mt-10 flex flex-col items-center gap-3 rounded-3xl border px-6 py-16 text-center">
          <p className="text-or-400/60 font-display text-2xl">À l&apos;année prochaine.</p>
          <p className="text-ivoire-muted font-sans text-sm">
            L&apos;archive se remplira après la première soirée.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {list.map((e) => {
            const date = fmtDate(e.event_at);
            return (
              <li key={e.id}>
                <Link
                  href={`/archive/${e.id}`}
                  className="border-or-400/15 bg-noir-700/40 hover:border-or-400/40 group flex items-center justify-between gap-4 rounded-2xl border px-6 py-5 backdrop-blur-sm transition"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-ivoire font-display text-2xl font-semibold">
                      {e.name}
                    </span>
                    <span className="text-ivoire-faint font-sans text-xs">
                      {[date, e.venue_name].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </div>
                  <span className="text-or-400/60 group-hover:text-or-300 font-display text-3xl tabular-nums transition">
                    {e.year}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
