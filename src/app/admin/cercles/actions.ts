"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/guards";

export type CircleState = { error: string | null; success?: boolean };

/** Créer un cercle. Réservé au super-admin. */
export async function createCircle(_prev: CircleState, formData: FormData): Promise<CircleState> {
  const current = await requireSuperAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom du cercle est requis." };

  const supabase = await createClient();
  const { data: circle, error } = await supabase
    .from("circles")
    .insert({ name })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Le créateur en devient administrateur : un cercle sans administrateur
  // serait inutilisable, et le trigger interdit d'ailleurs d'en arriver là.
  const { error: adminError } = await supabase
    .from("circle_admins")
    .insert({ circle_id: circle.id, user_id: current.user.id });
  if (adminError) return { error: adminError.message };

  revalidatePath("/admin/cercles");
  revalidatePath("/admin", "layout");
  return { error: null, success: true };
}

/** Renommer un cercle. */
export async function renameCircle(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("circle_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase.from("circles").update({ name }).eq("id", id);
  revalidatePath("/admin/cercles");
  revalidatePath("/admin", "layout");
}

/**
 * Désigner ou révoquer un administrateur de cercle.
 *
 * Seules les personnes disposant d'un compte peuvent l'être : `circle_admins`
 * référence auth.users, pas la fiche `people`.
 */
export async function setCircleAdmin(
  circleId: string,
  userId: string,
  isAdmin: boolean,
): Promise<CircleState> {
  await requireAdmin();
  if (!circleId || !userId) return { error: "Cercle ou compte introuvable." };

  const supabase = await createClient();
  const { error } = isAdmin
    ? await supabase.from("circle_admins").upsert({ circle_id: circleId, user_id: userId })
    : await supabase
        .from("circle_admins")
        .delete()
        .eq("circle_id", circleId)
        .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/cercles");
  revalidatePath("/admin/people");
  return { error: null, success: true };
}

/** Rattacher une personne sans cercle au cercle indiqué. */
export async function affiliatePerson(personId: string, circleId: string): Promise<CircleState> {
  await requireAdmin();
  if (!personId || !circleId) return { error: "Personne ou cercle introuvable." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("people")
    .update({ circle_id: circleId })
    .eq("id", personId)
    .is("circle_id", null); // on n'arrache jamais quelqu'un à son cercle par ce chemin
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null, success: true };
}
