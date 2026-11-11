# Storage and sign-in setup

## Vercel environment variables

Set these for Production, Preview, and Development, then redeploy:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use the URL and anon/publishable client key from the Supabase project that contains this app's `memories`, `user_settings`, and `music` data. Never put a Supabase `service_role` key in Vercel client variables.

## Email and password

The app now signs in with Supabase Auth email/password. New accounts can be created from the sign-in screen. If email confirmation is enabled in Supabase Auth, confirm the email before signing in.

## Device passcode

After email/password sign-in, open Settings and create a device passcode. It is stored as a PBKDF2-derived hash in this browser's local storage, not as readable text and not in the old passcode table or old passcode-login Edge Function. When the same browser is reopened with its Supabase session still active, the app asks for the device passcode. This is a same-device convenience lock, not a portable account credential; another device must sign in with email/password and create its own passcode. Clearing browser data removes this local passcode.

## Cloudinary

In Settings, select Cloudinary and enter the Cloud Name and an unsigned Upload Preset. Do not enter an API Secret in the browser. Cloudinary settings and the selected photo provider are stored in this browser. Existing Supabase photo paths continue to load; new uploads and backup restores use the currently selected provider.

Important limitation: unsigned browser uploads do not provide a secure way to delete an asset from Cloudinary. Removing a Cloudinary photo from a memory unlinks it from the memory record but may leave the asset in Cloudinary until deleted from the Cloudinary Media Library. Secure deletion needs a server-side function holding the Cloudinary API Secret.

## Music

The music player continues to use the private Supabase `music` bucket and `music_tracks` table. The existing music-only SQL setup is still required. Music management and memory edit/add/delete gates use the new device passcode.
