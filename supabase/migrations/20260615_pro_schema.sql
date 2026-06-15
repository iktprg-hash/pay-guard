-- =============================================================================
-- Pay Guard — Pro schema (2026-06-15)
-- Чистая масштабируемая схема / Clean scalable schema for Pro
--
-- Принципы / Principles:
--   • profiles     — identity, subscription, default currency, sync timestamp
--   • financial_sessions — JSON snapshot (profile_data) + engine result (recommendation)
--   • debts        — session rows OR user catalog (session_id IS NULL); amounts in profiles.currency
--   • recurring_*  — Pro cashflow catalog (no per-row currency)
--   • daily_expenses — Pro Max stub
--
-- Idempotent: IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, safe DROP IF EXISTS for v1 cleanup.
-- Requires migrations 001–008 applied first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Shared helpers
-- -----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'RU: Обновляет updated_at при UPDATE. EN: Sets updated_at on row update.';

create or replace function public.touch_profile_financial_last_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id := coalesce(new.user_id, old.user_id);
  if target_user_id is not null then
    update public.profiles
    set financial_last_updated = now()
    where id = target_user_id;
  end if;
  return coalesce(new, old);
end;
$$;

comment on function public.touch_profile_financial_last_updated() is
  'RU: Помечает profiles.financial_last_updated при изменении финансовых данных. EN: Bumps financial_last_updated on catalog changes.';

-- -----------------------------------------------------------------------------
-- 1. profiles — user identity + subscription + default currency
-- -----------------------------------------------------------------------------

comment on table public.profiles is
  'RU: Профиль пользователя — locale, подписка, валюта по умолчанию. EN: User profile — locale, subscription, default currency.';

-- Cleanup v1 Pro columns (snapshot data lives in financial_sessions.profile_data)
alter table public.profiles drop column if exists available_funds;
alter table public.profiles drop column if exists monthly_income;
alter table public.profiles drop column if exists monthly_expenses;
alter table public.profiles drop column if exists income_stability;

alter table public.profiles drop constraint if exists profiles_available_funds_nonneg;
alter table public.profiles drop constraint if exists profiles_income_stability_check;

alter table public.profiles
  drop constraint if exists profiles_subscription_tier_check;

alter table public.profiles
  add constraint profiles_subscription_tier_check
  check (subscription_tier in ('free', 'pro', 'pro_max'));

alter table public.profiles
  add column if not exists currency text not null default 'CZK',
  add column if not exists financial_last_updated timestamptz;

alter table public.profiles
  drop constraint if exists profiles_currency_check;

alter table public.profiles
  add constraint profiles_currency_check
  check (currency in ('CZK', 'RUB'));

comment on column public.profiles.subscription_tier is
  'RU: Тариф free | pro | pro_max (меняет только service_role). EN: Tier — service_role only.';
comment on column public.profiles.currency is
  'RU: Валюта по умолчанию для сумм пользователя (CZK/RUB). EN: Default currency for user amounts.';
comment on column public.profiles.financial_last_updated is
  'RU: Последняя синхронизация каталога долгов/доходов/расходов. EN: Last catalog sync timestamp.';

create index if not exists idx_profiles_subscription_tier
  on public.profiles (subscription_tier);

create index if not exists idx_profiles_financial_last_updated
  on public.profiles (financial_last_updated desc nulls last)
  where financial_last_updated is not null;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. financial_sessions — calculation history + JSON snapshots
-- -----------------------------------------------------------------------------

comment on table public.financial_sessions is
  'RU: История расчётов: snapshot профиля (profile_data) + результат (recommendation). EN: Run history with profile snapshot + engine result.';

alter table public.financial_sessions
  add column if not exists currency text not null default 'CZK',
  add column if not exists title text,
  add column if not exists source text not null default 'chat';

alter table public.financial_sessions
  drop constraint if exists financial_sessions_currency_check;

alter table public.financial_sessions
  add constraint financial_sessions_currency_check
  check (currency in ('CZK', 'RUB'));

alter table public.financial_sessions
  drop constraint if exists financial_sessions_source_check;

alter table public.financial_sessions
  add constraint financial_sessions_source_check
  check (source in ('chat', 'manual', 'api', 'import'));

comment on column public.financial_sessions.currency is
  'RU: Валюта сумм в этой сессии. EN: Currency for amounts in this session.';
comment on column public.financial_sessions.profile_data is
  'RU: JSON snapshot FinancialProfile (availableFunds, debts ref, income…). EN: FinancialProfile JSON snapshot.';
comment on column public.financial_sessions.recommendation is
  'RU: JSON результат Priority Engine. EN: PrioritizationResult JSON.';
comment on column public.financial_sessions.title is
  'RU: Человекочитаемое название сессии. EN: Optional session label.';
