import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { loadPlayerProfile } from "@/lib/editions/stats";
import { listCircles } from "@/lib/editions/circle";
import { Avatar } from "@/components/avatar";

export const metadata: Metadata = { title: "Joueur" };

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;
  const supabase = await createClient();

  // Une carrière PAR CERCLE : les gorgées d'un cercle ne s'additionnent
  // jamais à celles d'un autre. Pour un lecteur d'un seul cercle — le cas
  // normal — la page est identique à avant.
  const circles = await listCircles(supabase);
  const profiles = (
    await Promise.all(
      circles.map(async (circle) => ({
        circle,
        profile: await loadPlayerProfile(supabase, personId, circle.id),
      })),
    )
  ).filter((p) => p.profile.person !== null);
  if (profiles.length === 0) notFound();

  const withHistory = profiles.filter((p) => p.profile.history.length > 0);
  const sections = withHistory.length > 0 ? withHistory : profiles.slice(0, 1);
  const single = sections.length <= 1;
  const person = sections[0].profile.person!;

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link
        href="/archive/stats"
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← Palmarès
      </Link>

      <header className="mt-4 flex items-center gap-4">
        <Avatar name={person.name} headshot={person.headshot} size={72} />
        <div className="flex flex-col gap-1">
          <p className="text-or-400/80 font-sans text-xs tracking-[0.4em] uppercase">Joueur</p>
          <h1 className="text-ivoire font-display text-5xl font-semibold">{person.name}</h1>
        </div>
      </header>

      {sections.map(({ circle, profile }) => (
      <section key={circle.id} className={single ? "" : "border-or-400/15 mt-10 border-t pt-8"}>
      {!single && (
        <h2 className="text-or-300 font-sans text-sm tracking-[0.35em] uppercase">{circle.name}</h2>
      )}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="brunos-glass border-or-400/12 flex flex-col items-center gap-1 rounded-2xl border px-4 py-6">
          <span className="text-or-300 font-display text-4xl tabular-nums">
            {profile.lifetimeDrinks}
          </span>
          <span className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
            gorgées à vie
          </span>
        </div>
        <div className="brunos-glass border-or-400/12 flex flex-col items-center gap-1 rounded-2xl border px-4 py-6">
          <span className="text-or-300 font-display text-4xl tabular-nums">
            {profile.titleCount}
          </span>
          <span className="text-ivoire-faint font-sans text-xs tracking-wide uppercase">
            titre{profile.titleCount > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {profile.history.length === 0 ? (
        <p className="text-ivoire-muted mt-8 font-sans text-sm">
          Aucune participation archivée à afficher.
        </p>
      ) : (
        <>
          <h2 className="text-or-400/80 mt-10 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Historique
          </h2>
          <ul className="flex flex-col gap-2">
            {profile.history.map((h) => (
              <li
                key={h.editionId}
                className="border-or-400/12 bg-noir-700/40 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              >
                <Link
                  href={`/archive/${h.editionId}`}
                  className="text-ivoire hover:text-or-300 font-sans text-sm transition"
                >
                  {h.name} <span className="text-ivoire-faint">· {h.year}</span>
                </Link>
                <span className="text-ivoire-muted font-sans text-xs tabular-nums">
                  {h.titles > 0 && <span className="text-or-300">{h.titles} 🏆 · </span>}
                  {h.drinks} gorgées
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {profile.signatureWins.length > 0 && (
        <>
          <h2 className="text-or-400/80 mt-10 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Catégories fétiches
          </h2>
          <ul className="flex flex-col gap-2">
            {profile.signatureWins.map((s) => (
              <li
                key={s.prompt}
                className="brunos-glass border-or-400/12 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              >
                <span className="text-ivoire font-sans text-sm">{s.prompt}</span>
                <span className="text-or-300 font-display text-lg tabular-nums">×{s.count}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {profile.titles.length > 0 && (
        <>
          <h2 className="text-or-400/80 mt-10 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Titres remportés
          </h2>
          <ul className="flex flex-col gap-2">
            {profile.titles.map((t, i) => (
              <li
                key={`${t.editionId}-${i}`}
                className="brunos-glass border-or-400/12 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              >
                <span className="text-ivoire font-sans text-sm">🏆 {t.prompt}</span>
                <span className="text-ivoire-faint shrink-0 font-sans text-xs">{t.year}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      </section>
      ))}
    </main>
  );
}
