"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type EntourageState = { error: string | null; success?: boolean };

/**
 * Rattache un proche à une édition, auprès d'un joueur donné.
 *
 * On écrit dans `edition_entourage`, la table d'INTENTION : elle n'exige pas
 * que la personne ait un compte. Le trigger crée la ligne `participants`
 * (kind 'jury') dès qu'un compte existe — aujourd'hui ou après l'invitation.
 */
export async function addEntourage(
  _prev: EntourageState,
  formData: FormData,
): Promise<EntourageState> {
  await requireAdmin();
  const editionId = String(formData.get("edition_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  const linkedPlayerId = String(formData.get("linked_player_id") ?? "");
  const relation = String(formData.get("relation_label") ?? "").trim();

  if (!editionId || !personId) return { error: "Choisissez une personne." };
  if (!linkedPlayerId) return { error: "Choisissez le joueur auquel la rattacher." };
  if (!relation) return { error: "Précisez le lien (ex. « Mère de Raphaël »)." };

  const supabase = await createClient();
  const { error } = await supabase.from("edition_entourage").upsert(
    {
      edition_id: editionId,
      person_id: personId,
      linked_player_id: linkedPlayerId,
      relation_label: relation,
    },
    { onConflict: "edition_id,person_id" },
  );
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}/entourage`);
  return { error: null, success: true };
}

/** Retire un proche de l'édition (et le participant matérialisé, s'il existe). */
export async function removeEntourage(formData: FormData): Promise<void> {
  await requireAdmin();
  const editionId = String(formData.get("edition_id") ?? "");
  const personId = String(formData.get("person_id") ?? "");
  if (!editionId || !personId) return;

  const supabase = await createClient();
  await supabase
    .from("edition_entourage")
    .delete()
    .eq("edition_id", editionId)
    .eq("person_id", personId);

  // La ligne `participants` a pu être matérialisée : on la retire aussi, sinon
  // la personne continuerait de voir l'édition et de pouvoir voter.
  const { data: person } = await supabase
    .from("people")
    .select("auth_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (person?.auth_user_id) {
    await supabase
      .from("participants")
      .delete()
      .eq("edition_id", editionId)
      .eq("user_id", person.auth_user_id)
      .eq("kind", "jury");
  }

  revalidatePath(`/admin/editions/${editionId}/entourage`);
}
