import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/server";
import { billablePropertyCount } from "./constants";
import { countActivePropertiesForUser } from "./count-active-properties";
import { fetchProfileBilling, hasPaidSubscription } from "./profile-billing";

/**
 * After property changes: align Stripe subscription with billable active properties.
 * - billable > 0: set subscription item quantity to billable
 * - billable === 0: cancel subscription (webhook clears profile rows)
 */
export async function syncStripeSubscriptionQuantityForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const activeCount = await countActivePropertiesForUser(supabase, userId);
  const billable = billablePropertyCount(activeCount);
  const profile = await fetchProfileBilling(supabase, userId);

  if (!hasPaidSubscription(profile) || !profile?.stripe_subscription_id) {
    return { ok: true };
  }

  const stripe = getStripe();
  const subId = profile.stripe_subscription_id;

  if (billable === 0) {
    try {
      await stripe.subscriptions.cancel(subId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not cancel subscription.";
      return { ok: false, message: msg };
    }
    return { ok: true };
  }

  const itemId = profile.stripe_subscription_item_id;
  if (!itemId) {
    return { ok: false, message: "Missing subscription line item; complete checkout or contact support." };
  }

  try {
    await stripe.subscriptionItems.update(itemId, {
      quantity: billable,
      proration_behavior: "create_prorations",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not update subscription quantity.";
    return { ok: false, message: msg };
  }

  return { ok: true };
}
