import type { CasinoGame, CasinoMechanic } from "@/lib/casino-data";
import { SlotReels } from "./SlotReels";
import { WheelSpin } from "./WheelSpin";
import { RouletteWheel } from "./RouletteWheel";
import { CardReveal } from "./CardReveal";
import { CoinFlip } from "./CoinFlip";
import type { CasinoStageProps } from "./types";

export function GameStage({
  mechanic,
  cardStyle,
  phase,
  outcome,
  pick,
}: { mechanic: CasinoMechanic; cardStyle?: CasinoGame["cardStyle"] } & CasinoStageProps) {
  switch (mechanic) {
    case "slot":
      return <SlotReels phase={phase} outcome={outcome} />;
    case "wheel":
      return <WheelSpin phase={phase} outcome={outcome} />;
    case "roulette":
      return <RouletteWheel phase={phase} outcome={outcome} pick={pick} />;
    case "cards":
      return <CardReveal phase={phase} outcome={outcome} cardStyle={cardStyle} />;
    case "coinflip":
      return <CoinFlip phase={phase} outcome={outcome} pick={pick} />;
  }
}
