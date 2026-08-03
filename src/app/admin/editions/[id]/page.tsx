import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { StateBadge } from "@/components/state-badge";
import {
  nextState,
  STATE_ORDER,
  TRANSITION_LABEL,
  TRANSITION_NOTE,
} from "@/lib/editions/state-machine";
import { TransitionControl } from "./transition-control";
import { EditEditionForm } from "./edit-edition-form";
import { DeleteEditionButton } from "./delete-edition-button";
import { RecompileButton } from "./recompile-button";
import { VoteTracker } from "./vote-tracker";
import { ParticipantsManager } from "./participants-manager";
import { InviteLink } from "@/components/invite-link";
import { DRINK_RULE_LABEL } from "@/lib/editions/drink-rule";

export const metadata: Metadata = { title: "Édition" };

const PRIMARY =
  "from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-lg bg-gradient-to-b px-4 py-2 font-sans text-sm font-semibold transition";
const SECONDARY =
  "border-or-400/25 text-ivoire hover:border-or-400/50 hover:text-or-300 rounded-lg border px-4 py-2 font-sans text-sm transition";



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

  const { data: rawParts } = await supabase
    .from("participants")
    .select("id, kind, user_id, relation_label, apple_invite_url")
    .eq("edition_id", id);
  const userIds = [...new Set((rawParts ?? []).map((p) => p.user_id))];
  const { data: people } = userIds.length
    ? await supabase.from("people").select("display_name, auth_user_id").in("auth_user_id", userIds)
    : { data: [] as { display_name: string | null; auth_user_id: string | null }[] };
  const nameByUser = new Map((people ?? []).map((p) => [p.auth_user_id, p.display_name]));
  const participants = (rawParts ?? []).map((p) => ({
    id: p.id,
    kind: (p.kind === "jury" ? "jury" : "player") as "player" | "jury",
    name:
      nameByUser.get(p.user_id) ??
      p.relation_label ??
      (p.kind === "jury" ? "Entourage" : "Joueur"),
    apple_invite_url: p.apple_invite_url,
  }));

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
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

      <nav className="mt-6 flex flex-wrap gap-3">
        <Link href={`/admin/editions/${edition.id}/players`} className={SECONDARY}>
          Joueurs
        </Link>
        <Link href={`/admin/editions/${edition.id}/questions`} className={SECONDARY}>
          Questions
        </Link>
        {edition.state === "COMPILATION" && (
          <Link href={`/admin/editions/${edition.id}/compile`} className={PRIMARY}>
            Compiler →
          </Link>
        )}
        {edition.state === "LOCKED" && (
          <Link href={`/admin/editions/${edition.id}/present`} className={PRIMARY}>
            Aperçu de la présentation →
          </Link>
        )}
        {edition.state === "LIVE" && (
          <Link href={`/admin/editions/${edition.id}/present`} className={PRIMARY}>
            Lancer la présentation →
          </Link>
        )}
        {edition.state === "ARCHIVED" && (
          <Link href={`/archive/${edition.id}`} className={PRIMARY}>
            Voir le récap →
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
          Participants & invitations Apple
        </h2>
        <p className="text-ivoire-muted mb-3 font-sans text-sm">
          Colle le lien Apple Invitation personnalisé de chaque invité·e ; il ou elle verra un
          bouton « Voir mon invitation » sur son accueil.
        </p>
        <ParticipantsManager participants={participants} />
      </section>

      {STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("SENT_FOR_VOTE") && (
        <section className="mt-10">
          <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Suivi du vote
          </h2>
          <p className="text-ivoire-muted mb-3 font-sans text-sm">
            Qui a déposé son bulletin. Le détail des bulletins n&apos;est visible que de
            l&apos;admin — à n&apos;ouvrir que pour vérifier une incohérence.
          </p>
          <VoteTracker editionId={edition.id} />
        </section>
      )}

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

        {/* Les classements sont figés au passage en « Verrouillée ». Tout ce qui
            les nourrit peut bouger ensuite (valeur du shooter, règle, sélection
            des questions, bulletin corrigé) — d'où ce recalcul à la demande,
            qui évite de faire reculer puis réavancer l'édition. */}
        {STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("COMPILATION") && (
          <div className="border-or-400/12 mt-5 flex flex-col gap-2 rounded-xl border px-4 py-3">
            <p className="text-ivoire-muted font-sans text-xs">
              Une donnée a changé depuis le verrouillage (valeur du shooter, règle, questions
              sélectionnées, bulletins) ? Recalcule les classements figés sans toucher à
              l&apos;état.
            </p>
            <RecompileButton editionId={edition.id} />
          </div>
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

      <section className="mt-12 border-t border-red-400/15 pt-8">
        <h2 className="mb-3 font-sans text-xs tracking-[0.3em] text-red-300/70 uppercase">
          Zone de danger
        </h2>
        <p className="text-ivoire-muted mb-3 font-sans text-sm">
          Supprime définitivement cette édition et tout son contenu (joueurs, questions, votes,
          résultats).
        </p>
        <DeleteEditionButton
          editionId={edition.id}
          name={edition.name}
          redirectTo="/admin/editions"
        />
      </section>
    </div>
  );
}
