import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

const search = z.object({
  mode: z.enum(["login", "signup", "forgot"]).optional(),
  ref: z.string().max(20).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Log in or join — Work Cash" },
      { name: "description", content: "Sign in to your Work Cash account or create a new one to start earning." },
      { property: "og:title", content: "Log in or join Work Cash" },
      { property: "og:description", content: "Start earning from online tasks in Kenya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(100),
  phone: z.string().trim().regex(/^(?:\+?254|0)[17]\d{8}$/, "Enter a valid Kenyan phone, e.g. 0712345678"),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const { mode: m, ref } = Route.useSearch();
  const mode = m ?? (ref ? "signup" : "login");
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", password: "", ref: ref ?? "" });

  useEffect(() => {
    if (ref) localStorage.setItem("wc_ref", ref);
    else {
      const saved = localStorage.getItem("wc_ref");
      if (saved) setForm((f) => ({ ...f, ref: saved }));
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [ref, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(form);
        if (!parsed.success) return toast.error(parsed.error.issues[0].message);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin + "/dashboard",
            data: { full_name: parsed.data.full_name, phone: parsed.data.phone, ref: form.ref.trim() },
          },
        });
        if (error) return toast.error(error.message);
        localStorage.removeItem("wc_ref");
        toast.success("Account created! Check your email to confirm, then log in.");
        navigate({ to: "/auth", search: { mode: "login" } });
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) return toast.error(error.message);
        toast.success("Check your email for a reset link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) return toast.error(error.message);
        navigate({ to: "/dashboard" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (form.ref) localStorage.setItem("wc_ref", form.ref);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) return toast.error("Google sign-in failed");
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  const titles = { login: "Welcome back", signup: "Create your account", forgot: "Reset your password" };

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink p-10 text-ink-foreground md:flex">
        <Logo light />
        <div>
          <h2 className="text-5xl font-bold leading-tight">Turn spare minutes<br />into <span className="text-gold">M-Pesa cash.</span></h2>
          <ul className="mt-8 space-y-3 text-lg opacity-90">
            <li>▸ KSh 10–20 per ad video</li>
            <li>▸ Paid live surveys</li>
            <li>▸ KSh 50 for every friend who activates</li>
            <li>▸ Withdraw from KSh 800</li>
          </ul>
        </div>
        <p className="text-sm opacity-60">Your KSh 100 activation fee goes straight into your wallet.</p>
      </div>

      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 md:hidden"><Logo /></div>
          <h1 className="text-3xl font-bold">{titles[mode]}</h1>
          <p className="mt-1 text-muted-foreground">
            {mode === "signup" ? "Join free — activate later to unlock tasks." : mode === "login" ? "Log in to keep earning." : "We'll email you a reset link."}
          </p>

          {mode !== "forgot" && (
            <>
              <Button type="button" variant="outline" className="mt-6 h-11 w-full" onClick={google}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div><Label>Full name</Label><Input className="mt-1.5 h-11" value={form.full_name} onChange={set("full_name")} placeholder="Jane Wanjiku" /></div>
                <div><Label>M-Pesa phone number</Label><Input className="mt-1.5 h-11" value={form.phone} onChange={set("phone")} placeholder="0712345678" /></div>
              </>
            )}
            <div><Label>Email</Label><Input type="email" className="mt-1.5 h-11" value={form.email} onChange={set("email")} placeholder="you@example.com" required /></div>
            {mode !== "forgot" && (
              <div>
                <div className="flex justify-between">
                  <Label>Password</Label>
                  {mode === "login" && <Link to="/auth" search={{ mode: "forgot" }} className="text-xs text-primary hover:underline">Forgot password?</Link>}
                </div>
                <Input type="password" className="mt-1.5 h-11" value={form.password} onChange={set("password")} required />
              </div>
            )}
            {mode === "signup" && (
              <div><Label>Invite code (optional)</Label><Input className="mt-1.5 h-11 uppercase" value={form.ref} onChange={set("ref")} placeholder="ABC1234" /></div>
            )}
            <Button type="submit" className="h-11 w-full text-base" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : mode === "login" ? "Log in" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signup" ? (
              <>Already have an account? <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-primary">Log in</Link></>
            ) : (
              <>New here? <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-primary">Create an account</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
