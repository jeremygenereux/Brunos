import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadArchiveStats } from "@/lib/editions/stats";
import { Avatar } from "@/components/avatar";

export const metadata: Metadata = { title: "Statistiques" };

export default async function ArchiveStatsPage() {
  const supabase = await createClient();
  const { drinkers, editionsCount } = await loadArchiveStats(supabase);
  const maxTotal = drinkers.length ? drinkers[0].totalDrinks : 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/archive"
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← Archive
      </Link>

      <header className="mt-4 flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
          Inter-éditions
        </p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">Le palmarès</h1>
        <p className="text-ivoire-muted font-sans text-sm">
          Cumul à vie sur {editionsCount} édition{editionsCount > 1 ? "s" : ""} archivée
          {editionsCount > 1 ? "s" : ""}.
        </p>
      </header>

      {drinkers.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-8 rounded-2xl border px-6 py-12 text-center font-sans text-sm">
          Aucune statistique pour l&apos;instant — archive une première édition.
        </p>
      ) : (
        <ol className="mt-8 flex flex-col gap-2">
          {drinkers.map((d, i) => (
            <li
              key={d.personId}
              className={`brunos-glass flex items-center gap-4 rounded-2xl border px-5 py-3.5 ${
                i === 0 ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
              }`}
            >
              <span className="text-ivoire-faint font-display w-6 text-right text-lg tabular-nums">
                {i + 1}
              </span>
              <Avatar name={d.name} headshot={d.headshot} size={40} />
              <div className="flex flex-1 flex-col gap-0.5">
                <Link
                  href={`/archive/players/${d.personId}`}
                  className="text-ivoire hover:text-or-300 font-sans font-medium transition"
                >
                  {d.name}
                </Link>
                <span className="text-ivoire-faint font-sans text-xs">
                  {d.titleCount} titre{d.titleCount > 1 ? "s" : ""} · {d.editionCount} édition
                  {d.editionCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-noir-900/60 hidden h-2 w-28 overflow-hidden rounded-full sm:block">
                  <span
                    className="from-or-300 to-or-600 block h-full bg-gradient-to-r"
                    style={{ width: `${maxTotal ? (d.totalDrinks / maxTotal) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-or-300 font-display w-12 text-right text-2xl tabular-nums">
                  {d.totalDrinks}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
      {drinkers.length > 0 && (
        <p className="text-ivoire-faint mt-4 text-right font-sans text-xs">gorgées cumulées</p>
      )}
    </main>
  );
}
