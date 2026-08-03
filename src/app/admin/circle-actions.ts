"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";
import { CIRCLE_COOKIE, listCircles } from "@/lib/editions/circle";

/**
 * Bascule l'administration sur un autre cercle.
 *
 * On vérifie que le cercle demandé fait partie des cercles LISIBLES avant
 * d'écrire le cookie : sans ce contrôle, n'importe qui pourrait forger la
 * valeur et se retrouver avec une interface qui prétend administrer un cercle
 * dont la RLS ne renverrait ensuite que du vide.
 */
export async function selectCircle(circleId: string): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();

  const circles = await listCircles(supabase);
  if (!circles.some((c) => c.id === circleId)) {
    return { error: "Ce cercle ne vous est pas accessible." };
  }

  (await cookies()).set(CIRCLE_COOKIE, circleId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/admin", "layout");
  return { error: null };
}
