-- Ensure every authenticated Bantrbox login has a matching public profile.
-- OAuth redirects can establish a session before the browser onboarding UI runs,
-- so this repair belongs in the authoritative account bootstrap function as well.

create or replace function public.ensure_personal_account()
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  current_user_email text;
  current_user_metadata jsonb;
  clean_handle text;
  clean_name text;
  clean_avatar text;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email), coalesce(raw_user_meta_data, '{}'::jsonb)
  into current_user_email, current_user_metadata
  from auth.users
  where id = current_user_id;

  if current_user_email is null then
    raise exception 'The master login has no email address';
  end if;

  clean_handle := lower(regexp_replace(
    trim(leading '@' from coalesce(
      current_user_metadata ->> 'handle',
      current_user_metadata ->> 'username',
      current_user_metadata ->> 'preferred_username',
      split_part(current_user_email, '@', 1),
      'bantrbox'
    )),
    '[^a-zA-Z0-9_]', '', 'g'
  ));
  clean_handle := left(coalesce(nullif(clean_handle, ''), 'bantrbox'), 30);

  if exists (
    select 1 from public.profiles
    where lower(handle) = clean_handle and id <> current_user_id::text
  ) then
    clean_handle := left(clean_handle, 23) || '_' || left(replace(current_user_id::text, '-', ''), 6);
  end if;

  clean_name := trim(coalesce(
    current_user_metadata ->> 'display_name',
    current_user_metadata ->> 'full_name',
    current_user_metadata ->> 'name',
    clean_handle
  ));
  clean_avatar := trim(coalesce(
    current_user_metadata ->> 'avatar_url',
    current_user_metadata ->> 'picture',
    upper(left(clean_handle, 2))
  ));

  insert into public.profiles (
    id, email, handle, display_name, avatar, location, bio, bantr_feed,
    permission_preferences, terms_accepted_at, privacy_accepted_at, legal_version
  ) values (
    current_user_id::text,
    current_user_email,
    clean_handle,
    clean_name,
    clean_avatar,
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
  )
  on conflict (id) do nothing;

  insert into public.master_accounts (
    user_id,
    signup_source,
    acquisition_campaign,
    initial_room_slug,
    terms_accepted_at,
    privacy_accepted_at
  ) values (
    current_user_id,
    coalesce(current_user_metadata ->> 'signup_source', 'bantrbox'),
    current_user_metadata ->> 'acquisition_campaign',
    coalesce(current_user_metadata ->> 'initial_room_slug', 'springboksvsallblacks'),
    now(),
    now()
  )
  on conflict (user_id) do nothing;

  insert into public.account_memberships (user_id, profile_id, role)
  values (current_user_id, current_user_id::text, 'owner')
  on conflict (user_id, profile_id) do nothing;

  return current_user_id;
end;
$$;

revoke all on function public.ensure_personal_account() from public;
revoke all on function public.ensure_personal_account() from anon;
grant execute on function public.ensure_personal_account() to authenticated;
