-- Prototype · WestSide Content Studio · Feedback Loop (Phase 2)
-- Run this once in Supabase SQL Editor.

create table if not exists public.proto_ws_feedback (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),

    -- link to the draft that triggered the feedback (optional — feedback can also be standalone)
    draft_id uuid references public.proto_ws_drafts(id) on delete set null,

    -- tone (persists, feeds into future Strategy/Copy prompts)
    -- regenerate (ephemeral, logged but NOT fed into future prompts)
    kind text not null check (kind in ('tone', 'regenerate')),

    -- the rule itself — short human-readable line ("más casual", "más WestSide")
    rule text not null,

    -- structured target for regenerate kind (e.g. "hooks" | "caption")
    target text,

    -- free-form notes / context for the rule
    notes text,

    ephemeral boolean not null default false,

    client_ip text,
    user_agent text
);

create index if not exists proto_ws_feedback_created_at_idx on public.proto_ws_feedback (created_at desc);
create index if not exists proto_ws_feedback_kind_idx on public.proto_ws_feedback (kind);
create index if not exists proto_ws_feedback_ephemeral_idx on public.proto_ws_feedback (ephemeral);

-- RLS: demo-only, anon-key read + insert.
alter table public.proto_ws_feedback enable row level security;

drop policy if exists "proto_ws_feedback anon read" on public.proto_ws_feedback;
create policy "proto_ws_feedback anon read"
  on public.proto_ws_feedback for select
  to anon
  using (true);

drop policy if exists "proto_ws_feedback anon insert" on public.proto_ws_feedback;
create policy "proto_ws_feedback anon insert"
  on public.proto_ws_feedback for insert
  to anon
  with check (true);
