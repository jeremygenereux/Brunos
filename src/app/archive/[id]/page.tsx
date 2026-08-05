import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPresentation } from "@/lib/editions/presentation";
import { loadEditionVoteReveal } from "@/lib/editions/drama";
import { cascadeOf } from "@/lib/editions/reveal-order";
import type { Category, RankRow } from "@/lib/editions/presentation-types";
import { Avatar } from "@/components/avatar";
import { FormatBadge } from "@/components/question-mode";
import { formatEventDate } from "@/lib/dates/event-time";

export const metadata: Metadata = { title: "Récap" };

function fmtDate(value: string | null) {
  if (!value) return null;
  return formatEventDate(value);
}

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="brunos-glass border-or-400/12 flex flex-col items-center gap-0.5 rounded-2xl border px-4 py-5 text-center">
      <span className="text-or-300 font-display text-3xl tabular-nums">{value}</span>
      <span className="text-ivoire-faint font-sans text-[11px] tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
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
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${
                shooter ? "border-or-400/45 bg-or-500/10" : "border-or-400/12 bg-noir-700/40"
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
                {/* Sur une catégorie entourage, la moyenne EST le résultat :
                    sans elle, le classement tomberait du ciel. */}
                {typeof r.avgRating === "number" && (
                  <span className="text-or-300/80 font-sans text-xs tabular-nums">
                    {r.avgRating.toFixed(1).replace(".", ",")}/10
                  </span>
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

function CategoryCard({ c }: { c: Category }) {
  const winners = c.players.filter((p) => p.isWinner);
  // Même règle qu'en présentation (module partagé, pour qu'elles ne divergent
  // jamais) : en TOP_UNIQUE le classement n'est qu'un artefact du décompte des
  // voix — on n'affiche que les gagnant·e·s, déjà mis en avant en tête de carte.
  const { rankingMatters } = cascadeOf(c.players);
  return (
    <section className="brunos-glass border-or-400/12 flex flex-col gap-5 rounded-3xl border p-6">
      <div className="flex items-center gap-4">
        {winners.length > 0 && (
          <div className="flex -space-x-4">
            {winners.slice(0, 3).map((w) => (
              <span key={w.playerId} className="ring-noir-700 rounded-full ring-2" title={w.name}>
                <Avatar name={w.name} headshot={w.headshot} size={64} />
              </span>
            ))}
          </div>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-or-400/50 font-sans text-xs tracking-[0.25em] uppercase">
              Catégorie {c.index + 1}
            </span>
            <FormatBadge format={c.format} />
          </span>
          <h2 className="text-ivoire font-display text-2xl leading-tight font-semibold">
            {c.prompt}
          </h2>
          {winners.length > 0 && (
            <span className="text-or-300 font-sans text-sm">
              🏆 {winners.map((w) => w.name).join(", ")}
            </span>
          )}
        </div>
      </div>

      {c.players.length === 0 ? (
        <p className="text-ivoire-faint font-sans text-sm">
          Aucun vote dans cette catégorie.
        </p>
      ) : rankingMatters ? (
        <RankList
          title={c.format === "entourage" ? "Moyennes des proches" : "Classement"}
          rows={c.players}
          showDrinks
        />
      ) : (
        <p className="text-ivoire-faint font-sans text-sm">
          Catégorie à choix unique : {winners.length > 1 ? "les personnes" : "la personne"} en tête
          {winners.length > 1 ? " boivent" : " boit"} un shooter. Les autres ne boivent pas.
        </p>
      )}
    </section>
  );
}

export default async function ArchiveEditionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await loadPresentation(supabase, id);
  if (!data.edition || data.edition.state !== "ARCHIVED") notFound();
  const { edition, categories, recap } = data;
  const date = fmtDate(edition.eventAt);
  const hasPlayable = categories.some((c) => c.players.length > 0);

  const reveal = await loadEditionVoteReveal(supabase, id);
  const hasReveal = reveal.categories.some((c) => c.ballots.length > 0 || c.drama.length > 0);

  const totalDrinks = recap.reduce((s, r) => s + r.total, 0);
  const maxTotal = recap.length ? recap[0].total : 0;
  const votedCategories = categories.filter((c) => c.players.length > 0).length;
  const topDrinker = recap[0];

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="flex items-center gap-4">
        <Link
          href="/archive"
          className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
        >
          ← Archive
        </Link>
        <span className="text-ivoire-faint">·</span>
        <Link
          href="/account"
          className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
        >
          Accueil
        </Link>
      </div>

      <header className="mt-4 flex flex-col gap-2">
        <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
          Récap · Les Brunos {edition.year}
        </p>
        <h1 className="text-ivoire font-display text-5xl font-semibold">{edition.name}</h1>
        <p className="text-ivoire-faint font-sans text-sm">
          {[date, edition.venueName].filter(Boolean).join(" · ") || "—"}
        </p>
      </header>

      {hasPlayable && (
        <>
          <div className="mt-6">
            <Link
              href={`/archive/${id}/present`}
              className="from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 inline-flex rounded-full bg-gradient-to-b px-6 py-2.5 font-sans text-sm font-semibold shadow-lg transition"
            >
              Revoir la présentation
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value={totalDrinks} label="Gorgées au total" />
            <StatTile value={votedCategories} label="Catégories" />
            <StatTile value={recap.length} label="Joueurs" />
            <StatTile value={topDrinker ? topDrinker.name : "—"} label="Plus forte consommation" />
          </div>
        </>
      )}

      {recap.length > 0 && totalDrinks > 0 && (
        <section className="mt-10">
          <h2 className="text-or-400/80 mb-4 font-sans text-xs tracking-[0.3em] uppercase">
            La note de la soirée
          </h2>
          <ol className="flex flex-col gap-2">
            {recap.map((r, i) => (
              <li
                key={r.playerId}
                className={`brunos-glass flex items-center gap-4 rounded-2xl border px-5 py-3 ${
                  i === 0 ? "border-or-400/45 bg-or-500/10" : "border-or-400/12"
                }`}
              >
                <span className="text-ivoire-faint font-display w-6 text-right text-lg tabular-nums">
                  {i + 1}
                </span>
                <Avatar name={r.name} headshot={r.headshot} size={40} />
                <span className="text-ivoire flex-1 font-sans">{r.name}</span>
                <span className="bg-noir-900/60 hidden h-2 w-32 overflow-hidden rounded-full sm:block">
                  <span
                    className="from-or-300 to-or-600 block h-full bg-gradient-to-r"
                    style={{ width: `${maxTotal ? (r.total / maxTotal) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-or-300 font-display w-10 text-right text-2xl tabular-nums">
                  {r.total}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {categories.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-10 rounded-2xl border px-6 py-12 text-center font-sans text-sm">
          Cette édition n&apos;a aucune catégorie présentée.
        </p>
      ) : (
        <div className="mt-12 flex flex-col gap-5">
          <h2 className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
            Les catégories
          </h2>
          {categories.map((c) => (
            <CategoryCard key={c.questionId} c={c} />
          ))}
        </div>
      )}

      {hasReveal && (
        <section className="mt-14">
          <h2 className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
            Révélations des votes
          </h2>
          <p className="text-ivoire-faint mt-1 font-sans text-sm">
            Le détail des votes, maintenant que la cérémonie est terminée.
          </p>
          <div className="mt-5 flex flex-col gap-6">
            {reveal.categories
              .filter((c) => c.ballots.length > 0 || c.drama.length > 0)
              .map((c) => (
                <div key={c.questionId} className="flex flex-col gap-3">
                  <h3 className="text-ivoire font-display text-lg font-semibold">{c.prompt}</h3>
                  {c.drama.map((d, i) => (
                    <div
                      key={`${d.kind}-${i}`}
                      className="brunos-glass border-or-400/30 rounded-xl border px-4 py-3"
                    >
                      <span className="text-or-300 font-sans text-sm font-medium">{d.title}</span>
                      <span className="text-ivoire-muted font-sans text-sm"> · {d.detail}</span>
                    </div>
                  ))}
                  {c.ballots.length > 0 && (
                    <details className="group">
                      <summary className="text-ivoire-muted hover:text-or-300 cursor-pointer font-sans text-sm transition">
                        Voir les {c.ballots.length} bulletin{c.ballots.length > 1 ? "s" : ""}
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1.5 pl-1">
                        {c.ballots.map((b, i) => (
                          <li key={i} className="font-sans text-sm">
                            <span className="text-or-300">{b.voterName}</span>
                            <span className="text-ivoire-faint">
                              {b.voterKind === "jury" ? " (entourage)" : ""} :{" "}
                            </span>
                            <span className="text-ivoire-muted">
                              {b.ranking.map((r) => r.playerName).join(" › ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
    </main>
  );
}