comment on column public.financial_sessions.source is
  'RU: Источник: chat | manual | api | import. EN: Origin channel.';

-- Legacy scalar columns (001) kept for app backward compatibility — prefer profile_data
comment on column public.financial_sessions.available_funds is
  'DEPRECATED — use profile_data.availableFunds. RU: Устарело, см. profile_data.';
comment on column public.financial_sessions.monthly_income is
  'DEPRECATED — use profile_data.monthlyIncome.';
comment on column public.financial_sessions.monthly_expenses is
  'DEPRECATED — use profile_data.monthlyExpenses.';
comment on column public.financial_sessions.income_stability is
  'DEPRECATED — use profile_data.incomeStability.';

create index if not exists idx_financial_sessions_user_created
  on public.financial_sessions (user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_financial_sessions_user_source_created
  on public.financial_sessions (user_id, source, created_at desc)
  where user_id is not null;

drop trigger if exists trg_financial_sessions_set_updated_at on public.financial_sessions;
create trigger trg_financial_sessions_set_updated_at
  before update on public.financial_sessions
  for each row execute function public.set_updated_at();

alter table public.financial_sessions enable row level security;

drop policy if exists "Authenticated users view own sessions" on public.financial_sessions;
drop policy if exists "Authenticated users insert own sessions" on public.financial_sessions;
drop policy if exists "Authenticated users update own sessions" on public.financial_sessions;
drop policy if exists "Authenticated users delete own sessions" on public.financial_sessions;
drop policy if exists "Users select own financial_sessions" on public.financial_sessions;
drop policy if exists "Users insert own financial_sessions" on public.financial_sessions;
drop policy if exists "Users update own financial_sessions" on public.financial_sessions;
drop policy if exists "Users delete own financial_sessions" on public.financial_sessions;

create policy "financial_sessions_select_own"
  on public.financial_sessions for select
  using (auth.uid() = user_id);

create policy "financial_sessions_insert_own"
  on public.financial_sessions for insert
  with check (auth.uid() = user_id);

create policy "financial_sessions_update_own"
  on public.financial_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "financial_sessions_delete_own"
  on public.financial_sessions for delete
  using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. debts — session-linked OR user catalog (Pro library)
-- -----------------------------------------------------------------------------

comment on table public.debts is
  'RU: Долги — привязка к сессии или каталог пользователя (session_id NULL). EN: Debts — per session or user catalog.';

alter table public.debts
  alter column session_id drop not null;

alter table public.debts
  add column if not exists is_recurring boolean not null default false,
  add column if not exists frequency text;

-- Amounts use profiles.currency / financial_sessions.currency — no per-row currency
alter table public.debts drop column if exists currency;

alter table public.debts drop constraint if exists debts_currency_check;

alter table public.debts
  drop constraint if exists debts_category_check;

alter table public.debts
  add constraint debts_category_check
  check (category in (
    'housing', 'utilities', 'taxes', 'fines', 'loans', 'credit_card',
    'medical', 'transport', 'food', 'subscriptions', 'other'
  ));

alter table public.debts
  drop constraint if exists debts_frequency_check;

alter table public.debts
  add constraint debts_frequency_check
  check (frequency is null or frequency in ('monthly', 'weekly', 'biweekly', 'one_time'));

alter table public.debts
  drop constraint if exists debts_scope_check;

alter table public.debts
  add constraint debts_scope_check
  check (session_id is not null or user_id is not null);

comment on column public.debts.session_id is
  'RU: NULL = постоянный каталог Pro. EN: NULL = persistent Pro catalog entry.';
comment on column public.debts.user_id is
  'RU: Владелец (RLS). EN: Owner for RLS.';
comment on column public.debts.is_recurring is
  'RU: Повторяющийся платёж. EN: Recurring obligation flag.';
comment on column public.debts.frequency is
  'RU: monthly | weekly | biweekly | one_time. EN: Recurrence interval.';

create index if not exists idx_debts_session_id
  on public.debts (session_id)
  where session_id is not null;

create index if not exists idx_debts_user_library
  on public.debts (user_id, updated_at desc)
  where session_id is null and user_id is not null;

create index if not exists idx_debts_user_category
  on public.debts (user_id, category)
  where user_id is not null;

create index if not exists idx_debts_user_critical_date
  on public.debts (user_id, critical_date)
  where critical_date is not null and user_id is not null;

drop trigger if exists trg_debts_set_updated_at on public.debts;
create trigger trg_debts_set_updated_at
  before update on public.debts
  for each row execute function public.set_updated_at();

alter table public.debts enable row level security;

drop policy if exists "Users select own debts" on public.debts;
drop policy if exists "Users insert own debts" on public.debts;
drop policy if exists "Users update own debts" on public.debts;
drop policy if exists "Users delete own debts" on public.debts;
drop policy if exists "Authenticated users manage debts in own sessions" on public.debts;
drop policy if exists "debts_select_own" on public.debts;
drop policy if exists "debts_insert_own" on public.debts;
drop policy if exists "debts_update_own" on public.debts;
drop policy if exists "debts_delete_own" on public.debts;

create policy "debts_select_own"
  on public.debts for select
  using (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.financial_sessions s
        where s.id = debts.session_id and s.user_id = auth.uid()
      )
    )
  );

