-- Keep the Bantrbox app's display-label room tag and Bantrboks.com's stable
-- slug tag together on every Springboks vs All Blacks post.

create or replace function public.sync_bantrboks_room_post_tags()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.tags := coalesce(new.tags, '{}'::text[]);

  if new.tags && array['Springboks vs All Blacks', 'springboksvsallblacks'] then
    if not ('Springboks vs All Blacks' = any(new.tags)) then
      new.tags := array_append(new.tags, 'Springboks vs All Blacks');
    end if;

    if not ('springboksvsallblacks' = any(new.tags)) then
      new.tags := array_append(new.tags, 'springboksvsallblacks');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_bantrboks_room_post_tags on public.posts;
create trigger sync_bantrboks_room_post_tags
  before insert or update of tags on public.posts
  for each row
  execute function public.sync_bantrboks_room_post_tags();

-- Reconnect posts that were created before the two products shared aliases.
update public.posts
set tags = array(
  select distinct tag
  from unnest(
    coalesce(posts.tags, '{}'::text[])
    || array['Springboks vs All Blacks', 'springboksvsallblacks']
  ) as tag
)
where tags && array['Springboks vs All Blacks', 'springboksvsallblacks']
  and not tags @> array['Springboks vs All Blacks', 'springboksvsallblacks'];

create index if not exists posts_tags_gin_idx on public.posts using gin(tags);

-- Allow an already-open Bantrboks feed to refresh when shared content changes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
    ) then
      alter publication supabase_realtime add table public.posts;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments'
    ) then
      alter publication supabase_realtime add table public.comments;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_reactions'
    ) then
      alter publication supabase_realtime add table public.post_reactions;
    end if;
  end if;
end;
$$;
