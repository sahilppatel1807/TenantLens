-- Server-side backup: block >3 active properties without a paid Stripe subscription (API is primary).

create or replace function public.enforce_active_property_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_active int;
  active_after int;
  billable int;
  sub_status text;
  sub_id text;
begin
  if tg_op = 'INSERT' then
    select count(*)::int into other_active
    from public.properties
    where user_id = new.user_id and status = 'active';
    active_after := other_active + case when new.status = 'active' then 1 else 0 end;
  elsif tg_op = 'UPDATE' then
    select count(*)::int into other_active
    from public.properties
    where user_id = new.user_id and status = 'active' and id <> new.id;
    active_after := other_active + case when new.status = 'active' then 1 else 0 end;
  else
    return new;
  end if;

  billable := greatest(active_after - 3, 0);

  if billable > 0 then
    select p.subscription_status, p.stripe_subscription_id
    into sub_status, sub_id
    from public.profiles p
    where p.id = new.user_id;

    if sub_id is null or sub_status is null or sub_status not in ('active', 'trialing') then
      raise exception 'More than three active listings require an active subscription.'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_active_property_billing_trigger on public.properties;

create trigger enforce_active_property_billing_trigger
  before insert or update on public.properties
  for each row
  execute function public.enforce_active_property_billing();
