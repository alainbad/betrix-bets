import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ROULETTE_WHEEL_ORDER, rouletteColor } from "@/lib/roulette";
import type { CasinoStageProps } from "./types";

const SEGMENTS = ROULETTE_WHEEL_ORDER.length;
const SEGMENT_DEG = 360 / SEGMENTS;
const FULL_SPINS = 5;
const RADIUS = 76;

const SEGMENT_COLOR: Record<"red" | "black" | "green", string> = {
  red: "hsl(0 70% 42%)",
  black: "hsl(240 6% 12%)",
  green: "hsl(150 55% 30%)",
};

function buildWheelBackground() {
  const stops = ROULETTE_WHEEL_ORDER.map(
    (n, i) =>
      `${SEGMENT_COLOR[rouletteColor(n)]} ${i * SEGMENT_DEG}deg ${(i + 1) * SEGMENT_DEG}deg`,
  );
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

const WHEEL_BACKGROUND = buildWheelBackground();

function targetRotation(landingNumber: number) {
  const index = ROULETTE_WHEEL_ORDER.indexOf(landingNumber);
  const segmentCenter = index * SEGMENT_DEG + SEGMENT_DEG / 2;
  const alignment = (360 - segmentCenter) % 360;
  return FULL_SPINS * 360 + alignment;
}

function otherNumber(exclude: number) {
  let n = Math.floor(Math.random() * 37);
  while (n === exclude) n = Math.floor(Math.random() * 37);
  return n;
}

export function RouletteWheel({ phase, outcome, pick }: CasinoStageProps) {
  const [rotation, setRotation] = useState(0);
  const [landed, setLanded] = useState<number | null>(null);
  const pickedNumber = typeof pick === "number" ? pick : 0;

  useEffect(() => {
    if (phase === "revealed" && outcome) {
      const number = outcome === "win" ? pickedNumber : otherNumber(pickedNumber);
      setLanded(number);
      setRotation(targetRotation(number));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, outcome]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <div className="absolute inset-0 rounded-full shadow-[0_0_30px_rgba(0,0,0,0.5)]" />
        <div
          className="absolute left-1/2 top-[-6px] z-20 h-0 w-0 -translate-x-1/2 drop-shadow-md"
          style={{
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: "16px solid hsl(45 90% 55%)",
          }}
          aria-hidden
        />
        <div
          className={cn(
            "relative h-40 w-40 rounded-full border-[6px] border-betrix-amber/60 shadow-inner",
            phase === "spinning" && "animate-[casino-spin-loop_0.7s_linear_infinite]",
          )}
          style={{
            background: WHEEL_BACKGROUND,
            transform: phase === "revealed" ? `rotate(${rotation}deg)` : undefined,
            transition:
              phase === "revealed" ? "transform 2.4s cubic-bezier(0.1, 0.55, 0.15, 1)" : undefined,
          }}
        >
          {ROULETTE_WHEEL_ORDER.map((n, i) => {
            const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2;
            return (
              <span
                key={n}
                className="absolute left-1/2 top-1/2 origin-top text-[8px] font-bold text-white/90"
                style={{ transform: `rotate(${angle}deg) translateY(-${RADIUS}px)` }}
              >
                {n}
              </span>
            );
          })}
        </div>
        <div className="absolute z-10 h-9 w-9 rounded-full border-2 border-betrix-amber/60 bg-background shadow-md" />
      </div>
      {phase === "revealed" && landed !== null && (
        <p
          className={cn(
            "text-sm font-black",
            outcome === "win" ? "text-primary" : "text-destructive",
          )}
        >
          {landed}{" "}
          <span className="text-xs font-semibold capitalize text-muted-foreground">
            ({rouletteColor(landed)})
          </span>
        </p>
      )}
    </div>
  );
}
