-- Auth: umožnit upsert profilu při sync locale (idempotentní)

drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile on signup" on public.profiles;

create policy "Users can insert own profile on signup"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Index pro rychlé načtení poslední relace uživatele
create index if not exists idx_financial_sessions_user_created
  on public.financial_sessions (user_id, created_at desc);
