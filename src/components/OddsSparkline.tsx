import { useSyncExternalStore } from "react";
import { getOddsHistory, subscribeOddsHistory, type OddsPoint } from "@/lib/odds-history";
import { formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

function subscribe(listener: () => void) {
  return subscribeOddsHistory(listener);
}

export function useOddsHistory(selectionId: string): OddsPoint[] {
  return useSyncExternalStore(
    subscribe,
    () => getOddsHistory(selectionId),
    () => [],
  );
}

/** Micro price-drift chart. Renders nothing until at least two prices are seen. */
export function OddsSparkline({
  selectionId,
  className,
  width = 56,
  height = 16,
}: {
  selectionId: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  const points = useOddsHistory(selectionId);
  if (points.length < 2) return null;

  const values = points.map((p) => p.odds);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = values[0]!;
  const last = values[values.length - 1]!;
  const up = last > first;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Price history: opened ${formatOdds(first)}, now ${formatOdds(last)}`}
    >
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={up ? "stroke-primary" : "stroke-destructive"}
      />
    </svg>
  );
}

/** "Opened +150 · now +180" caption for detail views. */
export function OddsHistoryCaption({ selectionId }: { selectionId: string }) {
  const points = useOddsHistory(selectionId);
  if (points.length < 2) return null;
  const first = points[0]!.odds;
  const last = points[points.length - 1]!.odds;
  return (
    <span className="text-[10px] font-medium text-muted-foreground">
      Opened {formatOdds(first)} · now {formatOdds(last)}
    </span>
  );
}
