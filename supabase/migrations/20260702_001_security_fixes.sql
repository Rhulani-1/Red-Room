-- =============================================================================
-- Security fixes: money, paywalls, private media, location, profile ownership
-- =============================================================================
--
-- NOT YET APPLIED. Review before running.
--
-- Every statement is idempotent and guarded with IF EXISTS, so this is safe to run
-- regardless of which earlier migrations actually applied — which matters here,
-- because 20260621_004 fails on an already-existing column and may have halted the
-- chain before 20260622_005 ever ran.
--
-- This migration only REMOVES access that should not exist, and adds one missing
-- WITH CHECK. It creates no new capability.
--
-- BLAST RADIUS: verified against the client code before writing. There are zero
-- client-side writes to wallets, content_unlocks, subscriptions or payments — every
-- write comes from an Edge Function using the service role, which bypasses RLS
-- entirely. So removing client write access breaks nothing that currently works.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1) WALLETS — anyone could set their own balance
-- -----------------------------------------------------------------------------
-- "wallets_user_only" was FOR ALL (SELECT + INSERT + UPDATE + DELETE) with
-- USING/WITH CHECK (user_id = auth.uid()). A signed-in user could therefore run
--   update wallets set balance = 999999 where user_id = <their own id>
-- and wallet-pay would then authorise real spending against that invented balance,
-- crediting a real recipient. Money creation.
--
-- Balances must only ever change server-side. Users keep read access to their own.
DROP POLICY IF EXISTS "wallets_user_only" ON public.wallets;

DROP POLICY IF EXISTS "wallets_select_own" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
-- Note: "Service can insert wallets" / "Service can update wallets" already exist
-- and are correctly scoped TO service_role. Edge Functions are unaffected.


-- -----------------------------------------------------------------------------
-- 2) PAYWALLS — users could grant themselves paid content
-- -----------------------------------------------------------------------------
-- These three policies let a user INSERT their own rows into the very tables the
-- paywall checks. One API call from the browser bought nothing and unlocked
-- everything; a self-inserted active subscription also satisfied the paid-group
-- join check.
--
-- Unlocks are a *consequence* of payment and must be written only by the functions
-- that verify payment (payfast-itn, wallet-pay).
DROP POLICY IF EXISTS "content_unlocks_insert_user" ON public.content_unlocks;
DROP POLICY IF EXISTS "subscriptions_insert_user"   ON public.subscriptions;
DROP POLICY IF EXISTS "payments_insert_user"        ON public.payments;
-- SELECT-own policies ("content_unlocks_user", "subscriptions_user",
-- "payments_select_user") are deliberately left in place — the app must still read
-- what the current user has unlocked.


-- -----------------------------------------------------------------------------
-- 3) LOCATION & MEMBERSHIP — readable by signed-out clients
-- -----------------------------------------------------------------------------
-- These were created as FOR SELECT USING (true) with no TO clause, which defaults
-- to the `public` role and therefore includes `anon`. Anyone with the publishable
-- key — no account, no sign-in — could read every meetup row, and those rows carry
-- encoded GPS coordinates. Group membership was exposed the same way.
--
-- Re-scoped to authenticated. Discover and Near Me continue to work unchanged,
-- because they only ever run for a signed-in user.
DROP POLICY IF EXISTS "meetups_select_public" ON public.meetups;
CREATE POLICY "meetups_select_authenticated" ON public.meetups
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "group_members_select_public" ON public.group_members;
CREATE POLICY "group_members_select_authenticated" ON public.group_members
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "groups_select_public" ON public.groups;
CREATE POLICY "groups_select_authenticated" ON public.groups
  FOR SELECT TO authenticated
  USING (true);

-- HONEST LIMITATION: this closes anonymous access, which is the urgent part. Any
-- signed-in user can still read every user's approximate location, because that is
-- how discovery currently works — the client fetches all meetups and computes
-- distances locally. Properly fixing that needs a design change (compute distance
-- server-side in an RPC and return only the distance, never the coordinates).
-- Deliberately out of scope here: this migration removes access without changing
-- behaviour, and that change would need application work alongside it.


-- -----------------------------------------------------------------------------
-- 4) PRIVATE GROUP MEDIA — readable by anyone with the object path
-- -----------------------------------------------------------------------------
-- The bucket was deliberately made private in 20260508182249 and given a
-- membership-gated read policy. But that migration dropped three differently-named
-- policies and missed the original blanket one, which survived:
--   "Public read group-media"       (20260428033700) FOR SELECT USING (bucket_id = ...)
-- and a second unconditional public read was later added:
--   "group_media_download_public"   (20260622_005)   FOR SELECT TO public
-- Postgres ORs permissive policies together, so either one alone re-opens every
-- private group's photos, videos and voice notes.
DROP POLICY IF EXISTS "Public read group-media"     ON storage.objects;
DROP POLICY IF EXISTS "group_media_download_public" ON storage.objects;

