/*
# Add optional memory dates and private memory photos

## Plain-English summary
Memories can now be created without a date and can optionally include one image.
Images are kept in a private Supabase Storage bucket named `memories`. Each signed-in
user's files live inside a folder named with that user's account ID, so a user cannot
read, replace, or delete another user's images through the browser.

## Modified table
- `memories`
  - `date` is now nullable because a memory may be undated.
  - `photo_path` (text, nullable) stores the private Storage object path for the
    optional photo. It does not store the image itself.

## New storage configuration
- Private bucket `memories`.
- Image uploads are limited to common image MIME types and 10 MB.
- Storage object policies allow authenticated users to manage only objects in their
  own `<user-id>/...` folder.

## Security
- Anonymous access to `memories` is revoked; the signed-in app continues to use
  owner-scoped authenticated policies.
- Storage SELECT, INSERT, UPDATE, and DELETE policies are separate and scoped to
  the current authenticated user's folder.

## Important notes
1. Existing memory rows and their existing dates are preserved.
2. Existing rows receive a null `photo_path` and remain valid.
3. Photo paths are private object identifiers; the app must use short-lived signed
   URLs when displaying images.
*/

ALTER TABLE public.memories
  ALTER COLUMN date DROP NOT NULL;

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS photo_path text;

REVOKE ALL ON public.memories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memories TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memories',
  'memories',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];

DROP POLICY IF EXISTS "memory_photos_select_own_folder" ON storage.objects;
CREATE POLICY "memory_photos_select_own_folder"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "memory_photos_insert_own_folder" ON storage.objects;
CREATE POLICY "memory_photos_insert_own_folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "memory_photos_update_own_folder" ON storage.objects;
CREATE POLICY "memory_photos_update_own_folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "memory_photos_delete_own_folder" ON storage.objects;
CREATE POLICY "memory_photos_delete_own_folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'memories'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );