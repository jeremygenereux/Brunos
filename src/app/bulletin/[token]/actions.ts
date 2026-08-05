"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type RatingResult = { error: string | null; saved?: boolean };

/** { questionId → note }, avec les questions non répondues absentes. */
export type RatingMap = Record<string, number | null>;

function toRows(ratings: RatingMap) {
  return Object.entries(ratings)
    .filter(([, v]) => typeof v === "number")
    .map(([question_id, rating]) => ({ question_id, rating }));
}

/**
 * Le porteur du lien n'est PAS authentifié : le client Supabase agit ici en
 * `anon`. C'est voulu — les deux fonctions appelées sont SECURITY DEFINER,
 * résolvent le jeton elles-mêmes et ne touchent que le bulletin qui lui
 * correspond. Le jeton est donc à la fois l'identité et l'autorisation, et il
 * ne transite jamais par autre chose que l'URL et ces deux appels.
 */
export async function saveRatings(token: string, ratings: RatingMap): Promise<RatingResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_entourage_ratings", {
    p_token: token,
    p_ratings: toRows(ratings),
  });
  if (error) return { error: error.message };
  return { error: null, saved: true };
}

export async function submitRatings(token: string, ratings: RatingMap): Promise<RatingResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_entourage_ballot", {
    p_token: token,
    p_ratings: toRows(ratings),
  });
  if (error) return { error: error.message };
  revalidatePath(`/bulletin/${token}`);
  return { error: null, saved: true };
}
