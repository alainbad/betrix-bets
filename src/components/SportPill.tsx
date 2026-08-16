import { Link } from "@tanstack/react-router";
import type { Sport } from "@/lib/betting-data";

export function SportPill({ sport }: { sport: Sport }) {
  return (
    <Link
      to="/sports/$sportId"
      params={{ sportId: sport.id }}
      activeProps={{ className: "border-primary text-primary" }}
      className="flex min-w-[6rem] flex-col items-center gap-2 rounded-2xl border border-border bg-secondary p-4 text-center transition-all hover:border-primary/50 hover:bg-betrix-surface-elevated"
    >
      <span className="text-2xl" aria-hidden="true">
        {sport.icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{sport.name}</span>
    </Link>
  );
}
