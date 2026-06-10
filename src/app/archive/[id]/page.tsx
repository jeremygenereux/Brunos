import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPresentation } from "@/lib/editions/presentation";
import type { RankRow } from "@/lib/editions/presentation-types";
import { Avatar } from "@/components/avatar";

export const metadata: Metadata = { title: "Résultats" };

function fmtDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("fr-CA", { dateStyle: "long" });
}

function RankList({
  title,
  rows,
  showDrinks,
}: {
  title: string;
  rows: RankRow[];
  showDrinks: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-or-400/70 font-sans text-xs tracking-[0.25em] uppercase">{title}</p>
      <ol className="flex flex-col gap-1.5">
        {rows.map((r) => {
          const shooter = showDrinks && Boolean(r.isShooter);
          return (
            <li
              key={r.playerId}
              className={`brunos-glass flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                shooter ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
              }`}
            >
              <span className="text-ivoire-faint w-5 text-right font-sans text-sm tabular-nums">
                {r.finalRank}
              </span>
              <Avatar name={r.name} headshot={r.headshot} size={32} />
              <span className="flex flex-1 items-center gap-1.5">
                {showDrinks && r.isWinner && <span title="Gagnant·e">🏆</span>}
                {r.personId ? (
                  <Link
                    href={`/archive/players/${r.personId}`}
                    className="text-ivoire hover:text-or-300 font-sans text-sm transition"
                  >
                    {r.name}
                  </Link>
                ) : (
                  <span className="text-ivoire font-sans text-sm">{r.name}</span>
                )}
              </span>
              {showDrinks && (
                <span
                  className={`font-sans text-sm tabular-nums ${
                    shooter ? "text-or-300" : "text-ivoire-muted"
                  }`}
                >
                  {shooter ? "🥃 " : ""}
                  {r.drinks}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default async function ArchiveEditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadPresentation(supabase, id);
  if (!data.edition || data.edition.state !== "ARCHIVED") notFound();
  const { edition, categories, recap } = data;
  const date = fmtDate(edition.eventAt);
  const topDrinker = recap[0];
  const hasPlayable = categories.some((c) => c.players.length > 0);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <Link
        href="/archive"
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← Archive
      </Link>

      <header className="mt-4 flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
          Les Brunos {edition.year}
        </p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">{edition.name}</h1>
        <p className="text-ivoire-faint font-sans text-sm">
          {[date, edition.venueName].filter(Boolean).join(" · ") || "—"}
        </p>
      </header>

      {hasPlayable && (
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link
            href={`/archive/${id}/present`}
            className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-full bg-gradient-to-b px-6 py-2.5 font-sans text-sm font-semibold shadow-lg transition"
          >
            ▶ Rejouer la présentation
          </Link>
          {topDrinker && topDrinker.total > 0 && (
            <span className="text-ivoire-muted font-sans text-sm">
              🥃 Plus arrosé : <span className="text-or-300">{topDrinker.name}</span> (
              {topDrinker.total} gorgées)
            </span>
          )}
        </div>
      )}

      {categories.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-10 rounded-2xl border px-6 py-12 text-center font-sans text-sm">
          Cette édition n&apos;a aucune catégorie présentée.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          {categories.map((c) => (
            <section key={c.questionId} className="flex flex-col gap-4">
              <h2 className="text-ivoire font-display text-2xl font-semibold">
                <span className="text-or-400/50">{c.index + 1}.</span> {c.prompt}
              </h2>
              {c.players.length === 0 ? (
                <p className="text-ivoire-faint font-sans text-sm">
                  Personne n&apos;a voté dans cette catégorie.
                </p>
              ) : (
                <div
                  className={`grid gap-6 ${c.jury.length > 0 ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}
                >
                  <RankList title="Joueurs" rows={c.players} showDrinks />
                  {c.jury.length > 0 && (
                    <RankList title="Entourage" rows={c.jury} showDrinks={false} />
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
