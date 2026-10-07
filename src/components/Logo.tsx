import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.png";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src={logo} alt="WorkCash logo" className="h-10 w-10 rounded-xl object-contain" />
      <span className={`font-display text-xl font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>
        Work<span className="text-primary">Cash</span>
      </span>
    </Link>
  );
}
