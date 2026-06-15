-- Pay Guard — počáteční schéma Supabase
-- Spusťte v Supabase SQL Editor nebo přes supabase db push

-- Profily uživatelů
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  locale text not null default 'cs' check (locale in ('cs', 'ru', 'en')),
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'pro')),
  subscription_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Finanční relace (jedna konzultace)
create table if not exists public.financial_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  available_funds numeric(12, 2),
  monthly_income numeric(12, 2),
  monthly_expenses numeric(12, 2),
  income_stability text check (income_stability in ('stable', 'variable', 'uncertain')),
  profile_data jsonb not null default '{}',
  recommendation jsonb,
  created_at timestamptz not null default now()
);

-- Závazky / dluhy
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.financial_sessions(id) on delete cascade,
  creditor text not null,
  amount numeric(12, 2) not null,
  minimum_payment numeric(12, 2),
  due_date date,
  critical_date date,
  critical_note text,
  category text not null default 'other',
  interest_rate numeric(5, 2),
  notes text,
  created_at timestamptz not null default now()
);

-- Historie chatu (Pro)
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.financial_sessions(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.financial_sessions enable row level security;
alter table public.debts enable row level security;
alter table public.chat_messages enable row level security;

-- Profily: uživatel vidí jen svůj
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Relace: vlastník nebo anonymní (user_id null)
drop policy if exists "Users can view own sessions" on public.financial_sessions;
create policy "Users can view own sessions"
  on public.financial_sessions for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can insert sessions" on public.financial_sessions;
create policy "Users can insert sessions"
  on public.financial_sessions for insert
  with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can update own sessions" on public.financial_sessions;
create policy "Users can update own sessions"
  on public.financial_sessions for update
  using (user_id is null or auth.uid() = user_id);

-- Dluhy: přes relaci
drop policy if exists "Users can manage debts in own sessions" on public.debts;
create policy "Users can manage debts in own sessions"
  on public.debts for all
  using (
    exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id
        and (s.user_id is null or s.user_id = auth.uid())
    )
  );

-- Chat: Pro uživatelé
drop policy if exists "Users can view own chat messages" on public.chat_messages;
create policy "Users can view own chat messages"
  on public.chat_messages for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Users can insert chat messages" on public.chat_messages;
create policy "Users can insert chat messages"
  on public.chat_messages for insert
  with check (user_id is null or auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, 'cs');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Indexy
create index if not exists idx_financial_sessions_user_id on public.financial_sessions(user_id);
create index if not exists idx_debts_session_id on public.debts(session_id);
create index if not exists idx_chat_messages_session_id on public.chat_messages(session_id);
