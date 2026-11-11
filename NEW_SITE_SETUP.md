# Our Untold Story: Rebuild Blueprint

Paste this whole document into another AI builder (Bolt, Lovable, Cursor, etc.) and ask it to rebuild the site the same way. Never paste real passcodes, keys, or the contents of the `.env` file into the prompt. Replace bracketed parts with your own details.

This document is also a recovery plan. If the site is lost, this blueprint plus a backup file (see section 8) is enough to rebuild it with the same look, data, and photos.

---

## 1. What the site is

A private, single-owner memory site for two people. It shows:

- **Since Day One:** a live counter from the anniversary date, with years, months, days, hours, minutes, and seconds.
- **Last Sighting:** a live counter from the last time the two saw each other.
- **Our Memory Lane:** a timeline of dated memories. Each memory has a title, notes, an optional date, an optional photo, and an optional milestone flag. Undated memories appear last.
- **Memory reader:** clicking a memory opens a full-screen, blog-style reading view with Previous and Next navigation. Long notes wrap inside the page.
- **Settings:** anniversary date, last sighting date, private mode (blurs the counters), backup and transfer tools, and a reset button.
- **Sign in with a passcode** instead of email and password (section 5).

## 2. Project basics

- Build with Vite, React 18, TypeScript, and Tailwind CSS 3.
- Use lucide-react for all icons, including logos.
- Use `@/` as the import alias for the `src/` folder (for example `@/components/Foo`).
- Do not add other UI, theme, or icon packages unless requested.
- Verify with `npm run build` before finishing. A type check (`npx tsc --noEmit -p tsconfig.app.json`) is also useful.

## 3. Visual design

**Fonts**
- Headings and big numbers: `Cormorant Garamond` (weights 400, 500, 600), fallback Georgia, serif. Loaded from Google Fonts.
- Body and interface text: `Inter` (weights 300, 400, 500), fallback system-ui, sans-serif.
- Use at most three weights overall. Body line height about 150%. Heading line height about 120%.

**Colors**
- Page background: `#050509`, with an ambient backdrop of soft radial glows. Pink glow `rgba(244, 114, 182, 0.08)` at top left, blue glow `rgba(30, 58, 138, 0.18)` at top right, and a faint pink glow at the bottom.
- Primary accent: pink (`pink-300` to `pink-500`). Used for the heart logo, focus rings, and main buttons (`bg-pink-500/90`).
- Secondary accent: blue, used on the Last Sighting card.
- Panels: settings modal `#0d0d18`, memory lane `#0a0a12` with a frosted blur. Borders are `white/10`.
- Text: white for primary, `white/70` for body, `white/40` to `white/50` for labels and hints. Keep contrast readable.
- Destructive actions: rose (`rose-300` text, `rose-500/90` buttons).
- Warnings: amber. Success: emerald.
- Never use purple, indigo, or violet.

**Shape and motion**
- Cards use `rounded-3xl`. Buttons and chips are full pills. Inputs use `rounded-xl` with a `white/12` border and a pink focus ring.
- Modals fade up in 0.25 seconds. The live dot pulses. Milestone markers ping slowly.
- Spacing follows an 8px grid.
- Memory photos use this exact image class: `mt-3 w-full max-h-[600px] rounded-xl object-contain bg-black/20`.

**Layout**
- Content column max width `3xl`, centered.
- Header: small heart label, large serif title, short subtitle, then Settings and sign-out icon buttons on the right.
- Below the header: a live clock pill, then the two counters, then Memory Lane.
- Every screen works from phone width to desktop. Modals become bottom sheets on phones.

## 4. Data model (Supabase)

Use Supabase for everything that persists. The project is provisioned already. Only use the environment variable names `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL`. Never print their values.

**`memories`**
- `id` (uuid, primary key, generated in the browser so photo paths can use it)
- `user_id` (uuid, owner, default `auth.uid()`)
- `date` (timestamptz, nullable, so a memory can be undated)
- `title` (text), `notes` (text), `milestone` (boolean, default false)
- `photo_path` (text, nullable, points into the private `memories` bucket)
- `created_at` (timestamptz)
- RLS on. Grant `SELECT, INSERT, UPDATE, DELETE` to `authenticated` only. Revoke everything from `anon`. Four policies, each `auth.uid() = user_id`.

**`user_settings`**
- `user_id` (uuid, primary key, owner), `anniversary` (timestamptz), `last_seen` (timestamptz), `privacy` (boolean), `updated_at` (timestamptz).
- Same RLS pattern as `memories`.

**Storage bucket `memories`**
- Private. Maximum 10 MB per file. Allowed types: JPEG, PNG, WebP, GIF, HEIC, HEIF.
- Files are stored at `<user_id>/<memory_id>.<extension>`.
- Four policies on `storage.objects` (select, insert, update, delete), each allowing only `bucket_id = 'memories'` and `(storage.foldername(name))[1] = auth.uid()::text`.
- The app shows photos through signed URLs that last one hour. The app refreshes them each time the page loads.

**Passcode tables** (section 5)
- `passcodes`: owner's bcrypt hash only. No client access.
- `passcode_attempts`: client hash and timestamp. No client access.

## 5. Passcode sign-in

The owner signs in with a private passcode instead of an email and password.

