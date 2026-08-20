import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import { recordOdds } from "@/lib/odds-history";
import type { MarketStatus, Selection } from "@/lib/betting-data";

const CUE_MS = 1600;

/**
 * Row-style price button used on the event board: name on the left, price on
 * the right, the way a real sportsbook coupon reads on mobile.
 */
export function MarketRow({
  selection,
  label,
  sublabel,
  active,
  onClick,
  marketStatus = "open",
}: {
  selection: Selection;
  label: string;
  sublabel?: string | undefined;
  active?: boolean;
  onClick?: () => void;
  marketStatus?: MarketStatus;
}) {
  const previous = useRef(selection.odds);
  const [direction, setDirection] = useState<"up" | "down" | null>(null);

  const status: MarketStatus =
    selection.status && selection.status !== "open" ? selection.status : marketStatus;
  const bettable = status === "open";

  useEffect(() => {
    recordOdds(selection.id, selection.odds);
  }, [selection.id, selection.odds]);

  useEffect(() => {
    const before = previous.current;
    if (before === selection.odds) return;
    previous.current = selection.odds;
    setDirection(selection.odds > before ? "up" : "down");
    const timer = setTimeout(() => setDirection(null), CUE_MS);
    return () => clearTimeout(timer);
  }, [selection.odds]);

  return (
    <button
      type="button"
      onClick={bettable ? onClick : undefined}
      disabled={!bettable}
      aria-pressed={bettable ? Boolean(active) : undefined}
      aria-label={
        bettable
          ? `${label}${sublabel ? ` ${sublabel}` : ""}, odds ${formatOdds(selection.odds)}. ${
              active ? "In your bet slip, activate to remove" : "Activate to add to bet slip"
            }.`
          : `${label}, odds ${formatOdds(selection.odds)}. Market ${status}, betting unavailable.`
      }
      className={cn(
        "flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary/15"
          : "border-border bg-betrix-surface hover:border-primary/40 hover:bg-betrix-surface-elevated",
        !bettable && "cursor-not-allowed opacity-50",
        direction === "up" && "odds-flash-up",
        direction === "down" && "odds-flash-down",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{label}</span>
        {sublabel && (
          <span className="block truncate text-[11px] text-muted-foreground">{sublabel}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {direction === "up" && <ArrowUp className="h-3 w-3 text-accent" />}
        {direction === "down" && <ArrowDown className="h-3 w-3 text-destructive" />}
        {!bettable && <Lock className="h-3 w-3 text-muted-foreground" />}
        <span className="text-base font-black tabular-nums text-primary">
          {formatOdds(selection.odds)}
        </span>
      </span>
    </button>
  );
}
