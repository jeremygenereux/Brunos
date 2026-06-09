import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/state-badge";
import { nextState, TRANSITION_LABEL, TRANSITION_NOTE } from "@/lib/editions/state-machine";
import { TransitionControl } from "./transition-control";
import { EditEditionForm } from "./edit-edition-form";
import { InviteLink } from "@/components/invite-link";

export const metadata: Metadata = { title: "Édition" };

const DRINK_RULE_LABEL: Record<string, string> = {
  ESCALATION: "Escalade par classement",
  TOP_UNIQUE: "Top unique",
};

function fmt(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-CA", {
    dateStyle: "long",
    timeStyle: "short",
  });
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ivoire-faint text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-ivoire">{value}</dd>
    </div>
  );
}

export default async function EditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: edition } = await supabase.from("editions").select("*").eq("id", id).single();
  if (!edition) notFound();

  const next = nextState(edition.state);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Link
        href="/admin/editions"
        className="text-ivoire-muted hover:text-or-300 font-sans text-sm transition"
      >
        ← Toutes les éditions
      </Link>

      <header className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-ivoire font-display text-4xl font-semibold">{edition.name}</h1>
        <StateBadge state={edition.state} />
        <span className="text-ivoire-faint font-sans text-sm">{edition.year}</span>
      </header>

      <dl className="border-or-400/15 bg-noir-700/40 mt-6 grid grid-cols-1 gap-x-8 gap-y-3 rounded-2xl border p-6 sm:grid-cols-2">
        <Fact label="Date de l'événement" value={fmt(edition.event_at)} />
        <Fact label="Lieu" value={edition.venue_name ?? "—"} />
        <Fact label="Adresse" value={edition.venue_address ?? "—"} />
        <Fact
          label="Règle de consommation"
          value={DRINK_RULE_LABEL[edition.drink_rule] ?? edition.drink_rule}
        />
        <Fact label="Valeur d'un shooter" value={`${edition.shooter_value} gorgées`} />
        <Fact label="Date limite de vote" value={fmt(edition.vote_deadline)} />
      </dl>

      {edition.description && (
        <p className="text-ivoire-muted mt-4 font-sans text-sm">{edition.description}</p>
      )}

      <nav className="mt-6 flex flex-wrap gap-4 font-sans text-sm">
        <Link
          href={`/admin/editions/${edition.id}/players`}
          className="text-or-300 hover:text-or-400 transition"
        >
          Joueurs →
        </Link>
        <Link
          href={`/admin/editions/${edition.id}/questions`}
          className="text-or-300 hover:text-or-400 transition"
        >
          Questions →
        </Link>
        {edition.state === "COMPILATION" && (
          <Link
            href={`/admin/editions/${edition.id}/compile`}
            className="text-or-300 hover:text-or-400 transition"
          >
            Compilation →
          </Link>
        )}
      </nav>

      <section className="mt-10">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Lien d&apos;invitation
        </h2>
        <p className="text-ivoire-muted mb-3 font-sans text-sm">
          Partage ce lien pour que joueurs et jury rejoignent l&apos;édition.
        </p>
        <InviteLink token={edition.invite_token} />
      </section>

      <section className="mt-10">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          État de l&apos;édition
        </h2>
        {next ? (
          <TransitionControl
            editionId={edition.id}
            nextStateValue={next}
            label={TRANSITION_LABEL[edition.state] ?? "Avancer"}
            note={TRANSITION_NOTE[edition.state]}
            askDeadline={next === "SENT_FOR_VOTE"}
          />
        ) : (
          <p className="text-ivoire-muted font-sans text-sm">
            Édition archivée — les résultats sont publics et l&apos;édition est close.
          </p>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Modifier les informations
        </h2>
        <EditEditionForm
          edition={{
            id: edition.id,
            name: edition.name,
            year: edition.year,
            event_at: edition.event_at,
            venue_name: edition.venue_name,
            venue_address: edition.venue_address,
            description: edition.description,
            drink_rule: edition.drink_rule,
            shooter_value: edition.shooter_value,
          }}
        />
      </section>
    </div>
  );
}
