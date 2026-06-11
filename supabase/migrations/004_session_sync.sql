-- Session sync: updated_at + message metadata for recommendations

alter table public.financial_sessions
  add column if not exists updated_at timestamptz not null default now();

alter table public.chat_messages
  add column if not exists metadata jsonb not null default '{}';

create index if not exists idx_financial_sessions_user_updated
  on public.financial_sessions (user_id, updated_at desc);

-- Allow authenticated users to update own chat messages (upsert sync)
drop policy if exists "Authenticated users update own chat messages" on public.chat_messages;

create policy "Authenticated users update own chat messages"
  on public.chat_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
