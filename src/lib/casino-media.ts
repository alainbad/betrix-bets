import vaultRush from "@/assets/casino-vault-rush.jpg";
import neonReels from "@/assets/casino-neon-reels.jpg";
import coinFlip from "@/assets/casino-coin-flip.jpg";
import blackjack from "@/assets/casino-blackjack.jpg";
import roulette from "@/assets/casino-roulette.jpg";
import minefield from "@/assets/casino-minefield.jpg";
import goldFrontier from "@/assets/casino-gold-frontier.jpg";
import baccarat from "@/assets/casino-baccarat.jpg";
import holdem from "@/assets/casino-holdem.jpg";
import livePoker from "@/assets/casino-live-poker.jpg";
import videoPoker from "@/assets/casino-video-poker.jpg";

export const CASINO_GAME_IMAGES: Record<string, string> = {
  "vault-rush": vaultRush,
  "neon-reels": neonReels,
  "coin-flip": coinFlip,
  "blackjack-classic": blackjack,
  "roulette-euro": roulette,
  "mine-field": minefield,
  "gold-frontier": goldFrontier,
  "studio-baccarat": baccarat,
  "texas-holdem": holdem,
  "live-poker-room": livePoker,
  "video-poker-deuces": videoPoker,
};

export function casinoGameImage(id: string): string {
  return CASINO_GAME_IMAGES[id] ?? neonReels;
}
