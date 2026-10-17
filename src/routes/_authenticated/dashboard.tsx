import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Lock, Users, PlayCircle, ClipboardList, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useProfile, ksh, errMsg } from "@/lib/account";
import { useServerFn } from "@tanstack/react-start";
import { startActivationPush } from "@/lib/mpesa.functions";
import { paymentOutcome, type PaymentAttempt } from "@/lib/payment-outcome";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My wallet — Work Cash" }, { name: "description", content: "Your Work Cash wallets and earnings." }, { property: "og:title", content: "My wallet — Work Cash" }, { property: "og:description", content: "Manage your Work Cash activation, wallets and earnings." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data: p, isLoading } = useProfile();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [attempt, setAttempt] = useState<PaymentAttempt | null>(null);
  const { data: payments } = useQuery({
    queryKey: ["my-payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activation_payments").select("*").order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: attempt ? 4000 : 10000,
  });
  const latest = payments?.[0];
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("workcash-payment-attempt") ?? "null");
      if (saved && typeof saved.startedAt === "number" && Date.now() - saved.startedAt < 86400000 &&
        (saved.previousPaymentId === null || typeof saved.previousPaymentId === "string")) setAttempt(saved);
    } catch { /* Ignore unavailable storage or stale data. */ }
  }, []);
  useEffect(() => {
    if (!attempt) return;
    const timer = setInterval(() => void qc.invalidateQueries({ queryKey: ["profile"] }), 4000);
    return () => clearInterval(timer);
  }, [attempt, qc]);
  useEffect(() => {
    const outcome = paymentOutcome(!!p?.is_activated, attempt, latest);
    if (!outcome) return;
    try { sessionStorage.removeItem("workcash-payment-attempt"); } catch { /* Storage is optional. */ }
    setAttempt(null);
    void navigate({ to: outcome === "success" ? "/payment-success" : "/payment-failed", replace: true });
  }, [p?.is_activated, attempt, latest, navigate]);
  function trackPayment() {
    const next = { previousPaymentId: latest?.id ?? null, startedAt: Date.now() };
    setAttempt(next);
    try { sessionStorage.setItem("workcash-payment-attempt", JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }
  function paymentStartFailed() {
    setAttempt(null);
    try { sessionStorage.removeItem("workcash-payment-attempt"); } catch { /* Storage is optional. */ }
    void navigate({ to: "/payment-failed" });
  }
  const { data: refs } = useQuery({
    queryKey: ["refcount", p?.id],
    enabled: !!p,
    queryFn: async () => {
      if (!p) return 0;
      return (await supabase.rpc("referral_count", { _user: p.id })).data ?? 0;
    },
  });
  if (isLoading || !p) return <Loader2 className="mx-auto mt-20 h-8 w-8 animate-spin text-primary" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hi {p.full_name?.split(" ")[0] || "there"} 👋</h1>
        <p className="text-muted-foreground">{p.is_activated ? "Your account is active — start earning." : "Activate your account to unlock tasks."}</p>
      </div>
      {!p.is_activated && <Activation phone={p.phone} latest={latest} waiting={!!attempt && latest?.status === "pending"} onStarted={trackPayment} onFailed={paymentStartFailed} />}
      <div className="grid gap-6 lg:grid-cols-2">
        <WalletCard
          wallet="earnings"
          title="Earnings wallet"
          subtitle="Videos & surveys"
          balance={Number(p.balance)}
          target={600}
          canWithdraw={p.is_activated && Number(p.balance) >= 600}
          maxAmount={Math.max(0, Number(p.balance) - 100)}
          rule="Withdraw when you reach KSh 600. KSh 100 activation fee stays in your account."
          phone={p.phone}
        />
        <WalletCard
          wallet="referral"
          title="Referral wallet"
          subtitle={`${refs ?? 0} activated invites`}
          balance={Number(p.referral_balance)}
          target={60}
          canWithdraw={p.is_activated && Number(p.referral_balance) >= 60 && (refs ?? 0) >= 3}
          maxAmount={Number(p.referral_balance)}
          rule="Withdraw from KSh 60 after 3 activated referrals."
          phone={p.phone}
        />
      </div>
      <ReferralCard code={p.referral_code} activated={p.is_activated} count={refs ?? 0} />
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

function Activation({ phone: initial, latest, waiting, onStarted, onFailed }: { phone: string; latest?: { status: string }; waiting: boolean; onStarted: () => void; onFailed: () => void }) {
  const [phone, setPhone] = useState(initial);
  const [code, setCode] = useState("");
  const qc = useQueryClient();
  const [pushing, setPushing] = useState(false);
  const stk = useServerFn(startActivationPush);
  async function push() {
    if (!/^(?:\+?254|0)[17]\d{8}$/.test(phone.trim())) {
      toast.error("Enter a valid M-Pesa phone number, such as 0712345678.");
      return;
    }
    onStarted();
    setPushing(true);
    try {
      await stk({ data: { phone: phone.trim() } });
      toast.success("Check your phone and enter your M-Pesa PIN.");
      void qc.invalidateQueries({ queryKey: ["my-payments"] });
    } catch (e) {
      toast.error(errMsg(e));
      onFailed();
    } finally {
      setPushing(false);
    }
  }

  async function submit() {
    const { error } = await supabase.rpc("submit_manual_payment", { _phone: phone, _code: code.trim() });
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted! The admin will confirm your payment shortly.");
    setCode("");
    onStarted();
    qc.invalidateQueries({ queryKey: ["my-payments"] });
  }

  const statusText: Record<string, string> = {
    paid: "Code received ✓ — waiting for admin approval.",
    rejected: "Your payment was not confirmed. Check the code and try again.",
  };

  return (
    <div className="rounded-3xl border-2 border-gold bg-card p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-gold p-3 text-gold-foreground"><Lock className="h-6 w-6" /></div>
        <div className="flex-1">
          <h2 className="text-xl font-bold">Activate your account — KSh 100</h2>
          <p className="text-sm text-muted-foreground">The KSh 100 goes into your wallet. Activation unlocks videos, surveys and invite bonuses.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div><Label>M-Pesa phone number</Label><Input className="mt-1.5 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" /></div>
        <Button className="h-11 bg-gold text-gold-foreground hover:bg-gold/90" disabled={pushing} onClick={push}>
      {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Click here to activate now
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">You'll get an M-Pesa prompt on your phone. Enter your PIN and your account activates automatically.</p>
      {waiting && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-primary"><Loader2 className="h-4 w-4 animate-spin" />Waiting for M-Pesa confirmation…</p>}
      <p className="mt-5 text-sm font-semibold">Paid but your account is still inactive?</p>
      <p className="mt-1 text-sm text-muted-foreground">Enter the M-Pesa code from your payment SMS below for admin review. You don't need to pay again.</p>
      {latest && statusText[latest.status] && (
        <div className="mt-4 rounded-xl bg-accent px-4 py-3 text-sm font-medium">{statusText[latest.status]}</div>
      )}
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div><Label htmlFor="payment-phone">Phone you paid from</Label><Input id="payment-phone" className="mt-1.5 h-11" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" /></div>
        <div><Label htmlFor="payment-code">M-Pesa code</Label><Input id="payment-code" className="mt-1.5 h-11 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SJK3XXXXXX" /></div>
        <Button className="h-11" onClick={submit} disabled={latest?.status === "paid" || !code.trim()}>Submit code</Button>
      </div>
    </div>
  );
}

function WalletCard(props: { wallet: "earnings" | "referral"; title: string; subtitle: string; balance: number; target: number; canWithdraw: boolean; maxAmount: number; rule: string; phone: string }) {
  const [amount, setAmount] = useState(String(props.maxAmount || ""));
  const [phone, setPhone] = useState(props.phone);
  const qc = useQueryClient();
  async function withdraw() {
    const { error } = await supabase.rpc("request_withdrawal", { _amount: Number(amount), _phone: phone.trim(), _wallet: props.wallet });
    if (error) { toast.error(error.message); return; }
    toast.success("Withdrawal requested. You'll receive it on M-Pesa once processed.");
    qc.invalidateQueries();
  }
  const pct = Math.min(100, (props.balance / props.target) * 100);
  const dark = props.wallet === "earnings";
  return (
    <div className={`rounded-3xl p-6 ${dark ? "bg-ink text-ink-foreground" : "bg-primary text-primary-foreground"}`}>
      <div className="flex justify-between"><p className="font-semibold">{props.title}</p><p className="text-sm opacity-70">{props.subtitle}</p></div>
      <p className="mt-2 font-display text-5xl font-bold">{ksh(props.balance)}</p>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs opacity-80"><span>Withdrawal limit</span><span>{ksh(props.balance)} / KSh {props.target}</span></div>
        <Progress value={pct} className="h-2 bg-background/20 [&>div]:bg-gold" />
      </div>
      <p className="mt-3 text-xs opacity-75">{props.rule}</p>
      {props.canWithdraw && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input className="h-11 border-transparent bg-background/15 text-inherit" type="number" max={props.maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input className="h-11 border-transparent bg-background/15 text-inherit" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712345678" />
          <Button className="h-11 bg-gold text-gold-foreground hover:bg-gold/90" onClick={withdraw}>Withdraw</Button>
        </div>
      )}
    </div>
  );
}

function ReferralCard({ code, activated, count }: { code: string; activated: boolean; count: number }) {
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth?ref=${code}` : "";
  if (!activated) {
    return (
      <div className="rounded-3xl border bg-card p-6">
        <div className="flex items-center gap-3"><Lock className="h-6 w-6 text-gold" /><h2 className="text-xl font-bold">Invite & earn KSh 20 per person</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Your invite code unlocks once your KSh 100 activation is approved.</p>
      </div>
    );
  }
  return (
    <div className="rounded-3xl border bg-card p-6">
      <div className="flex items-center gap-3"><Users className="h-6 w-6 text-primary" /><h2 className="text-xl font-bold">Invite & earn KSh 20 per person</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">You get KSh 20 in your referral wallet when someone joins with your link and activates.</p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div><p className="text-xs uppercase text-muted-foreground">Your invite code</p><p className="font-display text-3xl font-bold tracking-widest">{code}</p></div>
        <p className="text-sm"><b>{count}</b> activated friends</p>
      </div>
      <div className="mt-3 flex gap-2">
        <Input readOnly value={link} className="h-10 text-xs" />
        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copied"); }}><Copy className="h-4 w-4" /></Button>
      </div>
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
