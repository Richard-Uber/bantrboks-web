begin;

alter table public.campaign_topics
  add column if not exists canonical_post_id text;

alter table public.campaign_topic_guest_responses
  add column if not exists claimed_comment_id text;

create temporary table _campaign_topic_post_merge (
  topic_id uuid not null,
  post_id text primary key,
  canonical_post_id text not null,
  generated_comment_id text,
  is_canonical boolean not null
) on commit drop;

insert into _campaign_topic_post_merge (
  topic_id,
  post_id,
  canonical_post_id,
  generated_comment_id,
  is_canonical
)
with chosen as (
  select distinct on (p.topic_id)
    p.topic_id,
    p.id as canonical_post_id
  from public.posts p
  join public.campaign_topics t on t.id = p.topic_id
  where p.topic_id is not null
    and p.deleted_at is null
  order by
    p.topic_id,
    case when p.id = t.canonical_post_id then 0 else 1 end,
    p.created_at,
    p.id
)
select
  p.topic_id,
  p.id,
  chosen.canonical_post_id,
  case
    when nullif(btrim(p.body), '') is not null
      and btrim(p.body) <> btrim(t.question)
    then 'topic-response-' || md5(p.id)
    else null
  end,
  p.id = chosen.canonical_post_id
from public.posts p
join public.campaign_topics t on t.id = p.topic_id
join chosen on chosen.topic_id = p.topic_id
where p.deleted_at is null;

-- Preserve every existing topic-post body as a response beneath the one
-- canonical campaign post before duplicate posts are hidden.
insert into public.comments (
  id,
  post_id,
  author_id,
  body,
  created_at,
  edited_at,
  deleted_at
)
select
  merge.generated_comment_id,
  merge.canonical_post_id,
  post.author_id,
  post.body,
  post.created_at,
  post.edited_at,
  null
from _campaign_topic_post_merge merge
join public.posts post on post.id = merge.post_id
where merge.generated_comment_id is not null
on conflict (id) do update
set
  post_id = excluded.post_id,
  author_id = excluded.author_id,
  body = excluded.body,
  created_at = excluded.created_at,
  edited_at = excluded.edited_at,
  deleted_at = null;

-- Move existing discussion and reactions onto the canonical post.
update public.comments comment
set post_id = merge.canonical_post_id
from _campaign_topic_post_merge merge
where comment.post_id = merge.post_id
  and merge.post_id <> merge.canonical_post_id;

delete from public.post_reactions reaction
using _campaign_topic_post_merge merge
where reaction.post_id = merge.post_id
  and merge.post_id <> merge.canonical_post_id
  and exists (
    select 1
    from public.post_reactions kept
    where kept.post_id = merge.canonical_post_id
      and kept.user_id = reaction.user_id
      and kept.reaction = reaction.reaction
  );

update public.post_reactions reaction
set post_id = merge.canonical_post_id
from _campaign_topic_post_merge merge
where reaction.post_id = merge.post_id
  and merge.post_id <> merge.canonical_post_id;

-- Topic-page reactions use string target keys rather than post_id columns.
-- Collapse those keys onto the same canonical post without violating the
-- topic/visitor primary key.
delete from public.campaign_topic_reactions reaction
using _campaign_topic_post_merge merge
where reaction.topic_id = merge.topic_id
  and reaction.target_key = 'post:' || merge.post_id
  and merge.post_id <> merge.canonical_post_id
  and exists (
    select 1
    from public.campaign_topic_reactions kept
    where kept.topic_id = reaction.topic_id
      and kept.target_key = 'post:' || merge.canonical_post_id
      and kept.visitor_hash = reaction.visitor_hash
  );

update public.campaign_topic_reactions reaction
set target_key = 'post:' || merge.canonical_post_id
from _campaign_topic_post_merge merge
where reaction.topic_id = merge.topic_id
  and reaction.target_key = 'post:' || merge.post_id
  and merge.post_id <> merge.canonical_post_id;

