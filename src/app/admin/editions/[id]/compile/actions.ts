"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type SelectionResult = { error: string | null; saved?: boolean };

/** Toggle whether a question's drama cards + vote reveal show in the show. */
export async function setQuestionReveal(
  editionId: string,
  questionId: string,
  enabled: boolean,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("questions")
    .update({ reveal_enabled: enabled })
    .eq("id", questionId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/editions/${editionId}/compile`);
  return { error: null };
}

export async function saveSelection(
  editionId: string,
  orderedIds: string[],
): Promise<SelectionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_question_selection", {
    p_edition: editionId,
    p_ordered_ids: orderedIds,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/editions/${editionId}/compile`);
  return { error: null, saved: true };
}
