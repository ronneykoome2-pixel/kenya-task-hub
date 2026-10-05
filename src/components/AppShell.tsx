import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { LayoutDashboard, PlayCircle, ClipboardList, Shield, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { useProfile, ksh } from "@/lib/account";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const links = [
    { to: "/dashboard", label: "Wallet", icon: LayoutDashboard },
    { to: "/videos", label: "Videos", icon: PlayCircle },
    { to: "/surveys", label: "Surveys", icon: ClipboardList },
    ...(profile?.isAdmin ? [{ to: "/admin", label: "Admin", icon: Shield }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-ink text-ink-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Logo light />
          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <Link key={l.to} to={l.to} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm opacity-80 hover:bg-sidebar-accent hover:opacity-100" activeProps={{ className: "bg-sidebar-accent !opacity-100" }}>
                <l.icon className="h-4 w-4" /> {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {profile && <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-gold-foreground">{ksh(profile.balance)}</span>}
            <button onClick={signOut} className="rounded-lg p-2 hover:bg-sidebar-accent" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>
        <nav className="flex justify-around border-t border-sidebar-border md:hidden">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="flex flex-1 flex-col items-center gap-1 py-2 text-xs opacity-70" activeProps={{ className: "!opacity-100 text-gold" }}>
              <l.icon className="h-5 w-5" /> {l.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
