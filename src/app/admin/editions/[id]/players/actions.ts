"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type PlayerState = { error: string | null; success?: boolean };

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function addPlayer(_prev: PlayerState, formData: FormData): Promise<PlayerState> {
  await requireAdmin();

  const editionId = String(formData.get("edition_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("headshot");
  if (!editionId) return { error: "Édition introuvable." };
  if (!name) return { error: "Le nom est requis." };

  const supabase = await createClient();

  // 1. Persistent person identity (nominee with no auth account).
  const { data: person, error: personError } = await supabase
    .from("people")
    .insert({ display_name: name })
    .select("id")
    .single();
  if (personError || !person) {
    return { error: personError?.message ?? "Création de la personne échouée." };
  }

  // 2. Optional headshot upload to the public `headshots` bucket (admin RLS).
  let headshotUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = EXT[file.type];
    if (!ext) return { error: "Le headshot doit être une image PNG, JPEG ou WebP." };
    const objectPath = `${editionId}/${randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("headshots")
      .upload(objectPath, file, { contentType: file.type, upsert: true });
    if (uploadError) return { error: `Upload du headshot : ${uploadError.message}` };
    headshotUrl = supabase.storage.from("headshots").getPublicUrl(objectPath).data.publicUrl;
  }

  // 3. Next display order (unique per edition).
  const { data: last } = await supabase
    .from("players")
    .select("display_order")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.display_order ?? -1) + 1;

  // 4. The player (= the person's participation in this edition).
  const { error: playerError } = await supabase.from("players").insert({
    edition_id: editionId,
    person_id: person.id,
    headshot_url: headshotUrl,
    display_order: nextOrder,
  });
  if (playerError) return { error: playerError.message };

  revalidatePath(`/admin/editions/${editionId}/players`);
  return { error: null, success: true };
}

export async function deletePlayer(formData: FormData): Promise<void> {
  await requireAdmin();
  const playerId = String(formData.get("player_id") ?? "");
  const editionId = String(formData.get("edition_id") ?? "");
  if (!playerId) return;

  const supabase = await createClient();
  await supabase.from("players").delete().eq("id", playerId);
  revalidatePath(`/admin/editions/${editionId}/players`);
}
