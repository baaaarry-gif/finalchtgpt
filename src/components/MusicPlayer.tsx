import { useCallback, useEffect, useRef, useState } from "react";
import { ListMusic, Play, Pause, SkipBack, SkipForward, Upload, RefreshCw, Trash2, Music2, Power } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { verifyDevicePasscode } from "@/lib/devicePasscode";

type Track = { id: string; title: string; artist: string; file_path: string; mime_type: string; duration_seconds: number | null; };

export function MusicPlayer({ userId, volume }: { userId: string; volume: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [current, setCurrent] = useState(0);
  const [src, setSrc] = useState("");
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(`ous.music.enabled.${userId}`) !== "false");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [manageUnlocked, setManageUnlocked] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = tracks[current];
  const loadTracks = useCallback(async () => {
    setBusy(true); setMessage("");
    try {
      const { data, error } = await supabase.from("music_tracks").select("id,title,artist,file_path,mime_type,duration_seconds").eq("user_id", userId).order("sort_order").order("created_at");
      if (error) throw error;
      const rows = (data ?? []) as Track[];
      // Also discover files uploaded manually in Supabase Storage and register them.
      const { data: objects, error: listError } = await supabase.storage.from("music").list(userId, { limit: 500 });
      if (listError) throw listError;
      const known = new Set(rows.map((r) => r.file_path));
      const fresh = (objects ?? []).filter((o) => o.name && !o.name.startsWith(".") && !known.has(`${userId}/${o.name}`));
      for (const o of fresh) {
        const path = `${userId}/${o.name}`;
        const ext = o.name.split(".").pop()?.toLowerCase() ?? "";
        if (!["mp3","m4a","aac","ogg","wav","flac","webm"].includes(ext)) continue;
        const mime = o.metadata?.mimetype || (ext === "mp3" ? "audio/mpeg" : `audio/${ext}`);
        const { data: inserted, error: insertError } = await supabase.from("music_tracks").insert({ user_id: userId, title: o.name.replace(/\.[^.]+$/, ""), artist: "", file_path: path, mime_type: mime, file_size: o.metadata?.size ?? null }).select("id,title,artist,file_path,mime_type,duration_seconds").single();
        if (!insertError && inserted) rows.push(inserted as Track);
      }
      setTracks(rows);
      setCurrent((n) => Math.min(n, Math.max(0, rows.length - 1)));
      setMessage(rows.length ? `${rows.length} song${rows.length === 1 ? "" : "s"} in your library.` : "No songs yet. Upload a song or add one in Supabase Storage, then refresh.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not load music library."); }
    finally { setBusy(false); }
  }, [userId]);

  useEffect(() => { void loadTracks(); }, [loadTracks]);
  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => { localStorage.setItem(`ous.music.enabled.${userId}`, String(enabled)); if (!enabled) { audioRef.current?.pause(); setPlaying(false); setSrc(""); } }, [enabled, userId]);
  useEffect(() => { setCurrentTime(0); setDuration(0); }, [src]);

  const prepare = async (index: number, autoplay: boolean) => {
    if (!enabled || !tracks[index]) return;
    const { data, error } = await supabase.storage.from("music").createSignedUrl(tracks[index].file_path, 60 * 60);
    if (error || !data?.signedUrl) { setMessage(error?.message ?? "Could not access this audio file."); return; }
    setCurrent(index); setSrc(data.signedUrl);
    if (autoplay) setTimeout(() => { void audioRef.current?.play().then(() => setPlaying(true)).catch(() => setMessage("Playback was blocked. Press Play to start.")); }, 0);
  };
  const play = async () => { if (!enabled || !selected) return; if (!src) { await prepare(current, true); return; } try { await audioRef.current?.play(); setPlaying(true); } catch { setMessage("Playback could not start. Try Play again."); } };
  const next = () => { if (tracks.length) void prepare((current + 1) % tracks.length, true); };
  const previous = () => { if (tracks.length) void prepare((current - 1 + tracks.length) % tracks.length, true); };
  const unlock = async () => { if (await verifyDevicePasscode(userId, passcode)) { setManageUnlocked(true); setPasscode(""); setMessage("Music management unlocked for this session."); } else setMessage("Incorrect device passcode. Create one in Settings first."); };

  const upload = async (file?: File) => {
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["mp3","m4a","aac","ogg","wav","flac","webm"].includes(ext)) { setMessage("Choose an audio file: MP3, M4A, AAC, OGG, WAV, FLAC or WEBM."); return; }
    setBusy(true);
    try {
      const safeName = `${crypto.randomUUID()}.${ext}`;
      const path = `${userId}/${safeName}`;
      const { error: upError } = await supabase.storage.from("music").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upError) throw upError;
      const { error: dbError } = await supabase.from("music_tracks").insert({ user_id: userId, title: file.name.replace(/\.[^.]+$/, ""), artist: "", file_path: path, mime_type: file.type || "application/octet-stream", file_size: file.size });
      if (dbError) { await supabase.storage.from("music").remove([path]); throw dbError; }
      await loadTracks(); setMessage(`Uploaded ${file.name}.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Upload failed."); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const remove = async (track: Track) => {
    if (!window.confirm(`Delete “${track.title}” from your music library?`)) return;
    setBusy(true);
    try {
      const { error: storageError } = await supabase.storage.from("music").remove([track.file_path]);
      if (storageError) throw storageError;
      const { error } = await supabase.from("music_tracks").delete().eq("id", track.id).eq("user_id", userId);
      if (error) throw error;
      if (selected?.id === track.id) { audioRef.current?.pause(); setPlaying(false); setSrc(""); }
      await loadTracks();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Could not delete song."); }
    finally { setBusy(false); }
  };

  return <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
    <audio ref={audioRef} src={src || undefined} preload="none" onEnded={next} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)} />
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Music2 className="h-4 w-4 text-pink-300"/><h2 className="font-serif text-lg">Music</h2></div>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="text-xs text-white/55 hover:text-white">{expanded ? "Hide library" : "Open library"}</button>
    </div>
    <div className="mt-3 flex items-center gap-3">
      <div className="min-w-0 flex-1"><p className="truncate text-sm text-white">{selected?.title ?? "No song selected"}</p><p className="truncate text-xs text-white/40">{selected?.artist || (selected ? "Your music library" : "Add songs in Settings")}</p></div>
      <button type="button" title="Previous" onClick={previous} disabled={!enabled || !tracks.length} className="rounded-full p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"><SkipBack className="h-4 w-4"/></button>
      <button type="button" title={playing ? "Pause" : "Play"} onClick={() => playing ? (audioRef.current?.pause(), setPlaying(false)) : void play()} disabled={!enabled || !selected} className="rounded-full bg-pink-500 p-3 text-white hover:bg-pink-400 disabled:opacity-30">{playing ? <Pause className="h-4 w-4"/> : <Play className="h-4 w-4"/>}</button>
      <button type="button" title="Next" onClick={next} disabled={!enabled || !tracks.length} className="rounded-full p-2 text-white/70 hover:bg-white/10 disabled:opacity-30"><SkipForward className="h-4 w-4"/></button>
    </div>
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2"><span className="w-9 text-right text-[11px] tabular-nums text-white/40">{formatTime(currentTime)}</span><input aria-label="Track duration" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(currentTime, duration || 0)} disabled={!duration} onChange={(e) => { const nextTime = Number(e.target.value); if (audioRef.current) audioRef.current.currentTime = nextTime; setCurrentTime(nextTime); }} className="w-full accent-pink-500 disabled:opacity-40"/><span className="w-9 text-[11px] tabular-nums text-white/40">{formatTime(duration)}</span></div>
      <div className="flex justify-end"><button type="button" onClick={() => setEnabled((v) => !v)} title="Master music on/off" className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs ${enabled ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}><Power className="h-3.5 w-3.5"/>{enabled ? "ON" : "OFF"}</button></div>
    </div>
    {expanded && <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm text-white/75"><ListMusic className="h-4 w-4"/>Full music library</div><button type="button" onClick={() => void loadTracks()} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65 disabled:opacity-40"><RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`}/> Refresh</button></div>
      <div className="mt-3 space-y-1">{tracks.map((track, i) => <div key={track.id} className={`flex items-center gap-2 rounded-xl px-2 py-2 ${i === current ? "bg-pink-500/10" : "hover:bg-white/5"}`}><button type="button" onClick={() => void prepare(i, true)} disabled={!enabled} className="min-w-0 flex-1 text-left"><span className="block truncate text-sm text-white/85">{track.title}</span><span className="block truncate text-xs text-white/35">{track.artist || track.file_path.split("/").pop()}</span></button>{manageUnlocked && <button type="button" onClick={() => void remove(track)} title="Delete song" className="rounded-lg p-2 text-white/40 hover:text-rose-300"><Trash2 className="h-4 w-4"/></button>}</div>)}{!tracks.length && <p className="py-3 text-xs text-white/40">Your library is empty.</p>}</div>
      <div className="mt-4 border-t border-white/10 pt-4"><p className="text-xs uppercase tracking-wider text-white/40">Manage music · Device Passcode</p>{!manageUnlocked ? <div className="mt-2 flex gap-2"><input aria-label="Device Passcode" type="password" inputMode="numeric" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Enter passcode" className="input min-w-0 flex-1"/><button type="button" onClick={() => void unlock()} className="rounded-full bg-pink-500 px-4 py-2 text-xs text-white">Unlock</button></div> : <div className="mt-2 flex flex-wrap items-center gap-2"><input ref={fileRef} type="file" accept="audio/*" onChange={(e) => void upload(e.target.files?.[0])} className="block max-w-full text-xs text-white/60 file:mr-2 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"/><button type="button" onClick={() => setManageUnlocked(false)} className="rounded-full border border-white/15 px-3 py-2 text-xs text-white/60">Lock</button></div>}<p className="mt-2 text-[11px] text-white/35">Songs uploaded here are stored in your private Supabase music bucket. Files uploaded directly in Supabase appear after Refresh and are registered automatically.</p></div>
    </div>}
    {message && <p role="status" className="mt-3 text-xs text-white/45">{message}</p>}
  </section>;
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
