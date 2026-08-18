import type { CasinoMechanic } from "@/lib/casino-data";
import { SlotReels } from "./SlotReels";
import { WheelSpin } from "./WheelSpin";
import { RouletteWheel } from "./RouletteWheel";
import { CardReveal } from "./CardReveal";
import { TileGrid } from "./TileGrid";
import { VaultDoor } from "./VaultDoor";
import { CoinFlip } from "./CoinFlip";
import type { CasinoStageProps } from "./types";

export function GameStage({
  mechanic,
  cardStyle,
  phase,
  outcome,
  pick,
}: { mechanic: CasinoMechanic; cardStyle?: "versus" | "baccarat" | undefined } & CasinoStageProps) {
  switch (mechanic) {
    case "slot":
      return <SlotReels phase={phase} outcome={outcome} />;
    case "wheel":
      return <WheelSpin phase={phase} outcome={outcome} />;
    case "roulette":
      return <RouletteWheel phase={phase} outcome={outcome} pick={pick} />;
    case "cards":
      return <CardReveal phase={phase} outcome={outcome} cardStyle={cardStyle} />;
    case "tiles":
      return <TileGrid phase={phase} outcome={outcome} />;
    case "vault":
      return <VaultDoor phase={phase} outcome={outcome} />;
    case "coinflip":
      return <CoinFlip phase={phase} outcome={outcome} pick={pick} />;
  }
}
