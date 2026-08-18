import neonReels from "@/assets/casino-neon-reels.jpg";
import coinFlip from "@/assets/casino-coin-flip.jpg";
import blackjack from "@/assets/casino-blackjack.jpg";
import roulette from "@/assets/casino-roulette.jpg";
import holdem from "@/assets/casino-holdem.jpg";
import luckyWheel from "@/assets/casino-lucky-wheel.jpg";

export const CASINO_GAME_IMAGES: Record<string, string> = {
  "neon-reels": neonReels,
  "coin-flip": coinFlip,
  "blackjack-classic": blackjack,
  "roulette-euro": roulette,
  "texas-holdem": holdem,
  "lucky-wheel": luckyWheel,
};

export function casinoGameImage(id: string): string {
  return CASINO_GAME_IMAGES[id] ?? neonReels;
}
