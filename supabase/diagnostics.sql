-- ============================================================================
-- RED RXXM — read-only production diagnostics
-- ============================================================================
-- PURPOSE: establish what is ACTUALLY applied to the live database, because the
-- migration chain is known to be broken at 20260621_004 (it does ADD COLUMN on a
-- column 20260428033700 already created, so it rolled back — and anything after
-- it probably never ran).
--
-- SAFETY: every statement here is a SELECT. Nothing is created, altered, dropped,
-- or deleted. It is safe to run on production. You can verify that yourself —
-- search this file for INSERT/UPDATE/DELETE/ALTER/DROP/CREATE and you'll find
-- none outside of this comment.
--
-- HOW TO RUN: the Supabase SQL editor only shows the result of the LAST statement,
-- so run each block SEPARATELY (Q1 … Q6) and paste each result back. Each block
-- returns a single cell of formatted JSON, so it copies cleanly.
--
-- RUN Q6 LAST AND ON ITS OWN. It may throw an error — that error IS the answer,
-- and running it in the same batch as anything else would abort the whole batch.
-- ============================================================================


-- ============================================================================
-- Q1 — Schema: which tables and columns actually exist?
-- Answers: which of the last 7 migrations landed.
-- Watch for: group_members.last_read_at — if is_nullable = 'NO' it came from
--   20260428033700 and 20260621_004 never applied (expected). If 'YES', that
--   migration DID apply.
--   meetups.price_rands + profiles.availability present => 20260619/20260620 landed.
--   post_metadata MUST be null — the app inserts into it on every post.
-- ============================================================================
SELECT jsonb_pretty(jsonb_build_object(
  'tables_in_public', (
    SELECT jsonb_agg(jsonb_build_object(
             'table', c.relname,
             'rls_enabled', c.relrowsecurity,
             'approx_rows', c.reltuples::bigint) ORDER BY c.relname)
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  ),
  'expected_missing_tables', jsonb_build_object(
    'post_metadata',           to_regclass('public.post_metadata')::text,
    'live_streams',            to_regclass('public.live_streams')::text,
    'live_stream_messages',    to_regclass('public.live_stream_messages')::text,
    'live_stream_viewers',     to_regclass('public.live_stream_viewers')::text,
    'series',                  to_regclass('public.series')::text,
    'series_episodes',         to_regclass('public.series_episodes')::text,
    'followers_relationships', to_regclass('public.followers_relationships')::text,
    'payment_logs',            to_regclass('public.payment_logs')::text
  ),
  'key_columns', (
    SELECT jsonb_agg(jsonb_build_object(
             'table', table_name,
             'column', column_name,
             'type', data_type,
             'nullable', is_nullable,
             'default', column_default)
           ORDER BY table_name, ordinal_position)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('profiles','meetups','group_members','wallets','post_boosts')
  )
)) AS q1_schema;


-- ============================================================================
-- Q2 — Every RLS policy. THE MOST IMPORTANT BLOCK.
-- Watch for these policy names existing (each = one live security hole):
--   wallets_user_only          -> hole 1: clients can UPDATE their own balance
--   content_unlocks_insert_user -> hole 2: self-granted content unlocks
--   subscriptions_insert_user   -> hole 2: self-granted subscriptions
--   payments_insert_user        -> hole 2: fabricated payment rows
--   meetups_select_public       -> hole 4: everyone's GPS readable
--   group_members_select_public / groups_select_public / groups_insert_auth
--   "Public read group-media" (in storage) -> hole 3: private media public
-- Also watch: 'roles' should be {authenticated} on anything sensitive. A value of
--   {public} means anon can do it too — that is the core defect in 20260615_002.
-- Also confirm BOTH "Profiles viewable by authenticated users" AND
--   profiles_select_own exist (the latter is dead: it tests id, not user_id).
-- ============================================================================
SELECT jsonb_pretty(jsonb_build_object(
  'public_policies', (
    SELECT jsonb_agg(jsonb_build_object(
             'table', tablename,
             'policy', policyname,
             'permissive', permissive,
             'roles', roles::text,
             'cmd', cmd,
             'using', qual,
             'with_check', with_check)
           ORDER BY tablename, cmd, policyname)
    FROM pg_policies WHERE schemaname = 'public'
  ),
  'storage_object_policies', (
    SELECT jsonb_agg(jsonb_build_object(
             'policy', policyname,
             'permissive', permissive,
             'roles', roles::text,
             'cmd', cmd,
             'using', qual,
             'with_check', with_check)
           ORDER BY cmd, policyname)
    FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
  )
)) AS q2_policies;