update public.notifications notification
set post_id = merge.canonical_post_id
from _campaign_topic_post_merge merge
where notification.post_id = merge.post_id
  and merge.post_id <> merge.canonical_post_id;

update public.campaign_topic_guest_responses guest
set
  claimed_post_id = merge.canonical_post_id,
  claimed_comment_id = coalesce(guest.claimed_comment_id, merge.generated_comment_id)
from _campaign_topic_post_merge merge
where guest.claimed_post_id = merge.post_id;

-- Soft-delete duplicate topic posts only after their content and activity have
-- been moved, then make the canonical card match the acquisition campaign.
update public.posts post
set deleted_at = coalesce(post.deleted_at, now())
from _campaign_topic_post_merge merge
where post.id = merge.post_id
  and not merge.is_canonical;

update public.posts post
set
  body = topic.question,
  media_url = coalesce(topic.media_url, post.media_url),
  edited_at = case
    when post.body is distinct from topic.question
      or (topic.media_url is not null and post.media_url is distinct from topic.media_url)
    then now()
    else post.edited_at
  end,
  deleted_at = null
from _campaign_topic_post_merge merge
join public.campaign_topics topic on topic.id = merge.topic_id
where merge.is_canonical
  and post.id = merge.post_id;

update public.campaign_topics topic
set
  canonical_post_id = merge.canonical_post_id,
  updated_at = now()
from (
  select distinct topic_id, canonical_post_id
  from _campaign_topic_post_merge
) merge
where topic.id = merge.topic_id
  and topic.canonical_post_id is distinct from merge.canonical_post_id;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaign_topics_canonical_post_id_fkey'
      and conrelid = 'public.campaign_topics'::regclass
  ) then
    alter table public.campaign_topics
      add constraint campaign_topics_canonical_post_id_fkey
      foreign key (canonical_post_id)
      references public.posts(id)
      on delete set null
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaign_topic_guest_responses_claimed_comment_id_fkey'
      and conrelid = 'public.campaign_topic_guest_responses'::regclass
  ) then
    alter table public.campaign_topic_guest_responses
      add constraint campaign_topic_guest_responses_claimed_comment_id_fkey
      foreign key (claimed_comment_id)
      references public.comments(id)
      on delete set null
      not valid;
  end if;
end
$$;

create unique index if not exists posts_topic_one_live_idx
  on public.posts(topic_id)
  where topic_id is not null and deleted_at is null;

-- A participant may own the row selected as the canonical card, but their
-- contribution is now a comment. Keep the shared campaign card immutable to
-- normal authenticated clients; service-role campaign endpoints still manage
-- it server-side.
drop policy if exists "Users update own posts" on public.posts;
create policy "Users update own posts"
  on public.posts for update
  to authenticated
  using (auth.uid()::text = author_id and deleted_at is null and topic_id is null)
  with check (auth.uid()::text = author_id and topic_id is null);

drop policy if exists "Members can update posts as managed profiles" on public.posts;
create policy "Members can update posts as managed profiles"
  on public.posts for update
  to authenticated
  using (
    deleted_at is null
    and topic_id is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = posts.author_id
    )
  )
  with check (
    topic_id is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = posts.author_id
    )
  );

create or replace function public.delete_managed_post(
  p_post_id text,
  p_profile_id text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not (
    current_user_id::text = p_profile_id
    or exists (
      select 1
      from public.account_memberships
      where user_id = current_user_id and profile_id = p_profile_id
    )
  ) then
    raise exception 'You can only delete bantrs from a profile managed by this login';
  end if;

  update public.posts
  set deleted_at = now()
  where id = p_post_id
    and author_id = p_profile_id
    and topic_id is null
    and deleted_at is null;

  if not found then
    raise exception 'Campaign discussions cannot be deleted by participants';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_managed_post(text, text) from public;
revoke all on function public.delete_managed_post(text, text) from anon;
grant execute on function public.delete_managed_post(text, text) to authenticated;

commit;
