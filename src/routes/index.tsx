import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayCircle, ClipboardList, Users, Wallet, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import hero from "@/assets/workcash-hero.png.asset.json";

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

      <section className="mx-auto max-w-6xl px-5 pb-12 pt-2">
        <h1 className="sr-only">WorkCash Kenya — Your skills. Real income.</h1>
        <Link to="/auth" search={{ mode: "signup" }} className="block overflow-hidden rounded-3xl shadow-2xl">
          <img src={hero.url} alt="WorkCash Kenya — find legit online jobs and earn. Start earning today." className="h-auto w-full" />
        </Link>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link to="/auth" search={{ mode: "signup" }}>Start earning today <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link to="/auth">I have an account</Link>
          </Button>
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
