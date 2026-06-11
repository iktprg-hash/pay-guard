-- Prevent self-escalation to Pro via profiles UPDATE/INSERT (anon/authenticated client)
-- Service role (Stripe webhook, admin) may change subscription fields.

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
  else
    new.subscription_tier := old.subscription_tier;
    new.subscription_expires_at := old.subscription_expires_at;
  end if;

  return new;
end;
$$;

comment on function public.guard_profile_subscription_fields() is
  'Blocks client JWT from changing subscription_tier / subscription_expires_at';

drop trigger if exists trg_guard_profile_subscription on public.profiles;
create trigger trg_guard_profile_subscription
  before insert or update on public.profiles
  for each row
  execute function public.guard_profile_subscription_fields();
