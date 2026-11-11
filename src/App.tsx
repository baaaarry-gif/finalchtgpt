import { useMemo } from "react";
import { Clock, Heart, LogOut, Loader2, Download, X, KeyRound } from "lucide-react";
import { useNow } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { useStoryData } from "@/lib/useStoryData";
import { CounterPanel } from "@/components/CounterPanel";
import { MemoryTimeline, type Memory } from "@/components/MemoryTimeline";
import { SettingsPanel } from "@/components/SettingsPanel";
import { AuthScreen } from "@/components/AuthScreen";
import { MusicPlayer } from "@/components/MusicPlayer";
import { ResetPasswordScreen } from "@/components/ResetPasswordScreen";
import { supabase } from "@/lib/supabase";
import { formatClock, formatLongDate, pad2 } from "@/lib/dates";
import { hasDevicePasscode, verifyDevicePasscode, saveDevicePasscode } from "@/lib/devicePasscode";
import { useEffect, useState } from "react";

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const now = useNow(1000);

  if (window.location.pathname === "/reset-password") return <ResetPasswordScreen />;

  if (authLoading) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-pink-300" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return <AuthenticatedApp user={user} now={now} onSignOut={signOut} />;
}

function AuthenticatedApp({ user, now, onSignOut }: { user: { id: string; email?: string }; now: Date; onSignOut: () => Promise<void> }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [locked, setLocked] = useState(false);
  useEffect(() => { let active = true; hasDevicePasscode(user.id).then(value => { if (active) { setConfigured(value); setLocked(value); } }).catch(() => { if (active) setConfigured(false); }); return () => { active = false; }; }, [user.id]);
  if (configured === null) return <div className="app-bg min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-pink-300" /></div>;
  if (!configured) return <CreatePasscodeScreen userId={user.id} onCreated={() => { setConfigured(true); setLocked(false); }} onSignOut={onSignOut} />;
  if (locked) return <DevicePasscodeScreen userId={user.id} onUnlock={() => setLocked(false)} onSignOut={onSignOut} />;
  return <Story user={user} now={now} onSignOut={onSignOut} onLock={() => setLocked(true)} />;
}

function CreatePasscodeScreen({ userId, onCreated, onSignOut }: { userId: string; onCreated: () => void; onSignOut: () => Promise<void> }) {
  const [code, setCode] = useState(""); const [confirm, setConfirm] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(""); if (code.length < 4 || code.length > 12 || code !== confirm) { setError("Passcodes must match and contain 4–12 characters."); return; } setBusy(true); try { await saveDevicePasscode(userId, code); onCreated(); } catch { setError("Could not save your passcode. Check your connection and try again."); } finally { setBusy(false); } }
  return <div className="app-bg min-h-screen flex items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 space-y-4"><div className="text-center"><KeyRound className="mx-auto h-7 w-7 text-pink-300"/><h1 className="mt-3 font-serif text-3xl text-white">Create your passcode</h1><p className="mt-2 text-sm text-white/50">Set this once for your account. It will be available after login on your other devices too.</p></div><input type="password" inputMode="numeric" autoComplete="new-password" required value={code} onChange={e=>setCode(e.target.value)} className="input text-center tracking-[0.3em]" placeholder="Create passcode"/><input type="password" inputMode="numeric" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} className="input text-center tracking-[0.3em]" placeholder="Confirm passcode"/>{error&&<p className="text-sm text-rose-300">{error}</p>}<button disabled={busy} className="w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm text-white disabled:opacity-50">{busy?"Saving…":"Save passcode"}</button><button type="button" onClick={()=>void onSignOut()} className="w-full text-xs text-white/40 hover:text-white">Sign out</button></form></div>;
}

function DevicePasscodeScreen({ userId, onUnlock, onSignOut }: { userId: string; onUnlock: () => void; onSignOut: () => Promise<void> }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setBusy(true); setError(""); try { if (await verifyDevicePasscode(userId, code)) onUnlock(); else { setCode(""); setError("Incorrect passcode."); } } catch { setError("Could not verify passcode."); } finally { setBusy(false); } }
  return <div className="app-bg min-h-screen flex items-center justify-center px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 space-y-4"><div className="text-center"><KeyRound className="mx-auto h-7 w-7 text-pink-300"/><h1 className="mt-3 font-serif text-3xl text-white">Our Untold Story</h1><p className="mt-2 text-sm text-white/50">Enter your device passcode to unlock.</p></div><input type="password" inputMode="numeric" autoComplete="off" autoFocus required value={code} onChange={e=>setCode(e.target.value)} className="input text-center tracking-[0.4em]" placeholder="••••••"/>{error&&<p className="text-sm text-rose-300">{error}</p>}<button disabled={busy} className="w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm text-white disabled:opacity-50">{busy?"Checking…":"Unlock"}</button><button type="button" onClick={()=>void onSignOut()} className="w-full text-xs text-white/40 hover:text-white">Use email and password instead</button></form></div>;
}

