-- Normalize debts: dedicated rows (not profile_data jsonb)
-- Scale: user_id + session_id FK, priority_level, currency

-- ── Schema upgrades ──
-- Safe rename (idempotent re-run)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'debts' and column_name = 'creditor'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'debts' and column_name = 'creditor_name'
  ) then
    alter table public.debts rename column creditor to creditor_name;
  end if;
end $$;

alter table public.debts
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists currency text not null default 'CZK',
  add column if not exists priority_level smallint check (priority_level between 0 and 3),
  add column if not exists updated_at timestamptz not null default now();

-- Keep engine fields from 001 (nullable)
alter table public.debts
  add column if not exists minimum_payment numeric(12, 2),
  add column if not exists critical_note text,
  add column if not exists interest_rate numeric(5, 2);

comment on column public.debts.creditor_name is 'Věřitel / popis závazku';
comment on column public.debts.priority_level is '0=kritický … 3=nízký (Priority Engine)';
comment on column public.debts.currency is 'ISO 4217, default CZK';

-- Backfill user_id from owning session
update public.debts d
set user_id = s.user_id
from public.financial_sessions s
where d.session_id = s.id
  and d.user_id is null
  and s.user_id is not null;

-- Migrate debts embedded in profile_data jsonb (one row per debt item)
insert into public.debts (
  id,
  user_id,
  session_id,
  creditor_name,
  amount,
  currency,
  due_date,
  critical_date,
  category,
  notes,
  minimum_payment,
  critical_note,
  interest_rate,
  created_at,
  updated_at
)
select
  case
    when elem->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (elem->>'id')::uuid
    else gen_random_uuid()
  end,
  s.user_id,
  s.id,
  coalesce(nullif(elem->>'creditor', ''), 'Unknown'),
  coalesce((elem->>'amount')::numeric, 0),
  coalesce(nullif(elem->>'currency', ''), 'CZK'),
  nullif(elem->>'dueDate', '')::date,
  nullif(elem->>'criticalDate', '')::date,
  coalesce(nullif(elem->>'category', ''), 'other'),
  nullif(elem->>'notes', ''),
  nullif(elem->>'minimumPayment', '')::numeric,
  nullif(elem->>'criticalNote', ''),
  nullif(elem->>'interestRate', '')::numeric,
  s.created_at,
  now()
from public.financial_sessions s
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(s.profile_data->'debts') = 'array' then s.profile_data->'debts'
    else '[]'::jsonb
  end
) as elem
where s.user_id is not null
  and jsonb_array_length(
    case
      when jsonb_typeof(s.profile_data->'debts') = 'array' then s.profile_data->'debts'
      else '[]'::jsonb
    end
  ) > 0
  and not exists (
    select 1 from public.debts d
    where d.session_id = s.id
      and d.creditor_name = coalesce(nullif(elem->>'creditor', ''), 'Unknown')
      and d.amount = coalesce((elem->>'amount')::numeric, 0)
  )
on conflict (id) do nothing;

-- Strip debts array from profile_data (keep locale + session metadata)
update public.financial_sessions
set profile_data = profile_data - 'debts'
where profile_data ? 'debts';

-- ── Indexes ──
create index if not exists idx_debts_user_id on public.debts(user_id);
create index if not exists idx_debts_session_user on public.debts(session_id, user_id);
create index if not exists idx_debts_priority on public.debts(session_id, priority_level);

-- ── RLS: direct user_id + session ownership ──
drop policy if exists "Authenticated users manage debts in own sessions" on public.debts;

create policy "Users select own debts"
  on public.debts for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id and s.user_id = auth.uid()
    )
  );

create policy "Users insert own debts"
  on public.debts for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id and s.user_id = auth.uid()
    )
  );

create policy "Users update own debts"
  on public.debts for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id and s.user_id = auth.uid()
    )
  );

create policy "Users delete own debts"
  on public.debts for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id and s.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (anon session token path on server)

-- Keep debts in sync when session is claimed
create or replace function public.sync_debt_user_on_session_claim()
returns trigger as $$
begin
  if new.user_id is not null and (old.user_id is distinct from new.user_id) then
    update public.debts
    set user_id = new.user_id, updated_at = now()
    where session_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_sync_debt_user_on_session on public.financial_sessions;
create trigger trg_sync_debt_user_on_session
  after update of user_id on public.financial_sessions
  for each row
  execute function public.sync_debt_user_on_session_claim();
