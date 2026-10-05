import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LockedNotice() {
  return (
    <div className="mx-auto max-w-md rounded-3xl border bg-card p-8 text-center">
      <Lock className="mx-auto h-10 w-10 text-gold" />
      <h2 className="mt-3 text-xl font-bold">Activate to unlock tasks</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pay KSh 100 once — it goes into your wallet.</p>
      <Button asChild className="mt-5"><Link to="/dashboard">Activate now</Link></Button>
    </div>
  );
}
