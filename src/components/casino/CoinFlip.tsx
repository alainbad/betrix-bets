import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

export function CoinFlip({ phase, outcome }: CasinoStageProps) {
  const revealed = phase === "revealed";
  return (
    <div style={{ perspective: "500px" }} className="flex items-center justify-center">
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-full border-4 text-xl font-black shadow-lg transition-colors duration-300",
          revealed
            ? outcome === "win"
              ? "border-primary bg-primary/15 text-primary"
              : "border-destructive bg-destructive/15 text-destructive"
            : "border-betrix-amber bg-betrix-amber/15 text-betrix-amber",
        )}
        style={{
          transformStyle: "preserve-3d",
          animation: phase === "spinning" ? "casino-coin-loop 0.5s linear infinite" : undefined,
        }}
      >
        {revealed ? (outcome === "win" ? "WIN" : "LOSE") : "?"}
      </div>
    </div>
  );
}
