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

export async function saveBallot(
  editionId: string,
  answers: BallotAnswer[],
): Promise<BallotResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Connexion requise." };

  const { data: participant } = await supabase
    .from("participants")
    .select("id")
    .eq("edition_id", editionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!participant) return { error: "Tu ne participes pas à cette édition." };

  // One ballot per (edition, participant). RLS gates this to the open window.
  const { data: vote, error: voteError } = await supabase
    .from("votes")
    .upsert(
      {
        edition_id: editionId,
        participant_id: participant.id,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "edition_id,participant_id" },
    )
    .select("id")
    .single();
  if (voteError || !vote) {
    return { error: voteError?.message ?? "Le vote n'est pas ouvert." };
  }

  // Replace this ballot's answers.
  await supabase.from("vote_answers").delete().eq("vote_id", vote.id);

  // edition_id is auto-filled by the tg_vote_answers_set_edition trigger, but
  // the generated Insert type requires it; pass it (the trigger re-derives it).
  const rows: {
    vote_id: string;
    edition_id: string;
    question_id: string;
    player_id: string;
    rank: number;
  }[] = [];
  for (const a of answers) {
    if (a.format === "ranking" && a.ranking) {
      a.ranking.forEach((playerId, i) =>
        rows.push({
          vote_id: vote.id,
          edition_id: editionId,
          question_id: a.questionId,
          player_id: playerId,
          rank: i + 1,
        }),
      );
    } else if (a.format === "single_choice" && a.choice) {
      rows.push({
        vote_id: vote.id,
        edition_id: editionId,
        question_id: a.questionId,
        player_id: a.choice,
        rank: 1,
      });
    }
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("vote_answers").insert(rows);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/vote/${editionId}`);
  return { error: null, saved: true };
}