-- ============================================================================
-- Q3 — Grants, buckets, storage paths, realtime, functions, triggers.
-- Watch for:
--   grants: does 'authenticated' hold UPDATE on wallets? RLS is only the second
--     gate — the table grant is the first. Capture this BEFORE we change anything
--     so we have a baseline, and so we can confirm service_role keeps its INSERTs.
--   buckets: group-media.public MUST be false. posts / profile-avatars should be
--     ABSENT (never created, despite policies existing for them).
--   storage_paths: group-media depth should be 2 ({user_id}/{group_id}/file),
--     matching GroupChat.tsx:317. Depth 1 would mean a client wrote a different
--     shape and the foldername[2] policies silently deny.
--   realtime: check puballtables — if true, new tables auto-join and must not be
--     re-added.
-- ============================================================================
SELECT jsonb_pretty(jsonb_build_object(
  'table_grants_to_clients', (
    SELECT jsonb_agg(jsonb_build_object(
             'table', table_name,
             'grantee', grantee,
             'privileges', privs) ORDER BY table_name, grantee)
    FROM (
      SELECT table_name, grantee,
             string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('anon','authenticated','service_role')
        AND table_name IN ('wallets','wallet_transactions','content_unlocks',
                           'subscriptions','payments','meetups','profiles',
                           'groups','group_members','platform_revenue')
      GROUP BY table_name, grantee
    ) g
  ),
  'buckets', (
    SELECT jsonb_agg(jsonb_build_object(
             'id', id, 'public', public,
             'size_limit', file_size_limit,
             'mime_types', allowed_mime_types) ORDER BY id)
    FROM storage.buckets
  ),
  'storage_paths', (
    SELECT jsonb_agg(jsonb_build_object(
             'bucket', bucket_id, 'depth', depth,
             'objects', objects, 'sample', sample) ORDER BY bucket_id, depth)
    FROM (
      SELECT bucket_id,
             array_length(storage.foldername(name), 1) AS depth,
             count(*) AS objects,
             min(name) AS sample
      FROM storage.objects
      GROUP BY bucket_id, array_length(storage.foldername(name), 1)
    ) p
  ),
  'realtime_publications', (
    SELECT jsonb_agg(jsonb_build_object(
             'publication', p.pubname,
             'all_tables', p.puballtables,
             'table', c.relname,
             'replica_identity', c.relreplident) ORDER BY p.pubname, c.relname)
    FROM pg_publication p
    LEFT JOIN pg_publication_rel pr ON pr.prpubid = p.oid
    LEFT JOIN pg_class c ON c.oid = pr.prrelid
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
             'name', p.proname,
             'args', pg_get_function_identity_arguments(p.oid),
             'security_definer', p.prosecdef) ORDER BY p.proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  ),
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object(
             'table', c.relname, 'trigger', t.tgname) ORDER BY c.relname, t.tgname)
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public','auth') AND NOT t.tgisinternal
  )
)) AS q3_grants_storage_realtime;


