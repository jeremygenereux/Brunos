import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";

/**
 * Privileged Supabase client using the service_role key — BYPASSES RLS.
 * Server-only.
 *
 * Currently UNUSED. The results snapshot, the equalizer/compile preview, and
 * the presentation all deliberately go through the RLS-respecting server
 * client (`@/lib/supabase/server`) and rely on is_admin() policies as the gate
 * — that is the intended design. Do NOT wire this client into the
 * results / votes / vote_answers paths: it would bypass vote-secrecy and the
 * admin-only write policies. Reserve it only for a genuine service task that
 * must run without a user session, never in code reachable from the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
