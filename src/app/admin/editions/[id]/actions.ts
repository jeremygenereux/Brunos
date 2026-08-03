"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { nextState, type EditionState } from "@/lib/editions/state-machine";
import { snapshotEditionResults } from "@/lib/editions/snapshot";

export type ActionState = { error: string | null; success?: boolean };

/**
 * Recalcule et refige les résultats d'une édition, sans toucher à son état.
 *
 * Le figeage normal n'a lieu qu'à la transition COMPILATION → LOCKED. Or tout
 * ce qui nourrit le calcul peut changer APRÈS : la valeur d'un shooter, la
 * règle de consommation, la sélection des questions, un bulletin corrigé.
 * Sans ce bouton, il fallait faire reculer l'édition puis la refaire avancer
 * pour que le cache reflète la réalité.
 *
 * `snapshotEditionResults` est idempotent (il purge tout le cache de l'édition
 * avant de réinsérer), donc l'opération est rejouable sans risque.
 */
export async function recompileEdition(editionId: string): Promise<ActionState> {
  await requireAdmin();
  if (!editionId) return { error: "Édition introuvable." };

  const supabase = await createClient();
  const { error } = await snapshotEditionResults(supabase, editionId);
  if (error) return { error };

  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath(`/archive/${editionId}`);
  revalidatePath("/archive");
  return { error: null, success: true };
}

/**
 * Rouvre le scrutin, y compris après échéance ou après verrouillage.
 *
 * `edition_accepts_votes()` exige DEUX conditions : l'état SENT_FOR_VOTE et une
 * échéance non dépassée. Repasser l'état sans toucher à la date laisserait donc
 * le scrutin fermé — c'est pourquoi on écrit les deux ensemble.
 *
 * Les classements figés ne sont pas touchés : ils deviennent simplement
 * périmés, et « Recompiler les résultats » les remettra à jour.
 */
export async function reopenVoting(editionId: string, deadline: string | null) {
  await requireAdmin();
  if (!editionId) return { error: "Édition introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("editions")
    .update({ state: "SENT_FOR_VOTE", vote_deadline: deadline })
    .eq("id", editionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/account");
  return { error: null, success: true };
}

/**
 * Efface le bulletin d'un participant pour qu'il puisse voter de nouveau.
 *
 * La policy `votes_delete_admin` autorise cette suppression, et les réponses
 * suivent par cascade. Un bulletin déposé étant verrouillé pour son auteur,
 * c'est la seule façon de corriger une erreur signalée après coup.
 */
export async function resetBallot(editionId: string, participantId: string) {
  await requireAdmin();
  if (!editionId || !participantId) return { error: "Participant introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("edition_id", editionId)
    .eq("participant_id", participantId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}`);
  return { error: null, success: true };
}

/** Set (or clear) a participant's personalized Apple Invitation URL. */
export async function setAppleInvite(participantId: string, url: string): Promise<ActionState> {
  await requireAdmin();
  if (!participantId) return { error: "Participant introuvable." };

  const trimmed = url.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    return { error: "Le lien doit commencer par http(s)://" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("participants")
    .update({ apple_invite_url: trimmed || null })
    .eq("id", participantId);
  if (error) return { error: error.message };
  return { error: null, success: true };
}

/** Permanently delete an edition and everything under it (cascades). */
export async function deleteEdition(editionId: string): Promise<ActionState> {
  await requireAdmin();
  if (!editionId) return { error: "Édition introuvable." };

  const supabase = await createClient();
  // FK cascades drop players/questions/participants/votes/answers/results/
  // notifications; persistent people in the bank are untouched.
  const { error } = await supabase.from("editions").delete().eq("id", editionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/editions");
  return { error: null, success: true };
}

export async function transitionEdition(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const editionId = String(formData.get("edition_id") ?? "");
  const requested = String(formData.get("next_state") ?? "") as EditionState;
  const voteDeadline = String(formData.get("vote_deadline") ?? "").trim();
  if (!editionId) return { error: "Édition introuvable." };

  const supabase = await createClient();
  const { data: edition, error: fetchError } = await supabase
    .from("editions")
    .select("state")
    .eq("id", editionId)
    .single();
  if (fetchError || !edition) return { error: "Édition introuvable." };

  // Only the single legal forward transition is allowed (no skipping states).
  const expected = nextState(edition.state);
  if (!expected) return { error: "Cette édition est déjà archivée." };
  if (requested !== expected) return { error: "Transition d'état invalide." };

  // Freeze the computed rankings into the `results` cache as the edition
  // locks. Done BEFORE flipping state so a failure aborts the transition.
  if (requested === "LOCKED") {
    const snap = await snapshotEditionResults(supabase, editionId);
    if (snap.error) return { error: snap.error };
  }

  const payload: { state: EditionState; vote_deadline?: string | null } = {
    state: requested,
  };
  if (requested === "SENT_FOR_VOTE") {
    payload.vote_deadline = voteDeadline ? new Date(voteDeadline).toISOString() : null;
  }

  // RLS (editions_update_admin) is the real gate; this update is admin-only.
  const { error } = await supabase.from("editions").update(payload).eq("id", editionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin/editions");
  return { error: null, success: true };
}

/**
 * Archive the edition from the presentation's recap screen (LIVE → ARCHIVED).
 * Makes results public (the `results` RLS opens to participants once ARCHIVED).
 */
export async function archiveEdition(editionId: string): Promise<ActionState> {
  await requireAdmin();
  if (!editionId) return { error: "Édition introuvable." };

  const supabase = await createClient();
  const { data: edition, error: fetchError } = await supabase
    .from("editions")
    .select("state")
    .eq("id", editionId)
    .single();
  if (fetchError || !edition) return { error: "Édition introuvable." };
  if (edition.state !== "LIVE") return { error: "L'édition n'est pas en direct." };

  const { error } = await supabase
    .from("editions")
    .update({ state: "ARCHIVED" })
    .eq("id", editionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath(`/admin/editions/${editionId}/present`);
  revalidatePath("/admin/editions");
  return { error: null, success: true };
}

export async function updateEdition(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();

  const editionId = String(formData.get("edition_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const year = Number(String(formData.get("year") ?? "").trim());
  const eventAt = String(formData.get("event_at") ?? "").trim();
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const venueAddress = String(formData.get("venue_address") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const drinkRule = String(formData.get("drink_rule") ?? "ESCALATION");
  const shooterValue = Number(String(formData.get("shooter_value") ?? "8").trim());

  if (!editionId) return { error: "Édition introuvable." };
  if (!name) return { error: "Le nom est requis." };
  if (!Number.isInteger(year) || year < 2001) return { error: "Année invalide." };
  if (!(shooterValue > 0)) return { error: "La valeur du shooter doit être positive." };
  if (drinkRule !== "ESCALATION" && drinkRule !== "TOP_UNIQUE") {
    return { error: "Règle de consommation invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("editions")
    .update({
      name,
      year,
      event_at: eventAt ? new Date(eventAt).toISOString() : null,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      description: description || null,
      drink_rule: drinkRule,
      shooter_value: shooterValue,
    })
    .eq("id", editionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/editions/${editionId}`);
  revalidatePath("/admin/editions");
  return { error: null, success: true };
}
