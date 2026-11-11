/*
# Create share_links table (protective read-only links)

## Purpose
Lets a signed-in owner generate an unguessable private link that gives
anyone holding it a read-only view of their "Our Untold Story" counters and
memories. The owner can regenerate or revoke the link at any time.

## New Table
- `share_links`
  - `id` (uuid, primary key)
  - `owner_id` (uuid, not null, defaults to auth.uid(), references auth.users, cascade)
  - `token` (text, unique, not null) — the unguessable path segment in the URL
  - `label` (text, default 'Protective link') — friendly name
  - `revoked` (boolean, default false)
  - `created_at` (timestamptz)
  - `last_used_at` (timestamptz, nullable)

There is at most one active (non-revoked) link per owner, enforced by a
partial unique index so a new generate call must revoke/replace the previous.

## Security
- RLS enabled.
- Owner-only CRUD: `TO authenticated` with `auth.uid() = owner_id`.
- The public share-view path does NOT read this table directly via the anon
  key. It is served by an edge function using the service role key, which
  bypasses RLS but still requires the table grant. The service_role grant is
  therefore included.
- `anon` has NO direct access to `share_links`, `user_settings`, or
  `memories` — the public view is only possible via the edge function, which
  validates the token, checks `revoked = false`, and returns only the
  non-sensitive fields needed to render the read-only story.

## Notes
- Idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
- No destructive changes to existing tables.
*/

CREATE TABLE IF NOT EXISTS share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  label text NOT NULL DEFAULT 'Protective link',
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON share_links TO authenticated;
GRANT SELECT, INSERT, UPDATE ON share_links TO service_role;

DROP POLICY IF EXISTS "select_own_share_links" ON share_links;
CREATE POLICY "select_own_share_links"
  ON share_links FOR SELECT
  TO authenticated USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "insert_own_share_links" ON share_links;
CREATE POLICY "insert_own_share_links"
  ON share_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "update_own_share_links" ON share_links;
CREATE POLICY "update_own_share_links"
  ON share_links FOR UPDATE
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "delete_own_share_links" ON share_links;
CREATE POLICY "delete_own_share_links"
  ON share_links FOR DELETE
  TO authenticated USING (auth.uid() = owner_id);

-- One active link per owner
CREATE UNIQUE INDEX IF NOT EXISTS share_links_one_active_per_owner
  ON share_links (owner_id) WHERE revoked = false;

-- Also grant service_role read access to the data it must serve
GRANT SELECT ON user_settings TO service_role;
GRANT SELECT ON memories TO service_role;
