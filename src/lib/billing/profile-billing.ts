import type { SupabaseClient } from "@supabase/supabase-js";
import { PAID_SUBSCRIPTION_STATUSES } from "./constants";

export type ProfileBillingRow = {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_subscription_item_id: string | null;
  subscription_status: string | null;
};

/** Any subset of billing columns (e.g. from `select` projections). */
export type ProfileBillingLike = {
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_item_id?: string | null;
  subscription_status?: string | null;
};

export function hasPaidSubscription(profile: ProfileBillingLike | null | undefined): boolean {
  if (!profile?.stripe_subscription_id) return false;
  const s = profile.subscription_status;
  return PAID_SUBSCRIPTION_STATUSES.some((p) => p === s);
}

export async function fetchProfileBilling(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileBillingLike | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as ProfileBillingLike;
}
