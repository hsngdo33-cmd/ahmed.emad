create table if not exists public.report_settings (
  id text primary key,
  telegram_chat_id text,
  daily_enabled boolean not null default false,
  link_code text,
  updated_at timestamptz not null default now()
);

alter table public.report_settings
add column if not exists link_code text;

alter table public.report_settings enable row level security;

drop policy if exists "Allow report settings read" on public.report_settings;
create policy "Allow report settings read"
on public.report_settings
for select
using (true);

drop policy if exists "Allow report settings write" on public.report_settings;
create policy "Allow report settings write"
on public.report_settings
for all
using (true)
with check (true);
