import type Stripe from "stripe";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ProfileBillingUpdate = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_item_id?: string | null;
  subscription_status?: string | null;
};

function firstSubscriptionItemId(subscription: Stripe.Subscription): string | null {
  const item = subscription.items?.data?.[0];
  return item?.id ?? null;
}

export async function upsertProfileBillingFromSubscription(
  supabaseUserId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const admin = getSupabaseAdminClient();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

  const patch: ProfileBillingUpdate = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_subscription_item_id: firstSubscriptionItemId(subscription),
    subscription_status: subscription.status,
  };

  const { error } = await admin.from("profiles").update(patch).eq("id", supabaseUserId);
  if (error) {
    console.error("upsertProfileBillingFromSubscription:", error.message);
    throw new Error(error.message);
  }
}

export async function clearSubscriptionBillingForUser(supabaseUserId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      stripe_subscription_id: null,
      stripe_subscription_item_id: null,
      subscription_status: "canceled",
    })
    .eq("id", supabaseUserId);

  if (error) {
    console.error("clearSubscriptionBillingForUser:", error.message);
    throw new Error(error.message);
  }
}

export async function resolveSupabaseUserIdFromSubscription(
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const meta = subscription.metadata?.supabase_user_id?.trim();
  if (meta) return meta;

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return null;

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { id: string }).id;
}
