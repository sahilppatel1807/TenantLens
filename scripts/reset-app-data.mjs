#!/usr/bin/env node
/**
 * Wipes TenantLens data on the linked Supabase project:
 * - All objects in storage buckets applicant-documents and property-images
 * - All rows in public.properties (CASCADE deletes applicants, applicant_documents,
 *   analysis_results, application_requirements)
 *
 * Optional: DELETE_AUTH_USERS=yes removes every auth user via the Admin API.
 * public.profiles rows CASCADE when auth.users are deleted (see migration FK).
 *
 * Run (from repo root):
 *   CONFIRM_RESET=yes node --env-file=.env.local scripts/reset-app-data.mjs
 *   CONFIRM_RESET=yes DELETE_AUTH_USERS=yes node --env-file=.env.local scripts/reset-app-data.mjs
 *   npm run reset:full
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (process.env.CONFIRM_RESET !== "yes") {
  console.error(
    "Refusing to run: set CONFIRM_RESET=yes to delete all properties, related rows, and storage objects.",
  );
  process.exit(1);
}

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Collect file paths under prefix (folders have metadata === null). */
async function listFilePaths(bucket, prefix = "") {
  const paths = [];
  const { data: items, error } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const item of items ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.metadata === null) {
      paths.push(...(await listFilePaths(bucket, path)));
    } else {
      paths.push(path);
    }
  }
  return paths;
}

async function removeAllInBucket(bucket) {
  const paths = await listFilePaths(bucket);
  const chunk = 500;
  let removed = 0;
  for (let i = 0; i < paths.length; i += chunk) {
    const batch = paths.slice(i, i + chunk);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw error;
    removed += batch.length;
  }
  return removed;
}

async function main() {
  console.log("Removing storage objects…");
  const applicantDocs = await removeAllInBucket("applicant-documents");
  const propertyImages = await removeAllInBucket("property-images");
  console.log(`  applicant-documents: ${applicantDocs} file(s)`);
  console.log(`  property-images: ${propertyImages} file(s)`);

  console.log("Deleting all properties (cascade to applicants, documents, …)…");
  const { error: delErr, count } = await supabase
    .from("properties")
    .delete({ count: "exact" })
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (delErr) throw delErr;
  console.log(`  properties deleted: ${count ?? "unknown"}`);

  if (process.env.DELETE_AUTH_USERS === "yes") {
    console.log("Deleting all auth users (profiles CASCADE; you can register again)…");
    let deleted = 0;
    let page = 1;
    const perPage = 1000;
    for (;;) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const { users } = data;
      for (const u of users) {
        const { error: delUserErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delUserErr) throw delUserErr;
        deleted++;
      }
      if (users.length < perPage) break;
      page++;
    }
    console.log(`  auth users deleted: ${deleted}`);
    console.log("Done. Register a new account at /register.");
  } else {
    console.log("Done. Auth users and profiles unchanged (set DELETE_AUTH_USERS=yes to remove them).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
