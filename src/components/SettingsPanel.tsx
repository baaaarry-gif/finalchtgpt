import { useState } from "react";
import { toDateTimeInputValue } from "@/lib/dates";
import { Settings as SettingsIcon, X, RotateCcw } from "lucide-react";
import type { Memory } from "@/components/MemoryTimeline";
import { BackupSection } from "@/components/BackupSection";
import { hasDevicePasscode, saveDevicePasscode, verifyDevicePasscode } from "@/lib/devicePasscode";
import { getCloudinaryConfig, getPhotoProvider, saveCloudinaryConfig, loadAccountStorageConfig, saveAccountStorageConfig } from "@/lib/storageConfig";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SettingsPanelProps {
  userId: string;
  anniversary: string; // fixed ISO value, shown for backup compatibility
  musicVolume: number;
  onMusicVolume: (value: number) => void;
  lastSeen: string; // ISO
  privacy: boolean;
  memories: Memory[];
  onLastSeen: (iso: string) => void;
  onPrivacy: (v: boolean) => void;
  onReset: () => void;
  onRestored: () => Promise<void>;
  onLock: () => void;
}

export function SettingsPanel({
  userId,
  anniversary,
  musicVolume,
  onMusicVolume,
  lastSeen,
  privacy,
  memories,
  onLastSeen,
  onPrivacy,
  onReset,
  onRestored,
  onLock,
}: SettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [provider, setProvider] = useState(getPhotoProvider);
  const [cloudName, setCloudName] = useState(() => getCloudinaryConfig().cloudName);
  const [uploadPreset, setUploadPreset] = useState(() => getCloudinaryConfig().uploadPreset);
  const [passcodeExists, setPasscodeExists] = useState(false);
  const [showPasscodeEditor, setShowPasscodeEditor] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [passcodeMessage, setPasscodeMessage] = useState("");
  const [credentialsUnlocked, setCredentialsUnlocked] = useState(false);
  const [credentialsCode, setCredentialsCode] = useState("");
  const [credentialsMessage, setCredentialsMessage] = useState("");
  const [showCredentialEditor, setShowCredentialEditor] = useState(false);
  useEffect(() => { let active = true; loadAccountStorageConfig(userId).then(({ provider: savedProvider, config }) => { if (!active) return; setProvider(savedProvider); setCloudName(config.cloudName); setUploadPreset(config.uploadPreset); }).catch(() => { if (active) setCredentialsMessage("Could not load saved storage settings. Check your connection."); }); return () => { active = false; }; }, [userId]);
  useEffect(() => { let active = true; hasDevicePasscode(userId).then(v => { if (active) setPasscodeExists(v); }).catch(() => { if (active) setPasscodeMessage("Could not check account passcode."); }); return () => { active = false; }; }, [userId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-pink-400/40 hover:text-white"
        aria-label="Open settings"
      >
        <SettingsIcon className="h-3.5 w-3.5" />
        Settings
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d0d18] p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-xl text-white">Settings</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div><p className="text-xs uppercase tracking-wider text-white/45">File storage</p><p className="mt-1 text-xs text-white/35">Choose where new memory photos are uploaded.</p></div>
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setProvider("supabase"); void saveAccountStorageConfig(userId, "supabase", { cloudName, uploadPreset }).catch(() => setCredentialsMessage("Could not save storage choice.")); }} className={`rounded-xl border px-3 py-3 text-sm ${provider === "supabase" ? "border-pink-400 bg-pink-500/15 text-white" : "border-white/10 text-white/55"}`}>Supabase</button><button type="button" onClick={() => { setProvider("cloudinary"); void saveAccountStorageConfig(userId, "cloudinary", { cloudName, uploadPreset }).catch(() => setCredentialsMessage("Could not save storage choice.")); }} className={`rounded-xl border px-3 py-3 text-sm ${provider === "cloudinary" ? "border-pink-400 bg-pink-500/15 text-white" : "border-white/10 text-white/55"}`}>Cloudinary</button></div>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-white/45">Security · Device passcode</p>
                <p className="text-xs text-white/40">Create a private passcode for this device. Your Supabase email/password session stays signed in; the passcode unlocks this device only.</p>
                <button type="button" onClick={() => { setShowPasscodeEditor((value) => !value); setPasscodeMessage(""); }} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/75">{showPasscodeEditor ? "Hide passcode options" : "Change Passcode"}</button>
                {showPasscodeEditor && (!passcodeExists ? <div className="space-y-2"><input type="password" inputMode="numeric" value={newCode} onChange={e=>setNewCode(e.target.value)} className="input" placeholder="Create passcode (4–12 characters)"/><input type="password" inputMode="numeric" value={confirmCode} onChange={e=>setConfirmCode(e.target.value)} className="input" placeholder="Confirm passcode"/><button type="button" onClick={async()=>{ if(newCode.length<4 || newCode.length>12 || newCode!==confirmCode){setPasscodeMessage("Passcodes must match and contain 4–12 characters.");return;} await saveDevicePasscode(userId,newCode); setPasscodeExists(true); setNewCode("");setConfirmCode("");setPasscodeMessage("Device passcode created."); }} className="rounded-full bg-pink-500 px-4 py-2 text-xs text-white">Create passcode</button></div> : <div className="space-y-2"><input type="password" inputMode="numeric" value={currentCode} onChange={e=>setCurrentCode(e.target.value)} className="input" placeholder="Current passcode"/><input type="password" inputMode="numeric" value={newCode} onChange={e=>setNewCode(e.target.value)} className="input" placeholder="New passcode (4–12 characters)"/><input type="password" inputMode="numeric" value={confirmCode} onChange={e=>setConfirmCode(e.target.value)} className="input" placeholder="Confirm new passcode"/><button type="button" onClick={async()=>{if(!(await verifyDevicePasscode(userId,currentCode))){setPasscodeMessage("Current passcode is incorrect.");return;}if(newCode.length<4||newCode.length>12||newCode!==confirmCode){setPasscodeMessage("New passcodes must match and contain 4–12 characters.");return;}await saveDevicePasscode(userId,newCode);setCurrentCode("");setNewCode("");setConfirmCode("");setPasscodeMessage("Passcode updated.");}} className="rounded-full bg-pink-500 px-4 py-2 text-xs text-white">Change passcode</button></div>)}
                {passcodeMessage&&<p className="text-xs text-white/55">{passcodeMessage}</p>}
                <button type="button" onClick={onLock} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70">Lock app now</button>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <p className="text-xs uppercase tracking-wider text-white/45">Cloudinary credentials</p>
                <p className="text-xs text-white/40">Credentials are saved to your private account and restored after login. Use an unsigned upload preset; never enter your API secret here.</p>
                {!showCredentialEditor ? <><button type="button" onClick={()=>setShowCredentialEditor(true)} className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/75">Edit Cloudinary credentials</button>{credentialsMessage&&<p className="text-xs text-white/50">{credentialsMessage}</p>}</> : <div className="space-y-2">{!credentialsUnlocked&&<><input type="password" inputMode="numeric" value={credentialsCode} onChange={e=>setCredentialsCode(e.target.value)} className="input" placeholder="Device passcode"/><button type="button" onClick={async()=>{if(await verifyDevicePasscode(userId,credentialsCode)){setCredentialsUnlocked(true);setCredentialsMessage("");}else setCredentialsMessage("Incorrect device passcode.");}} className="rounded-full bg-pink-500 px-4 py-2 text-xs text-white">Unlock credentials</button></>}{credentialsUnlocked&&<><input value={cloudName} onChange={e=>setCloudName(e.target.value)} className="input" placeholder="Cloud Name"/><input value={uploadPreset} onChange={e=>setUploadPreset(e.target.value)} className="input" placeholder="Unsigned Upload Preset"/><button type="button" onClick={()=>{void saveAccountStorageConfig(userId, provider, {cloudName:cloudName.trim(),uploadPreset:uploadPreset.trim()}).then(()=>setCredentialsMessage("Cloudinary settings saved to your account.")).catch(()=>setCredentialsMessage("Could not save settings. Please retry."));saveCloudinaryConfig({cloudName:cloudName.trim(),uploadPreset:uploadPreset.trim()});setShowCredentialEditor(false);setCredentialsUnlocked(false);setCredentialsCode("");setCredentialsMessage("Cloudinary credentials saved on this device.");}} className="rounded-full bg-pink-500 px-4 py-2 text-xs text-white">Save credentials</button></>}</div>}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                <p className="text-xs uppercase tracking-wider text-white/45">Fixed anniversary · Day 1</p>
                <p className="text-sm text-white">April 19, 2022 · 4:30 PM</p>
                <p className="text-xs text-white/35">This date and time are permanent and cannot be changed.</p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                <div className="flex items-center justify-between"><p className="text-xs uppercase tracking-wider text-white/45">Music volume</p><span className="text-xs tabular-nums text-white/45">{Math.round(musicVolume * 100)}%</span></div>
                <input aria-label="Music volume" type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(e) => onMusicVolume(Number(e.target.value))} className="w-full accent-pink-500" />
              </section>

              <Field
                label="Last sighting date"
                hint="The last time you saw them. Updates the sighting counter."
              >
                <input
                  type="datetime-local"
                  value={toDateTimeInputValue(new Date(lastSeen))}
                  onChange={(e) => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) onLastSeen(d.toISOString());
                  }}
                  className="input"
                />
              </Field>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => onPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-pink-500"
                />
                <span className="text-sm text-white/70">
                  <span className="block text-white">Private mode</span>
                  <span className="block text-white/45 text-xs mt-0.5">
                    This toggle hides the counters from quick view.
                  </span>
                </span>
              </label>

              <div className="pt-5 border-t border-white/10">
                <BackupSection
                  userId={userId}
                  memories={memories}
                  settings={{ anniversary, lastSeen, privacy }}
                  onRestored={onRestored}
                />
              </div>

              <div className="pt-3 border-t border-white/10">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-rose-300"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset all data
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white/60">Erase everything?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onReset();
                        setConfirmReset(false);
                        setOpen(false);
                      }}
                      className="rounded-full bg-rose-500/90 px-3 py-1 text-xs text-white hover:bg-rose-500"
                    >
                      Yes, erase
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/10 space-y-2">
                <p className="text-[11px] uppercase tracking-wider text-white/35">Account recovery</p>
                <button type="button" onClick={async () => { const { data } = await supabase.auth.getUser(); const email = data.user?.email; if (!email) { setPasscodeMessage("No account email is available."); return; } const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); setPasscodeMessage(error ? error.message : "Password reset link sent to your account email. Use it to reset your login password or contact support to recover a forgotten passcode."); }} className="block text-[11px] text-white/45 hover:text-pink-300">Forgot login password? Reset it by email.</button>
              </div>
              <p className="text-[11px] leading-relaxed text-white/35">
                Your dates and memories are saved
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-white/35 mt-1">{hint}</span>}
    </label>
  );
}
