import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — Work Cash" },
      { name: "description", content: "Choose a new password for your Work Cash account." },
      { property: "og:title", content: "Reset password — Work Cash" },
      { property: "og:description", content: "Choose a new password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("At least 8 characters");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={save} className="w-full max-w-sm space-y-4">
        <Logo />
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <div><Label>New password</Label><Input type="password" className="mt-1.5 h-11" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="h-11 w-full">Save password</Button>
      </form>
    </div>
  );
}
