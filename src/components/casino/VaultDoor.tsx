import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

export function VaultDoor({ phase, outcome }: CasinoStageProps) {
  const revealed = phase === "revealed";
  const win = revealed && outcome === "win";
  const lose = revealed && outcome === "lose";

  return (
    <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-2xl border-2 border-betrix-amber/40 bg-gradient-to-br from-secondary to-background shadow-inner">
      {win && (
        <div className="absolute inset-0 flex items-center justify-center bg-betrix-amber/10">
          <span className="animate-[casino-pulse-soft_1s_ease-in-out_infinite] text-4xl">💰</span>
        </div>
      )}
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1/2 border-r border-black/30 bg-gradient-to-br from-neutral-700 to-neutral-900 shadow-lg transition-transform duration-700 ease-in",
          win && "-translate-x-full",
          !revealed &&
            phase === "spinning" &&
            "animate-[casino-pulse-soft_0.9s_ease-in-out_infinite]",
          lose && "animate-[casino-shake_0.5s_ease-in-out]",
        )}
      >
        <div className="absolute right-2 top-1/2 h-6 w-2 -translate-y-1/2 rounded-full bg-betrix-amber/70" />
      </div>
      <div
        className={cn(
          "absolute inset-y-0 right-0 w-1/2 border-l border-black/30 bg-gradient-to-bl from-neutral-700 to-neutral-900 shadow-lg transition-transform duration-700 ease-in",
          win && "translate-x-full",
          !revealed &&
            phase === "spinning" &&
            "animate-[casino-pulse-soft_0.9s_ease-in-out_infinite]",
          lose && "animate-[casino-shake_0.5s_ease-in-out]",
        )}
      >
        <div className="absolute left-2 top-1/2 h-6 w-2 -translate-y-1/2 rounded-full bg-betrix-amber/70" />
      </div>
      <div className="relative z-10 h-9 w-9 rounded-full border-4 border-betrix-amber/70 bg-background shadow-lg" />
    </div>
  );
}
