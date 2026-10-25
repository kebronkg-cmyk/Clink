-- CLINK · Datenbankschema für Supabase (Postgres)
-- Im Supabase-Dashboard unter "SQL Editor" einmal ausführen.
-- Serverstandort EU beim Anlegen des Projekts wählen (z. B. Frankfurt).

create extension if not exists "pgcrypto";

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  datum date not null,
  location text not null,
  is_active boolean not null default false,
  swipe_until timestamptz not null,
  created_at timestamptz not null default now()
);

-- Geräte-ID vom Aufkleber (z. B. 778775) ist der Schlüssel.
create table if not exists bands (
  id text primary key,
  mac text,
  akku smallint,
  last_seen timestamptz
);

create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  vorname text not null,
  foto text,
  "alter" smallint not null check ("alter" >= 18),
  instagram text,
  instagram_freigabe boolean not null default false,
  email text,
  einwilligung_at timestamptz not null,
  erstellt timestamptz not null default now()
);

-- Verbindet Band und Gast pro Abend (Bänder werden wiederverwendet).
create table if not exists checkins (
  event_id uuid not null references events(id) on delete cascade,
  band_id text not null references bands(id),
  guest_id uuid not null references guests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, band_id),
  unique (event_id, guest_id)
);

-- Pro Paar nur ein Eintrag: band_a ist immer die kleinere ID.
create table if not exists encounters (
  event_id uuid not null references events(id) on delete cascade,
  band_a text not null,
  band_b text not null,
  timestamp timestamptz not null,
  primary key (event_id, band_a, band_b)
);

create table if not exists swipes (
  event_id uuid not null references events(id) on delete cascade,
  from_guest uuid not null references guests(id) on delete cascade,
  to_guest uuid not null references guests(id) on delete cascade,
  richtung text not null check (richtung in ('rechts', 'links')),
  created_at timestamptz not null default now(),
  primary key (event_id, from_guest, to_guest)
);

create table if not exists matches (
  event_id uuid not null references events(id) on delete cascade,
  guest_a uuid not null references guests(id) on delete cascade,
  guest_b uuid not null references guests(id) on delete cascade,
  erstellt timestamptz not null default now(),
  primary key (event_id, guest_a, guest_b),
  check (guest_a < guest_b)
);

create table if not exists settings (
  id smallint primary key default 1 check (id = 1),
  schwelle_stoss real not null default 2.5,
  schwelle_rssi smallint not null default -45,
  zeitfenster_ms smallint not null default 100,
  updated_at timestamptz not null default now()
);
insert into settings (id) values (1) on conflict do nothing;

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  stadt text not null,
  email text not null,
  nachricht text not null default '',
  erstellt timestamptz not null default now()
);

-- Nur der Server (Service-Role-Key) greift zu. RLS an, keine öffentlichen Policies.
alter table events enable row level security;
alter table bands enable row level security;
alter table guests enable row level security;
alter table checkins enable row level security;
alter table encounters enable row level security;
alter table swipes enable row level security;
alter table matches enable row level security;
alter table settings enable row level security;
alter table leads enable row level security;

-- Profilfotos: öffentlicher Bucket, Dateinamen sind zufällige Gast-IDs.
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
on conflict (id) do nothing;
