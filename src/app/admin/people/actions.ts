"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { getCurrentUser, type Role } from "@/lib/auth/user";

export type PeopleState = { error: string | null; success?: boolean };

/** Normalise un courriel d'invitation, ou null si vide. Le check en base
 *  exige déjà minuscules + trim ; on s'aligne côté serveur pour donner un
 *  message clair plutôt qu'une violation de contrainte. */
function normalizeEmail(raw: FormDataEntryValue | null): string | null {
  const email = String(raw ?? "")
    .trim()
    .toLowerCase();
  return email.length > 0 ? email : null;
}

function invalidEmail(email: string) {
  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function createPerson(_prev: PeopleState, formData: FormData): Promise<PeopleState> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Le nom est requis." };
  const email = normalizeEmail(formData.get("email"));
  if (email && invalidEmail(email)) return { error: "Courriel invalide." };

  const supabase = await createClient();
  const { data: person, error } = await supabase
    .from("people")
    .insert({ display_name: name })
    .select("id")
    .single();
  if (error) return { error: error.message };

  if (email && person) {
    const { error: inviteError } = await supabase
      .from("person_invites")
      .insert({ person_id: person.id, email });
    if (inviteError) {
      return {
        error:
          inviteError.code === "23505"
            ? "Ce courriel est déjà associé à une autre personne."
            : inviteError.message,
      };
    }
  }

  revalidatePath("/admin/people");
  return { error: null, success: true };
}

/**
 * Enregistre (ou efface) le courriel d'invitation d'une personne. C'est lui
 * qui permet, à l'inscription, de rattacher le compte à CETTE personne au lieu
 * d'en créer une nouvelle — et donc de retrouver les éditions où elle est déjà
 * inscrite comme joueuse.
 */
export async function setPersonEmail(formData: FormData): Promise<void> {
  await requireAdmin();
  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return;
  const email = normalizeEmail(formData.get("email"));

  const supabase = await createClient();
  if (!email) {
    await supabase.from("person_invites").delete().eq("person_id", personId);
  } else if (!invalidEmail(email)) {
    await supabase.from("person_invites").upsert({ person_id: personId, email });
  }
  revalidatePath("/admin/people");
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
