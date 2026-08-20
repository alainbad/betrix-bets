import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import type { Selection } from "@/lib/betting-data";

interface OddsButtonProps {
  selection: Selection;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  caption?: string;
}

type Direction = "up" | "down";

// How long the drift cue stays on screen after a price move. Long enough for a
// glance, short enough that a busy live board is not permanently flashing.
const CUE_MS = 1600;

export function OddsButton({ selection, active, onClick, size = "md", caption }: OddsButtonProps) {
  const previousOdds = useRef(selection.odds);
  const [direction, setDirection] = useState<Direction | null>(null);
  // Bumped on every move so re-animating the same direction restarts the CSS
  // animation instead of being ignored as an unchanged class.
  const [pulse, setPulse] = useState(0);

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

  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      className={cn(
        "relative flex min-w-0 flex-col items-center justify-center overflow-hidden rounded-xl border transition-all",
        size === "sm" ? "px-2 py-1.5" : "px-3 py-2.5",
        active
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border bg-secondary text-foreground hover:border-primary/60 hover:bg-betrix-surface-elevated",
        drifting && (direction === "up" ? "border-primary/70" : "border-destructive/70"),
      )}
    >
      {drifting && (
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
          className={cn(
            "relative max-w-full truncate font-medium text-muted-foreground",
            size === "sm" ? "text-[10px]" : "text-xs",
          )}
        >
          {caption ?? selection.value}
        </span>
      )}
      <span
        className={cn(
          "relative flex items-center gap-1 font-bold transition-colors",
          size === "sm" ? "text-sm" : "text-base",
          drifting && (direction === "up" ? "text-primary" : "text-destructive"),
        )}
      >
        {drifting &&
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
        <span className="sr-only">
          {drifting ? (direction === "up" ? "odds drifted out" : "odds shortened") : ""}
        </span>
      </span>
    </button>
  );
}
