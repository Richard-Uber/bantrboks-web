-- Let a creator remove a post they own at any time, including when using a
-- managed profile. The RPC keeps ownership checks server-side and makes the
-- soft-delete atomic for mobile and web clients.

drop policy if exists "Users update own posts" on public.posts;
create policy "Users update own posts"
  on public.posts for update
  to authenticated
  using (auth.uid()::text = author_id and deleted_at is null)
  with check (auth.uid()::text = author_id);

drop policy if exists "Members can update posts as managed profiles" on public.posts;
create policy "Members can update posts as managed profiles"
  on public.posts for update
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = posts.author_id
    )
  )
  with check (
    exists (
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
    and deleted_at is null;

  if not found then
    raise exception 'You can only delete your own bantrs';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_managed_post(text, text) from public;
revoke all on function public.delete_managed_post(text, text) from anon;
grant execute on function public.delete_managed_post(text, text) to authenticated;
