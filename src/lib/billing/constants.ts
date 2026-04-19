/** Billable "active listing" = `properties.status === 'active'` (not draft or leased). */
export const FREE_ACTIVE_PROPERTY_LIMIT = 3;

/** Stripe subscription statuses that allow paid-tier property actions. */
export const PAID_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type PaidSubscriptionStatus = (typeof PAID_SUBSCRIPTION_STATUSES)[number];

export function billablePropertyCount(activePropertyCount: number): number {
  return Math.max(activePropertyCount - FREE_ACTIVE_PROPERTY_LIMIT, 0);
}
