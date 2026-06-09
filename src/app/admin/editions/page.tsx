import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/state-badge";
import { NewEditionForm } from "./new-edition-form";

export const metadata: Metadata = { title: "Éditions" };

const DRINK_RULE_LABEL: Record<string, string> = {
  ESCALATION: "Escalade",
  TOP_UNIQUE: "Top unique",
};

function formatDate(value: string | null) {
  if (!value) return "Date à venir";
  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export default async function EditionsPage() {
  const supabase = await createClient();
  const { data: editions } = await supabase
    .from("editions")
    .select("id, name, year, event_at, venue_name, state, drink_rule, shooter_value")
    .order("year", { ascending: false })
    .order("created_at", { ascending: false });

  // Reasonable default for the "new edition" year field.
  const defaultYear =
    (editions?.[0]?.year ?? new Date().getFullYear()) + (editions?.length ? 1 : 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-ivoire font-display text-4xl font-semibold">Éditions</h1>
      <p className="text-ivoire-muted mt-1 font-sans text-sm">
        Crée et gère les galas. Chaque édition suit sa propre machine à états.
      </p>

      <section className="mt-8">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Nouvelle édition
        </h2>
        <NewEditionForm defaultYear={defaultYear} />
      </section>

      <section className="mt-12">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Éditions existantes
        </h2>

        {!editions || editions.length === 0 ? (
          <p className="border-or-400/10 text-ivoire-muted rounded-2xl border border-dashed px-6 py-10 text-center font-sans text-sm">
            Aucune édition pour l&apos;instant. Crée la première ci-dessus.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {editions.map((e) => (
              <li
                key={e.id}
                className="border-or-400/15 bg-noir-700/40 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-ivoire font-display text-xl">{e.name}</span>
                    <StateBadge state={e.state} />
                  </div>
                  <p className="text-ivoire-muted mt-1 font-sans text-sm">
                    {formatDate(e.event_at)}
                    {e.venue_name ? ` · ${e.venue_name}` : ""}
                  </p>
                </div>
                <div className="text-ivoire-faint text-right font-sans text-xs">
                  <div>{DRINK_RULE_LABEL[e.drink_rule] ?? e.drink_rule}</div>
                  <div>shooter = {e.shooter_value} gorgées</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
