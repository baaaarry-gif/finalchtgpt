import { supabase } from "@/lib/supabase";
export type PhotoProvider = "supabase" | "cloudinary";
export interface CloudinaryConfig { cloudName: string; uploadPreset: string }
const providerKey = "ous.photo-provider.v1";
const cloudinaryKey = "ous.cloudinary-config.v1";
export function getPhotoProvider(): PhotoProvider { return localStorage.getItem(providerKey) === "cloudinary" ? "cloudinary" : "supabase"; }
export function getCloudinaryConfig(): CloudinaryConfig { try { return JSON.parse(localStorage.getItem(cloudinaryKey) || "{}"); } catch { return { cloudName: "", uploadPreset: "" }; } }
export async function loadAccountStorageConfig(userId: string) {
  const { data, error } = await supabase.from("user_settings").select("photo_provider,cloudinary_cloud_name,cloudinary_upload_preset").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  const provider: PhotoProvider = data?.photo_provider === "cloudinary" ? "cloudinary" : "supabase";
  const config = { cloudName: data?.cloudinary_cloud_name ?? "", uploadPreset: data?.cloudinary_upload_preset ?? "" };
  localStorage.setItem(providerKey, provider); localStorage.setItem(cloudinaryKey, JSON.stringify(config));
  return { provider, config };
}
export async function saveAccountStorageConfig(userId: string, provider: PhotoProvider, config: CloudinaryConfig) {
  const { error } = await supabase.from("user_settings").upsert({ user_id: userId, photo_provider: provider, cloudinary_cloud_name: config.cloudName, cloudinary_upload_preset: config.uploadPreset, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  setPhotoProvider(provider); saveCloudinaryConfig(config);
}
export function saveCloudinaryConfig(config: CloudinaryConfig) { localStorage.setItem(cloudinaryKey, JSON.stringify(config)); }
export function setPhotoProvider(provider: PhotoProvider) { localStorage.setItem(providerKey, provider); }
export function cloudinaryPath(publicId: string, url: string) { return `cloudinary:${encodeURIComponent(publicId)}|${url}`; }
export function parseCloudinaryPath(path: string) { if (!path.startsWith("cloudinary:")) return null; const [id, url] = path.slice(11).split("|"); return { publicId: decodeURIComponent(id), url }; }
