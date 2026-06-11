-- Grok / xAI data-processing consent (server-side, GDPR)

alter table public.profiles
  add column if not exists grok_consent_at timestamptz;

comment on column public.profiles.grok_consent_at is
  'Timestamp when the user accepted xAI Grok data processing for chat.';
