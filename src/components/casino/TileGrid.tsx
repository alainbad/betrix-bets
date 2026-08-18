import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SlotSymbol } from "./icons";
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
              "flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl transition-all",
              revealed
                ? cn(
                    "duration-300 ease-out",
                    isBomb
                      ? "border-destructive bg-destructive/25 shadow-[0_0_16px_theme(colors.destructive.DEFAULT/0.5)]"
                      : "border-primary/60 bg-primary/10 shadow-[0_0_10px_theme(colors.primary.DEFAULT/0.35)]",
                  )
                : "border-border bg-background/60",
            )}
            style={{
              transform: revealed ? "scale(1)" : undefined,
              transitionDelay: revealed ? `${i * 55}ms` : "0ms",
              animation:
                !revealed && phase === "spinning"
                  ? "casino-pulse-soft 1.1s ease-in-out infinite"
                  : undefined,
              animationDelay: !revealed && phase === "spinning" ? `${(i % 3) * 120}ms` : undefined,
            }}
          >
            <span
              className={cn(
                "inline-block transition-transform duration-300",
                revealed ? "scale-100" : "scale-0",
              )}
              style={{ transitionDelay: revealed ? `${i * 55}ms` : "0ms" }}
            >
              {revealed &&
                (isBomb ? (
                  <span className="text-xl">💣</span>
                ) : (
                  <SlotSymbol name="gem" className="h-6 w-6" />
                ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}
