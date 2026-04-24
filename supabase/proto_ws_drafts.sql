-- Prototype · WestSide Content Studio
-- Run this once in Supabase SQL Editor.

create table if not exists public.proto_ws_drafts (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- input
    location text not null,
    post_type text not null,
    format text not null,
    topic text not null,

    -- orchestrator state
    status text not null default 'draft',      -- draft | review | approved | ready | published
    run_ms integer,                             -- total orchestration time
    agent_trace jsonb,                          -- { context: {...}, strategist: {...}, ... }

    -- output
    output jsonb,                               -- { hooks, caption_short, caption_medium, reel_script, manychat, hashtags, best_time, image_prompt }

    -- demo metadata
    client_ip text,
    user_agent text
);

create index if not exists proto_ws_drafts_created_at_idx on public.proto_ws_drafts (created_at desc);
create index if not exists proto_ws_drafts_location_idx on public.proto_ws_drafts (location);
create index if not exists proto_ws_drafts_status_idx on public.proto_ws_drafts (status);

-- RLS: allow anon-key inserts + reads for the demo.
-- (Demo-only table; no PII stored. Tighten when productionizing.)
alter table public.proto_ws_drafts enable row level security;

drop policy if exists "proto_ws_drafts anon read" on public.proto_ws_drafts;
create policy "proto_ws_drafts anon read"
  on public.proto_ws_drafts for select
  to anon
  using (true);

drop policy if exists "proto_ws_drafts anon insert" on public.proto_ws_drafts;
create policy "proto_ws_drafts anon insert"
  on public.proto_ws_drafts for insert
  to anon
  with check (true);

drop policy if exists "proto_ws_drafts anon update" on public.proto_ws_drafts;
create policy "proto_ws_drafts anon update"
  on public.proto_ws_drafts for update
  to anon
  using (true)
  with check (true);
