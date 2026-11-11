import type { Memory } from "@/components/MemoryTimeline";
import { toDateInputValue } from "@/lib/dates";
import { downloadBlob } from "@/lib/download";

const HEADERS = ["date", "title", "notes", "milestone", "photo_path"];

function escapeCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export function memoriesToCsv(memories: Memory[]): string {
  const rows = memories.map((m) =>
    [
      m.date ? toDateInputValue(new Date(m.date)) : "",
      m.title,
      m.notes,
      m.milestone ? "yes" : "no",
      m.photoPath ?? "",
    ]
      .map(escapeCell)
      .join(",")
  );
  return [HEADERS.join(","), ...rows].join("\r\n");
}

export function downloadMemoriesCsv(memories: Memory[]) {
  const blob = new Blob(["\uFEFF" + memoriesToCsv(memories)], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, `memories-${toDateInputValue(new Date())}.csv`);
}
