-- Repair legacy account-link constraints left behind by earlier table versions.
--
-- A membership or consent event belongs to a Bantrbox master account. Linking
-- these rows to master_accounts also keeps the write order deterministic:
-- ensure/confirm creates the master account first, then writes its child row.
-- NOT VALID preserves any historical orphan rows while enforcing the corrected
-- relationship for every new write.

alter table public.account_memberships
  drop constraint if exists account_memberships_user_id_fkey;

alter table public.account_memberships
  add constraint account_memberships_user_id_fkey
  foreign key (user_id)
  references public.master_accounts(user_id)
  on delete cascade
  not valid;

alter table public.account_consent_events
  drop constraint if exists account_consent_events_user_id_fkey;

alter table public.account_consent_events
  add constraint account_consent_events_user_id_fkey
  foreign key (user_id)
  references public.master_accounts(user_id)
  on delete cascade
  not valid;