create policy "debts_insert_own"
  on public.debts for insert
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.financial_sessions s
        where s.id = debts.session_id and s.user_id = auth.uid()
      )
    )
  );

create policy "debts_update_own"
  on public.debts for update
  using (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.financial_sessions s
        where s.id = debts.session_id and s.user_id = auth.uid()
      )
    )
  )
  with check (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.financial_sessions s
        where s.id = debts.session_id and s.user_id = auth.uid()
      )
    )
  );

create policy "debts_delete_own"
  on public.debts for delete
  using (
    auth.uid() = user_id
    and (
      session_id is null
      or exists (
        select 1 from public.financial_sessions s
        where s.id = debts.session_id and s.user_id = auth.uid()
      )
    )
  );

drop trigger if exists trg_debts_touch_profile_financial on public.debts;
create trigger trg_debts_touch_profile_financial
  after insert or update or delete on public.debts
  for each row execute function public.touch_profile_financial_last_updated();

-- -----------------------------------------------------------------------------
-- 4. recurring_incomes — Pro income catalog
-- -----------------------------------------------------------------------------

create table if not exists public.recurring_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  amount numeric(14, 2) not null,
  frequency text not null,
  next_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_incomes_amount_positive check (amount >= 0),
  constraint recurring_incomes_frequency_check check (
    frequency in ('monthly', 'weekly', 'biweekly', 'one_time')
  ),
  constraint recurring_incomes_source_len check (char_length(source) between 1 and 200)
);

alter table public.recurring_incomes drop column if exists currency;
alter table public.recurring_incomes drop constraint if exists recurring_incomes_currency_check;

comment on table public.recurring_incomes is
  'RU: Pro — регулярные доходы (суммы в profiles.currency). EN: Pro recurring income streams.';
comment on column public.recurring_incomes.source is
  'RU: Источник дохода. EN: Income source label.';
comment on column public.recurring_incomes.next_date is
  'RU: Дата следующего поступления. EN: Next expected payment date.';

create index if not exists idx_recurring_incomes_user_next
  on public.recurring_incomes (user_id, next_date);

alter table public.recurring_incomes enable row level security;

drop policy if exists "Users select own recurring_incomes" on public.recurring_incomes;
drop policy if exists "Users insert own recurring_incomes" on public.recurring_incomes;
drop policy if exists "Users update own recurring_incomes" on public.recurring_incomes;
drop policy if exists "Users delete own recurring_incomes" on public.recurring_incomes;
drop policy if exists "recurring_incomes_select_own" on public.recurring_incomes;
drop policy if exists "recurring_incomes_insert_own" on public.recurring_incomes;
drop policy if exists "recurring_incomes_update_own" on public.recurring_incomes;
drop policy if exists "recurring_incomes_delete_own" on public.recurring_incomes;

create policy "recurring_incomes_select_own"
  on public.recurring_incomes for select using (auth.uid() = user_id);
create policy "recurring_incomes_insert_own"
  on public.recurring_incomes for insert with check (auth.uid() = user_id);
create policy "recurring_incomes_update_own"
  on public.recurring_incomes for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_incomes_delete_own"
  on public.recurring_incomes for delete using (auth.uid() = user_id);

drop trigger if exists trg_recurring_incomes_set_updated_at on public.recurring_incomes;
create trigger trg_recurring_incomes_set_updated_at
  before update on public.recurring_incomes
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recurring_incomes_touch_profile on public.recurring_incomes;
create trigger trg_recurring_incomes_touch_profile
  after insert or update or delete on public.recurring_incomes
  for each row execute function public.touch_profile_financial_last_updated();

-- -----------------------------------------------------------------------------
-- 5. recurring_expenses — Pro expense catalog
-- -----------------------------------------------------------------------------

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null,
  frequency text not null,
  category text not null default 'other',
  next_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_expenses_amount_positive check (amount >= 0),
  constraint recurring_expenses_frequency_check check (
    frequency in ('monthly', 'weekly', 'biweekly', 'one_time')
  ),
  constraint recurring_expenses_category_check check (category in (
    'housing', 'utilities', 'transport', 'food', 'health',
    'entertainment', 'subscriptions', 'shopping', 'other'
  )),
  constraint recurring_expenses_name_len check (char_length(name) between 1 and 200)
);

