# Bantrbox database migrations

Apply migrations to the production Supabase project before deploying application code that depends on them.

`202608120001_master_accounts.sql` adds the permanent Bantrbox master-account ownership layer. Bantrboks is treated as an acquisition source and first room, not a separate account system. It:

- preserves every existing user's current profile as their first owned account;
- records `bantrboks` as the signup source and the Springboks vs All Blacks tour as the acquisition campaign;
- automatically places campaign signups in the Bantrboks room while keeping their identity usable across Bantrbox;
- allows one authenticated email login to manage up to ten profiles;
- adds owner, admin, and editor membership roles;
- adds secure database functions for onboarding and profile creation; and
- extends row-level security so actions can be performed only through profiles the signed-in user manages.

The migration is additive and idempotent. Existing single-profile access policies remain in place during rollout.
