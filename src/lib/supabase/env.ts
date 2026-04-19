/**
 * Public Supabase URL + anon/publishable key (browser-safe).
 * Supabase UI may label the key "anon" or "publishable"; both work for the JS client.
 */
export function getSupabasePublicEnv(): { url: string | undefined; anonKey: string | undefined } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return { url, anonKey };
}

/**
 * Per-Supabase-project auth storage/cookie name so sessions from another app
 * on the same host (e.g. a previous prototype on localhost) are not reused.
 * Matches @supabase/ssr: pass as `cookieOptions.name` (sets auth `storageKey`).
 */
export function supabaseAuthStorageKey(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return ref ? `tl-sb-${ref}` : undefined;
  } catch {
    return undefined;
  }
}
