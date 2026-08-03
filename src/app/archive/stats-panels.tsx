import Link from "next/link";
import { Avatar } from "@/components/avatar";
import type { DrinkerStat, FunAward } from "@/lib/editions/stats";

/**
 * Palmarès à vie. Chaque ligne est un LIEN vers la fiche du joueur : c'est la
 * porte d'entrée vers son historique, alors on le dit explicitement et on met
 * un chevron — l'ancienne version n'avait qu'un nom cliquable, invisible.
 */
export function LifetimeBoard({
  drinkers,
  editionsCount,
}: {
  drinkers: DrinkerStat[];
  editionsCount: number;
}) {
  if (drinkers.length === 0) return null;
  const maxTotal = drinkers[0].totalDrinks;

  return (
    <section>
      <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Inter-éditions</p>
      <h2 className="text-ivoire font-display mt-2 text-3xl font-semibold">Le palmarès à vie</h2>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        Cumul sur {editionsCount} édition{editionsCount > 1 ? "s" : ""} archivée
        {editionsCount > 1 ? "s" : ""}. Clique sur quelqu&apos;un pour voir sa fiche complète.
      </p>

      <ol className="mt-5 flex flex-col gap-2">
        {drinkers.map((d, i) => (
          <li key={d.personId}>
            <Link
              href={`/archive/players/${d.personId}`}
              className={`brunos-glass group flex items-center gap-4 rounded-2xl border px-5 py-3.5 transition ${
                i === 0
                  ? "border-or-400/45 bg-or-500/10 hover:border-or-400/70"
                  : "border-or-400/12 hover:border-or-400/40"
              }`}
            >
              <span className="text-ivoire-faint font-display w-6 text-right text-lg tabular-nums">
                {i + 1}
              </span>
              <Avatar name={d.name} headshot={d.headshot} size={40} />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-ivoire group-hover:text-or-300 font-sans font-medium transition">
                  {d.name}
                </span>
                <span className="text-ivoire-faint font-sans text-xs">
                  {d.titleCount} titre{d.titleCount > 1 ? "s" : ""} · {d.editionCount} édition
                  {d.editionCount > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-noir-900/60 hidden h-2 w-24 overflow-hidden rounded-full sm:block">
                  <span
                    className="from-or-300 to-or-600 block h-full bg-gradient-to-r"
                    style={{ width: `${maxTotal ? (d.totalDrinks / maxTotal) * 100 : 0}%` }}
                  />
                </span>
                <span className="text-or-300 font-display w-10 text-right text-2xl tabular-nums">
                  {d.totalDrinks}
                </span>
                <span className="text-ivoire-faint group-hover:text-or-300 font-sans text-sm transition">
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ol>
      <p className="text-ivoire-faint mt-3 text-right font-sans text-xs">gorgées cumulées</p>
    </section>
  );
}

/** Les trophées lus entre les lignes des bulletins. */
export function FunAwards({ awards }: { awards: FunAward[] }) {
  if (awards.length === 0) return null;
  return (
    <section>
      <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">
        Les trophées officieux
      </p>
      <h2 className="text-ivoire font-display mt-2 text-3xl font-semibold">
        Ce que les bulletins racontent
      </h2>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        Lu entre les lignes des votes de toutes les éditions archivées.
      </p>

      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {awards.map((a) => (
          <li
            key={a.key}
            className="brunos-glass border-or-400/15 flex flex-col gap-2 rounded-2xl border px-5 py-4"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-xl leading-none">{a.emoji}</span>
              <span className="text-or-400/80 font-sans text-xs tracking-[0.25em] uppercase">
                {a.title}
              </span>
            </div>
            <p className="text-ivoire font-display text-2xl leading-tight font-semibold">
              {a.subject}
            </p>
            <p className="text-or-300 font-sans text-sm">{a.detail}</p>
            <p className="text-ivoire-faint font-sans text-xs leading-relaxed">{a.blurb}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
