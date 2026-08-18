import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const SEGMENTS = 12;
const SEGMENT_DEG = 360 / SEGMENTS;
const WIN_SEGMENTS = [0, 6];
const FULL_SPINS = 6;

function buildWheelBackground() {
  const stops: string[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const isWin = WIN_SEGMENTS.includes(i);
    const color = isWin ? "hsl(45 90% 55%)" : i % 2 === 0 ? "hsl(240 6% 14%)" : "hsl(240 6% 22%)";
    stops.push(`${color} ${i * SEGMENT_DEG}deg ${(i + 1) * SEGMENT_DEG}deg`);
  }
  return `conic-gradient(from 0deg, ${stops.join(", ")})`;
}

const WHEEL_BACKGROUND = buildWheelBackground();

function targetRotation(outcome: "win" | "lose") {
  const pool =
    outcome === "win"
      ? WIN_SEGMENTS
      : Array.from({ length: SEGMENTS }, (_, i) => i).filter((i) => !WIN_SEGMENTS.includes(i));
  const index = pool[Math.floor(Math.random() * pool.length)] ?? 0;
  const segmentCenter = index * SEGMENT_DEG + SEGMENT_DEG / 2;
  const alignment = (360 - segmentCenter) % 360;
  return FULL_SPINS * 360 + alignment;
}

export function WheelSpin({ phase, outcome }: CasinoStageProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (phase === "revealed" && outcome) setRotation(targetRotation(outcome));
  }, [phase, outcome]);

  return (
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
            phase === "revealed" ? "transform 2.2s cubic-bezier(0.1, 0.55, 0.15, 1)" : undefined,
        }}
      >
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <div
            key={i}
            className="absolute left-1/2 top-1/2 h-1/2 w-[2px] origin-top bg-background/40"
            style={{ transform: `rotate(${i * SEGMENT_DEG}deg)` }}
          />
        ))}
      </div>
      <div className="absolute z-10 h-9 w-9 rounded-full border-2 border-betrix-amber/60 bg-background shadow-md" />
    </div>
  );
}
