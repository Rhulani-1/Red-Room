
-- ============ GROUPS ============
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  pass_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subscribers_free BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- ============ GROUP MEMBERS ============
CREATE TYPE public.group_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.group_role NOT NULL DEFAULT 'member',
  muted BOOLEAN NOT NULL DEFAULT false,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_members_user ON public.group_members(user_id);
CREATE INDEX idx_group_members_group ON public.group_members(group_id);

-- ============ GROUP PASSES (one-time purchase) ============
CREATE TABLE public.group_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.group_passes ENABLE ROW LEVEL SECURITY;

-- ============ HELPER FUNCTIONS (security definer to avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_group_member(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.group_role_of(_group_id UUID, _user_id UUID)
RETURNS public.group_role
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.group_members
  WHERE group_id = _group_id AND user_id = _user_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_join_group(_group_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator UUID;
  v_subs_free BOOLEAN;
BEGIN
  SELECT creator_id, subscribers_free INTO v_creator, v_subs_free
  FROM public.groups WHERE id = _group_id;

  IF v_creator IS NULL THEN RETURN false; END IF;
  IF v_creator = _user_id THEN RETURN true; END IF;

  -- Active subscription
  IF v_subs_free AND EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE subscriber_id = _user_id AND creator_id = v_creator AND status = 'active'
  ) THEN RETURN true; END IF;

  -- Paid pass
  IF EXISTS (
    SELECT 1 FROM public.group_passes
    WHERE group_id = _group_id AND user_id = _user_id
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

-- ============ GROUP MESSAGES ============
CREATE TYPE public.message_media_type AS ENUM ('none', 'image', 'video', 'voice');

CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  body TEXT,
  media_url TEXT,
  media_type public.message_media_type NOT NULL DEFAULT 'none',
  reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_group_messages_group_created ON public.group_messages(group_id, created_at DESC);

-- ============ REACTIONS ============
CREATE TABLE public.group_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;

-- ============ READS ============
CREATE TABLE public.group_message_reads (
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- groups
CREATE POLICY "Anyone authenticated can view groups"
ON public.groups FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can create groups they own"
ON public.groups FOR INSERT TO authenticated
WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Owner or admin can update group"
ON public.groups FOR UPDATE TO authenticated
USING (creator_id = auth.uid() OR public.group_role_of(id, auth.uid()) IN ('owner','admin'));

CREATE POLICY "Owner can delete group"
ON public.groups FOR DELETE TO authenticated
USING (creator_id = auth.uid());

-- group_members
CREATE POLICY "Members can view their group memberships"
ON public.group_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Eligible users can self-join"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND public.can_join_group(group_id, auth.uid()));

CREATE POLICY "Owner/admin can add members"
ON public.group_members FOR INSERT TO authenticated
WITH CHECK (public.group_role_of(group_id, auth.uid()) IN ('owner','admin'));

CREATE POLICY "Owner/admin can update members"
ON public.group_members FOR UPDATE TO authenticated
USING (public.group_role_of(group_id, auth.uid()) IN ('owner','admin') OR user_id = auth.uid());

CREATE POLICY "Owner/admin or self can remove member"
ON public.group_members FOR DELETE TO authenticated
USING (public.group_role_of(group_id, auth.uid()) IN ('owner','admin') OR user_id = auth.uid());

-- group_passes
CREATE POLICY "Users view own passes"
ON public.group_passes FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service inserts passes"
ON public.group_passes FOR INSERT TO service_role
WITH CHECK (true);

-- group_messages
CREATE POLICY "Members can view group messages"
ON public.group_messages FOR SELECT TO authenticated
USING (public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Members can post messages"
ON public.group_messages FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));

CREATE POLICY "Author can edit own message"
ON public.group_messages FOR UPDATE TO authenticated
USING (author_id = auth.uid());

CREATE POLICY "Author or admin can delete message"
ON public.group_messages FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.group_role_of(group_id, auth.uid()) IN ('owner','admin'));

-- reactions
CREATE POLICY "Members view reactions"
ON public.group_message_reactions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id = message_id AND public.is_group_member(m.group_id, auth.uid())));

CREATE POLICY "Members add own reactions"
ON public.group_message_reactions FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id = message_id AND public.is_group_member(m.group_id, auth.uid())));

CREATE POLICY "Users remove own reactions"
ON public.group_message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- reads
CREATE POLICY "Members view reads in their groups"
ON public.group_message_reads FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id = message_id AND public.is_group_member(m.group_id, auth.uid())));

CREATE POLICY "Members mark own reads"
ON public.group_message_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.group_messages m WHERE m.id = message_id AND public.is_group_member(m.group_id, auth.uid())));

-- ============ TRIGGERS ============
CREATE TRIGGER update_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_group_messages_updated_at
BEFORE UPDATE ON public.group_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-add creator as owner member
CREATE OR REPLACE FUNCTION public.add_creator_as_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER groups_after_insert_add_owner
AFTER INSERT ON public.groups
FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_owner();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
ALTER TABLE public.group_message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.group_message_reads REPLICA IDENTITY FULL;
ALTER TABLE public.group_members REPLICA IDENTITY FULL;

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-media', 'group-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read group-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-media');

CREATE POLICY "Auth upload group-media in own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'group-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Auth update own group-media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'group-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Auth delete own group-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'group-media' AND auth.uid()::text = (storage.foldername(name))[1]);
