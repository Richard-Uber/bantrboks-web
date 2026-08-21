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
  'c99d9c4d-e8c4-45d2-f6ca-202608210005',
  'haka-expert-singing-is-an-honour',
  'Haka expert: singing back is beautiful',
  E'For opponents to accept the haka challenge and respond in song is an honour.\n\nDoes staying silent show respect—or refuse the challenge? Give your take!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-haka-expert-singing-is-an-honour-1080x1080.png',
  'live',
  '2026-08-21 14:55:00+02',
  '2026-09-21 14:55:00+02',
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
