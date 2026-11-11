/*
# Create user_settings and memories tables (multi-user, owner-scoped)

## Purpose
"Our Untold Story" is a private personal site. Each signed-in user has their
own anniversary date, last-sighting date, privacy flag, and a collection of
memories. Data must travel with the user across browsers, so it lives in
Supabase behind owner-scoped row-level security.

## New Tables

1. `user_settings` — one row per user
   - `user_id` (uuid, primary key, defaults to auth.uid())
   - `anniversary` (timestamptz, the "Day 1" date)
   - `last_seen` (timestamptz, the last-sighting date)
   - `privacy` (boolean, default false)
   - `updated_at` (timestamptz, auto-maintained)

2. `memories` — many rows per user
   - `id` (uuid, primary key)
   - `user_id` (uuid, not null, defaults to auth.uid(), cascades on user delete)
   - `date` (timestamptz, when the memory happened)
   - `title` (text, not null)
   - `notes` (text, default '')
   - `milestone` (boolean, default false)
   - `created_at` (timestamptz)

## Security
- RLS enabled on both tables.
- All four CRUD policies per table, scoped `TO authenticated` with
  `auth.uid() = user_id` ownership checks.
- `user_id` defaults to `auth.uid()` so inserts from the client that omit
  `user_id` still satisfy the WITH CHECK policy.

## Notes
- No destructive operations; idempotent creation with IF NOT EXISTS.
- Policies are dropped before recreate to keep re-runs safe.
*/

-- user_settings -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  anniversary timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  privacy boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON user_settings;
CREATE POLICY "select_own_settings"
  ON user_settings FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_settings" ON user_settings;
CREATE POLICY "insert_own_settings"
  ON user_settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_settings" ON user_settings;
CREATE POLICY "update_own_settings"
  ON user_settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_settings" ON user_settings;
CREATE POLICY "delete_own_settings"
  ON user_settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- memories ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  notes text NOT NULL DEFAULT '',
  milestone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_memories" ON memories;
CREATE POLICY "select_own_memories"
  ON memories FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_memories" ON memories;
CREATE POLICY "insert_own_memories"
  ON memories FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_memories" ON memories;
CREATE POLICY "update_own_memories"
  ON memories FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_memories" ON memories;
CREATE POLICY "delete_own_memories"
  ON memories FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- helpful index for timeline ordering
CREATE INDEX IF NOT EXISTS memories_user_date_idx ON memories (user_id, date);
