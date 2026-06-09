"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type QuestionState = { error: string | null; success?: boolean };

export async function addQuestion(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  await requireAdmin();

  const editionId = String(formData.get("edition_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const format = String(formData.get("format") ?? "ranking");
  if (!editionId) return { error: "Édition introuvable." };
  if (!prompt) return { error: "L'énoncé est requis." };
  if (format !== "ranking" && format !== "single_choice") {
    return { error: "Format invalide." };
  }

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("questions")
    .select("position")
    .eq("edition_id", editionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (last?.position ?? -1) + 1;

  // RLS (questions_insert_admin) + the question-edit-lock trigger gate this.
  const { error } = await supabase.from("questions").insert({
    edition_id: editionId,
    prompt,
    format,
    position: nextPosition,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}/questions`);
  return { error: null, success: true };
}

export async function deleteQuestion(formData: FormData): Promise<void> {
  await requireAdmin();
  const questionId = String(formData.get("question_id") ?? "");
  const editionId = String(formData.get("edition_id") ?? "");
  if (!questionId) return;

  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", questionId);
  revalidatePath(`/admin/editions/${editionId}/questions`);
}

export async function reorderQuestions(
  editionId: string,
  ids: string[],
): Promise<{ error: string | null }> {
  await requireAdmin();
  if (!editionId || ids.length === 0) return { error: null };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_questions", {
    p_edition: editionId,
    p_ids: ids,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}/questions`);
  return { error: null };
}
