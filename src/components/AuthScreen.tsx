import { useState, type FormEvent } from "react";
import { Heart, Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [notice, setNotice] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice(""); setBusy(true);
    try {
      if (forgot) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: "https://newwchtgpp.vercel.app/reset-password",
        });
        if (resetError) throw resetError;
        setNotice("Password reset link sent. Open the email on this device to choose a new password.");
        return;
      }
      const result = create
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) throw result.error;
      if (create && !result.data.session) setNotice("Account created. Check your email to confirm it, then sign in.");
    } catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed. Please try again."); }
    finally { setBusy(false); }
  }
  return <div className="app-bg min-h-screen flex items-center justify-center px-4 py-10"><div className="w-full max-w-sm"><div className="text-center"><div className="inline-flex items-center gap-2 text-pink-300/80 text-xs uppercase tracking-[0.2em]"><Heart className="h-3.5 w-3.5"/>Our Untold Story</div><h1 className="mt-3 font-serif text-4xl text-white">Our Untold Story</h1><p className="mt-2 text-sm text-white/50">{forgot ? "Reset your login password" : create ? "Create your account" : "Sign in with your email and password"}</p></div><form onSubmit={submit} className="mt-8 rounded-3xl border border-white/10 bg-[#0a0a12]/80 p-6 backdrop-blur space-y-4"><label className="block"><span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">Email</span><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="input" placeholder="you@example.com"/></label>{!forgot && <label className="block"><span className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">Password</span><div className="relative"><input type={show?"text":"password"} required minLength={6} autoComplete={create?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} className="input pr-12" placeholder="Your password"/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45" aria-label={show?"Hide password":"Show password"}>{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></label>}{notice&&<p role="status" className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-sm text-emerald-200">{notice}</p>}{error&&<p role="alert" className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-2 text-sm text-rose-200">{error}</p>}<button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-pink-500 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy&&<Loader2 className="h-4 w-4 animate-spin"/>}{forgot ? "Send reset link" : create?"Create account":"Sign in"}</button>{!forgot && !create && <button type="button" onClick={()=>{setForgot(true);setError("");setNotice("")}} className="w-full text-xs text-pink-300/80 hover:text-pink-200">Forgot password?</button>}<button type="button" onClick={()=>{setForgot(false);setCreate(v=>!v);setError("");setNotice("")}} className="w-full text-xs text-white/50 hover:text-white">{forgot?"Back to sign in":create?"Already have an account? Sign in":"New here? Create an account"}</button></form></div></div>;
}
