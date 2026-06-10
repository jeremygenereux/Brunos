"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentUser, type Role } from "@/lib/auth/user";

export type PeopleState = { error: string | null; success?: boolean };

export async function createPerson(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from("people").insert({ display_name: name });
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null, success: true };
}

export async function renamePerson(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("person_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  await supabase.from("people").update({ display_name: name }).eq("id", id);
  revalidatePath("/admin/people");
}

export async function deletePerson(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("person_id") ?? "");
  if (!id) return;

  // FK RESTRICT on players.person_id stops deletion of someone still in an
  // edition — the UI disables the button in that case, so this only runs for
  // unreferenced people.
  const supabase = await createClient();
  await supabase.from("people").delete().eq("id", id);
  revalidatePath("/admin/people");
}

export async function setPersonRole(personId: string, role: Role): Promise<PeopleState> {
  await requireAdmin();
  const current = await getCurrentUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("person_id", personId)
    .maybeSingle();
  if (!profile) return { error: "Cette personne n'a pas de compte." };
  if (profile.user_id === current?.user.id) {
    return { error: "Tu ne peux pas changer ton propre rôle." };
  }

  // RLS (profiles_update_admin) gates this to admins.
  const { error } = await supabase.from("profiles").update({ role }).eq("person_id", personId);
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null };
}
