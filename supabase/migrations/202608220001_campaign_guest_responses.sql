create table if not exists public.campaign_topic_guest_responses (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.campaign_topics(id) on delete cascade,
  visitor_hash text not null,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_post_id text references public.posts(id) on delete set null,
  claimed_at timestamptz,
  unique (topic_id, visitor_hash)
);

alter table public.campaign_topic_guest_responses enable row level security;

create index if not exists campaign_topic_guest_responses_topic_created_idx
  on public.campaign_topic_guest_responses (topic_id, created_at desc);

comment on table public.campaign_topic_guest_responses is
  'Server-only holding area for the single anonymous campaign response allowed before registration.';
