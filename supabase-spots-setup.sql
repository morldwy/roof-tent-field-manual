-- Einmal vollständig im Supabase SQL Editor ausführen.

create table if not exists public.spots (
  id text primary key,
  name text not null,
  type text not null check (type in ('meer', 'see', 'wald')),
  icon text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  access text not null,
  status text not null check (status in ('green', 'amber', 'red')),
  label text not null,
  note text not null,
  source text not null default 'OpenStreetMap',
  source_url text,
  discovered boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists spots_lat_lng_idx on public.spots (lat, lng);
alter table public.spots enable row level security;

create policy "Spots are publicly readable" on public.spots
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.spots from anon, authenticated;
grant select on public.spots to anon, authenticated;
