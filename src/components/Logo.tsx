import { Link } from "@tanstack/react-router";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold font-display text-lg font-bold text-gold-foreground">W</span>
      <span className={`font-display text-xl font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>
        Work<span className="text-primary">Cash</span>
      </span>
    </Link>
  );
}
