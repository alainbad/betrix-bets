import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

export function VaultDoor({ phase, outcome }: CasinoStageProps) {
  const revealed = phase === "revealed";
  return (
    <div className="relative flex h-40 w-40 items-center justify-center">
      {revealed && outcome === "win" && (
        <div className="absolute inset-0 animate-[casino-pulse-soft_1s_ease-in-out_infinite] rounded-full bg-primary/25 blur-xl" />
      )}
      <div
        className={cn(
          "relative flex h-32 w-32 items-center justify-center rounded-full border-[6px] bg-gradient-to-br from-secondary to-background transition-all duration-500",
          revealed && outcome === "win"
            ? "scale-75 border-primary opacity-40"
            : revealed && outcome === "lose"
              ? "border-destructive"
              : "border-border",
          !revealed &&
            phase === "spinning" &&
            "animate-[casino-pulse-soft_0.9s_ease-in-out_infinite]",
          revealed && outcome === "lose" && "animate-[casino-shake_0.5s_ease-in-out]",
        )}
      >
        <div className="h-10 w-10 rounded-full border-4 border-border bg-background" />
      </div>
      {revealed && <span className="absolute text-3xl">{outcome === "win" ? "💰" : "🔒"}</span>}
    </div>
  );
}
