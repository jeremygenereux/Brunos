import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database.types";

export type Role = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  user: { id: string; email: string | undefined };
  role: Role;
  personId: string | null;
};

/**
 * Resolves the signed-in user and their profile role (server-side, RLS-aware).
 * Returns null when no valid session exists.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, person_id")
    .eq("user_id", user.id)
    .single();

  return {
    user: { id: user.id, email: user.email },
    role: profile?.role ?? "player",
    personId: profile?.person_id ?? null,
  };
}
