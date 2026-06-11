-- Session token pro ochranu anonymních relací před IDOR

alter table public.financial_sessions
  add column if not exists session_token text;

-- Index pro rychlou validaci tokenu
create index if not exists idx_financial_sessions_token
  on public.financial_sessions (id, session_token);

-- Zrušení příliš otevřených RLS politik (user_id is null = čitelné všem)
drop policy if exists "Users can view own sessions" on public.financial_sessions;
drop policy if exists "Users can insert sessions" on public.financial_sessions;
drop policy if exists "Users can update own sessions" on public.financial_sessions;
drop policy if exists "Users can view own chat messages" on public.chat_messages;
drop policy if exists "Users can insert chat messages" on public.chat_messages;

-- Autentizovaní uživatelé: přístup jen ke svým relacím
create policy "Authenticated users view own sessions"
  on public.financial_sessions for select
  using (auth.uid() = user_id);

create policy "Authenticated users insert own sessions"
  on public.financial_sessions for insert
  with check (auth.uid() = user_id);

create policy "Authenticated users update own sessions"
  on public.financial_sessions for update
  using (auth.uid() = user_id);

create policy "Authenticated users view own chat messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

create policy "Authenticated users insert own chat messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Dluhy: jen pro autentizované relace (anonymní přes service role)
drop policy if exists "Users can manage debts in own sessions" on public.debts;

create policy "Authenticated users manage debts in own sessions"
  on public.debts for all
  using (
    exists (
      select 1 from public.financial_sessions s
      where s.id = debts.session_id
        and s.user_id = auth.uid()
    )
  );

-- Anonymní relace: přístup pouze přes service role na serveru (app-layer token check)
