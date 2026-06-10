"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

export type RsvpStatus = "yes" | "no" | "maybe";

export type RsvpResult = { error: string | null };

export async function setRsvp(editionId: string, rsvp: RsvpStatus): Promise<RsvpResult> {
  const current = await getCurrentUser();
  if (!current) return { error: "Tu n'es pas connecté·e." };

  const supabase = await createClient();
  // RLS (participants_update_own_rsvp) gates this to the caller's own row and
  // permits changing ONLY the rsvp column.
  const { error } = await supabase
    .from("participants")
    .update({ rsvp })
    .eq("edition_id", editionId)
    .eq("user_id", current.user.id);
  if (error) return { error: error.message };

  revalidatePath("/account");
  return { error: null };
}
