# Music library setup

This project now includes a private Supabase-backed music library.

## Supabase resources expected

- Private Storage bucket: `music`
- Table: `public.music_tracks`
- Table columns: `id`, `user_id`, `title`, `artist`, `file_path`, `mime_type`, `file_size`, `duration_seconds`, `sort_order`, `created_at`
- Four owner-scoped RLS policies on `music_tracks`
- Four owner-folder-scoped Storage policies on `storage.objects`, each restricted to `bucket_id = 'music'`

The project uses the existing Supabase browser client and current authenticated user session. It never uses a service-role key.

## Audio library behavior

- No autoplay on login.
- Play, pause, previous, next, volume and master ON/OFF controls.
- Volume and master switch are saved in browser local storage per user.
- App uploads use the private path `<auth.uid>/<random-filename>.<extension>`.
- Directly uploaded files in the user's bucket folder are discovered and registered when Refresh is used.
- Supported extensions for app management: MP3, M4A, AAC, OGG, WAV, FLAC and WEBM. Browser playback depends on browser codec support.
- Music management uses the same existing Memory Access Passcode (`19`) as the current Add/Edit/Delete memory gate. This is a UI gate only; Supabase RLS remains the data security boundary.

## Required environment variables

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in your deployment environment. Do not put a Supabase service-role key in the browser app.
