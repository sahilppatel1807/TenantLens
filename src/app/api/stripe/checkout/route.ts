import { NextResponse } from "next/server";
import { billablePropertyCount } from "@/lib/billing/constants";
import { countActivePropertiesForUser } from "@/lib/billing/count-active-properties";
import { fetchProfileBilling, hasPaidSubscription } from "@/lib/billing/profile-billing";
import { getStripe } from "@/lib/stripe/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "You must be signed in to subscribe." }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_ID?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

  if (!priceId || !siteUrl) {
    console.error("Stripe checkout: missing STRIPE_PRICE_ID or NEXT_PUBLIC_SITE_URL");
    return NextResponse.json({ error: "Checkout is not available." }, { status: 500 });
  }

  const profile = await fetchProfileBilling(supabase, user.id);
  if (hasPaidSubscription(profile)) {
    return NextResponse.json(
      { error: "You already have a subscription. Extra active listings update automatically." },
      { status: 400 },
    );
  }

  const activeCount = await countActivePropertiesForUser(supabase, user.id);
  const billable = billablePropertyCount(activeCount);

  let lineQuantity = billable;
  if (lineQuantity === 0) {
    if (activeCount >= 3) {
      lineQuantity = 1;
    } else {
      return NextResponse.json(
        { error: "You do not need a paid plan until you have more than three active listings." },
        { status: 400 },
      );
    }
  }

  try {
    const stripe = getStripe();
    const customerId = profile?.stripe_customer_id?.trim() || undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: lineQuantity }],
      success_url: `${siteUrl}/dashboard/billing?success=true`,
      cancel_url: `${siteUrl}/dashboard/billing?canceled=true`,
      client_reference_id: user.id,
      ...(customerId
        ? { customer: customerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    if (err instanceof Error && err.message.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json({ error: "Checkout is not configured." }, { status: 500 });
    }
    const message =
      err instanceof Error && err.message.trim().length > 0
        ? err.message
        : "Could not start checkout.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
