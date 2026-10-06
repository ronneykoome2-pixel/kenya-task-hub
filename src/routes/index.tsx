import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayCircle, ClipboardList, Users, Wallet, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Work Cash — Get paid for simple online tasks in Kenya" },
      { name: "description", content: "Watch ad videos, take paid surveys and invite friends. Withdraw your KSh earnings to M-Pesa." },
      { property: "og:title", content: "Work Cash — Earn online in Kenya" },
      { property: "og:description", content: "Watch ads, complete surveys and invite friends. Withdraw to M-Pesa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const ways = [
  { icon: PlayCircle, title: "Watch ad videos", amount: "KSh 10 – 20", text: "Watch short videos to the end and get paid for each one." },
  { icon: ClipboardList, title: "Take surveys", amount: "Paid per survey", text: "Share your opinion in live surveys from trusted research partners." },
  { icon: Users, title: "Invite friends", amount: "KSh 20", text: "Get paid for every friend who joins and activates their account." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex gap-2">
          <Button asChild variant="ghost"><Link to="/auth">Log in</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Join now</Link></Button>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 md:grid-cols-[1.2fr_1fr] md:pt-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Made for Kenya · Withdraw to M-Pesa
          </span>
          <h1 className="mt-5 text-5xl font-bold leading-[1.02] md:text-7xl">
            Your phone.<br />Your time.<br /><span className="text-primary">Your cash.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted-foreground">
            Complete simple online tasks — videos, surveys and invites — and grow your wallet in Kenya shillings.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/auth" search={{ mode: "signup" }}>Create free account <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
              <Link to="/auth">I have an account</Link>
            </Button>
          </div>
        </div>

        <div className="relative rounded-3xl bg-ink p-7 text-ink-foreground shadow-2xl">
          <p className="text-sm opacity-70">Wallet balance</p>
          <p className="mt-1 font-display text-5xl font-bold">KSh 1,240</p>
          <div className="mt-6 space-y-3">
            {[["Ad video watched", "+15"], ["Survey completed", "+65"], ["Friend activated", "+20"], ["Activation deposit", "+100"]].map(([a, b]) => (
              <div key={a} className="flex items-center justify-between rounded-xl bg-sidebar-accent px-4 py-3 text-sm">
                <span>{a}</span><span className="font-semibold text-gold">KSh {b}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl bg-gold px-4 py-3 text-center text-sm font-semibold text-gold-foreground">
            Withdraw from KSh 600 to M-Pesa
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16">
        <h2 className="text-3xl font-bold">Three ways to earn</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {ways.map((w) => (
            <div key={w.title} className="rounded-2xl border bg-card p-6">
              <w.icon className="h-8 w-8 text-primary" />
              <h3 className="mt-4 text-xl font-semibold">{w.title}</h3>
              <p className="mt-1 font-semibold text-primary">{w.amount}</p>
              <p className="mt-2 text-sm text-muted-foreground">{w.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-6 rounded-3xl bg-primary p-8 text-primary-foreground md:grid-cols-4">
          {[["1", "Sign up", "Create your free account"], ["2", "Activate", "Pay KSh 100 to Till 6412161 — it goes into your wallet"], ["3", "Earn", "Unlock videos, surveys and invites"], ["4", "Withdraw", "Cash out earnings from KSh 600, referrals from KSh 60"]].map(([n, t, d]) => (
            <div key={n}>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold font-bold text-gold-foreground">{n}</div>
              <h3 className="mt-3 text-lg font-semibold">{t}</h3>
              <p className="text-sm opacity-85">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        <Wallet className="mx-auto mb-2 h-5 w-5" /> © {new Date().getFullYear()} Work Cash Kenya
      </footer>
    </div>
  );
}
