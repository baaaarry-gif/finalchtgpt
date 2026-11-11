import { supabase, type MemoryRow } from "@/lib/supabase";
import type { Memory } from "@/components/MemoryTimeline";
import { getCloudinaryConfig, getPhotoProvider, parseCloudinaryPath } from "@/lib/storageConfig";
import { FIXED_ANNIVERSARY } from "@/lib/constants";

const FORMAT = "our-untold-story-backup";
const VERSION = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BackupSettings {
  anniversary: string;
  lastSeen: string;
  privacy: boolean;
}

interface BackupPhoto {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  /** Original storage provider, preserved independently of the currently selected provider. */
  provider?: "supabase" | "cloudinary";
}

interface BackupMemory {
  id: string;
  date: string | null;
  title: string;
  notes: string;
  milestone: boolean;
  photo: BackupPhoto | null;
}

interface BackupFile {
  format: typeof FORMAT;
  version: 1 | typeof VERSION;
  exportedAt: string;
  settings: BackupSettings;
  memories: BackupMemory[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function exportPhoto(path: string): Promise<BackupPhoto> {
  const cloud = parseCloudinaryPath(path);
  let data: Blob;
  if (cloud) { const response = await fetch(cloud.url); if (!response.ok) throw new Error("Cloudinary photo download failed"); data = await response.blob(); }
  else { const result = await supabase.storage.from("memories").download(path); if (result.error || !result.data) throw result.error ?? new Error("Photo download failed"); data = result.data; }
  return {
    fileName: path.split("/").pop() ?? "photo",
    mimeType: data.type || "image/jpeg",
    dataUrl: await blobToDataUrl(data),
    provider: cloud ? "cloudinary" : "supabase",
  };
}

export async function buildBackup(memories: Memory[], settings: BackupSettings): Promise<Blob> {
  const exported = await Promise.all(
    memories.map(async (m): Promise<BackupMemory> => ({
      id: m.id,
      date: m.date,
      title: m.title,
      notes: m.notes,
      milestone: !!m.milestone,
      photo: m.photoPath ? await exportPhoto(m.photoPath) : null,
    }))
  );
  const file: BackupFile = {
    format: FORMAT,
    version: VERSION,
    exportedAt: new Date().toISOString(),
    settings: { ...settings, anniversary: FIXED_ANNIVERSARY },
    memories: exported,
  };
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

function isBackupMemory(value: unknown, version: 1 | 2): value is BackupMemory {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    UUID_PATTERN.test(m.id) &&
    (m.date === null || typeof m.date === "string") &&
    typeof m.title === "string" &&
    typeof m.notes === "string" &&
    typeof m.milestone === "boolean" &&
    (m.photo === null ||
      (typeof m.photo === "object" &&
        m.photo !== null &&
        typeof (m.photo as BackupPhoto).fileName === "string" &&
        typeof (m.photo as BackupPhoto).mimeType === "string" &&
        typeof (m.photo as BackupPhoto).dataUrl === "string" &&
        (m.photo as BackupPhoto).dataUrl.startsWith("data:image/") &&
        ((m.photo as BackupPhoto).provider === undefined ||
          (m.photo as BackupPhoto).provider === "supabase" ||
          (m.photo as BackupPhoto).provider === "cloudinary") &&
        (version === 1 ||
          (m.photo as BackupPhoto).provider === "supabase" ||
          (m.photo as BackupPhoto).provider === "cloudinary")))
  );
}

function parseBackup(value: unknown): BackupFile {
  const f = value as Partial<BackupFile> | null;
  const s = f?.settings as Partial<BackupSettings> | undefined;
  if (
    !f ||
    f.format !== FORMAT ||
    (f.version !== 1 && f.version !== VERSION) ||
    !s ||
    typeof s.anniversary !== "string" ||
    typeof s.lastSeen !== "string" ||
    typeof s.privacy !== "boolean" ||
    !Array.isArray(f.memories) ||
    !f.memories.every((memory) => isBackupMemory(memory, f.version as 1 | 2))
  ) {
    throw new Error("This file is not a valid backup.");
  }
  return f as BackupFile;
}

function photoExtension(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : "jpg";
}

export async function restoreBackup(file: File, userId: string): Promise<number> {
  const backup = parseBackup(JSON.parse(await file.text()));

  const rows: MemoryRow[] = [];
  for (const m of backup.memories) {
    let photoPath: string | null = null;
    if (m.photo) {
      const blob = await (await fetch(m.photo.dataUrl)).blob();
      // New backups restore each photo to the provider it originally came from.
      // Version 1 backups did not record this, so retain the legacy behavior and
      // use the currently selected provider for those older files.
      const photoProvider = m.photo.provider ?? getPhotoProvider();
      if (photoProvider === "cloudinary") {
        const config = getCloudinaryConfig();
        if (!config.cloudName || !config.uploadPreset) throw new Error("Configure Cloudinary in Settings before restoring this backup.");
        const body = new FormData(); body.append("file", blob, m.photo.fileName); body.append("upload_preset", config.uploadPreset); body.append("folder", `our-untold-story/${userId}`); body.append("public_id", m.id);
        const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`, { method: "POST", body }); const result = await response.json();
        if (!response.ok || !result.secure_url || !result.public_id) throw new Error(result.error?.message || "Cloudinary restore upload failed.");
        photoPath = `cloudinary:${encodeURIComponent(result.public_id)}|${result.secure_url}`;
      } else {
        photoPath = `${userId}/${m.id}.${photoExtension(m.photo.fileName)}`;
        const { error: uploadError } = await supabase.storage.from("memories").upload(photoPath, blob, { contentType: m.photo.mimeType, upsert: true });
        if (uploadError) throw uploadError;
      }
    }
    rows.push({
      id: m.id,
      user_id: userId,
      date: m.date,
      title: m.title,
      notes: m.notes,
      milestone: m.milestone,
      photo_path: photoPath,
    });
  }

  if (rows.length) {
    const { error } = await supabase.from("memories").upsert(rows);
    if (error) throw error;
  }

  const { error: settingsError } = await supabase.from("user_settings").upsert({
    user_id: userId,
    anniversary: FIXED_ANNIVERSARY,
    last_seen: backup.settings.lastSeen,
    privacy: backup.settings.privacy,
    updated_at: new Date().toISOString(),
  });
  if (settingsError) throw settingsError;

  return rows.length;
}
