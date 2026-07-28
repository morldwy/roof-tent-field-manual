create table if not exists public.guide_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('setup', 'weather', 'gear', 'location', 'vehicle')),
  body text not null check (char_length(body) between 15 and 800),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists guide_tips_status_created_idx
  on public.guide_tips (status, created_at desc);

alter table public.guide_tips enable row level security;

drop policy if exists "Approved guide tips are public" on public.guide_tips;
create policy "Approved guide tips are public" on public.guide_tips
  for select to anon, authenticated
  using (status = 'approved');

drop policy if exists "Users submit own pending guide tips" on public.guide_tips;
create policy "Users submit own pending guide tips" on public.guide_tips
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and reviewed_at is null
  );

revoke update, delete on public.guide_tips from anon, authenticated;
grant select, insert on public.guide_tips to anon, authenticated;
