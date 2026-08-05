import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { formatEventDate, formatEventDateTime } from "@/lib/dates/event-time";
import { RatingForm, type EntourageQuestion } from "./rating-form";

export const metadata: Metadata = { title: "Votre bulletin" };

/** Forme renvoyée par `entourage_ballot_info`. */
type BallotInfo = {
  edition: {
    id: string;
    name: string;
    event_at: string | null;
    vote_deadline: string | null;
    venue_name: string | null;
    open: boolean;
  };
  voter: { display_name: string; relation_label: string };
  player: { id: string; display_name: string; headshot_url: string | null };
  submitted_at: string | null;
  questions: EntourageQuestion[];
};

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12">{children}</main>;
}

export default async function BulletinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Le visiteur n'est pas connecté : ce client agit en `anon`. La fonction
  // appelée est SECURITY DEFINER et ne rend que le bulletin du porteur du
  // jeton, jamais les votes des joueurs ni ceux des autres proches.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("entourage_ballot_info", { p_token: token });
  const info = (data ?? null) as BallotInfo | null;

  // Un jeton inconnu et un jeton révoqué se ressemblent volontairement : rien
  // dans la réponse ne dit si l'édition existe.
  if (error || !info) {
    return (
      <Shell>
        <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">Les Brunos</p>
        <h1 className="text-ivoire font-display mt-3 text-3xl font-semibold">Lien introuvable</h1>
        <p className="text-ivoire-muted mt-4 font-sans text-sm">
          Ce lien n&apos;ouvre aucun bulletin. Il a peut-être été remplacé depuis. Demandez le lien
          à jour à la personne qui organise la soirée.
        </p>
      </Shell>
    );
  }

  const { edition, voter, player, questions, submitted_at } = info;
  const eventDate = formatEventDate(edition.event_at);
  // L'échéance vaut aussi pour les proches : passé cette date, les fonctions
  // de sauvegarde et d'envoi refusent tout. Autant qu'ils la voient.
  const deadline = formatEventDateTime(edition.vote_deadline, "long");

  return (
    <Shell>
      <p className="text-or-400/80 font-sans text-xs tracking-[0.3em] uppercase">{edition.name}</p>
      <h1 className="text-ivoire font-display mt-3 text-4xl leading-tight font-semibold">
        Bonjour {voter.display_name}
      </h1>

      {deadline && !submitted_at && (
        <p className="border-or-400/25 bg-or-500/10 text-or-300 mt-5 inline-flex rounded-full border px-4 py-1.5 font-sans text-xs">
          À rendre avant le {deadline}
        </p>
      )}

      {/* La mise en contexte vit dans le formulaire, étalée sur trois écrans :
          un proche qui découvre tout d'un bloc ne lit rien. */}
      {!edition.open && !submitted_at ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-8 rounded-2xl border px-6 py-8 text-center font-sans text-sm">
          Le vote n&apos;est pas ouvert pour le moment. Revenez avec ce même lien lorsque
          l&apos;organisation vous préviendra.
        </p>
      ) : questions.length === 0 ? (
        <p className="border-or-400/15 bg-noir-700/40 text-ivoire-muted mt-8 rounded-2xl border px-6 py-8 text-center font-sans text-sm">
          Les questions ne sont pas encore écrites. Gardez ce lien, il restera valable.
        </p>
      ) : (
        <div className="mt-8">
          <RatingForm
            token={token}
            playerName={player.display_name}
            playerHeadshot={player.headshot_url}
            relation={voter.relation_label}
            eventDate={eventDate}
            questions={questions}
            submittedAt={submitted_at}
            open={edition.open}
          />
        </div>
      )}
    </Shell>
  );
}
