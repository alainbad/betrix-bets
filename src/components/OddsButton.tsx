import { cn } from "@/lib/utils";
import { formatOdds } from "@/lib/format";
import type { Selection } from "@/lib/betting-data";

interface OddsButtonProps {
  selection: Selection;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function OddsButton({ selection, active, onClick, size = "md" }: OddsButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border transition-all",
        size === "sm" ? "px-2 py-1.5" : "px-3 py-2.5",
        active
          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary"
          : "border-border bg-secondary text-foreground hover:border-primary/60 hover:bg-betrix-surface-elevated"
      )}
    >
      {selection.value && (
        <span className={cn("font-medium text-muted-foreground", size === "sm" ? "text-[10px]" : "text-xs")}>
          {selection.value}
        </span>
      )}
      <span className={cn("font-bold", size === "sm" ? "text-sm" : "text-base")}>{formatOdds(selection.odds)}</span>
    </button>
  );
}
