import { NextResponse } from "next/server";
import { billablePropertyCount } from "@/lib/billing/constants";
import { countActivePropertiesForUser } from "@/lib/billing/count-active-properties";
import { fetchProfileBilling, hasPaidSubscription } from "@/lib/billing/profile-billing";
import { payloadToPropertyInput, propertyPayloadSchema } from "@/lib/billing/property-payload";
import { syncStripeSubscriptionQuantityForUser } from "@/lib/billing/sync-subscription-quantity";
import { propertyToInsert } from "@/lib/db/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = propertyPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid property payload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const payload = payloadToPropertyInput(parsed.data);
  const activeBefore = await countActivePropertiesForUser(supabase, user.id);
  const activeAfter = activeBefore + (payload.status === "active" ? 1 : 0);
  const billableAfter = billablePropertyCount(activeAfter);
  const profile = await fetchProfileBilling(supabase, user.id);

  if (billableAfter > 0 && !hasPaidSubscription(profile)) {
    return NextResponse.json(
      {
        code: "UPGRADE_REQUIRED" as const,
        message: "Subscribe to add more than three active listings.",
        activePropertyCount: activeAfter,
        billablePropertyCount: billableAfter,
      },
      { status: 403 },
    );
  }

  const insert = propertyToInsert(payload, user.id);
  const { data, error } = await supabase.from("properties").insert(insert).select("*").single();
  if (error) {
    console.error("POST /api/properties:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (hasPaidSubscription(profile)) {
    const sync = await syncStripeSubscriptionQuantityForUser(supabase, user.id);
    if (sync.ok === false) {
      return NextResponse.json(
        { error: sync.message, code: "STRIPE_SYNC_FAILED" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(data);
}
