-- Storage bucket RLS policies for posts, profile avatars, and group media
-- These buckets will be created manually in the Supabase dashboard

-- Posts bucket: users can upload their own, everyone can download
DROP POLICY IF EXISTS "posts_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "posts_download_public" ON storage.objects;

CREATE POLICY "posts_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'posts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "posts_download_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'posts');

-- Profile avatars: users can upload their own, everyone can download
DROP POLICY IF EXISTS "profile_avatars_upload_own" ON storage.objects;
DROP POLICY IF EXISTS "profile_avatars_download_public" ON storage.objects;

CREATE POLICY "profile_avatars_upload_own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "profile_avatars_download_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');

-- Group media: members can upload/delete, everyone can download
DROP POLICY IF EXISTS "group_media_upload_members" ON storage.objects;
DROP POLICY IF EXISTS "group_media_delete_members" ON storage.objects;
DROP POLICY IF EXISTS "group_media_download_public" ON storage.objects;

CREATE POLICY "group_media_upload_members"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'group-media'
  AND EXISTS (
    SELECT 1 FROM group_members 
    WHERE user_id = auth.uid() 
    AND group_id = (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "group_media_delete_members"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'group-media'
  AND EXISTS (
    SELECT 1 FROM group_members 
    WHERE user_id = auth.uid() 
    AND group_id = (storage.foldername(name))[1]::uuid
  )
);

CREATE POLICY "group_media_download_public"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'group-media');
