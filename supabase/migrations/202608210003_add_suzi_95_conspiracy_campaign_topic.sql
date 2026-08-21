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
  'a77b7a2b-c6a2-43b0-d4a8-202608210003',
  'famous-conspiracies-suzi-95',
  'Which conspiracy still divides rugby fans?',
  E'Moon landing. Area 51. Chemtrails. Suzi ''95.\n\nWas the 1995 food-poisoning accusation plausible—or has it become rugby folklore? Give your take!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-famous-conspiracies-suzi-95-1080x1080.png',
  'live',
  '2026-08-21 06:23:00+02',
  '2026-09-21 06:23:00+02',
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
