-- Tables are only written from this app’s server (PostgREST + service_role JWT).
-- If a table was created earlier in the Dashboard with RLS on, inserts fail until RLS is off
-- or policies exist. Service_role normally bypasses RLS; this migration still normalizes state.

alter table if exists public.checkout_session_meta disable row level security;
alter table if exists public.fax_tracks disable row level security;
alter table if exists public.stripe_webhook_events disable row level security;
alter table if exists public.fax_notify_dedup disable row level security;
alter table if exists public.fax_status_manual_refresh disable row level security;
alter table if exists public.reply_ref_mappings disable row level security;
alter table if exists public.reply_downloads disable row level security;
alter table if exists public.reply_inbound_dedupe disable row level security;
alter table if exists public.leads disable row level security;
