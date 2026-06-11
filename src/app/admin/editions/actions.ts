"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export type EditionFormState = { error: string | null; success?: boolean };

export async function createEdition(
  _prev: EditionFormState,
  formData: FormData,
): Promise<EditionFormState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const year = Number(String(formData.get("year") ?? "").trim());
  const eventAt = String(formData.get("event_at") ?? "").trim();
  const venueName = String(formData.get("venue_name") ?? "").trim();
  const venueAddress = String(formData.get("venue_address") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const drinkRule = String(formData.get("drink_rule") ?? "ESCALATION");
  const shooterValue = Number(String(formData.get("shooter_value") ?? "8").trim());

  if (!name) return { error: "Le nom est requis." };
  if (!Number.isInteger(year) || year < 2001) return { error: "Année invalide." };
  if (!(shooterValue > 0)) return { error: "La valeur du shooter doit être positive." };
  if (drinkRule !== "ESCALATION" && drinkRule !== "TOP_UNIQUE") {
    return { error: "Règle de consommation invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("editions").insert({
    name,
    year,
    event_at: eventAt ? new Date(eventAt).toISOString() : null,
    venue_name: venueName || null,
    venue_address: venueAddress || null,
    description: description || null,
    drink_rule: drinkRule,
    shooter_value: shooterValue,
  });

  // RLS (editions_insert_admin) is the real gate; surface any failure.
  if (error) return { error: error.message };

  revalidatePath("/admin/editions");
  return { error: null, success: true };
}
