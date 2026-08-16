import { useState } from "react";
import { leagueLogoUrl } from "@/lib/league-logos";

export function LeagueLogo({
  league,
  size = 28,
  className = "",
}: {
  league: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const source = leagueLogoUrl(league, size * 2);
  if (!source || failed) return null;

  const filterClass = source.monochrome
    ? "brightness-0 invert drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
    : "";

  return (
    <img
      src={source.url}
      alt={`${league} logo`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`league-logo-3d shrink-0 object-contain ${filterClass} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function LeagueBadge({ league, size = 28 }: { league: string; size?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-secondary px-2 py-1 text-foreground">
      <LeagueLogo league={league} size={size} />
      {league}
    </span>
  );
}
