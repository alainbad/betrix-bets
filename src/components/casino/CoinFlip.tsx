import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

export function CoinFlip({ phase, outcome }: CasinoStageProps) {
  const revealed = phase === "revealed";
  return (
    <div style={{ perspective: "500px" }} className="flex items-center justify-center">
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-full border-[5px] text-lg font-black shadow-[0_6px_16px_rgba(0,0,0,0.4)] transition-colors duration-300",
          revealed
            ? outcome === "win"
              ? "border-primary bg-gradient-to-br from-primary/30 to-primary/5 text-primary"
              : "border-destructive bg-gradient-to-br from-destructive/30 to-destructive/5 text-destructive"
            : "border-betrix-amber bg-gradient-to-br from-betrix-amber/35 to-betrix-amber/5 text-betrix-amber",
        )}
        style={{
          transformStyle: "preserve-3d",
          animation: phase === "spinning" ? "casino-coin-loop 0.45s linear infinite" : undefined,
        }}
      >
        <span className="rounded-full border border-current/30 px-3 py-1">
          {revealed ? (outcome === "win" ? "WIN" : "LOSE") : "?"}
        </span>
      </div>
    </div>
  );
}
