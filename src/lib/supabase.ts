import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export interface UserSettings {
  user_id: string;
  anniversary: string;
  last_seen: string;
  privacy: boolean;
  music_volume?: number;
  updated_at?: string;
}

export interface MemoryRow {
  id: string;
  user_id: string;
  date: string | null;
  title: string;
  notes: string;
  milestone: boolean;
  photo_path: string | null;
  created_at?: string;
}
