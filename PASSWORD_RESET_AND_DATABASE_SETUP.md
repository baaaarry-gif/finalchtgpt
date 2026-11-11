# Supabase setup for the updated site

## Password reset redirect

In Supabase Dashboard, open **Authentication → URL Configuration**.

- Site URL: `https://newwchtgpp.vercel.app`
- Redirect URL: `https://newwchtgpp.vercel.app/**`

The login screen sends reset emails to `https://newwchtgpp.vercel.app/reset-password`. The included Vercel rewrite serves the app at that path, and the reset page lets the user enter and confirm a new Supabase Auth password.

## Apply the new database migration

Before deploying the updated site, open **Supabase → SQL Editor**, paste the contents of:

`supabase/migrations/20261111000000_fixed_anniversary_music_volume.sql`

Run it once. It adds the account-level `music_volume` field and sets existing account anniversary timestamps to the fixed Day 1 instant (April 19, 2022 at 4:30 PM India time).

The app itself also enforces that fixed anniversary in its counter, Settings, JSON export, JSON import, and reset/default flows.