1. Store the passcode only as a salted bcrypt hash in the database (pgcrypto extension, `crypt()` with `gen_salt('bf', 12)`). Never store the plain passcode in a table, file, or log.
2. Create `passcode_attempts` with a client identifier hash and a timestamp. Enable RLS and grant nothing to `anon` or `authenticated`.
3. Create `passcode_login(p_passcode text, p_client text)`:
   - `SECURITY DEFINER`, with `SET search_path = public, extensions, pg_temp`.
   - Raise `PASSCODE_LOCKED` after 5 failures from one client in 15 minutes, or 50 failures overall in one hour.
   - Return the owner's email on a match, otherwise NULL.
   - Revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated`. Grant only to `service_role`.
4. Create edge function `passcode-login` with `verify_jwt = false`:
   - Accept `{ passcode }` by POST, limited to 200 characters.
   - Hash the caller's IP with SHA-256 and pass it as the client identifier.
   - Call `passcode_login` with the service role.
   - Return HTTP 429 with "Too many attempts. Please wait 15 minutes and try again." when locked, and HTTP 401 with "That passcode didn't match." on a mismatch.
   - On success, create a session for the owner (magic-link token verified server-side) and return the access and refresh tokens.
   - Return generic errors only. Log details on the server.
   - Include the required CORS headers on every response.
5. Sign-in screen: passcode field uses `type="password"` with a show/hide eye toggle, disables autofill and autocorrect, clears itself after a failed attempt, and shows the server's message.
6. Never store the passcode or tokens in localStorage beyond what the session library does.

## 6. Feature rules

**Memories**
- Adding a memory: title is required. Date and photo are optional. A new memory starts undated.
- Photos use the file picker with an `image/*` filter and a 10 MB limit. Replacing or removing a photo deletes the old file from storage.
- Deleting a memory also deletes its photo.
- Undated memories sort last and show "Date not set".
- The timeline's path dots skip undated memories.
- Clicking a card opens the reader. Edit and delete buttons on the card stop click propagation so they do not open the reader.
- Reader: Escape closes it, left and right arrow keys move between memories, and long notes wrap inside the card (`whitespace-pre-wrap break-words`).

**Counters**
- Both counters update every second. A date must be in the past to show; otherwise a "not set" card explains how to fix it in Settings.

**Private mode**
- Blurs the counters and disables interaction with them. It is for discretion only, not a security control.

**Gate for changes**
- Adding, editing, and deleting memories is protected by a PIN prompt in the browser. This is a convenience gate only. Anyone with the page can read the code, so do not rely on it for real security. If stronger protection is wanted, move the check into the database.

**Reset**
- "Reset all data" asks for confirmation, then deletes all memory records and restores default dates. Photo files stay in storage and are not removed.

## 7. Shared-data rules

- Derive ownership on the server (`auth.uid()` default), never trust it from the browser.
- Show users generic error messages. Never show raw database text.
- Do not reveal whether an account exists.
- Remove unused files and code.
- Keep `.env` out of version control.

## 8. Backup, restore, and spreadsheet

Open Settings, then "Backup and transfer".

- **Export backup** downloads one JSON file named `our-untold-story-backup-YYYY-MM-DD.json`. It contains:
  - `format`: `our-untold-story-backup`, `version`: 1, `exportedAt`
  - `settings`: anniversary, last sighting, private mode (ISO dates and boolean)
  - `memories`: id, date, title, notes, milestone, and `photo` (file name, MIME type, and the photo embedded as a base64 data URL, or null)
- **Import backup** asks for confirmation, then validates the file format. It adds memories that are new and updates memories with matching ids. It does not delete memories missing from the file. It re-uploads photos to `<user_id>/<memory_id>.<extension>`, then writes memories and settings. The app then reloads your data on screen.
- **Spreadsheet (CSV)** downloads one row per memory: date (YYYY-MM-DD), title, notes, milestone (yes/no), and photo path. Cells starting with `=`, `+`, `-`, or `@` are prefixed with an apostrophe so spreadsheets do not run them as formulas. The file starts with a byte order mark so accented characters display correctly in Excel.
- Backups include photos, so files can be large. Each photo adds its full size.

## 9. Recovery plan

1. Keep this document with the project.
2. Export a backup regularly and store it outside the app (for example, a private cloud folder).
3. Keep the code in GitHub. Connect it from the GitHub icon in the builder's top-right corner.
4. Free Supabase projects pause after about a week of inactivity. They can be restored from the Supabase dashboard within a year. Keep the app used, or upgrade if needed.
5. To rebuild on a new Supabase project:
   - Create the project, then apply the migrations in order: the memories and settings tables, the passcode tables and function, and the photo bucket migration.
   - Point the app's environment variables at the new project.
   - Deploy the `passcode-login` edge function and set the owner's passcode hash.
   - Sign in and import the latest backup file.

## 10. Definition of done

- The site builds without errors.
- Every screen is reachable from the screen before it.
- Sign-in accepts the right passcode, rejects wrong ones, and locks out after repeated failures.
- Memories can be added with or without a date and photo, opened in the reader, edited, and deleted.
- Long notes stay inside the reader.
- Backup export and import keep photos and dates intact.
- Layouts work at phone and desktop widths.
- A short plain-language summary is given at the end of each change.
