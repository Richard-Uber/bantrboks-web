-- Complete Bantrboks notifications at the database layer so activity from
-- both Bantrbox and Bantrboks reaches the same notification centre.

alter table public.notifications add column if not exists post_id text;
alter table public.notifications add column if not exists comment_id text;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

drop policy if exists "Members can update managed notifications" on public.notifications;
create policy "Members can update managed notifications"
  on public.notifications for update
  to authenticated
  using (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = notifications.user_id
  ))
  with check (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = notifications.user_id
  ));

create or replace function public.bantrboks_profile_handle(profile_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce('@' || nullif(handle, ''), display_name, '@bantrboks')
  from public.profiles
  where id = profile_id
$$;

create or replace function public.notify_bantrboks_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id text;
  actor_handle text;
begin
  select author_id into recipient_id from public.posts where id = new.post_id;
  if recipient_id is null or recipient_id = new.user_id then return new; end if;
  actor_handle := coalesce(public.bantrboks_profile_handle(new.user_id), '@bantrboks');

  insert into public.notifications (id, user_id, kind, title, body, post_id, created_at)
  values (
    'notification-reaction-' || new.id || '-' || txid_current(),
    recipient_id,
    'activity',
    case when new.reaction = 'slap' then 'New Slap' else 'New Drop' end,
    actor_handle || case when new.reaction = 'slap' then ' slapped your bantr.' else ' dropped fire on your bantr.' end,
    new.post_id,
    now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.notify_bantrboks_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id text;
  parent_id text;
  actor_handle text;
begin
  parent_id := new.parent_comment_id;
  if parent_id is null and new.body ~ '^\[\[reply:[^]]+\]\]' then
    parent_id := substring(new.body from '^\[\[reply:([^]]+)\]\]');
  end if;

  if parent_id is not null then
    select author_id into recipient_id from public.comments where id = parent_id;
  else
    select author_id into recipient_id from public.posts where id = new.post_id;
  end if;

  if recipient_id is null or recipient_id = new.author_id then return new; end if;
  actor_handle := coalesce(public.bantrboks_profile_handle(new.author_id), '@bantrboks');

  insert into public.notifications (id, user_id, kind, title, body, post_id, comment_id, created_at)
  values (
    'notification-comment-' || new.id,
    recipient_id,
    'comment',
    case when parent_id is null then 'New Comment' else 'New Reply' end,
    actor_handle || case when parent_id is null then ' commented on your bantr.' else ' replied to your comment.' end,
    new.post_id,
    new.id,
    now()
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists bantrboks_reaction_notifications on public.post_reactions;
create trigger bantrboks_reaction_notifications
after insert on public.post_reactions
for each row execute function public.notify_bantrboks_reaction();

drop trigger if exists bantrboks_comment_notifications on public.comments;
create trigger bantrboks_comment_notifications
after insert on public.comments
for each row execute function public.notify_bantrboks_comment();

grant select, update on public.notifications to authenticated;
