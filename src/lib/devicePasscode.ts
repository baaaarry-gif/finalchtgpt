import { supabase } from "@/lib/supabase";

const encoder = new TextEncoder();
async function derive(passcode: string, salt: Uint8Array): Promise<string> {
  const material = await crypto.subtle.importKey("raw", encoder.encode(passcode), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 210000, hash: "SHA-256" }, material, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, "0")).join("");
}
function hex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }

// Passcodes are account-scoped: they follow the authenticated user across browsers/devices.
export async function hasDevicePasscode(userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_settings").select("passcode_hash").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return !!data?.passcode_hash;
}
export async function saveDevicePasscode(userId: string, passcode: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(passcode, salt);
  const { error } = await supabase.from("user_settings").upsert({ user_id: userId, passcode_salt: hex(salt), passcode_hash: hash, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}
export async function verifyDevicePasscode(userId: string, passcode: string): Promise<boolean> {
  const { data, error } = await supabase.from("user_settings").select("passcode_salt,passcode_hash").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data?.passcode_salt || !data?.passcode_hash) return false;
  const salt = new Uint8Array((data.passcode_salt.match(/.{2}/g) ?? []).map((v: string) => parseInt(v, 16)));
  const actual = await derive(passcode, salt);
  if (actual.length !== data.passcode_hash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ data.passcode_hash.charCodeAt(i);
  return diff === 0;
}
