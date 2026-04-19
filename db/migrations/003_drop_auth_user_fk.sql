-- Drop auth.users FK constraints so the app works without Supabase Auth.
-- The service-role key bypasses RLS but not FK constraints, so any insert
-- with a user_id that isn't a real auth.users row would fail.
-- After this migration user_id columns are plain UUIDs with no FK enforcement.

alter table business_profiles drop constraint if exists business_profiles_id_fkey;
alter table boms               drop constraint if exists boms_user_id_fkey;
alter table exposure_scores    drop constraint if exists exposure_scores_user_id_fkey;
alter table recommendations    drop constraint if exists recommendations_user_id_fkey;