function Story({
  user,
  now,
  onSignOut,
  onLock,
}: {
  user: { id: string; email?: string };
  now: Date;
  onSignOut: () => void;
  onLock: () => void;
}) {
  const {
    anniversary,
    lastSeen,
    privacy,
    memories,
    loading,
    setLastSeen,
    setPrivacy,
    setMemories,
    resetAll,
    hasLocalData,
    importLocal,
    dismissLocal,
    uploadMemoryPhoto,
    removeMemoryPhoto,
    reload,
  } = useStoryData(user.id);

  const anniversaryDate = useMemo(() => new Date(anniversary), [anniversary]);
  const [musicVolume, setMusicVolume] = useState(0.65);
  useEffect(() => {
    let active = true;
    supabase.from("user_settings").select("music_volume").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { console.error("Could not load saved music volume", error); return; }
      if (typeof data?.music_volume === "number") setMusicVolume(Math.min(1, Math.max(0, data.music_volume)));
    });
    return () => { active = false; };
  }, [user.id]);
  const changeMusicVolume = (value: number) => {
    const safeValue = Math.min(1, Math.max(0, value));
    setMusicVolume(safeValue);
    void supabase.from("user_settings").update({ music_volume: safeValue, updated_at: new Date().toISOString() }).eq("user_id", user.id).then(({ error }) => {
      if (error) console.error("Could not save music volume", error);
    });
  };
  const lastSeenDate = useMemo(() => new Date(lastSeen), [lastSeen]);

  const anniversaryValid =
    !isNaN(anniversaryDate.getTime()) && anniversaryDate <= now;
  const lastSeenValid =
    !isNaN(lastSeenDate.getTime()) && lastSeenDate <= now;

  return (
    <div className="app-bg min-h-screen text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]">
              <Heart className="h-3.5 w-3.5" />
              Our Untold Story
            </div>
            <h1 className="mt-2 font-serif text-4xl sm:text-6xl leading-tight tracking-tight">
              Our Untold Story
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/50 max-w-md">
              A quiet place that counts every moment since the day everything
              began.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <SettingsPanel
              userId={user.id}
              anniversary={anniversary}
              musicVolume={musicVolume}
              onMusicVolume={changeMusicVolume}
              lastSeen={lastSeen}
              privacy={privacy}
              memories={memories}
              onLastSeen={setLastSeen}
              onPrivacy={setPrivacy}
              onReset={resetAll}
              onRestored={reload}
              onLock={onLock}
            />
            <button type="button" onClick={onLock} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:text-white" title="Lock app">Lock</button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-pink-400/40 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {hasLocalData && (
          <div className="mt-5 rounded-2xl border border-pink-400/30 bg-pink-500/10 p-4 sm:p-5 animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Download className="h-5 w-5 text-pink-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm text-white">
                    We found memories saved earlier in this browser.
                  </p>
                  <p className="mt-0.5 text-xs text-white/55">
                    Import them into your account so they travel with you to
                    every browser.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissLocal}
                className="shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={importLocal}
                className="inline-flex items-center gap-1.5 rounded-full bg-pink-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-400"
              >
                <Download className="h-4 w-4" /> Import into my account
              </button>
              <button
                type="button"
                onClick={dismissLocal}
                className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition hover:text-white"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        <MusicPlayer userId={user.id} volume={musicVolume} />

        {/* Live clock */}
        <div className="mt-6 flex items-center justify-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-pink-400 live-dot" />
            <Clock className="h-4 w-4 text-white/50" />
            <span className="font-serif text-lg sm:text-xl tabular-nums tracking-wider">
              {formatClock(now)}
            </span>
            <span className="text-xs text-white/40 hidden sm:inline">
              {now.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="mt-16 flex items-center justify-center text-white/40">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your
            story…
          </div>
        ) : (
          <>
            <div
              className={privacy ? "pointer-events-none select-none blur-lg" : ""}
            >
              <div className="mt-8">
                {anniversaryValid ? (
                  <CounterPanel
                    title="Since Day One"
                    subtitle={`From ${formatLongDate(anniversaryDate)} — and still counting.`}
                    start={anniversaryDate}
                    now={now}
                    accent="pink"
                  />
                ) : (
                  <InvalidDate
                    label="Anniversary date"
                    hint="Set a valid date in the past in Settings."
                  />
                )}
              </div>

              <div className="mt-5">
                {lastSeenValid ? (
                  <CounterPanel
                    title="Last Sighting"
                    subtitle={`Since ${formatLongDate(lastSeenDate)}.`}
                    start={lastSeenDate}
                    now={now}
                    accent="blue"
                  />
                ) : (
                  <InvalidDate
                    label="Last sighting date"
                    hint="Set a valid date in the past in Settings."
                  />
                )}
              </div>
            </div>

            <div className="mt-5">
              <MemoryTimeline
                memories={memories}
                onChange={setMemories}
                anniversary={anniversaryDate}
                uploadPhoto={uploadMemoryPhoto}
                removePhoto={removeMemoryPhoto}
                verifyPasscode={(code) => verifyDevicePasscode(user.id, code)}
              />
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-white/30 space-y-1">
          <p>Signed in as {user.email ?? "you"} · saved to your private account</p>
          <p className="max-w-md mx-auto leading-relaxed">
            Your dates and memories now live with your account, so they appear
            on any browser you sign in from — and only you can see them.
          </p>
          <p className="text-white/25">
            {pad2(now.getHours())}:{pad2(now.getMinutes())}
          </p>
        </footer>
      </div>
    </div>
  );
}

function InvalidDate({ label, hint }: { label: string; hint: string }) {
  return (
    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-6 text-center">
      <p className="font-serif text-xl text-white">{label} is not set</p>
      <p className="mt-1 text-sm text-white/50">{hint}</p>
    </section>
  );
}
