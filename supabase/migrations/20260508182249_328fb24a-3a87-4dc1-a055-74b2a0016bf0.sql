
-- 1) Restrict agreement_payment_confirmations SELECT to the confirming user only
DROP POLICY IF EXISTS "Authenticated can view confirmations" ON public.agreement_payment_confirmations;
CREATE POLICY "Users view own confirmations"
ON public.agreement_payment_confirmations
FOR SELECT
TO authenticated
USING (confirmed_by = auth.uid());

-- 2) Make group-media bucket private and add membership-gated read policy
UPDATE storage.buckets SET public = false WHERE id = 'group-media';

DROP POLICY IF EXISTS "Group media readable by members" ON storage.objects;
DROP POLICY IF EXISTS "Members upload group media" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete group media" ON storage.objects;

CREATE POLICY "Group media readable by members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'group-media'
  AND public.is_group_member(
    NULLIF((storage.foldername(name))[2], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Members upload group media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.is_group_member(
    NULLIF((storage.foldername(name))[2], '')::uuid,
    auth.uid()
  )
);

CREATE POLICY "Uploaders delete own group media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'group-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 3) Lock down SECURITY DEFINER function execution (revoke from PUBLIC/anon; grant only what RLS/clients need)
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.group_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_join_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_rate(uuid, uuid, uuid) FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.recalc_profile_rating(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_wallet_transaction() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_creator_as_owner() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ratings_after_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.group_role_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_group(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_rate(uuid, uuid, uuid) TO authenticated;
