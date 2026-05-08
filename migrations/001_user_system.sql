-- Run this against your Supabase project once.
-- 1. Add new columns to public.accounts
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS bio          TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url   TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- 2. Create public.comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug   TEXT        NOT NULL,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted  BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS comments_post_slug_idx ON public.comments(post_slug);
CREATE INDEX IF NOT EXISTS comments_user_id_idx   ON public.comments(user_id);

-- 3. RLS on comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
-- Anyone can read non-deleted comments
CREATE POLICY IF NOT EXISTS "public_read_comments"
  ON public.comments FOR SELECT USING (is_deleted = FALSE);
-- Authenticated users can insert their own
CREATE POLICY IF NOT EXISTS "user_insert_comment"
  ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can soft-delete their own
CREATE POLICY IF NOT EXISTS "user_delete_own_comment"
  ON public.comments FOR UPDATE USING (auth.uid() = user_id);

-- Note: Create a PUBLIC Supabase Storage bucket named "avatars" via the
-- Supabase Dashboard or CLI. RLS policy: allow authenticated users to
-- upload to avatars/{user_id}/avatar.* and allow public reads.
