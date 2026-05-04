-- Run in Supabase SQL Editor (or supabase db push). Service role bypasses RLS for server webhooks.

create table if not exists fax_tracks (
  stripe_session_id text primary key,
  fax_id text unique,
  contact_email text not null default '',
  delivery_status text not null default 'processing',
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  fax_to text,
  page_count int,
  amount_cents int,
  contact_name text,
  ref_code text,
  error_message text,
  phaxio_last_status text,
  progress_percent int,
  payment_verified boolean default true
);

create index if not exists fax_tracks_fax_id_idx on fax_tracks (fax_id) where fax_id is not null;

create table if not exists stripe_webhook_events (
  stripe_event_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists fax_notify_dedup (
  stripe_session_id text not null,
  notify_kind text not null,
  created_at timestamptz not null default now(),
  primary key (stripe_session_id, notify_kind)
);

create table if not exists fax_status_manual_refresh (
  stripe_session_id text primary key,
  last_refresh_at timestamptz not null default now()
);

create table if not exists checkout_session_meta (
  session_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists reply_ref_mappings (
  ref_code text primary key,
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists reply_downloads (
  download_token text primary key,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists reply_inbound_dedupe (
  phaxio_fax_id text primary key,
  created_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text,
  source text,
  created_at timestamptz not null default now()
);
