import type { SupabaseClient } from "@supabase/supabase-js";

/** Count properties with status `active` for the user (billing-relevant). */
export async function countActivePropertiesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "active");

  if (error) throw new Error(error.message);
  return count ?? 0;
}
