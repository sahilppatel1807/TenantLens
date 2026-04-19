-- Stripe billing fields on profiles (1:1 with auth.users)

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_item_id text,
  add column if not exists subscription_status text;

comment on column public.profiles.stripe_customer_id is 'Stripe Customer id (cus_...)';
comment on column public.profiles.stripe_subscription_id is 'Stripe Subscription id (sub_...)';
comment on column public.profiles.stripe_subscription_item_id is 'Subscription item id for the priced line (si_...) — used for quantity updates';
comment on column public.profiles.subscription_status is 'Mirrors Stripe subscription.status';
