import { useState } from "react";
import { leagueLogoUrl } from "@/lib/league-logos";

export function LeagueLogo({
  league,
  size = 20,
  className = "",
}: {
  league: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = leagueLogoUrl(league, size * 2);
  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={`${league} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-[4px] bg-white/90 object-contain p-[2px] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function LeagueBadge({ league, size = 18 }: { league: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-foreground">
      <LeagueLogo league={league} size={size} />
      {league}
    </span>
  );
}
