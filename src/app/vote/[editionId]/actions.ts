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
