import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  user: { id: string; email: string | undefined };
  role: Role;
  personId: string | null;
  name: string | null;
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

  return {
    user: { id: user.id, email: user.email },
    role: profile?.role ?? "player",
    personId: profile?.person_id ?? null,
    name: profile ? personName(profile.people) : null,
  };
}
