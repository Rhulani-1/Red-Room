-- Creates the two storage buckets whose access policies already exist but whose
-- buckets were never created (20260622_005 wrote policies for buckets that don't
-- exist, so media upload could never work).
--
-- Both are PRIVATE. The posts bucket especially: it holds paid and sensitive media,
-- and a public bucket serves objects without consulting any policy at all. Reads go
-- through signed URLs, the pattern GroupChat already uses successfully.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts', 'posts', false, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars', 'profile-avatars', true, 5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
-- Avatars stay public: they are meant to be visible to everyone, including
-- signed-out visitors, and contain nothing sensitive.

-- Owner-scoped writes. Path convention is {user_id}/{filename}, matching the
-- existing policies from 20260622_005.
DROP POLICY IF EXISTS "posts_upload_own" ON storage.objects;
CREATE POLICY "posts_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "posts_update_own" ON storage.objects;
CREATE POLICY "posts_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "posts_delete_own" ON storage.objects;
CREATE POLICY "posts_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "profile_avatars_upload_own" ON storage.objects;
CREATE POLICY "profile_avatars_upload_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "profile_avatars_update_own" ON storage.objects;
CREATE POLICY "profile_avatars_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "profile_avatars_delete_own" ON storage.objects;
CREATE POLICY "profile_avatars_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile-avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
