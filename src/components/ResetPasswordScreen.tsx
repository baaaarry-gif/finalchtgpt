import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Heart, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function ResetPasswordScreen() {
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(!!session);
      setReady(true);
    });
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      setHasSession(!!data.session);
      if (sessionError) setError(sessionError.message);
      setReady(true);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(""); setMessage("");
    if (password.length < 6) { setError("Your password must contain at least 6 characters."); return; }
    if (password !== confirm) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setMessage("Your password has been updated. You can now sign in with your new password.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update your password. Request a new reset link and try again.");
    } finally { setBusy(false); }
  }

  return <div className="app-bg min-h-screen flex items-center justify-center px-4 py-10"><div className="w-full max-w-sm"><div className="text-center"><div className="inline-flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]"><Heart className="h-3.5 w-3.5"/>Our Untold Story</div><h1 className="mt-3 font-serif text-3xl text-white">Create a new password</h1><p className="mt-2 text-sm text-white/50">Choose a new password for your account.</p></div><div className="mt-8 rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 space-y-4">
    {!ready ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-pink-300"/></div> : !hasSession ? <><p className="text-sm text-rose-200">This reset link is invalid, expired, or already used. Request a new password-reset email from the sign-in page.</p><a href="/" className="block text-center rounded-full bg-pink-500 px-4 py-2.5 text-sm text-white">Back to sign in</a></> : message ? <><p role="status" className="text-sm text-emerald-200">{message}</p><a href="/" className="block text-center rounded-full bg-pink-500 px-4 py-2.5 text-sm text-white">Continue to sign in</a></> : <form onSubmit={submit} className="space-y-4"><label className="block"><span className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">New password</span><div className="relative"><input required minLength={6} autoComplete="new-password" type={show ? "text" : "password"} value={password} onChange={e=>setPassword(e.target.value)} className="input pr-12" placeholder="At least 6 characters"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45" aria-label={show?"Hide password":"Show password"}>{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></label><label className="block"><span className="mb-1.5 block text-xs uppercase tracking-wider text-white/40">Confirm new password</span><input required minLength={6} autoComplete="new-password" type={show ? "text" : "password"} value={confirm} onChange={e=>setConfirm(e.target.value)} className="input" placeholder="Enter it again"/></label>{error&&<p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>}<button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}Update password</button></form>}
  </div></div></div>;
}
