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
  'c33d3ce7-e2ce-4f7c-b064-202608200002',
  'staying-silent-haka-deserves-response',
  'The haka deserves a response',
  'Staying silent is disrespectful! The haka deserves a response!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-responding-to-haka-singing-fact-v4-1080x1080.png',
  'live',
  '2026-08-20 16:23:00+10',
  '2026-09-10 16:23:00+10',
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