-- Also drop the 20260622_005 write policies: they read the group id from
-- foldername[1], but uploads use `{user_id}/{group_id}/{file}` (see
-- src/pages/GroupChat.tsx uploadFile), so [1] is the USER id and [2] is the group.
-- They match nothing and only confuse the picture. The correct policies from
-- 20260508182249 (which use [2]) are recreated below.
DROP POLICY IF EXISTS "group_media_upload_members" ON storage.objects;
DROP POLICY IF EXISTS "group_media_delete_members" ON storage.objects;

-- Legacy blanket write policies from 20260428033700, superseded by the
-- membership-gated versions below.
DROP POLICY IF EXISTS "Auth upload group-media in own folder" ON storage.objects;
DROP POLICY IF EXISTS "Auth update own group-media"           ON storage.objects;
DROP POLICY IF EXISTS "Auth delete own group-media"           ON storage.objects;

-- Recreate the correct membership-gated policies, so this migration leaves group
-- media working whether or not 20260508182249 actually applied.
DROP POLICY IF EXISTS "Group media readable by members" ON storage.objects;
CREATE POLICY "Group media readable by members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'group-media'
  AND public.is_group_member(
    NULLIF((storage.foldername(name))[2], '')::uuid,
    auth.uid()
  )
);

DROP POLICY IF EXISTS "Members upload group media" ON storage.objects;
CREATE POLICY "Members upload group media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'group-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.is_group_member(
    NULLIF((storage.foldername(name))[2], '')::uuid,
    auth.uid()
  )
);

DROP POLICY IF EXISTS "Uploaders delete own group media" ON storage.objects;
CREATE POLICY "Uploaders delete own group media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'group-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Belt and braces: the bucket must not be public, or the public URL endpoint
-- serves objects without consulting these policies at all.
UPDATE storage.buckets SET public = false WHERE id = 'group-media';


-- -----------------------------------------------------------------------------
-- 5) GROUPS — signed-out clients could create groups, and anyone could create
--    a group owned by someone else
-- -----------------------------------------------------------------------------
-- "groups_insert_auth" had WITH CHECK (auth.role() IS NOT NULL OR auth.uid() IS NOT NULL).
-- For an anonymous request auth.role() returns the string 'anon', which is NOT NULL,
-- so the check passes — the policy that reads like "must be logged in" actually
-- admits everyone. It also never verified creator_id, so a group could be created
-- already owned by another account.
DROP POLICY IF EXISTS "groups_insert_auth" ON public.groups;
CREATE POLICY "groups_insert_own" ON public.groups
  FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 6) POST MEDIA — would be world-readable the moment the bucket is created
-- -----------------------------------------------------------------------------
-- "posts_download_public" is TO public USING (bucket_id = 'posts'). The posts
-- bucket holds post media, which includes paid and sensitive content, so this
-- makes every paywalled image and video readable by anyone who knows the path —
-- no account required.
--
-- Not currently exploitable only because the bucket has never been created. It
-- becomes live the moment you create it for media upload, so fix it first.
DROP POLICY IF EXISTS "posts_download_public" ON storage.objects;
CREATE POLICY "posts_download_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'posts');
-- NOTE: this is still "any signed-in user can read any post object". Enforcing the
-- paywall itself needs signed URLs issued only after checking content_unlocks —
-- the pattern GroupChat already uses. That is application work, not a policy.
--
-- "profile_avatars_download_public" is intentionally left public: avatars are meant
-- to be visible to everyone, including signed-out visitors.


-- -----------------------------------------------------------------------------
-- 7) PROFILES — a user could reassign their profile to someone else
-- -----------------------------------------------------------------------------
-- "Users update their own profile" has USING (user_id = auth.uid()) and NO
-- WITH CHECK. USING decides which rows you may update; WITH CHECK decides what the
-- row may look like afterwards. Without it, a user can edit their own row and set
-- user_id to another account — taking over that profile.
DROP POLICY IF EXISTS "Users update their own profile" ON public.profiles;
CREATE POLICY "Users update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Remove three dead policies from 20260615_002. `profiles` has BOTH an `id`
-- (a random per-row uuid) and a `user_id` (the auth.users reference), and these
-- compare auth.uid() against `id` — so they have never matched a single row and do
-- nothing. Removing them so the remaining policies are the real picture.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
-- "Profiles viewable by authenticated users" (TO authenticated, USING true) is
-- intentionally kept: Discover, Near Me and viewing another person's profile all
-- depend on cross-user reads. It is already correctly scoped away from anon.


-- =============================================================================
-- Verification — run this after applying and check the output
-- =============================================================================
-- Expect: no rows. Each row returned is a policy still granting public/anon access
-- or client writes to a money table.
--
-- SELECT tablename, policyname, roles::text, cmd
-- FROM pg_policies
-- WHERE schemaname IN ('public', 'storage')
--   AND (
--     -- anything still reachable by anon
--     ('anon' = ANY (roles) OR 'public' = ANY (roles))
--     -- or client writes to money tables
--     OR (tablename IN ('wallets','payments','content_unlocks','subscriptions')
--         AND cmd <> 'SELECT'
--         AND NOT ('service_role' = ANY (roles)))
--   )
-- ORDER BY tablename, policyname;
