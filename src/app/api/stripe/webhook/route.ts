import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/server";
import {
  clearSubscriptionBillingForUser,
  resolveSupabaseUserIdFromSubscription,
  upsertProfileBillingFromSubscription,
} from "@/lib/billing/stripe-profile-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("Stripe webhook: missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId =
          (session.client_reference_id?.trim() || session.metadata?.supabase_user_id?.trim()) ?? null;
        if (!userId) {
          console.error("checkout.session.completed: missing user reference on session", session.id);
          break;
        }

        const subRef = session.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;

        const subscription = await stripe.subscriptions.retrieve(subId);
        await upsertProfileBillingFromSubscription(userId, subscription);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveSupabaseUserIdFromSubscription(subscription);
        if (!userId) {
          console.warn(
            `${event.type}: could not resolve Supabase user for subscription`,
            subscription.id,
          );
          break;
        }
        await upsertProfileBillingFromSubscription(userId, subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveSupabaseUserIdFromSubscription(subscription);
        if (!userId) break;
        await clearSubscriptionBillingForUser(userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error (${event.type}):`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
