import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];

function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] ?? SYMBOLS[0]!;
}

function winningTriplet(): [string, string, string] {
  const s = randomSymbol();
  return [s, s, s];
}

function losingTriplet(): [string, string, string] {
  const a = randomSymbol();
  let b = randomSymbol();
  while (b === a) b = randomSymbol();
  return [a, b, randomSymbol()];
}

export function SlotReels({ phase, outcome }: CasinoStageProps) {
  const [reels, setReels] = useState<[string, string, string]>(() => losingTriplet());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "spinning") {
      intervalRef.current = setInterval(() => {
        setReels([randomSymbol(), randomSymbol(), randomSymbol()]);
      }, 90);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (phase === "revealed") {
        setReels(outcome === "win" ? winningTriplet() : losingTriplet());
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [phase, outcome]);

  return (
    <div className="flex items-center justify-center gap-3">
      {reels.map((symbol, i) => (
        <div
          key={i}
          className={cn(
            "flex h-20 w-16 items-center justify-center rounded-xl border-2 bg-background/85 text-4xl transition-all duration-300",
            phase === "revealed" && outcome === "win"
              ? "border-primary shadow-[0_0_18px_theme(colors.primary.DEFAULT/0.55)] scale-110"
              : phase === "revealed"
                ? "border-destructive/40"
                : "border-border",
          )}
        >
          {symbol}
        </div>
      ))}
    </div>
  );
}
