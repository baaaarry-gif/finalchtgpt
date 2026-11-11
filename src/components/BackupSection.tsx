import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import type { Memory } from "@/components/MemoryTimeline";
import { downloadBlob } from "@/lib/download";
import { downloadMemoriesCsv } from "@/lib/memoryCsv";
import { buildBackup, restoreBackup, type BackupSettings } from "@/lib/memoryBackup";
import { toDateInputValue } from "@/lib/dates";

interface BackupSectionProps {
  userId: string;
  memories: Memory[];
  settings: BackupSettings;
  onRestored: () => Promise<void>;
}

type Busy = "backup" | "restore" | null;

export function BackupSection({ userId, memories, settings, onRestored }: BackupSectionProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setBusy("backup");
    setMessage(null);
    try {
      const blob = await buildBackup(memories, settings);
      downloadBlob(blob, `our-untold-story-backup-${toDateInputValue(new Date())}.json`);
      setMessage({ tone: "ok", text: "Backup downloaded with your photos included." });
    } catch {
      setMessage({ tone: "error", text: "Could not create the backup. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (!pendingFile) return;
    setBusy("restore");
    setMessage(null);
    try {
      const count = await restoreBackup(pendingFile, userId);
      await onRestored();
      setMessage({ tone: "ok", text: `Restored ${count} ${count === 1 ? "memory" : "memories"} and your last-sighting settings.` });
      setPendingFile(null);
    } catch (cause) {
      const text =
        cause instanceof SyntaxError || (cause instanceof Error && cause.message.includes("not a valid backup"))
          ? "That file is not a valid backup from this site."
          : "Could not restore the backup. Please try again.";
      setMessage({ tone: "error", text });
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-white/40">Backup and transfer</p>
        <p className="mt-1 text-xs text-white/35">
          The backup file holds your dates, memories, and photos. Use it to move to another account or keep a safe copy.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleBackup}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/80 transition hover:border-pink-400/40 hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          {busy === "backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export backup
        </button>
        <button
          type="button"
          onClick={() => downloadMemoriesCsv(memories)}
          disabled={memories.length === 0 || busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/80 transition hover:border-pink-400/40 hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Spreadsheet (CSV)
        </button>
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-white/80 transition hover:border-pink-400/40 hover:text-white disabled:pointer-events-none disabled:opacity-40"
        >
          <Upload className="h-4 w-4" />
          Import backup
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            setMessage(null);
            setPendingFile(e.target.files?.[0] ?? null);
          }}
        />
      </div>

      {pendingFile && (
        <div className="rounded-2xl border border-pink-400/25 bg-pink-500/5 p-4">
          <p className="text-sm text-white">Import “{pendingFile.name}”?</p>
          <p className="mt-1 text-xs text-white/50">
            Memories in the file will be added, or updated if they already exist here. Your other memories stay as they are. Your last-sighting date and privacy setting will be restored; the fixed anniversary stays April 19, 2022 at 4:30 PM.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleRestore}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-pink-400 disabled:opacity-50"
            >
              {busy === "restore" && <Loader2 className="h-4 w-4 animate-spin" />}
              Import
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingFile(null);
                if (fileInput.current) fileInput.current.value = "";
              }}
              disabled={busy !== null}
              className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-white/70 transition hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`text-xs ${message.tone === "ok" ? "text-emerald-300/90" : "text-rose-300"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
