import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const SYMBOL_HEIGHT = 80;
const SPIN_LENGTH = 22;

function randomSymbol(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)] ?? SYMBOLS[0]!;
}

function losingSymbols(): [string, string, string] {
  const a = randomSymbol();
  let b = randomSymbol();
  while (b === a) b = randomSymbol();
  return [a, b, randomSymbol()];
}

function buildStrip(finalSymbol: string): string[] {
  const strip = Array.from({ length: SPIN_LENGTH }, randomSymbol);
  strip.push(finalSymbol);
  return strip;
}

function Reel({
  phase,
  finalSymbol,
  win,
  delayMs,
}: {
  phase: CasinoStageProps["phase"];
  finalSymbol: string | null;
  win: boolean;
  delayMs: number;
}) {
  const [strip, setStrip] = useState<string[]>(() => Array.from({ length: 6 }, randomSymbol));
  const landed = phase === "revealed" && !!finalSymbol;

  useEffect(() => {
    if (landed && finalSymbol) setStrip(buildStrip(finalSymbol));
  }, [landed, finalSymbol]);

  return (
    <div
      className={cn(
        "relative h-20 w-16 overflow-hidden rounded-xl border-2 bg-background/90 shadow-inner transition-colors duration-300",
        landed && win
          ? "border-primary shadow-[0_0_20px_theme(colors.primary.DEFAULT/0.55)]"
          : "border-border",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-6 bg-gradient-to-t from-background to-transparent" />
      <div
        className={cn(
          "flex flex-col",
          phase === "spinning" && "animate-[casino-reel-spin_0.35s_linear_infinite]",
        )}
        style={
          landed
            ? {
                transform: `translateY(-${(strip.length - 1) * SYMBOL_HEIGHT}px)`,
                transition: `transform 1.05s cubic-bezier(0.13, 0.66, 0.16, 1) ${delayMs}ms`,
              }
            : undefined
        }
      >
        {strip.map((s, i) => (
          <span key={i} className="flex h-20 w-16 shrink-0 items-center justify-center text-4xl">
            {s}
          </span>
        ))}
      </div>
      {landed && win && (
        <div
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
          style={{ animation: `casino-shimmer 1.1s ease-out ${delayMs + 900}ms` }}
        >
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>
      )}
    </div>
  );
}

export function SlotReels({ phase, outcome }: CasinoStageProps) {
  const [finals, setFinals] = useState<[string, string, string] | null>(null);

  useEffect(() => {
    if (phase === "spinning") {
      setFinals(null);
      return;
    }
    if (phase === "revealed" && outcome) {
      const symbol = randomSymbol();
      setFinals(outcome === "win" ? [symbol, symbol, symbol] : losingSymbols());
    }
  }, [phase, outcome]);

  return (
    <div className="flex items-center justify-center gap-3">
      {[0, 1, 2].map((i) => (
        <Reel
          key={i}
          phase={phase}
          finalSymbol={finals?.[i] ?? null}
          win={outcome === "win"}
          delayMs={i * 180}
        />
      ))}
    </div>
  );
}
