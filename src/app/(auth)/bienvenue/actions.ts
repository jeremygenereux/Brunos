"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type WelcomeState = { error: string | null };

/**
 * Pose le mot de passe d'un compte créé par invitation. La session vient du
 * lien du courriel (verifyOtp dans /auth/confirm) — sans elle, on renvoie vers
 * la connexion plutôt que d'échouer silencieusement.
 */
export async function setInitialPassword(
  _prev: WelcomeState,
  formData: FormData,
): Promise<WelcomeState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) return { error: "Le mot de passe doit faire au moins 8 caractères." };
  if (password !== confirm) return { error: "Les deux mots de passe ne correspondent pas." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=invitation");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/account");
}
