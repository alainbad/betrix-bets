import type { CasinoMechanic } from "@/lib/casino-data";
import { SlotReels } from "./SlotReels";
import { WheelSpin } from "./WheelSpin";
import { CardReveal } from "./CardReveal";
import { TileGrid } from "./TileGrid";
import { VaultDoor } from "./VaultDoor";
import { CoinFlip } from "./CoinFlip";
import type { CasinoStageProps } from "./types";

export function GameStage({
  mechanic,
  phase,
  outcome,
}: { mechanic: CasinoMechanic } & CasinoStageProps) {
  switch (mechanic) {
    case "slot":
      return <SlotReels phase={phase} outcome={outcome} />;
    case "wheel":
      return <WheelSpin phase={phase} outcome={outcome} />;
    case "cards":
      return <CardReveal phase={phase} outcome={outcome} />;
    case "tiles":
      return <TileGrid phase={phase} outcome={outcome} />;
    case "vault":
      return <VaultDoor phase={phase} outcome={outcome} />;
    case "coinflip":
      return <CoinFlip phase={phase} outcome={outcome} />;
  }
}
