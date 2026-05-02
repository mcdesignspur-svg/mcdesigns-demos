-- Eco — Voice cloning demo schema
-- Tables:
--   eco_voice_profiles: persisted voice profiles (created on profile generation; email attached on opt-in)
--   eco_events: anonymous validation signals (humanize calls, ratings, saves)
--
-- Run once in Supabase SQL editor for the demos project.

create extension if not exists "pgcrypto";

create table if not exists eco_voice_profiles (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz default now(),
    last_active_at timestamptz default now(),
    email text,
    willingness text, -- "no" | "maybe" | "9" | "19"
    answers jsonb not null,
    profile jsonb not null,
    summary text,
    samples_count int default 0
);

create index if not exists eco_voice_profiles_email_idx on eco_voice_profiles (email) where email is not null;
create index if not exists eco_voice_profiles_created_idx on eco_voice_profiles (created_at desc);

create table if not exists eco_events (
    id bigserial primary key,
    created_at timestamptz default now(),
    profile_id text, -- soft reference; supports both real uuids and "local-..." anon ids
    kind text not null, -- 'profile_created' | 'humanize' | 'rating' | 'save'
    rating int, -- 1..4 when kind='rating'
    directive text, -- 'regenerate' | 'more_casual' | 'more_formal' | 'shorter' | null
    input_chars int,
    output_chars int,
    metadata jsonb default '{}'::jsonb
);

create index if not exists eco_events_kind_idx on eco_events (kind, created_at desc);
create index if not exists eco_events_profile_idx on eco_events (profile_id) where profile_id is not null;

-- Allow anon-key inserts/updates from the demo. Reads stay restricted (only service-role / dashboard).
-- If RLS is enabled on the project, uncomment the policies below.

-- alter table eco_voice_profiles enable row level security;
-- create policy "eco_profiles_anon_insert" on eco_voice_profiles for insert with check (true);
-- create policy "eco_profiles_anon_update_email" on eco_voice_profiles for update using (true) with check (true);

-- alter table eco_events enable row level security;
-- create policy "eco_events_anon_insert" on eco_events for insert with check (true);
