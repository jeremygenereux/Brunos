import "server-only";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Cookie qui retient le cercle choisi par un super-admin d'une page à l'autre. */
export const CIRCLE_COOKIE = "brunos_circle";

export type CircleOption = { id: string; name: string };

/**
 * Les cercles que l'utilisateur a le droit de voir.
 *
 * Aucun filtrage applicatif : la politique `circles_select` fait déjà le tri
 * (son propre cercle, plus ceux qu'il administre, plus tous s'il est
 * super-admin). Se reposer dessus évite d'avoir deux règles à garder d'accord.
 */
export async function listCircles(supabase: Client): Promise<CircleOption[]> {
  const { data } = await supabase.from("circles").select("id, name").order("name");
  return data ?? [];
}

/**
 * Le cercle sur lequel l'administration travaille, par ordre de priorité :
 *
 *   1. le cercle choisi explicitement, s'il reste accessible — on revalide à
 *      chaque fois plutôt que de faire confiance au cookie, sinon un cercle
 *      perdu entre-temps donnerait des écrans vides et incompréhensibles ;
 *   2. le cercle de sa propre fiche, pour un admin qui n'en a qu'un ;
 *   3. à défaut, le premier cercle lisible.
 *
 * Renvoie null quand l'utilisateur n'est rattaché à rien : les appelants
 * doivent le traiter comme « rien à administrer ».
 */
export async function currentCircleId(supabase: Client): Promise<string | null> {
  const circles = await listCircles(supabase);
  if (circles.length === 0) return null;

  const chosen = (await cookies()).get(CIRCLE_COOKIE)?.value;
  if (chosen && circles.some((c) => c.id === chosen)) return chosen;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: person } = await supabase
      .from("people")
      .select("circle_id")
      .eq("auth_user_id", user.id)
      .not("circle_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (person?.circle_id && circles.some((c) => c.id === person.circle_id)) {
      return person.circle_id;
    }
  }

  return circles[0].id;
}
