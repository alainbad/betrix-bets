import type { CasinoMechanic } from "@/lib/casino-data";
import { SlotReels } from "./SlotReels";
import { WheelSpin } from "./WheelSpin";
import { RouletteWheel } from "./RouletteWheel";
import { CoinFlip } from "./CoinFlip";
import type { CasinoStageProps } from "./types";

export function GameStage({
  mechanic,
  phase,
  outcome,
  pick,
}: { mechanic: CasinoMechanic } & CasinoStageProps) {
  switch (mechanic) {
    case "slot":
      return <SlotReels phase={phase} outcome={outcome} />;
    case "wheel":
      return <WheelSpin phase={phase} outcome={outcome} />;
    case "roulette":
      return <RouletteWheel phase={phase} outcome={outcome} pick={pick} />;
    case "coinflip":
      return <CoinFlip phase={phase} outcome={outcome} pick={pick} />;
    case "blackjack":
    case "holdem":
      // Blackjack and Texas Hold'em have their own dedicated multi-step
      // tables (BlackjackTable, HoldemTable) and never render through this
      // single-shot stage.
      return null;
  }
}
