import { Link } from "@tanstack/react-router";
import type { Sport } from "@/lib/betting-data";
import { getSportImage } from "@/lib/sport-media";

export function SportPill({ sport }: { sport: Sport }) {
  return (
    <Link
      to="/sports/$sportId"
      params={{ sportId: sport.id }}
      activeProps={{ className: "ring-2 ring-primary" }}
      className="group relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card"
    >
      <img
        src={getSportImage(sport.id)}
        alt={`${sport.name} betting`}
        loading="lazy"
        width={640}
        height={640}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <span className="absolute bottom-2 left-3 text-sm font-bold tracking-tight text-foreground">
        {sport.name}
      </span>
    </Link>
  );
}
