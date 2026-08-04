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
import { ReopenVoting } from "./reopen-voting";
import { VoteTracker } from "./vote-tracker";
import { ParticipantsManager } from "./participants-manager";
import { InviteLink } from "@/components/invite-link";

export const metadata: Metadata = { title: "Édition" };

const PRIMARY =
  "from-or-300 to-or-600 text-noir-900 hover:from-or-400 hover:to-or-500 rounded-lg bg-gradient-to-b px-4 py-2 font-sans text-sm font-semibold transition";
const SECONDARY =
  "border-or-400/25 text-ivoire hover:border-or-400/50 hover:text-or-300 rounded-lg border px-4 py-2 font-sans text-sm transition";




export default async function EditionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: edition } = await supabase.from("editions").select("*").eq("id", id).single();
  if (!edition) notFound();

  const next = nextState(edition.state);

  // Les conviés se lisent dans `players` et `edition_entourage` — les tables
  // d'intention — et non dans `participants`, qui n'existe qu'à partir de la
  // création d'un compte. Un nommé fraîchement ajouté n'a pas encore de compte :
  // c'est justement lui qu'il faut pouvoir inviter.
  const [{ data: playerRows }, { data: entourageRows }, { data: inviteRows }] = await Promise.all([
    supabase.from("players").select("person_id, display_order").eq("edition_id", id),
    supabase.from("edition_entourage").select("person_id, relation_label").eq("edition_id", id),
    supabase.from("edition_invites").select("person_id, apple_invite_url").eq("edition_id", id),
  ]);

  const personIds = [
    ...new Set([
      ...(playerRows ?? []).map((r) => r.person_id),
      ...(entourageRows ?? []).map((r) => r.person_id),
    ]),
  ];
  const { data: people } = personIds.length
    ? await supabase.from("people").select("id, display_name, auth_user_id").in("id", personIds)
    : { data: [] as { id: string; display_name: string | null; auth_user_id: string | null }[] };

  const personById = new Map((people ?? []).map((p) => [p.id, p]));
  const inviteByPerson = new Map(
    (inviteRows ?? []).map((r) => [r.person_id, r.apple_invite_url]),
  );
  const guest = (personId: string, kind: "player" | "jury", fallback: string) => {
    const person = personById.get(personId);
    return {
      personId,
      kind,
      name: person?.display_name ?? fallback,
      hasAccount: Boolean(person?.auth_user_id),
      apple_invite_url: inviteByPerson.get(personId) ?? null,
    };
  };

  const guests = [
    ...(playerRows ?? [])
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((r) => guest(r.person_id, "player", "Joueur")),
    ...(entourageRows ?? []).map((r) => guest(r.person_id, "jury", r.relation_label ?? "Entourage")),
  ];

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

      {/* Ordre de lecture : où l'on va travailler, ce qu'on corrige, où en
          est la cérémonie, puis qui l'on convie. Le récapitulatif figé qui
          ouvrait la page doublait le formulaire — il a disparu. */}
      <section className="mt-8">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Gestion
        </h2>
        <nav className="flex flex-wrap gap-3">
          <Link href={`/admin/editions/${edition.id}/players`} className={SECONDARY}>
            Joueurs
          </Link>
          <Link href={`/admin/editions/${edition.id}/questions`} className={SECONDARY}>
            Questions
          </Link>
          <Link href={`/admin/editions/${edition.id}/entourage`} className={SECONDARY}>
            Entourage
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
      </section>

      <section className="mt-8">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Informations
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

      <section className="mt-10">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          État de la cérémonie
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
            Cérémonie archivée. Les résultats sont publics et la cérémonie est close.
          </p>
        )}

        {/* Rouvrir reste possible tant que la cérémonie n'est pas archivée :
            c'est la soupape quand un bulletin doit être corrigé après coup. */}
        {STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("SENT_FOR_VOTE") &&
          edition.state !== "ARCHIVED" && (
            <ReopenVoting
              editionId={edition.id}
              currentDeadline={edition.vote_deadline}
              resultsAreFrozen={
                STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("LOCKED")
              }
            />
          )}

        {/* Les classements sont figés au passage en « Verrouillée ». Tout ce qui
            les nourrit peut bouger ensuite (valeur du shooter, règle, sélection
            des questions, bulletin corrigé) — d'où ce recalcul à la demande,
            qui évite de faire reculer puis réavancer l'édition. */}
        {STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("COMPILATION") && (
          <div className="border-or-400/12 mt-5 flex flex-col gap-2 rounded-xl border px-4 py-3">
            <p className="text-ivoire-muted font-sans text-xs">
              Si une donnée a changé depuis le verrouillage (valeur du shooter, règlement,
              catégories retenues, bulletins), recalculez les classements sans modifier
              l&apos;état.
            </p>
            <RecompileButton editionId={edition.id} />
          </div>
        )}
      </section>

      {STATE_ORDER.indexOf(edition.state) >= STATE_ORDER.indexOf("SENT_FOR_VOTE") && (
        <section className="mt-10">
          <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
            Suivi du scrutin
          </h2>
          <p className="text-ivoire-muted mb-3 font-sans text-sm">
            Qui a déposé son bulletin. Le détail des réponses est réservé à l&apos;administration :
            à n&apos;ouvrir qu&apos;en cas de problème.
          </p>
          <VoteTracker editionId={edition.id} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-or-400/80 mb-3 font-sans text-xs tracking-[0.3em] uppercase">
          Invitations
        </h2>
        <p className="text-ivoire-muted mb-3 font-sans text-sm">
          Ce lien permet de rejoindre la cérémonie.
        </p>
        <InviteLink token={edition.invite_token} />

        <p className="text-ivoire-muted mt-6 mb-3 font-sans text-sm">
          Renseignez le lien Apple Invitation de chaque personne : un bouton « Consulter
          l&apos;invitation » apparaîtra sur son espace. Les personnes sans compte figurent aussi
          dans la liste, leur lien les attendra à l&apos;inscription.
        </p>
        <ParticipantsManager editionId={edition.id} guests={guests} />
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
