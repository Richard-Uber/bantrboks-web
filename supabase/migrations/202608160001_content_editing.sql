-- Owner-only editing for Bantrbox posts and comments across web and mobile.

alter table public.posts
  add column if not exists edited_at timestamptz;

alter table public.comments
  add column if not exists edited_at timestamptz;

drop policy if exists "Users update own comments" on public.comments;
create policy "Users update own comments"
  on public.comments for update
  to authenticated
  using (auth.uid()::text = author_id and deleted_at is null)
  with check (auth.uid()::text = author_id and deleted_at is null);

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
    deleted_at is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = posts.author_id
    )
  );

drop policy if exists "Members can update comments as managed profiles" on public.comments;
create policy "Members can update comments as managed profiles"
  on public.comments for update
  to authenticated
  using (
    deleted_at is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = comments.author_id
    )
  )
  with check (
    deleted_at is null
    and exists (
      select 1
      from public.account_memberships
      where user_id = auth.uid() and profile_id = comments.author_id
    )
  );
