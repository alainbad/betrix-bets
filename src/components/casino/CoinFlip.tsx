import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

// The player calls a side before playing (see the picker in casino.$gameId.tsx,
// which supplies "pick"). The coin only ever lands on the called side when
// outcome is "win" and the other side when it's "lose" - the server decided
// win/lose first, this just makes the coin visually agree with it.
export function CoinFlip({ phase, outcome, pick }: CasinoStageProps) {
  const revealed = phase === "revealed";
  const called = pick === "T" ? "Tails" : "Heads";
  const landedSide = revealed ? (outcome === "win" ? pick : pick === "T" ? "H" : "T") : null;
  const landedLabel = landedSide === "T" ? "Tails" : "Heads";

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ perspective: "500px" }} className="flex items-center justify-center">
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-full border-[5px] text-xs font-black uppercase tracking-wide shadow-[0_6px_16px_rgba(0,0,0,0.4)] transition-colors duration-300",
            revealed
              ? outcome === "win"
                ? "border-primary bg-gradient-to-br from-primary/30 to-primary/5 text-primary"
                : "border-destructive bg-gradient-to-br from-destructive/30 to-destructive/5 text-destructive"
              : "border-betrix-amber bg-gradient-to-br from-betrix-amber/35 to-betrix-amber/5 text-betrix-amber",
          )}
          style={{
            transformStyle: "preserve-3d",
            animation: phase === "spinning" ? "casino-coin-loop 0.45s linear infinite" : undefined,
          }}
        >
          <span className="rounded-full border border-current/30 px-2 py-1 text-center leading-tight">
            {revealed ? landedLabel : called}
          </span>
        </div>
      </div>
      {!revealed && pick && <p className="text-xs text-muted-foreground">You called {called}</p>}
      {revealed && (
        <p
          className={cn(
            "text-xs font-semibold",
            outcome === "win" ? "text-primary" : "text-destructive",
          )}
        >
          {outcome === "win"
            ? `Landed on ${landedLabel} - your call!`
            : `Landed on ${landedLabel}, you called ${called}`}
        </p>
      )}
    </div>
  );
}
