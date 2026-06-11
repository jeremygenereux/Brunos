import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/state-badge";
import { NewEditionForm } from "./new-edition-form";
import { DeleteEditionButton } from "./[id]/delete-edition-button";
import type { Database } from "@/lib/types/database.types";

export const metadata: Metadata = { title: "Éditions" };

type EditionState = Database["public"]["Enums"]["edition_state"];

function formatDate(value: string | null) {
  if (!value) return "Date à venir";
  return new Date(value).toLocaleDateString("fr-CA", { dateStyle: "long" });
}

const PRIMARY =
  "from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-lg bg-gradient-to-b px-4 py-2 font-sans text-sm font-semibold transition";
const SECONDARY =
  "border-or-400/25 text-ivoire hover:border-or-400/50 hover:text-or-300 rounded-lg border px-4 py-2 font-sans text-sm transition";

function primaryAction(e: {
  id: string;
  state: EditionState;
}): { label: string; href: string } | null {
  switch (e.state) {
    case "CONSTRUCTION":
    case "SENT_FOR_VOTE":
      return { label: "Configurer →", href: `/admin/editions/${e.id}` };
    case "COMPILATION":
      return { label: "Compiler →", href: `/admin/editions/${e.id}/compile` };
    case "LOCKED":
    case "LIVE":
      return { label: "Présentation →", href: `/admin/editions/${e.id}/present` };
    case "ARCHIVED":
      return { label: "Récap →", href: `/archive/${e.id}` };
    default:
      return null;
  }
}

export default async function EditionsPage() {
  const supabase = await createClient();
  const { data: editions } = await supabase
    .from("editions")
    .select("id, name, year, event_at, venue_name, state, drink_rule, shooter_value")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });
  const list = editions ?? [];

  const defaultYear = (list[0]?.year ?? new Date().getFullYear()) + (list.length ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-ivoire font-display text-4xl font-semibold">Éditions</h1>
          <p className="text-ivoire-muted mt-1 font-sans text-sm">
            Gère les galas et leur cycle de vie.
          </p>
        </div>
      </div>

      <section className="mt-8">
        {list.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-12 text-center font-sans text-sm">
            Aucune édition. Crée la première ci-dessous.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {list.map((e) => {
              const primary = primaryAction(e);
              return (
                <li
                  key={e.id}
                  className="border-or-400/15 bg-noir-700/40 flex flex-col gap-4 rounded-2xl border p-6 backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/editions/${e.id}`}
                          className="text-ivoire hover:text-or-300 font-display text-2xl font-semibold transition"
                        >
                          {e.name}
                        </Link>
                        <StateBadge state={e.state} />
                        <span className="text-ivoire-faint font-display text-lg tabular-nums">
                          {e.year}
                        </span>
                      </div>
                      <p className="text-ivoire-muted font-sans text-sm">
                        {formatDate(e.event_at)}
                        {e.venue_name ? ` · ${e.venue_name}` : ""} · shooter = {e.shooter_value}{" "}
                        gorgées
                      </p>
                    </div>
                    <DeleteEditionButton compact editionId={e.id} name={e.name} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {primary && (
                      <Link href={primary.href} className={PRIMARY}>
                        {primary.label}
                      </Link>
                    )}
                    <Link href={`/admin/editions/${e.id}/players`} className={SECONDARY}>
                      Joueurs
                    </Link>
                    <Link href={`/admin/editions/${e.id}/questions`} className={SECONDARY}>
                      Questions
                    </Link>
                    <Link href={`/admin/editions/${e.id}`} className={SECONDARY}>
                      Réglages
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* New edition is the least-used action (once a year) — kept secondary. */}
      <details className="group mt-8">
        <summary className="border-or-400/20 text-or-300 hover:bg-noir-900 inline-flex cursor-pointer items-center gap-2 rounded-full border px-5 py-2.5 font-sans text-sm transition">
          <span className="text-lg leading-none">+</span> Nouvelle édition
        </summary>
        <div className="mt-4">
          <NewEditionForm defaultYear={defaultYear} />
        </div>
      </details>
    </div>
  );
}
