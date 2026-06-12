-- Stripe billing identifiers on profiles (updated via service-role webhook only)

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create unique index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists idx_profiles_stripe_subscription_id
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on column public.profiles.stripe_customer_id is
  'Stripe Customer id — set by billing webhook (service role)';
comment on column public.profiles.stripe_subscription_id is
  'Active Stripe Subscription id — cleared on cancel';

-- Extend subscription guard: only service role may change Stripe + tier fields
create or replace function public.guard_profile_subscription_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.subscription_tier := 'free';
    new.subscription_expires_at := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
  else
    new.subscription_tier := old.subscription_tier;
    new.subscription_expires_at := old.subscription_expires_at;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;

  return new;
end;
$$;
