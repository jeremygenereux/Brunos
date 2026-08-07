import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadArchiveStats, loadFunStats } from "@/lib/editions/stats";
import { listCircles } from "@/lib/editions/circle";
import { LifetimeBoard, FunAwards } from "./stats-panels";
import { formatEventDate } from "@/lib/dates/event-time";

export const metadata: Metadata = { title: "Archive" };

function fmtDate(value: string | null) {
  if (!value) return null;
  return formatEventDate(value);
}

export default async function ArchivePage() {
  const supabase = await createClient();

  // Une section PAR CERCLE : chaque cercle a son propre palmarès, et les
  // gorgées de l'un n'entrent jamais dans les totaux de l'autre. Pour qui
  // n'appartient qu'à un cercle — tout le monde ou presque — la page est
  // identique à avant, sans en-tête de cercle.
  const circles = await listCircles(supabase);
  const sections = (
    await Promise.all(
      circles.map(async (circle) => {
        const [{ data: editions }, stats, funAwards] = await Promise.all([
          supabase
            .from("editions")
            .select("id, name, year, event_at, venue_name")
            .eq("state", "ARCHIVED")
            .eq("circle_id", circle.id)
            .order("year", { ascending: false }),
          loadArchiveStats(supabase, circle.id),
          loadFunStats(supabase, circle.id),
        ]);
        return { circle, editions: editions ?? [], stats, funAwards };
      }),
    )
  ).filter((s) => s.editions.length > 0);

  const single = sections.length <= 1;

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/account"
        className="text-ivoire-muted hover:text-or-300 mb-6 inline-block font-sans text-sm transition"
      >
        ← Mon espace
      </Link>
      <header className="flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Les Brunos</p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">Archive</h1>
        <p className="text-ivoire-muted font-sans text-sm">
          Les cérémonies passées, leurs résultats et leurs présentations.
        </p>
      </header>

      {sections.length === 0 ? (
        <div className="border-or-400/15 bg-noir-700/40 mt-10 flex flex-col items-center gap-3 rounded-3xl border px-6 py-16 text-center">
          <p className="text-or-400/60 font-display text-2xl">À l&apos;année prochaine.</p>
          <p className="text-ivoire-muted font-sans text-sm">
            L&apos;archive s&apos;ouvrira après la première cérémonie.
          </p>
        </div>
      ) : (
        sections.map(({ circle, editions, stats, funAwards }) => (
          <section key={circle.id} className={single ? "" : "border-or-400/15 mt-14 border-t pt-10"}>
            {!single && (
              <h2 className="text-or-300 font-sans text-sm tracking-[0.35em] uppercase">
                {circle.name}
              </h2>
            )}

            {/* Les statistiques d'abord : c'est ce qui se lit, pas ce qui se
                navigue. Le choix d'une édition vient ensuite. */}
            <div className="mt-10 flex flex-col gap-12">
              <LifetimeBoard drinkers={stats.drinkers} editionsCount={stats.editionsCount} />
              <FunAwards awards={funAwards} />
            </div>

            <h2 className="text-ivoire font-display mt-14 text-3xl font-semibold">
              Les cérémonies
            </h2>

            <ul className="mt-8 flex flex-col gap-3">
              {editions.map((e) => {
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
          </section>
        ))
      )}
    </main>
  );
}