alter table public.recurring_expenses drop column if exists currency;
alter table public.recurring_expenses drop constraint if exists recurring_expenses_currency_check;

comment on table public.recurring_expenses is
  'RU: Pro — регулярные расходы. EN: Pro recurring expense streams.';
comment on column public.recurring_expenses.category is
  'RU: ExpenseCategory (financial.ts). EN: Expense category enum.';

create index if not exists idx_recurring_expenses_user_next
  on public.recurring_expenses (user_id, next_date);

create index if not exists idx_recurring_expenses_user_category
  on public.recurring_expenses (user_id, category);

alter table public.recurring_expenses enable row level security;

drop policy if exists "Users select own recurring_expenses" on public.recurring_expenses;
drop policy if exists "Users insert own recurring_expenses" on public.recurring_expenses;
drop policy if exists "Users update own recurring_expenses" on public.recurring_expenses;
drop policy if exists "Users delete own recurring_expenses" on public.recurring_expenses;
drop policy if exists "recurring_expenses_select_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_insert_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_update_own" on public.recurring_expenses;
drop policy if exists "recurring_expenses_delete_own" on public.recurring_expenses;

create policy "recurring_expenses_select_own"
  on public.recurring_expenses for select using (auth.uid() = user_id);
create policy "recurring_expenses_insert_own"
  on public.recurring_expenses for insert with check (auth.uid() = user_id);
create policy "recurring_expenses_update_own"
  on public.recurring_expenses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "recurring_expenses_delete_own"
  on public.recurring_expenses for delete using (auth.uid() = user_id);

drop trigger if exists trg_recurring_expenses_set_updated_at on public.recurring_expenses;
create trigger trg_recurring_expenses_set_updated_at
  before update on public.recurring_expenses
  for each row execute function public.set_updated_at();

drop trigger if exists trg_recurring_expenses_touch_profile on public.recurring_expenses;
create trigger trg_recurring_expenses_touch_profile
  after insert or update or delete on public.recurring_expenses
  for each row execute function public.touch_profile_financial_last_updated();

-- -----------------------------------------------------------------------------
-- 6. daily_expenses — Pro Max (minimal stub)
-- -----------------------------------------------------------------------------

create table if not exists public.daily_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expense_date date not null default (timezone('utc', now()))::date,
  amount numeric(14, 2) not null,
  category text not null default 'other',
  description text,
  merchant text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_expenses_amount_positive check (amount >= 0),
  constraint daily_expenses_category_check check (category in (
    'housing', 'utilities', 'transport', 'food', 'health',
    'entertainment', 'subscriptions', 'shopping', 'other'
  ))
);

alter table public.daily_expenses drop column if exists currency;
alter table public.daily_expenses drop constraint if exists daily_expenses_currency_check;

comment on table public.daily_expenses is
  'RU: Pro Max — дневные траты (заготовка). EN: Pro Max daily spending log (stub).';
comment on column public.daily_expenses.expense_date is
  'RU: Дата траты. EN: Expense date.';

create index if not exists idx_daily_expenses_user_date
  on public.daily_expenses (user_id, expense_date desc);

alter table public.daily_expenses enable row level security;

drop policy if exists "Users select own daily_expenses" on public.daily_expenses;
drop policy if exists "Users insert own daily_expenses" on public.daily_expenses;
drop policy if exists "Users update own daily_expenses" on public.daily_expenses;
drop policy if exists "Users delete own daily_expenses" on public.daily_expenses;
drop policy if exists "daily_expenses_select_own" on public.daily_expenses;
drop policy if exists "daily_expenses_insert_own" on public.daily_expenses;
drop policy if exists "daily_expenses_update_own" on public.daily_expenses;
drop policy if exists "daily_expenses_delete_own" on public.daily_expenses;

create policy "daily_expenses_select_own"
  on public.daily_expenses for select using (auth.uid() = user_id);
create policy "daily_expenses_insert_own"
  on public.daily_expenses for insert with check (auth.uid() = user_id);
create policy "daily_expenses_update_own"
  on public.daily_expenses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_expenses_delete_own"
  on public.daily_expenses for delete using (auth.uid() = user_id);

drop trigger if exists trg_daily_expenses_set_updated_at on public.daily_expenses;
create trigger trg_daily_expenses_set_updated_at
  before update on public.daily_expenses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. Grants
-- -----------------------------------------------------------------------------

grant select, insert, update, delete on public.recurring_incomes to authenticated;
grant select, insert, update, delete on public.recurring_expenses to authenticated;
grant select, insert, update, delete on public.daily_expenses to authenticated;

grant all on public.recurring_incomes to service_role;
grant all on public.recurring_expenses to service_role;
grant all on public.daily_expenses to service_role;
