"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const kind = String(formData.get("kind") ?? "player") === "jury" ? "jury" : "player";

  const supabase = await createClient();
  const { data: person, error } = await supabase
    .from("people")
    .insert({ display_name: name, kind })
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
 * Enregistre (ou efface) le courriel d'accès d'une personne.
 *
 * Sans compte, ce courriel sert d'aiguillage : à l'inscription, il rattache le
 * compte à CETTE fiche plutôt que d'en créer une nouvelle — et la personne
 * retrouve les cérémonies où elle est déjà nommée.
 *
 * Avec un compte, il EST son identifiant de connexion : on modifie donc aussi
 * l'adresse du compte. Deux cas courants l'exigent — les comptes techniques
 * créés par l'import de l'historique (`@brunos.invalid`, qui ne reçoivent rien)
 * et une adresse saisie de travers. Sans ça, la fiche resterait à jamais
 * accrochée à la mauvaise adresse.
 */
export async function setPersonEmail(formData: FormData): Promise<PeopleState> {
  await requireAdmin();
  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return { error: "Personne introuvable." };
  const email = normalizeEmail(formData.get("email"));
  if (email && invalidEmail(email)) return { error: "Ce courriel n'est pas valide." };

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select("auth_user_id")
    .eq("id", personId)
    .maybeSingle();

  if (person?.auth_user_id) {
    if (!email) return { error: "Un compte existant ne peut pas rester sans adresse." };
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "SUPABASE_SERVICE_ROLE_KEY manquante côté serveur." };
    }
    // `email_confirm` évite le double courriel de confirmation d'Supabase, qui
    // n'a pas de sens ici : c'est l'administration qui décide, et la personne
    // reprend la main via le lien d'accès envoyé juste après.
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(person.auth_user_id, {
      email,
      email_confirm: true,
    });
    if (error) return { error: error.message };
  }

  if (!email) {
    await supabase.from("person_invites").delete().eq("person_id", personId);
  } else {
    await supabase.from("person_invites").upsert({ person_id: personId, email });
  }
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

const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Portrait de référence d'une personne, dans le bucket public `headshots`.
 * C'est CE portrait qui suit la personne d'une édition à l'autre ; la photo
 * posée sur un joueur d'une année donnée reste prioritaire pour cette année-là.
 */
export async function setPersonHeadshot(
  _prev: PeopleState,
  formData: FormData,
): Promise<PeopleState> {
  await requireAdmin();
  const personId = String(formData.get("person_id") ?? "");
  if (!personId) return { error: "Personne introuvable." };

  const file = formData.get("headshot");
  if (!(file instanceof File) || file.size === 0) return { error: "Choisissez une image." };
  const ext = IMAGE_EXT[file.type];
  if (!ext) return { error: "L'image doit être en PNG, JPEG ou WebP." };

  const supabase = await createClient();
  const objectPath = `people/${personId}-${randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("headshots")
    .upload(objectPath, file, { contentType: file.type, upsert: true });
  if (uploadError) return { error: `Téléversement : ${uploadError.message}` };

  const url = supabase.storage.from("headshots").getPublicUrl(objectPath).data.publicUrl;
  const { error } = await supabase.from("people").update({ headshot_url: url }).eq("id", personId);
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null, success: true };
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

/**
 * Envoie l'invitation par courriel à une personne sans compte.
 *
 * `inviteUserByEmail` crée l'utilisateur auth et envoie le courriel ; le
 * trigger on_auth_user_created rattache alors la fiche `people` qui porte ce
 * courriel (person_invites) et enrôle la personne dans les éditions où elle est
 * déjà joueuse. Elle n'a plus qu'à choisir son mot de passe sur /bienvenue.
 *
 * Un des rares cas légitimes pour le client service-role : l'API admin d'auth
 * n'est pas accessible depuis une session utilisateur.
 */
export async function invitePerson(personId: string): Promise<PeopleState> {
  await requireAdmin();
  if (!personId) return { error: "Personne introuvable." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "SUPABASE_SERVICE_ROLE_KEY manquante côté serveur." };
  }

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("people")
    .select("id, display_name, auth_user_id")
    .eq("id", personId)
    .maybeSingle();
  if (!person) return { error: "Personne introuvable." };

  const { data: invite } = await supabase
    .from("person_invites")
    .select("email")
    .eq("person_id", personId)
    .maybeSingle();

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (await headers().then((h) => {
      const host = h.get("host");
      return host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : null;
    })) ??
    "http://localhost:3001";

  const admin = createAdminClient();

  // Quand un compte existe, SON adresse fait foi : c'est là que le courriel
  // partira, et `person_invites` peut avoir pris du retard.
  const { data: list } = await admin.auth.admin.listUsers();
  const account = person.auth_user_id
    ? (list?.users ?? []).find((u) => u.id === person.auth_user_id)
    : (list?.users ?? []).find(
        (u) => (u.email ?? "").toLowerCase() === (invite?.email ?? "").toLowerCase(),
      );

  const email = account?.email ?? invite?.email;
  if (!email) return { error: "Notez d'abord un courriel d'accès." };

  // Une première invitation crée le compte auth (et le trigger rattache la
  // fiche) ; réinviter à la même adresse échouerait sur « already registered ».
  // Dès qu'un compte existe — utilisé ou non — on envoie donc un lien de
  // récupération. C'est aussi la reprise en main après un changement d'adresse.
  if (account) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/bienvenue`,
    });
    if (error) return { error: error.message };
    revalidatePath("/admin/people");
    return { error: null, success: true };
  }

  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/bienvenue`,
    data: { display_name: person.display_name },
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null, success: true };
}


/**
 * Bascule une personne entre « joueur » et « proche ».
 *
 * Un proche ne peut pas être nommé dans une édition (garde en base) : on
 * refuse donc la bascule si la personne figure déjà comme nommée quelque part,
 * plutôt que de laisser l'admin découvrir l'erreur plus tard.
 */
export async function setPersonKind(personId: string, kind: "player" | "jury"): Promise<PeopleState> {
  await requireAdmin();
  if (!personId) return { error: "Personne introuvable." };

  const supabase = await createClient();
  if (kind === "jury") {
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("person_id", personId);
    if ((count ?? 0) > 0) {
      return {
        error: `Impossible : cette personne est nommée dans ${count} édition${(count ?? 0) > 1 ? "s" : ""}. Retirez-la d'abord.`,
      };
    }
  }

  const { error } = await supabase.from("people").update({ kind }).eq("id", personId);
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null, success: true };
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
    return { error: "Vous ne pouvez pas changer votre propre rôle." };
  }

  // RLS (profiles_update_admin) gates this to admins.
  const { error } = await supabase.from("profiles").update({ role }).eq("person_id", personId);
  if (error) return { error: error.message };

  revalidatePath("/admin/people");
  return { error: null };
}
