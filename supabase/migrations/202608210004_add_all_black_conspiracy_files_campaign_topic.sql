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
  'b88c8b3c-d7b3-44c1-e5b9-202608210004',
  'all-black-conspiracy-files',
  'The All Black conspiracy files',
  E'1987. 1995. 2009. 2011.\n\nPattern or paranoia? Which All Black conspiracy theory still gets rugby fans arguing? Give your take!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-all-black-conspiracy-files-1080x1080.png',
  'live',
  '2026-08-21 13:40:00+02',
  '2026-09-21 13:40:00+02',
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
