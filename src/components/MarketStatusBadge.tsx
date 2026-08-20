import { Lock, PauseCircle, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketStatus } from "@/lib/betting-data";

const CONFIG: Record<
  Exclude<MarketStatus, "open">,
  { label: string; icon: typeof Lock; className: string }
> = {
  suspended: {
    label: "Suspended",
    icon: PauseCircle,
    className: "bg-destructive/15 text-destructive",
  },
  closed: { label: "Closed", icon: Lock, className: "bg-secondary text-muted-foreground" },
  settled: { label: "Settled", icon: Lock, className: "bg-secondary text-muted-foreground" },
};

/**
 * Shows why a market cannot be bet right now. Open markets render a quiet
 * "Betting open" cue only when `showOpen` is set (detail views), so lists are
 * not littered with badges on every healthy market.
 */
export function MarketStatusBadge({
  status,
  showOpen = false,
  className,
}: {
  status: MarketStatus;
  showOpen?: boolean;
  className?: string;
}) {
  if (status === "open") {
    if (!showOpen) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary",
          className,
        )}
      >
        <Radio className="h-3 w-3" />
        Betting open
      </span>
    );
  }

  const config = CONFIG[status] ?? CONFIG.closed;
  const Icon = config.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        config.className,
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}
