import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import { recordOdds } from "@/lib/odds-history";
import { OddsSparkline } from "./OddsSparkline";
import type { MarketStatus, Selection } from "@/lib/betting-data";

interface OddsButtonProps {
  selection: Selection;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  caption?: string;
  /** Trading status of the parent market; selection status wins when stricter. */
  marketStatus?: MarketStatus;
  /** Show the session price-drift sparkline (detail views). */
  showHistory?: boolean;
}

type Direction = "up" | "down";

// How long the drift cue stays on screen after a price move. Long enough for a
// glance, short enough that a busy live board is not permanently flashing.
const CUE_MS = 1600;

export function OddsButton({
  selection,
  active,
  onClick,
  size = "md",
  caption,
  marketStatus = "open",
  showHistory = false,
}: OddsButtonProps) {
  const previousOdds = useRef(selection.odds);
  const [direction, setDirection] = useState<Direction | null>(null);
  // Bumped on every move so re-animating the same direction restarts the CSS
  // animation instead of being ignored as an unchanged class.
  const [pulse, setPulse] = useState(0);

  const status: MarketStatus =
    selection.status && selection.status !== "open" ? selection.status : marketStatus;
  const bettable = status === "open";

  useEffect(() => {
    recordOdds(selection.id, selection.odds);
  }, [selection.id, selection.odds]);

  useEffect(() => {
    const before = previousOdds.current;
    if (before === selection.odds) return;
    previousOdds.current = selection.odds;
    setDirection(selection.odds > before ? "up" : "down");
    setPulse((n) => n + 1);
    const timer = setTimeout(() => setDirection(null), CUE_MS);
    return () => clearTimeout(timer);
  }, [selection.odds]);

  const drifting = direction !== null;
  const label = caption ?? selection.value ?? selection.label;
  const movementText = drifting
    ? direction === "up"
      ? `, price lengthened to ${formatOdds(selection.odds)}`
      : `, price shortened to ${formatOdds(selection.odds)}`
    : "";
  const ariaLabel = bettable
    ? `${label}, odds ${formatOdds(selection.odds)}${movementText}. ${active ? "In your bet slip, activate to remove" : "Activate to add to bet slip"}.`
    : `${label}, odds ${formatOdds(selection.odds)}. Market ${status}, betting unavailable.`;

  return (
    <button
      type="button"
      onClick={bettable ? onClick : undefined}
      disabled={!bettable}
      aria-pressed={bettable ? Boolean(active) : undefined}
      aria-label={ariaLabel}
      title={bettable ? undefined : `Market ${status}`}
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "sm" ? "px-2 py-1.5" : "px-3 py-2.5",
        !bettable
          ? "cursor-not-allowed border-border bg-secondary/50 text-muted-foreground opacity-70"
          : active
            ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
            : "border-border bg-secondary text-foreground hover:border-primary/60 hover:bg-betrix-surface-elevated",
        bettable && drifting && (direction === "up" ? "border-primary/70" : "border-destructive/70"),
      )}
    >
      {bettable && drifting && (
        <span
          key={pulse}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0",
            direction === "up" ? "odds-flash-up" : "odds-flash-down",
          )}
        />
      )}
      {(caption ?? selection.value) && (
        <span
          aria-hidden
          className={cn(
            "relative max-w-full truncate font-medium text-muted-foreground",
            size === "sm" ? "text-[10px]" : "text-xs",
          )}
        >
          {caption ?? selection.value}
        </span>
      )}
      <span
        aria-hidden
        className={cn(
          "relative flex items-center gap-1 font-bold transition-colors",
          size === "sm" ? "text-sm" : "text-base",
          bettable && drifting && (direction === "up" ? "text-primary" : "text-destructive"),
        )}
      >
        {!bettable && <Lock className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
        {bettable &&
          drifting &&
          (direction === "up" ? (
            <ArrowUp className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
          ) : (
            <ArrowDown className={cn(size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
          ))}
        <span
          key={`${pulse}-${selection.odds}`}
          className={drifting ? "odds-value-pop" : undefined}
          style={
            drifting
              ? ({ "--odds-pop-from": direction === "up" ? "6px" : "-6px" } as React.CSSProperties)
              : undefined
          }
        >
          {formatOdds(selection.odds)}
        </span>
      </span>
      {showHistory && (
        <span aria-hidden className="relative mt-1">
          <OddsSparkline selectionId={selection.id} />
        </span>
      )}
    </button>
  );
}