-- ============================================================================
-- Q4 — Data volume. Tells us what we must not break, and how much real usage
-- exists. Also tells us whether the paid-meetup trigger in a later phase would
-- affect any existing row (expect meetups_priced = 0, since nothing writes it).
-- ============================================================================
SELECT jsonb_pretty(jsonb_object_agg(label, n)) AS q4_volumes
FROM (
  SELECT 'auth_users' AS label, count(*) AS n FROM auth.users
  UNION ALL SELECT 'profiles',              count(*) FROM public.profiles
  UNION ALL SELECT 'meetups',               count(*) FROM public.meetups
  UNION ALL SELECT 'meetups_with_location', count(*) FROM public.meetups WHERE location IS NOT NULL
  UNION ALL SELECT 'meetups_priced',        count(*) FROM public.meetups WHERE COALESCE(price_rands,0) > 0
  UNION ALL SELECT 'groups',                count(*) FROM public.groups
  UNION ALL SELECT 'group_messages',        count(*) FROM public.group_messages
  UNION ALL SELECT 'group_msgs_with_media', count(*) FROM public.group_messages WHERE media_url IS NOT NULL
  UNION ALL SELECT 'payments_paid',         count(*) FROM public.payments WHERE status = 'paid'
  UNION ALL SELECT 'content_unlocks',       count(*) FROM public.content_unlocks
  UNION ALL SELECT 'subscriptions_active',  count(*) FROM public.subscriptions WHERE status = 'active'
  UNION ALL SELECT 'wallets_nonzero',       count(*) FROM public.wallets WHERE balance <> 0
  UNION ALL SELECT 'followers',             count(*) FROM public.followers_relationships
) v;
-- NOTE: if this errors on price_rands or followers_relationships, that column or
-- table doesn't exist yet — which is itself a useful answer. Remove the offending
-- line and re-run.


-- ============================================================================
-- Q5 — FORENSICS: were the security holes actually exploited?
-- Three signatures of abuse. Empty results are the good outcome.
--   unlocks_without_payment: a content unlock with no paid payment behind it.
--   subs_without_token:      an active subscription with no PayFast token.
--   wallet_balance_mismatch: balance <> sum of completed transactions. This is
--                            the direct fingerprint of a hand-edited balance.
-- IMPORTANT: rows here are NOT automatically fraud. A legitimate payment path
-- that didn't set payment_id looks identical. Do not delete anything based on
-- this — send me the output and we'll go through it row by row.
-- ============================================================================
SELECT jsonb_pretty(jsonb_build_object(
  'unlocks_without_paid_payment', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'user_id', cu.user_id, 'content_id', cu.content_id,
             'unlock_type', cu.unlock_type, 'payment_id', cu.payment_id,
             'created_at', cu.created_at)), '[]'::jsonb)
    FROM public.content_unlocks cu
    LEFT JOIN public.payments p ON p.id = cu.payment_id
    WHERE cu.payment_id IS NULL OR p.status IS DISTINCT FROM 'paid'
  ),
  'active_subs_without_token', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'subscriber_id', s.subscriber_id, 'creator_id', s.creator_id,
             'amount', s.amount, 'created_at', s.created_at)), '[]'::jsonb)
    FROM public.subscriptions s
    WHERE s.status = 'active' AND s.payfast_token IS NULL
  ),
  'wallet_balance_mismatch', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'user_id', w.user_id, 'balance', w.balance, 'tx_sum', tx.s)), '[]'::jsonb)
    FROM public.wallets w
    CROSS JOIN LATERAL (
      SELECT COALESCE(sum(t.amount), 0) AS s
      FROM public.wallet_transactions t
      WHERE t.wallet_id = w.id AND t.status = 'completed'
    ) tx
    WHERE w.balance <> tx.s
  )
)) AS q5_forensics;


-- ============================================================================
-- Q6 — RUN THIS ALONE, LAST. It may throw an error, and that is the answer.
--
-- public.has_role (20260506035224:24) compares an app_role ENUM column against
-- _role::text. Postgres has no enum = text operator, so this function may have
-- failed at CREATE time — which would mean migration 20260506035224 aborted and
-- roughly fifteen admin-gated policies across 20260615_002 are non-functional.
--
-- Expected good result: false (function works, that fake uuid has no admin role).
-- Bad result: an error mentioning "operator does not exist: app_role = text".
-- Either way, paste exactly what you get.
-- ============================================================================
SELECT public.has_role('00000000-0000-0000-0000-000000000000'::uuid,
                       'admin'::public.app_role) AS q6_has_role_works;
