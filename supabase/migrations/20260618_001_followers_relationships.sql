-- Create followers_relationships table
CREATE TABLE public.followers_relationships (
  follower_id uuid NOT NULL,
  following_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CHECK (follower_id != following_id)
);

-- Enable RLS
ALTER TABLE public.followers_relationships ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all followers/following (public stats)
CREATE POLICY "followers_relationships_select_public" 
ON public.followers_relationships 
FOR SELECT 
TO authenticated
USING (true);

-- Policy: Users can insert their own follow relationships
CREATE POLICY "followers_relationships_insert_self" 
ON public.followers_relationships 
FOR INSERT 
TO authenticated
WITH CHECK (follower_id = auth.uid());

-- Policy: Users can delete their own follow relationships
CREATE POLICY "followers_relationships_delete_self" 
ON public.followers_relationships 
FOR DELETE 
TO authenticated
USING (follower_id = auth.uid());

-- Index for fast lookups
CREATE INDEX idx_followers_relationships_follower ON public.followers_relationships(follower_id);
CREATE INDEX idx_followers_relationships_following ON public.followers_relationships(following_id);
