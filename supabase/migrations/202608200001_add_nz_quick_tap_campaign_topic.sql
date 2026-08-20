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
  'b22c2bd6-d1bd-4f6b-af53-202608200001',
  'nz-quick-tap-cheat-code-or-legit',
  'NZ quick tap: cheat code or legit?',
  E'This is a NZ rugby tactic, elsewhere its called cheating right?\n\n“Take a big hit, stay down, then take the quick tap”',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-nz-quick-tap-debate-1080x1080.png',
  'live',
  '2026-08-20 00:00:00+02',
  '2026-08-23 17:00:00+02',
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
