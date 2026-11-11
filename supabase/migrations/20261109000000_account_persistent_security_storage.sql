-- Account-scoped passcode and photo-provider configuration.
-- Existing memories, photo_path values, and storage objects are untouched.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS passcode_salt text,
  ADD COLUMN IF NOT EXISTS passcode_hash text,
  ADD COLUMN IF NOT EXISTS photo_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS cloudinary_cloud_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS cloudinary_upload_preset text NOT NULL DEFAULT '';

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_photo_provider_check;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_photo_provider_check
  CHECK (photo_provider IN ('supabase', 'cloudinary'));
