-- Posts. Matches what the app already writes and reads:
--   insert: src/pages/Create.tsx  (creator_id, description, is_sensitive, post_type)
--   select: src/pages/Profile.tsx (id, description, is_sensitive, post_type, created_at)
--
-- media_url is included now so post media upload does not need a second migration
-- once the storage buckets exist.
--
-- Idempotent throughout: safe to re-run, and cannot halt a migration chain.

CREATE TABLE IF NOT EXISTS public.post_metadata (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description  text,
  is_sensitive boolean NOT NULL DEFAULT false,
  post_type    text NOT NULL DEFAULT 'text' CHECK (post_type IN ('text','media')),
  media_url    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_metadata_creator_created_idx
  ON public.post_metadata (creator_id, created_at DESC);

ALTER TABLE public.post_metadata ENABLE ROW LEVEL SECURITY;

-- Readable by signed-in users only. NOT public: posts can be flagged sensitive, and
-- anonymous read is how this project's other tables went wrong.
DROP POLICY IF EXISTS post_metadata_select_authenticated ON public.post_metadata;
CREATE POLICY post_metadata_select_authenticated
  ON public.post_metadata FOR SELECT TO authenticated
  USING (true);

-- WITH CHECK on both INSERT and UPDATE. Without it on UPDATE a row can be edited to
-- belong to someone else — the exact bug found on the profiles table.
DROP POLICY IF EXISTS post_metadata_insert_own ON public.post_metadata;
CREATE POLICY post_metadata_insert_own
  ON public.post_metadata FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS post_metadata_update_own ON public.post_metadata;
CREATE POLICY post_metadata_update_own
  ON public.post_metadata FOR UPDATE TO authenticated
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS post_metadata_delete_own ON public.post_metadata;
CREATE POLICY post_metadata_delete_own
  ON public.post_metadata FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_post_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_metadata_touch ON public.post_metadata;
CREATE TRIGGER post_metadata_touch
  BEFORE UPDATE ON public.post_metadata
  FOR EACH ROW EXECUTE FUNCTION public.touch_post_metadata();
