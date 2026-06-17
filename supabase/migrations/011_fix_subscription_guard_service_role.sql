-- Allow service_role / postgres to change subscription fields via PostgREST + direct SQL.
-- Previous guard only checked request.jwt.claim.role, which is unset for some service-role requests.

create or replace function public.guard_profile_subscription_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or coalesce(auth.role(), '') = 'service_role'
     or current_user in ('service_role', 'postgres', 'supabase_admin') then
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

comment on function public.guard_profile_subscription_fields() is
  'Blocks client JWT from changing subscription/Stripe fields; service_role and postgres may update.';
