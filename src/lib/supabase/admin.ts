import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the service_role key — BYPASSES RLS.
 * Server-only. Use exclusively for trusted admin/server logic (e.g. compiling
 * results, the equalizer), never in code reachable from the browser.
 */
export function createAdminClient() {
  return createClient(
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
