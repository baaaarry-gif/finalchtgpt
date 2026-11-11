import { useEffect, useMemo, useState } from "react";
import {
  Pencil,
  Plus,
  Trash2,
  X,
  Heart,
  CalendarDays,
  Save,
  Sparkles,
  Shield,
  Loader2,
  ImagePlus,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Star,
  
} from "lucide-react";
import { formatLongDate, parseDateInput, toDateInputValue } from "@/lib/dates";

export interface Memory {
  id: string;
  date: string | null;
  title: string;
  notes: string;
  milestone?: boolean;
  photoPath?: string | null;
  photoUrl?: string | null;
}

interface MemoryTimelineProps {
  memories: Memory[];
  onChange: (memories: Memory[]) => void;
  anniversary: Date;
  uploadPhoto: (file: File, memoryId: string) => Promise<{ path: string; url: string }>;
  removePhoto: (path: string) => Promise<void>;
  verifyPasscode: (code: string) => Promise<boolean>;
}


type PendingAction =
  | { type: "new" }
  | { type: "edit"; memory: Memory }
  | { type: "delete"; id: string }
  | null;

/** Season-based accent palette for each memory card. */
function seasonStyle(date: Date): {
  glow: string;
  border: string;
  dot: string;
  chip: string;
  emoji: string;
} {
  const m = date.getMonth();
  if (m >= 2 && m <= 4)
    return {
      glow: "from-rose-500/8 to-rose-400/3",
      border: "hover:border-rose-400/40",
      dot: "bg-rose-400",
      chip: "bg-rose-500/15 text-rose-200",
      emoji: "🌸",
    };
  if (m >= 5 && m <= 7)
    return {
      glow: "from-amber-500/8 to-amber-400/3",
      border: "hover:border-amber-400/40",
      dot: "bg-amber-400",
      chip: "bg-amber-500/15 text-amber-200",
      emoji: "☀️",
    };
  if (m >= 8 && m <= 10)
    return {
      glow: "from-orange-600/8 to-orange-500/3",
      border: "hover:border-orange-400/40",
      dot: "bg-orange-400",
      chip: "bg-orange-500/15 text-orange-200",
      emoji: "🍂",
    };
  return {
    glow: "from-sky-500/8 to-sky-400/3",
    border: "hover:border-sky-400/40",
    dot: "bg-sky-300",
    chip: "bg-sky-500/15 text-sky-200",
    emoji: "❄️",
  };
}

function timeAgo(date: Date, now: Date): string {
  const ms = now.getTime() - date.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = (months / 12).toFixed(1);
  return `${years} year${years === "1.0" ? "" : "s"} ago`;
}

function ordinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function MemoryTimeline({
  memories,
  onChange,
  anniversary,
  uploadPhoto,
  removePhoto,
  verifyPasscode,
}: MemoryTimelineProps) {
  const [editing, setEditing] = useState<Memory | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [reading, setReading] = useState<Memory | null>(null);

  const sorted = useMemo(
    () =>
      [...memories].sort(
        (a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
      ),
    [memories]
  );

  const executeAction = (action: PendingAction) => {
    if (!action) return;
    if (action.type === "new") {
      setEditing({
        id: crypto.randomUUID(),
        date: null,
        title: "",
        notes: "",
        milestone: false,
      });
      setIsNew(true);
    } else if (action.type === "edit") {
      setEditing(action.memory);
      setIsNew(false);
    } else if (action.type === "delete") {
      onChange(memories.filter((x) => x.id !== action.id));
    }
  };

  const save = (m: Memory) => {
    if (!m.title.trim()) return;
    if (isNew) {
      onChange([...memories, m]);
    } else {
      onChange(memories.map((x) => (x.id === m.id ? m : x)));
    }
    setEditing(null);
  };

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-5 sm:p-8 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl text-white">
            Our Memory Lane
          </h2>
          <p className="mt-1 text-sm text-white/50">
            A little path of moments, each one a piece of us.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPending({ type: "new" })}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-pink-500/90 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-pink-500 hover:shadow-lg hover:shadow-pink-500/20"
        >
          <Plus className="h-4 w-4" /> Add Memory
        </button>
      </div>

      <MemoryPath memories={sorted} anniversary={anniversary} />

      {/* Wandering timeline */}
      <ol className="mt-8 relative space-y-1">
        {sorted.length === 0 && (
          <li className="py-8 text-center">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
                <Sparkles className="h-6 w-6 text-pink-300/60" />
              </div>
              <p className="text-white/40 text-sm italic max-w-xs">
                Nothings to remember yet — tap “Add Memory” to begin your story.
              </p>
            </div>
          </li>
        )}

        {sorted.map((m, i) => {
          const d = m.date ? new Date(m.date) : null;
          const s = seasonStyle(d ?? new Date(0));
          const side = i % 2 === 0;

          return (
            <li key={m.id} className="relative group animate-fade-up">
              <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-white/5 via-white/10 to-white/5 sm:-translate-x-1/2" />

              <div className="absolute left-4 sm:left-1/2 top-6 -translate-x-1/2 z-10">
                <div
                  className={`h-3.5 w-3.5 rounded-full ${s.dot} ring-4 ring-[#0a0a12] transition-transform group-hover:scale-125`}
                />
                {m.milestone && (
                  <div className="absolute -top-1 -left-1 h-5.5 w-5.5 animate-ping-slow rounded-full bg-pink-400/20" />
                )}
              </div>

              <div
                className={`pl-12 sm:pl-0 ${
                  side ? "sm:w-1/2 sm:pr-8" : "sm:w-1/2 sm:ml-auto sm:pl-8"
                }`}
              >
                <div
                  className={`relative cursor-pointer rounded-2xl border border-white/10 bg-gradient-to-br ${s.glow} to-transparent p-4 sm:p-5 transition-all duration-200 ${s.border} group-hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 focus:outline-none focus:ring-2 focus:ring-pink-400/60`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setReading(m)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setReading(m);
                    }
                  }}
                >
                  {m.milestone && (
                    <div className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-pink-500 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white shadow-lg shadow-pink-500/30">
                      <Heart className="h-2.5 w-2.5 fill-white" />
                      Milestone
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${s.chip}`}
                        >
                          <CalendarDays className="h-3 w-3" />
                          {d ? formatLongDate(d) : "Date not set"}
                        </span>
                        <span className="text-[11px] text-white/35">
                          {ordinalSuffix(i + 1)} memory
                        </span>
                      </div>

                      <h3 className="mt-2.5 font-serif text-xl text-white leading-snug">
                        {m.title}
                      </h3>

                      {m.notes && (
                        <p className="mt-2 text-sm text-white/60 whitespace-pre-wrap break-words leading-relaxed">
                          {m.notes}
                        </p>
                      )}

                      {m.photoUrl && (
  <div className="relative mt-3">
    <img
      src={m.photoUrl}
      alt={`Photo for ${m.title}`}
      className="w-full max-h-[600px] rounded-xl object-contain bg-black/20"
    />

    {m.photoUrl.includes("cloudinary.com") && (
      <Star
        className="absolute top-2 right-2 h-1.5 w-2 fill-red-500 text-black drop-shadow-lg"
        aria-label="Cloudinary photo"
      />
    )}
  </div>
)}

                      <div className="mt-3 flex items-center gap-3 text-[11px] text-white/30">
                        <span className="flex items-center gap-1">
                          <span className="text-sm">{s.emoji}</span>
                          {d ? timeAgo(d, new Date()) : "undated"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPending({ type: "edit", memory: m });
                        }}
                        className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
                        aria-label="Edit memory"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPending({ type: "delete", id: m.id });
                        }}
                        className="rounded-lg p-1.5 text-white/50 hover:bg-rose-500/20 hover:text-rose-300"
                        aria-label="Delete memory"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {pending && (
        <SecurityGate
          action={pending}
          verifyPasscode={verifyPasscode}
          onConfirm={() => {
            executeAction(pending);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}

      {editing && (
        <MemoryModal
          memory={editing}
          isNew={isNew}
          onSave={save}
          uploadPhoto={uploadPhoto}
          removePhoto={removePhoto}
          onCancel={() => setEditing(null)}
        />
      )}

      {reading && (
        <MemoryReader
          memory={reading}
          index={sorted.findIndex((memory) => memory.id === reading.id)}
          total={sorted.length}
          onClose={() => setReading(null)}
          onPrevious={() => {
            const index = sorted.findIndex((memory) => memory.id === reading.id);
            if (index > 0) setReading(sorted[index - 1]);
          }}
          onNext={() => {
            const index = sorted.findIndex((memory) => memory.id === reading.id);
            if (index < sorted.length - 1) setReading(sorted[index + 1]);
          }}
        />
      )}
    </section>
  );
}

/** Security code prompt shown before any memory change. */
function SecurityGate({
  action,
  verifyPasscode,
  onConfirm,
  onCancel,
}: {
  action: PendingAction;
  verifyPasscode: (code: string) => Promise<boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const label =
    action?.type === "delete"
      ? "delete this memory"
      : action?.type === "edit"
        ? "edit this memory"
        : "add a new memory";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      if (await verifyPasscode(code)) onConfirm();
      else { setError("Incorrect device passcode. Create one in Settings first."); setCode(""); }
    } catch { setError("Could not verify passcode."); }
    finally { setBusy(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-up"
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-xs rounded-3xl border border-white/10 bg-[#0d0d18] p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/15 border border-pink-400/20">
          <Shield className="h-6 w-6 text-pink-300" />
        </div>

        <h3 className="mt-4 font-serif text-xl text-white">
          Security Code
        </h3>
        <p className="mt-1.5 text-sm text-white/50">
          Enter the code to {label}.
        </p>

        <input
          type="password"
          inputMode="numeric"
          required
          autoFocus
          autoComplete="off"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          className="input mt-4 text-center text-lg tracking-[0.3em] font-serif"
          placeholder="••"
          maxLength={4}
        />

        {error && (
          <p className="mt-2 text-sm text-rose-300">{error}</p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-400 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Unlock"
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/70 transition hover:text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function MemoryModal({
  memory,
  isNew,
  onSave,
  uploadPhoto,
  removePhoto,
  onCancel,
}: {
  memory: Memory;
  isNew: boolean;
  onSave: (m: Memory) => void;
  uploadPhoto: (file: File, memoryId: string) => Promise<{ path: string; url: string }>;
  removePhoto: (path: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Memory>(memory);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(memory.photoUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setDraft(memory);
    setPhotoFile(null);
    setPhotoPreview(memory.photoUrl ?? null);
    setError(null);
  }, [memory]);

  const dateValue = draft.date ? toDateInputValue(new Date(draft.date)) : "";

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setError("Choose an image smaller than 10 MB.");
      return;
    }
    setError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const saveWithPhoto = async () => {
    if (!draft.title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      let next = draft;
      if (photoFile) {
        const uploaded = await uploadPhoto(photoFile, draft.id);
        next = { ...next, photoPath: uploaded.path, photoUrl: uploaded.url };
      }
      if (memory.photoPath && memory.photoPath !== next.photoPath) {
        await removePhoto(memory.photoPath);
      }
      onSave(next);
    } catch {
      setError("The photo could not be saved. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 animate-fade-up"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d0d18] p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-xl text-white">
            {isNew ? "A New Memory" : "Edit Memory"}
          </h3>
          <button type="button" onClick={onCancel} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Date (optional)">
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDraft({ ...draft, date: e.target.value ? parseDateInput(e.target.value)?.toISOString() ?? null : null })}
              className="input"
            />
          </Field>

          <Field label="Title">
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="A day to remember…"
              className="input"
              autoFocus
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="What made this day special?"
              rows={4}
              className="input resize-none"
            />
          </Field>

          <Field label="Photo (optional)">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:border-pink-400/50 hover:bg-white/[0.06]">
              <ImagePlus className="h-4 w-4" /> Choose photo from gallery
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => choosePhoto(e.target.files?.[0])} />
            </label>
            {photoPreview && (
              <div className="relative mt-3">
                <img src={photoPreview} alt="Selected memory" className="w-full max-h-[360px] rounded-xl object-contain bg-black/20" />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setDraft({ ...draft, photoPath: null, photoUrl: null });
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
                >
                  Remove photo
                </button>
              </div>
            )}
          </Field>

          <label className="flex items-center gap-2 text-sm text-white/70 select-none cursor-pointer">
            <input type="checkbox" checked={!!draft.milestone} onChange={(e) => setDraft({ ...draft, milestone: e.target.checked })} className="h-4 w-4 accent-pink-500" />
            Mark as a milestone moment
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </div>

        <div className="mt-6 flex gap-2">
          <button type="button" onClick={saveWithPhoto} disabled={!draft.title.trim() || saving} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-pink-400 disabled:opacity-40">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
          </button>
          <button type="button" onClick={onCancel} className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/70 transition hover:text-white">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryReader({
  memory,
  index,
  total,
  onClose,
  onPrevious,
  onNext,
}: {
  memory: Memory;
  index: number;
  total: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onPrevious();
      if (event.key === "ArrowRight") onNext();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrevious]);

  const date = memory.date ? new Date(memory.date) : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07070b]/95 px-4 py-5 backdrop-blur-md sm:px-8 sm:py-10" onClick={onClose}>
      <article className="mx-auto min-h-[calc(100vh-2.5rem)] max-w-3xl rounded-[2rem] border border-white/10 bg-[#101017] shadow-2xl shadow-black/50 animate-fade-up" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-pink-200/70">
            <BookOpen className="h-4 w-4" />
            Memory {index + 1} of {total}
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 p-2 text-white/55 transition hover:border-white/25 hover:bg-white/10 hover:text-white" aria-label="Close reader">
            <span className="sr-only">Close reader</span>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="px-6 py-10 sm:px-16 sm:py-16">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.16em] text-white/40">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-500/10 px-3 py-1.5 text-pink-200/80">
              <CalendarDays className="h-3.5 w-3.5" />
              {date ? formatLongDate(date) : "Undated memory"}
            </span>
            {memory.milestone && <span className="text-pink-300">Milestone</span>}
          </div>

          <h1 className="mt-7 max-w-2xl font-serif text-4xl leading-[1.08] text-white sm:text-6xl">
            {memory.title}
          </h1>

          {date && <p className="mt-4 text-sm text-white/35">{timeAgo(date, new Date())}</p>}

          {memory.photoUrl && (
            <img
              src={memory.photoUrl}
              alt={`Photo for ${memory.title}`}
              className="mt-10 w-full max-h-[680px] rounded-2xl object-contain bg-black/30 shadow-xl"
            />
          )}

          {memory.notes ? (
            <div className="mt-10 border-t border-white/10 pt-9">
              <p className="max-w-full whitespace-pre-wrap break-words text-base leading-[1.9] text-white/75 sm:text-lg">
                {memory.notes}
              </p>
            </div>
          ) : (
            <p className="mt-10 border-t border-white/10 pt-9 font-serif text-xl italic text-white/35">
              This memory has no notes yet.
            </p>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 px-5 py-4 sm:px-8">
          <button type="button" onClick={onPrevious} disabled={index <= 0} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25">
            <ArrowLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs text-white/25">Press Escape to close</span>
          <button type="button" onClick={onNext} disabled={index >= total - 1} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-white/60 transition hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25">
            Next <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </article>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Decorative winding path summary at the top of the timeline. */
function MemoryPath({
  memories,
  anniversary,
}: {
  memories: Memory[];
  anniversary: Date;
}) {
  const now = new Date();
  const totalDays = Math.max(
    1,
    Math.round((now.getTime() - anniversary.getTime()) / (1000 * 60 * 60 * 24))
  );
  const milestoneCount = memories.filter((m) => m.milestone).length;

  const dots = memories.filter((m) => m.date).map((m) => {
    const d = new Date(m.date as string);
    const pct = Math.min(
      100,
      Math.max(0,
        ((d.getTime() - anniversary.getTime()) /
          (now.getTime() - anniversary.getTime())) *
          100
      )
    );
    return { pct, milestone: m.milestone, date: d };
  });

  return (
    <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-4 sm:p-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-pink-300/70" />
          <span className="text-xs uppercase tracking-wider text-white/40">
            The Journey So Far
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-white/50">
            <span className="font-serif text-lg text-white">{memories.length}</span>{" "}
            memories
          </span>
          <span className="text-white/50">
            <span className="font-serif text-lg text-white">{milestoneCount}</span>{" "}
            milestones
          </span>
          <span className="text-white/50">
            <span className="font-serif text-lg text-white">{totalDays.toLocaleString()}</span>{" "}
            days
          </span>
        </div>
      </div>

      <div className="relative h-12">
        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d="M0,6 Q25,0 50,6 T100,6"
            fill="none"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="0.3"
            strokeDasharray="0.8,0.8"
          />
        </svg>
        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-transform hover:scale-125"
            style={{ left: `${dot.pct}%` }}
            title={formatLongDate(dot.date)}
          >
            <div
              className={`h-2.5 w-2.5 rounded-full ring-2 ring-[#0a0a12] ${
                dot.milestone
                  ? "bg-pink-400 shadow-md shadow-pink-400/40"
                  : "bg-white/50"
              }`}
            />
          </div>
        ))}
        <div className="absolute left-0 top-1/2 -translate-y-1/2">
          <div className="h-2 w-2 rounded-full bg-pink-500/60" />
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <div className="h-2 w-2 rounded-full bg-blue-400/60 live-dot" />
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-white/30">
        <span>{anniversary.getFullYear()}</span>
        <span>now</span>
      </div>
    </div>
  );
}
