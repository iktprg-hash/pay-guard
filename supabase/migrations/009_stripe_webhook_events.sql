-- Idempotent Stripe webhook processing (service role only)

create table if not exists public.stripe_webhook_events (
  id text primary key,
  event_type text not null,
  processed_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_processed_at
  on public.stripe_webhook_events (processed_at desc);

alter table public.stripe_webhook_events enable row level security;

comment on table public.stripe_webhook_events is
  'Processed Stripe event ids — prevents duplicate webhook handling';
