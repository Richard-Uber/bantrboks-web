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
  'f66a6f1a-b5f1-42af-c397-202608200005',
  'springboks-all-blacks-de-allende-100th',
  'Who wins this epic Test match?',
  E'Who wins this epic Test match?\n\nDamian de Allende earns his 100th Test cap. Drop your prediction and take!',
  'Springboks vs All Blacks',
  'springboksvsallblacks',
  '/brand/bantrboks-epic-test-de-allende-100th-1080x1080.png',
  'live',
  '2026-08-20 14:00:00+02',
  '2026-08-22 17:00:00+02',
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
