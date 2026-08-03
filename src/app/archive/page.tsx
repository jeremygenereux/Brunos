import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadArchiveStats, loadFunStats } from "@/lib/editions/stats";
import { LifetimeBoard, FunAwards } from "./stats-panels";

export const metadata: Metadata = { title: "Archive" };

function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-CA", { dateStyle: "long" });
}

export default async function ArchivePage() {
  const supabase = await createClient();
  const [{ data: editions }, { drinkers, editionsCount }, funAwards] = await Promise.all([
    supabase
      .from("editions")
      .select("id, name, year, event_at, venue_name")
      .eq("state", "ARCHIVED")
      .order("year", { ascending: false }),
    loadArchiveStats(supabase),
    loadFunStats(supabase),
  ]);
  const list = editions ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/account"
        className="text-ivoire-muted hover:text-or-300 mb-6 inline-block font-sans text-sm transition"
      >
        ← Accueil
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Les Brunos</p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">Archive</h1>
        <p className="text-ivoire-muted font-sans text-sm">
          Les galas passés — palmarès par catégorie et présentations rejouables.
        </p>
      </header>

      {/* Les statistiques d'abord : c'est ce qui se lit, pas ce qui se navigue.
          Le choix d'une édition vient ensuite. */}
      {list.length > 0 && (
        <div className="mt-10 flex flex-col gap-12">
          <LifetimeBoard drinkers={drinkers} editionsCount={editionsCount} />
          <FunAwards awards={funAwards} />
        </div>
      )}

      {list.length > 0 && (
        <h2 className="text-ivoire font-display mt-14 text-3xl font-semibold">Les éditions</h2>
      )}

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
