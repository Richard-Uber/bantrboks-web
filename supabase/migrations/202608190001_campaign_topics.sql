-- Reusable advert-to-topic landing pages for Bantrboks campaigns.
-- Public visitors may read topics and responses. All writes are performed by
-- authenticated product flows or the rate-limited server endpoints.

create extension if not exists pgcrypto;

create table if not exists public.campaign_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  campaign_name text not null,
  question text not null,
  room_name text not null,
  room_slug text not null,
  media_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'live', 'paused', 'expired')),
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  redirect_path text not null default '/#home',
  admin_emails text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.posts add column if not exists topic_id uuid references public.campaign_topics(id) on delete set null;
create index if not exists posts_topic_id_created_at_idx on public.posts(topic_id, created_at desc);

create table if not exists public.campaign_topic_visits (
  id bigint generated always as identity primary key,
  topic_id uuid not null references public.campaign_topics(id) on delete cascade,
  visitor_hash text not null,
  session_id text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(topic_id, visitor_hash, session_id)
);
create index if not exists campaign_topic_visits_visitor_idx
  on public.campaign_topic_visits(topic_id, visitor_hash, first_seen_at);

create table if not exists public.campaign_topic_reactions (
  topic_id uuid not null references public.campaign_topics(id) on delete cascade,
  target_key text not null,
  visitor_hash text not null,
  user_id text,
  reaction text not null check (reaction in ('slap', 'fire')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(topic_id, target_key, visitor_hash)
);

create table if not exists public.campaign_topic_rate_events (
  id bigint generated always as identity primary key,
  topic_id uuid not null references public.campaign_topics(id) on delete cascade,
  actor_hash text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists campaign_topic_rate_events_lookup_idx
  on public.campaign_topic_rate_events(topic_id, actor_hash, created_at desc);

alter table public.campaign_topics enable row level security;
alter table public.campaign_topic_visits enable row level security;
alter table public.campaign_topic_reactions enable row level security;
alter table public.campaign_topic_rate_events enable row level security;

drop policy if exists "Public can read campaign topics" on public.campaign_topics;
create policy "Public can read campaign topics"
  on public.campaign_topics for select
  using (status in ('scheduled', 'live', 'expired'));

drop policy if exists "Campaign admins can manage topics" on public.campaign_topics;
create policy "Campaign admins can manage topics"
  on public.campaign_topics for all
  using (lower(coalesce(auth.jwt() ->> 'email', '')) = any(admin_emails))
  with check (lower(coalesce(auth.jwt() ->> 'email', '')) = any(admin_emails));

drop policy if exists "Public can read campaign reaction totals" on public.campaign_topic_reactions;
create policy "Public can read campaign reaction totals"
  on public.campaign_topic_reactions for select using (true);

-- Visits, rate events and anonymous reaction writes remain service-role only.

insert into public.campaign_topics (
  id,
  slug,
  campaign_name,
  question,
  room_name,
  room_slug,
  media_url,
  status,
  starts_at,
  expires_at,
  redirect_path,
  admin_emails
) values (
  'a11b1ac5-c0ac-4e5a-9e42-202608190001',
  'all-blacks-coaching-approved',
  'All Blacks coaching: approved?',
  E'Did the All Black coaches approve:\n1) Tucked shoulder & reversed-arm non-wrapping hits?\n2) Illegal maul defence by pulling or trying to lift attackers leg or going off feet?\n\nDrop your take!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-coached-technique-comment-now-1080x1080.gif',
  'live',
  '2026-08-19 00:00:00+02',
  '2026-08-23 17:00:00+02',
  '/#home',
  array['richard@ubermobi.com']
)
on conflict (slug) do update set
  campaign_name = excluded.campaign_name,
  question = excluded.question,
  room_name = excluded.room_name,
  room_slug = excluded.room_slug,
  media_url = excluded.media_url,
  status = excluded.status,
  starts_at = excluded.starts_at,
  expires_at = excluded.expires_at,
  redirect_path = excluded.redirect_path,
  admin_emails = excluded.admin_emails,
  updated_at = now();

