-- Keep the account's music volume across sessions and devices.
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS music_volume numeric NOT NULL DEFAULT 0.65;

ALTER TABLE public.user_settings
  DROP CONSTRAINT IF EXISTS user_settings_music_volume_check;
ALTER TABLE public.user_settings
  ADD CONSTRAINT user_settings_music_volume_check
  CHECK (music_volume >= 0 AND music_volume <= 1);

-- Enforce the fixed Day 1 value for all existing account settings rows.
UPDATE public.user_settings
SET anniversary = TIMESTAMPTZ '2022-04-19 11:00:00+00'
WHERE anniversary IS DISTINCT FROM TIMESTAMPTZ '2022-04-19 11:00:00+00';
