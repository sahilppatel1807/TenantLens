# Deploying TenantLens on Vercel

## Environment variables

Set these in the Vercel project: **Settings → Environment Variables** (Production, Preview, and Development as needed).

| Variable | Scope | Notes |
|----------|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (`https://….supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Same **anon / publishable** API key from Supabase (either env name works; RLS still applies). |

Do **not** put the Supabase **service role** key in `NEXT_PUBLIC_*` variables. If you add server-only secrets later, define them without the `NEXT_PUBLIC_` prefix and read them only from server code or Route Handlers.

## Supabase project checklist

- Run the SQL migrations in `supabase/migrations/` (or equivalent) so tables, RLS, Storage buckets, and policies exist.
- **Authentication**: Match email confirmation and redirect URLs to your deployed domain (e.g. Site URL and redirect allow list in Supabase Auth settings).
- **Storage**:
  - Private applicant PDFs: bucket `applicant-documents` (see core migration).
  - Public property cover photos: bucket `property-images` (`20260418140000_property_images_bucket.sql`). Apply that migration so add/edit property image uploads work; objects are readable via public URLs for `<img>` tags.

## Build

Vercel runs `npm run build` by default. Ensure the repo builds locally with the same env vars you configure on Vercel.

## Optional: Playwright against a preview URL

```bash
PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
PLAYWRIGHT_BASE_URL="https://your-preview.vercel.app" PLAYWRIGHT_BROWSERS_PATH=0 npx playwright test
```

Use a preview deployment that has the public Supabase variables set. For the optional `E2E_EMAIL` / `E2E_PASSWORD` test, use a dedicated test user in a non-production project when possible.

## Images

`next.config.mjs` allows `images.unsplash.com` for remote `next/image` URLs. Add more `images.remotePatterns` entries if you store property images on another host.
