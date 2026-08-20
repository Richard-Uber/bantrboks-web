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
  'd44e4df8-f3df-408d-a175-202608200003',
  'rugby-greatest-rivalry-trophy-named',
  'Rugby''s Greatest Rivalry trophy named!',
  'Rugby''s Greatest Rivalry trophy named!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-bill-and-suzi-trophies-v2-1080x1080.png',
  'live',
  '2026-08-20 17:20:00+10',
  '2026-09-10 17:20:00+10',
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
