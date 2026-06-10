import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPresentation } from "@/lib/editions/presentation";
import { loadEditionVoteReveal } from "@/lib/editions/drama";
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

  const reveal = await loadEditionVoteReveal(supabase, id);
  const hasReveal = reveal.categories.some((c) => c.ballots.length > 0 || c.drama.length > 0);

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

      {hasReveal && (
        <section className="mt-14">
          <h2 className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">
            Révélations des votes
          </h2>
          <p className="text-ivoire-faint mt-1 font-sans text-sm">
            Qui a voté pour qui — maintenant que la soirée est archivée.
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
                      <span className="text-ivoire-muted font-sans text-sm"> — {d.detail}</span>
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
