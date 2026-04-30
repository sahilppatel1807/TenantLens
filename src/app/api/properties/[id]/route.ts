import { NextResponse } from "next/server";
import { billablePropertyCount } from "@/lib/billing/constants";
import { fetchProfileBilling, hasPaidSubscription } from "@/lib/billing/profile-billing";
import { payloadToPropertyInput, propertyPayloadSchema } from "@/lib/billing/property-payload";
import { syncStripeSubscriptionQuantityForUser } from "@/lib/billing/sync-subscription-quantity";
import { propertyToUpdateRow } from "@/lib/db/mappers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteCtx = { params: { id: string } };

export async function PATCH(request: Request, context: RouteCtx) {
  const { id: propertyId } = context.params;

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

  const { data: existing, error: loadErr } = await supabase
    .from("properties")
    .select("id, user_id, status")
    .eq("id", propertyId)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const { count: otherActive, error: countErr } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "active")
    .neq("id", propertyId);

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 });
  }

  const payload = payloadToPropertyInput(parsed.data);
  const activeAfter = (otherActive ?? 0) + (payload.status === "active" ? 1 : 0);
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

  const patch = propertyToUpdateRow(payload);
  const { data, error } = await supabase
    .from("properties")
    .update(patch)
    .eq("id", propertyId)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("PATCH /api/properties/[id]:", error.message);
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

export async function DELETE(_request: Request, context: RouteCtx) {
  const { id: propertyId } = context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: existing, error: loadErr } = await supabase
    .from("properties")
    .select("id, user_id")
    .eq("id", propertyId)
    .maybeSingle();

  if (loadErr || !existing) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Property not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("user_id", user.id);

  if (deleteError) {
    console.error("DELETE /api/properties/[id]:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const profile = await fetchProfileBilling(supabase, user.id);
  if (hasPaidSubscription(profile)) {
    const sync = await syncStripeSubscriptionQuantityForUser(supabase, user.id);
    if (sync.ok === false) {
      return NextResponse.json(
        { error: sync.message, code: "STRIPE_SYNC_FAILED" },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
