-- Add unread message tracking to group_members
ALTER TABLE public.group_members 
ADD COLUMN last_read_at timestamp with time zone DEFAULT now();

-- Index for finding unread counts
CREATE INDEX idx_group_members_last_read_at ON public.group_members(last_read_at, group_id, user_id);

-- Comment for clarity
COMMENT ON COLUMN public.group_members.last_read_at IS 'Timestamp of when member last read group messages. Use to compute unread count: COUNT(messages WHERE created_at > last_read_at)';
