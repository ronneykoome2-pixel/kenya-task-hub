import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Smartphone, Users, PlayCircle, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useProfile, ksh, errMsg } from "@/lib/account";
import { startActivationPayment } from "@/lib/mpesa.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My wallet — Work Cash" }, { name: "description", content: "Your Work Cash wallet and earnings." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: p, isLoading } = useProfile();
  if (isLoading || !p) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hi {p.full_name?.split(" ")[0] || "there"} 👋</h1>
        <p className="text-muted-foreground">{p.is_activated ? "Your account is active — start earning." : "Activate your account to unlock tasks."}</p>
      </div>
      {!p.is_activated && <Activation phone={p.phone} />}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <WalletCard balance={Number(p.balance)} activated={p.is_activated} phone={p.phone} />
        <ReferralCard code={p.referral_code} userId={p.id} activated={p.is_activated} />
      </div>
      {p.is_activated && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/videos" className="flex items-center gap-4 rounded-2xl border bg-card p-5 hover:border-primary"><PlayCircle className="h-10 w-10 text-primary" /><div><p className="font-semibold">Watch ad videos</p><p className="text-sm text-muted-foreground">KSh 10–20 each</p></div></Link>
          <Link to="/surveys" className="flex items-center gap-4 rounded-2xl border bg-card p-5 hover:border-primary"><ClipboardList className="h-10 w-10 text-primary" /><div><p className="font-semibold">Take surveys</p><p className="text-sm text-muted-foreground">Paid per completed survey</p></div></Link>
        </div>
      )}
      <History />
    </div>
  );
}

function Activation({ phone: initial }: { phone: string }) {
  const [phone, setPhone] = useState(initial);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const qc = useQueryClient();
  const pay = useServerFn(startActivationPayment);
  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => (await supabase.from("activation_payments").select("*").order("created_at", { ascending: false }).limit(5)).data ?? [],
    refetchInterval: 8000,
  });
  const latest = payments?.[0];

  async function stk() {
    setBusy(true);
    try {
      const r = await pay({ data: { phone } });
      if (!r.ok) { toast.error(r.error); setShowManual(true); }
      else { toast.success("Check your phone and enter your M-Pesa PIN."); qc.invalidateQueries({ queryKey: ["my-payments"] }); }
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function manual() {
    const { error } = await supabase.rpc("submit_manual_payment", { _phone: phone, _code: code.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted! The admin will confirm your payment shortly.");
    setCode("");
    qc.invalidateQueries({ queryKey: ["my-payments"] });
  }

  const statusText: Record<string, string> = {
    pending: "Waiting for you to confirm on your phone…",
    paid: "Payment received ✓ — waiting for admin approval.",
    failed: "Payment didn't go through. Please try again.",
    rejected: "Payment was rejected by admin. Contact support or try again.",
  };

  return (
    <div className="rounded-3xl border-2 border-gold bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-gold p-3 text-gold-foreground"><Lock className="h-6 w-6" /></div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Activate your account — KSh 100</h2>
          <p className="text-sm text-muted-foreground">The KSh 100 goes straight into your wallet. Activation unlocks videos, surveys and invite bonuses.</p>
        </div>
      </div>
      {latest && latest.status !== "approved" && (
        <div className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm font-medium">{statusText[latest.status] ?? latest.status}</div>
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1"><Label>M-Pesa number</Label><Input className="mt-1.5 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" /></div>
        <Button className="h-11" onClick={stk} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}Pay KSh 100 with M-Pesa</Button>
      </div>
      <button className="mt-3 text-sm text-primary hover:underline" onClick={() => setShowManual(!showManual)}>Already paid? Enter your M-Pesa code</button>
      {showManual && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1"><Label>M-Pesa transaction code</Label><Input className="mt-1.5 h-11 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SJK3XXXXXX" /></div>
          <Button variant="outline" className="h-11" onClick={manual}>Submit code</Button>
        </div>
      )}
    </div>
  );
}

function WalletCard({ balance, activated, phone: initial }: { balance: number; activated: boolean; phone: string }) {
  const [amount, setAmount] = useState("800");
  const [phone, setPhone] = useState(initial);
  const qc = useQueryClient();
  async function withdraw() {
    const { error } = await supabase.rpc("request_withdrawal", { _amount: Number(amount), _phone: phone.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal requested. You'll receive it on M-Pesa once processed.");
    qc.invalidateQueries();
  }
  const pct = Math.min(100, (balance / 800) * 100);
  return (
    <div className="rounded-3xl bg-ink p-6 text-ink-foreground">
      <p className="text-sm opacity-70">Wallet balance</p>
      <p className="font-display text-5xl font-bold">{ksh(balance)}</p>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs opacity-80"><span>Withdrawal limit</span><span>{ksh(balance)} / KSh 800</span></div>
        <Progress value={pct} className="h-2 bg-sidebar-accent [&>div]:bg-gold" />
      </div>
      {activated && balance >= 800 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input className="h-11 border-sidebar-border bg-sidebar-accent text-ink-foreground" type="number" min={800} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input className="h-11 border-sidebar-border bg-sidebar-accent text-ink-foreground" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" />
          <Button className="h-11 bg-gold text-gold-foreground hover:bg-gold/90" onClick={withdraw}>Withdraw</Button>
        </div>
      ) : (
        <p className="mt-5 text-sm opacity-70">Reach KSh 800 to withdraw to M-Pesa.</p>
      )}
    </div>
  );
}

function ReferralCard({ code, userId, activated }: { code: string; userId: string; activated: boolean }) {
  const { data: count } = useQuery({ queryKey: ["refcount"], queryFn: async () => (await supabase.rpc("referral_count", { _user: userId })).data ?? 0 });
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";
  return (
    <div className="rounded-3xl border bg-card p-6">
      <div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><h2 className="text-xl font-bold">Invite & earn KSh 50</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">Earn KSh 50 when someone joins with your link and activates. {!activated && "(Activate first to qualify.)"}</p>
      <p className="mt-4 text-xs uppercase text-muted-foreground">Your invite code</p>
      <p className="font-display text-3xl font-bold tracking-widest">{code}</p>
      <div className="mt-3 flex gap-2">
        <Input readOnly value={link} className="h-10 text-xs" />
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
      </div>
      <p className="mt-4 text-sm"><span className="font-bold">{count}</span> activated friends · <span className="font-bold text-primary">{ksh((count ?? 0) * 50)}</span> earned</p>
    </div>
  );
}

function History() {
  const { data } = useQuery({
    queryKey: ["tx"],
    queryFn: async () => (await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  return (
    <div className="rounded-3xl border bg-card p-6">
      <h2 className="text-xl font-bold">Recent activity</h2>
      {!data?.length ? <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p> : (
        <ul className="mt-3 divide-y">
          {data.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-3 text-sm">
              <div><p className="font-medium">{t.description}</p><p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("en-KE")}</p></div>
              <span className={`font-semibold ${Number(t.amount) >= 0 ? "text-primary" : "text-destructive"}`}>{Number(t.amount) >= 0 ? "+" : ""}{ksh(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
