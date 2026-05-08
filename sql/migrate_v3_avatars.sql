-- yepgent-site v3: profile avatars
-- Apply in Supabase SQL editor (Dashboard → SQL Editor)
--
-- Adds:
--   accounts.avatar_url    text (nullable)
--   storage bucket 'avatars' (public read)
--   RLS on storage.objects so each user can write only their own folder
--
-- Path convention: avatars/<user_id>/avatar.<ext>
-- Public URL    : <SUPABASE_URL>/storage/v1/object/public/avatars/<user_id>/avatar.<ext>

-- 1. Profile column ------------------------------------------------------
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Storage bucket ------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5 * 1024 * 1024,                                       -- 5 MB hard cap
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. RLS policies on storage.objects ------------------------------------
-- Public read of any object in the avatars bucket.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='avatars_public_read'
  ) THEN
    CREATE POLICY avatars_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  -- Authenticated users can insert into their own folder.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='avatars_owner_insert'
  ) THEN
    CREATE POLICY avatars_owner_insert
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'avatars'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Owner can update (overwrite) their own files.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='avatars_owner_update'
  ) THEN
    CREATE POLICY avatars_owner_update
      ON storage.objects FOR UPDATE
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Owner can delete their own files.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='avatars_owner_delete'
  ) THEN
    CREATE POLICY avatars_owner_delete
      ON storage.objects FOR DELETE
      USING (
        bucket_id = 'avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
