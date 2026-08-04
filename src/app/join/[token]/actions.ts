"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error: string | null };

export async function joinEdition(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const token = String(formData.get("token") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const linkedPlayer = String(formData.get("linked_player") ?? "").trim();
  const relation = String(formData.get("relation") ?? "").trim();

  if (!token) return { error: "Invitation invalide." };
  if (kind !== "player" && kind !== "jury") return { error: "Choisissez joueur ou entourage." };
  if (kind === "jury" && (!linkedPlayer || !relation)) {
    return { error: "Le jury doit choisir un joueur et préciser son lien." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/join/${token}`);

  const { error } = await supabase.rpc("join_edition", {
    p_token: token,
    p_kind: kind as "player" | "jury",
    p_linked_player: kind === "jury" ? linkedPlayer : undefined,
    p_relation: kind === "jury" ? relation : undefined,
  });
  if (error) return { error: error.message };

  revalidatePath("/account");
  redirect("/account?joined=1");
}
