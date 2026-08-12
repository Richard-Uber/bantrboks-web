-- Bantrbox master accounts
-- One Supabase Auth user can own or manage several public profiles.

-- Profile IDs are permanent text identifiers in the existing Bantrbox schema.
-- The login email remains on each profile for compatibility with the main app.

create table if not exists public.master_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  signup_source text not null default 'bantrbox',
  acquisition_campaign text,
  initial_room_slug text,
  terms_version text not null default 'bantrbox-terms-2026-08',
  privacy_version text not null default 'bantrbox-privacy-2026-08',
  terms_accepted_at timestamptz,
  privacy_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.master_accounts to authenticated;
alter table public.master_accounts enable row level security;

drop policy if exists "Users can view their master account" on public.master_accounts;
create policy "Users can view their master account"
  on public.master_accounts for select
  to authenticated
  using (user_id = auth.uid());

create table if not exists public.account_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id text not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'editor')),
  created_at timestamptz not null default now(),
  primary key (user_id, profile_id)
);

create index if not exists account_memberships_profile_id_idx
  on public.account_memberships(profile_id);

grant select on public.account_memberships to authenticated;

alter table public.account_memberships enable row level security;

drop policy if exists "Members can view their account access" on public.account_memberships;
create policy "Members can view their account access"
  on public.account_memberships for select
  to authenticated
  using (user_id = auth.uid());

-- Preserve every existing user's current identity as their first managed profile.
insert into public.master_accounts (
  user_id,
  signup_source,
  acquisition_campaign,
  initial_room_slug,
  terms_accepted_at,
  privacy_accepted_at
)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'signup_source', users.raw_user_meta_data ->> 'product', 'bantrbox'),
  users.raw_user_meta_data ->> 'acquisition_campaign',
  coalesce(users.raw_user_meta_data ->> 'initial_room_slug', users.raw_user_meta_data ->> 'default_room'),
  coalesce(profiles.terms_accepted_at, users.created_at),
  coalesce(profiles.privacy_accepted_at, users.created_at)
from auth.users as users
left join public.profiles as profiles on profiles.id = users.id::text
on conflict (user_id) do nothing;

insert into public.account_memberships (user_id, profile_id, role)
select distinct users.id, profiles.id, 'owner'
from auth.users as users
join public.profiles as profiles
  on profiles.id = users.id::text
  or lower(profiles.email) = lower(users.email)
on conflict (user_id, profile_id) do nothing;

create or replace function public.ensure_personal_account()
returns uuid
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

  insert into public.master_accounts (
    user_id,
    signup_source,
    acquisition_campaign,
    initial_room_slug,
    terms_accepted_at,
    privacy_accepted_at
  )
  select
    current_user_id,
    coalesce(raw_user_meta_data ->> 'signup_source', 'bantrbox'),
    raw_user_meta_data ->> 'acquisition_campaign',
    raw_user_meta_data ->> 'initial_room_slug',
    now(),
    now()
  from auth.users
  where id = current_user_id
  on conflict (user_id) do nothing;

  insert into public.account_memberships (user_id, profile_id, role)
  select current_user_id, current_user_id, 'owner'
  where exists (select 1 from public.profiles where id = current_user_id::text)
  on conflict (user_id, profile_id) do nothing;

  return current_user_id;
end;
$$;

revoke all on function public.ensure_personal_account() from public;
revoke all on function public.ensure_personal_account() from anon;
grant execute on function public.ensure_personal_account() to authenticated;

create or replace function public.create_managed_profile(
  p_display_name text,
  p_handle text
)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  new_profile_id text := gen_random_uuid()::text;
  current_user_email text;
  clean_handle text := lower(regexp_replace(trim(leading '@' from coalesce(p_handle, '')), '[^a-zA-Z0-9_]', '', 'g'));
  clean_name text := trim(coalesce(p_display_name, ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  select email into current_user_email from auth.users where id = current_user_id;
  if current_user_email is null then
    raise exception 'The master login has no email address';
  end if;
  if clean_name = '' then
    raise exception 'Display name is required';
  end if;
  if clean_handle = '' or length(clean_handle) > 30 then
    raise exception 'Choose a valid handle of 30 characters or fewer';
  end if;
  if (select count(*) from public.account_memberships where user_id = current_user_id) >= 10 then
    raise exception 'A master account can manage up to 10 accounts';
  end if;
  if exists (select 1 from public.profiles where lower(handle) = clean_handle) then
    raise exception 'That handle is already taken';
  end if;

  insert into public.profiles (
    id, email, handle, display_name, avatar, location, bio, bantr_feed,
    permission_preferences, terms_accepted_at, privacy_accepted_at, legal_version
  ) values (
    new_profile_id,
    lower(current_user_email),
    clean_handle,
    clean_name,
    upper(left(clean_handle, 2)),
    '',
    '',
    array['springboksvsallblacks'],
    jsonb_build_object(
      'product', 'bantrbox',
      'signup_source', 'bantrboks',
      'acquisition_campaign', 'springboks-all-blacks-tour',
      'created_via', 'bantrboks.com',
      'default_room', 'springboksvsallblacks',
      'current_room', 'springboksvsallblacks',
      'legal_scope', 'bantrbox-platform'
    ),
    now(),
    now(),
    'bantrbox-platform-2026-08'
  );

  insert into public.account_memberships (user_id, profile_id, role)
  values (current_user_id, new_profile_id, 'owner');

  return new_profile_id;
end;
$$;

revoke all on function public.create_managed_profile(text, text) from public;
revoke all on function public.create_managed_profile(text, text) from anon;
grant execute on function public.create_managed_profile(text, text) to authenticated;

-- Membership-based policies are additive to the existing single-profile policies,
-- so current users continue working throughout the migration.
drop policy if exists "Members can update managed profiles" on public.profiles;
create policy "Members can update managed profiles"
  on public.profiles for update
  to authenticated
  using (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = profiles.id
  ))
  with check (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = profiles.id
  ));

drop policy if exists "Members can view managed profiles" on public.profiles;
create policy "Members can view managed profiles"
  on public.profiles for select
  to authenticated
  using (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = profiles.id
  ));

drop policy if exists "Members can create posts as managed profiles" on public.posts;
create policy "Members can create posts as managed profiles"
  on public.posts for insert
  to authenticated
  with check (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = posts.author_id
  ));

drop policy if exists "Members can create comments as managed profiles" on public.comments;
create policy "Members can create comments as managed profiles"
  on public.comments for insert
  to authenticated
  with check (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = comments.author_id
  ));

drop policy if exists "Members can react as managed profiles" on public.post_reactions;
create policy "Members can react as managed profiles"
  on public.post_reactions for insert
  to authenticated
  with check (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = post_reactions.user_id
  ));

drop policy if exists "Members can remove managed reactions" on public.post_reactions;
create policy "Members can remove managed reactions"
  on public.post_reactions for delete
  to authenticated
  using (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = post_reactions.user_id
  ));

drop policy if exists "Members can view managed notifications" on public.notifications;
create policy "Members can view managed notifications"
  on public.notifications for select
  to authenticated
  using (exists (
    select 1 from public.account_memberships
    where user_id = auth.uid() and profile_id = notifications.user_id
  ));
