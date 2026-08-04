"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type BallotAnswer = {
  questionId: string;
  format: string;
  ranking?: string[];
  choice?: string | null;
};

export type BallotResult = { error: string | null; saved?: boolean };

/** Réponses du formulaire → lignes `vote_answers`. */
function toRows(answers: BallotAnswer[]) {
  const rows: { question_id: string; player_id: string; rank: number }[] = [];
  for (const a of answers) {
    if (a.format === "ranking" && a.ranking) {
      a.ranking.forEach((playerId, i) =>
        rows.push({ question_id: a.questionId, player_id: playerId, rank: i + 1 }),
      );
    } else if (a.format === "single_choice" && a.choice) {
      rows.push({ question_id: a.questionId, player_id: a.choice, rank: 1 });
    }
  }
  return rows;
}

/**
 * Enregistre un BROUILLON : les réponses sont écrites, mais `submitted_at`
 * reste nul. On peut donc quitter et revenir sans que le vote soit considéré
 * comme rendu.
 *
 * Le modèle prévoyait déjà ce cas — `votes.submitted_at` est nullable et
 * `vote_is_editable()` ne verrouille qu'une fois l'horodatage posé. Rien à
 * ajouter côté base : on réutilise les politiques existantes.
 */
export async function saveDraft(
  editionId: string,
  answers: BallotAnswer[],
): Promise<BallotResult> {
  const supabase = await createClient();

  // Filtrer sur user_id est INDISPENSABLE : la policy de lecture renvoie
  // toutes les lignes de l'édition à un admin, et `maybeSingle()` échouerait
  // alors sur « multiple rows returned ». Un admin qui vote se serait vu
  // refuser chaque enregistrement.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("edition_id", editionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!participant) return { error: "Vous ne participez pas à cette édition." };

  // Un seul bulletin par (édition, participant) : on récupère ou on crée.
  const { data: existing } = await supabase
    .from("votes")
    .select("id, submitted_at")
    .eq("edition_id", editionId)
    .eq("participant_id", participant.id)
    .maybeSingle();
  if (existing?.submitted_at) return { error: "Votre bulletin a déjà été déposé." };

  let voteId = existing?.id;
  if (!voteId) {
    const { data: created, error } = await supabase
      .from("votes")
      .insert({ edition_id: editionId, participant_id: participant.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    voteId = created.id;
  }

  // Remplacement intégral : plus simple et plus sûr qu'un diff, et le volume
  // est minuscule (quelques dizaines de lignes).
  const { error: delError } = await supabase.from("vote_answers").delete().eq("vote_id", voteId);
  if (delError) return { error: delError.message };

  // `edition_id` est de toute façon réécrit par le trigger depuis le bulletin
  // parent ; on le fournit parce que la colonne est NOT NULL côté types.
  const rows = toRows(answers).map((r) => ({ ...r, vote_id: voteId, edition_id: editionId }));
  if (rows.length) {
    const { error: insError } = await supabase.from("vote_answers").insert(rows);
    if (insError) return { error: insError.message };
  }

  return { error: null, saved: true };
}

/**
 * Finalize the caller's ballot. A vote is a DEFINITIVE session: once sent it
 * can't be changed. The submit_ballot RPC writes the answers, stamps
 * submitted_at, and drops an admin notification — atomically. RLS then locks
 * the ballot from any further edits.
 */
export async function submitBallot(
  editionId: string,
  answers: BallotAnswer[],
): Promise<BallotResult> {
  const rows = toRows(answers);

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_ballot", {
    p_edition: editionId,
    p_answers: rows,
  });
  if (error) return { error: error.message };

  revalidatePath(`/vote/${editionId}`);
  revalidatePath("/account");
  return { error: null, saved: true };
}
