import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const GRID_SIZE = 9;

export function TileGrid({ phase, outcome }: CasinoStageProps) {
  const [bombIndex, setBombIndex] = useState(-1);

  useEffect(() => {
    if (phase === "revealed") {
      setBombIndex(outcome === "lose" ? Math.floor(Math.random() * GRID_SIZE) : -1);
    }
  }, [phase, outcome]);

  const revealed = phase === "revealed";

  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: GRID_SIZE }).map((_, i) => {
        const isBomb = revealed && i === bombIndex;
        return (
          <div
            key={i}
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl transition-all duration-300",
              revealed
                ? isBomb
                  ? "border-destructive bg-destructive/20"
                  : "border-primary/50 bg-primary/10"
                : "border-border bg-background/60",
            )}
            style={{
              transitionDelay: revealed ? `${i * 45}ms` : "0ms",
              animation:
                !revealed && phase === "spinning"
                  ? "casino-pulse-soft 1.1s ease-in-out infinite"
                  : undefined,
              animationDelay: !revealed && phase === "spinning" ? `${(i % 3) * 120}ms` : undefined,
            }}
          >
            {revealed ? (isBomb ? "💣" : "💎") : ""}
          </div>
        );
      })}
    </div>
  );
}
