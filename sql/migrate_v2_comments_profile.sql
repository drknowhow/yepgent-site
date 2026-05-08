-- yepgent-site v2: extended profiles + comments
-- Apply in Supabase SQL editor (Dashboard → SQL Editor)

-- 1. Extend accounts table
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}';

-- 2. Comments table
CREATE TABLE IF NOT EXISTS comments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_slug    text        NOT NULL,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_display text      NOT NULL DEFAULT '',
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  parent_id    uuid        REFERENCES comments(id) ON DELETE CASCADE,
  is_deleted   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_post_slug_idx ON comments(post_slug) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS comments_user_id_idx   ON comments(user_id);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='public_read') THEN
    CREATE POLICY public_read   ON comments FOR SELECT USING (NOT is_deleted);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='auth_insert') THEN
    CREATE POLICY auth_insert   ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='comments' AND policyname='owner_update') THEN
    CREATE POLICY owner_update  ON comments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
