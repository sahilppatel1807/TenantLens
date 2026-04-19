import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, supabaseAuthStorageKey } from "./env";

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabasePublicEnv();
  if (!url || !anonKey) return null;
  const name = supabaseAuthStorageKey(url);
  return createBrowserClient(url, anonKey, {
    ...(name ? { cookieOptions: { name } } : {}),
  });
}

/** Use when env must be present; prefer {@link getSupabaseBrowserClient} in shared layouts. */
export function createSupabaseBrowserClient(): SupabaseClient {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or a public key (NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)",
    );
  }
  return client;
}
