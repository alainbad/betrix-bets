import { useState } from "react";
import { teamLogoUrl } from "@/lib/team-logos";

/**
 * Renders a real club/franchise crest. Falls back to a monogram tile when the
 * team has no brand domain (e.g. individual tennis players).
 */
export function TeamLogo({
  team,
  size = 36,
  className = "",
}: {
  team: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = teamLogoUrl(team, size * 2);

  if (!url || failed) {
    return (
      <span
        aria-hidden
        className={`flex shrink-0 items-center justify-center rounded-full bg-betrix-surface-elevated text-[11px] font-black uppercase text-muted-foreground ${className}`}
        style={{ width: size, height: size }}
      >
        {initials(team)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={`${team} crest`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`league-logo-3d shrink-0 object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("");
}
