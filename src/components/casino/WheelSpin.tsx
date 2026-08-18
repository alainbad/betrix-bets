import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const SEGMENTS = 8;
const SEGMENT_DEG = 360 / SEGMENTS;
const WIN_SEGMENT = 0;
const FULL_SPINS = 5;

const WHEEL_BACKGROUND = `conic-gradient(from 0deg,
  hsl(45 90% 55%) 0deg ${SEGMENT_DEG}deg,
  hsl(240 6% 14%) ${SEGMENT_DEG}deg ${SEGMENT_DEG * 2}deg,
  hsl(240 6% 20%) ${SEGMENT_DEG * 2}deg ${SEGMENT_DEG * 3}deg,
  hsl(240 6% 14%) ${SEGMENT_DEG * 3}deg ${SEGMENT_DEG * 4}deg,
  hsl(240 6% 20%) ${SEGMENT_DEG * 4}deg ${SEGMENT_DEG * 5}deg,
  hsl(240 6% 14%) ${SEGMENT_DEG * 5}deg ${SEGMENT_DEG * 6}deg,
  hsl(240 6% 20%) ${SEGMENT_DEG * 6}deg ${SEGMENT_DEG * 7}deg,
  hsl(240 6% 14%) ${SEGMENT_DEG * 7}deg ${SEGMENT_DEG * 8}deg
)`;

function targetRotation(outcome: "win" | "lose") {
  let index = WIN_SEGMENT;
  if (outcome === "lose") {
    index = 1 + Math.floor(Math.random() * (SEGMENTS - 1));
  }
  const segmentCenter = index * SEGMENT_DEG + SEGMENT_DEG / 2;
  const alignment = (360 - segmentCenter) % 360;
  return FULL_SPINS * 360 + alignment;
}

export function WheelSpin({ phase, outcome }: CasinoStageProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (phase === "revealed" && outcome) {
      setRotation(targetRotation(outcome));
    }
  }, [phase, outcome]);

  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      <div
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-8 border-t-[14px] border-x-transparent border-t-primary"
        aria-hidden
      />
      <div
        className={cn(
          "h-36 w-36 rounded-full border-4 border-border shadow-inner",
          phase === "spinning" && "animate-[casino-spin-loop_0.8s_linear_infinite]",
        )}
        style={{
          background: WHEEL_BACKGROUND,
          transform: phase === "revealed" ? `rotate(${rotation}deg)` : undefined,
          transition:
            phase === "revealed" ? "transform 1.2s cubic-bezier(0.14, 0.67, 0.2, 1)" : undefined,
        }}
      />
      <div className="absolute h-8 w-8 rounded-full border-2 border-border bg-background" />
    </div>
  );
}
