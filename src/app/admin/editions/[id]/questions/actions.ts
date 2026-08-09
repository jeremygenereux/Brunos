"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import type { DrinkRule } from "@/lib/editions/drink-rule";

export type QuestionState = { error: string | null; success?: boolean };

const RANKING_RULES = ["ESCALATION", "ESCALATION_INVERSE"] as const;

/**
 * La règle découle du FORMAT et n'est pas négociable :
 *  - un choix unique fait caler la personne désignée, un point ;
 *  - un classement fait boire tout le monde, le shooter tombant en tête
 *    (« gagnant boit ») ou en queue (« perdant boit »), jamais TOP_UNIQUE.
 * Le déclencheur `questions_force_rule` l'impose aussi en base ; ceci n'est
 * que la première barrière.
 */
function ruleForFormat(format: string, wanted: string): DrinkRule {
  if (format === "single_choice") return "TOP_UNIQUE";
  return (RANKING_RULES as readonly string[]).includes(wanted)
    ? (wanted as DrinkRule)
    : "ESCALATION_INVERSE";
}

export async function addQuestion(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  await requireAdmin();

  const editionId = String(formData.get("edition_id") ?? "");
  const prompt = String(formData.get("prompt") ?? "").trim();
  const format = String(formData.get("format") ?? "ranking");
  const drinkRule = String(formData.get("drink_rule") ?? "");
  if (!editionId) return { error: "Édition introuvable." };
  if (!prompt) return { error: "L'énoncé est requis." };
  if (format !== "ranking" && format !== "single_choice") {
    return { error: "Format invalide." };
  }
  const ruleOverride = ruleForFormat(format, drinkRule);

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
    drink_rule_override: ruleOverride,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}/questions`);
  return { error: null, success: true };
}

/** Set a question's drink rule (during CONSTRUCTION; the edit-lock trigger
 *  blocks it afterwards). drink_rule_override drives the per-question rule. */
export async function setQuestionRule(
  questionId: string,
  editionId: string,
  rule: string,
): Promise<QuestionState> {
  await requireAdmin();
  if (!(RANKING_RULES as readonly string[]).includes(rule)) return { error: "Règle invalide." };

  const supabase = await createClient();
  // Le déclencheur en base ramènera un choix unique à TOP_UNIQUE quoi qu'il
  // arrive ; on n'a donc pas à relire le format ici.
  const { error } = await supabase
    .from("questions")
    .update({ drink_rule_override: rule as DrinkRule })
    .eq("id", questionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}/questions`);
  return { error: null };
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
