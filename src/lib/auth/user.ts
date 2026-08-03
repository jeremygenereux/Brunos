import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Role = Database["public"]["Enums"]["user_role"];



export type CurrentUser = {
  user: { id: string; email: string | undefined };
  role: Role;
  personId: string | null;
  name: string | null;
  /**
   * Accède à l'administration.
   *
   * Ne se déduit PAS du rôle seul : depuis les cercles, administrer est une
   * appartenance (`circle_admins`) et non un rôle global. Un administrateur de
   * cercle porte le rôle « player » — le tester aurait fermé la porte à tous
   * ceux qui ne sont pas super-admins.
   */
  administers: boolean;
};

function personName(people: unknown): string | null {
  const p = Array.isArray(people) ? people[0] : people;
  return (p as { display_name?: string } | null)?.display_name ?? null;
}

/**
 * Resolves the signed-in user, their profile role, and their display name
 * (server-side, RLS-aware). Returns null when no valid session exists.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Degrade gracefully if Supabase env isn't configured (e.g. a deploy made
  // before the env vars are wired) instead of throwing a 500.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, person_id, people(display_name)")
    .eq("user_id", user.id)
    .single();

  const role = profile?.role ?? "player";

  // Administre-t-il au moins un cercle ? La politique de lecture de
  // circle_admins n'expose que ses propres lignes, donc un simple compte suffit.
  let administers = role === "super_admin";
  if (!administers) {
    const { count } = await supabase
      .from("circle_admins")
      .select("circle_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    administers = (count ?? 0) > 0;
  }

  return {
    user: { id: user.id, email: user.email },
    role,
    personId: profile?.person_id ?? null,
    name: profile ? personName(profile.people) : null,
    administers,
  };
}
