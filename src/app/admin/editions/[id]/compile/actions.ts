"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type SelectionResult = { error: string | null; saved?: boolean };

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
