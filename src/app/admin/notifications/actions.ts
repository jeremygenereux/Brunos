"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/guards";

export async function markAllNotificationsRead(): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  // RLS (notifications_update_admin) gates this to admins.
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/admin/notifications");
  revalidatePath("/admin", "layout");
}
