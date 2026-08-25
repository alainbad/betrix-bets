export type CasinoCategory = "slots" | "table" | "instant" | "live";

export interface Html5CasinoGame {
  id: string;
  name: string;
  provider: string;
  category: CasinoCategory;
  // Path to the self-hosted HTML5 game's entry file, served from /public
  // (or a full URL for an externally-hosted bundle). Rendered in an iframe -
  // see GameModal.tsx and lib/game-bridge.ts.
  path: string;
  thumbnail?: string;
  tagline: string;
  // Informational only right now - the actual win multiplier is a single
  // global constant rolled server-side in play_html5_casino_round
  // (supabase/migrations/*_html5_casino_rtp_engine.sql), same as the native
  // in-house games. This field isn't read by the engine yet; it's here for
  // when per-game payout curves are worth building.
  maxWinMultiplier: number;
}

export const CASINO_CATEGORIES: { id: CasinoCategory | "all"; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "slots", label: "Slots" },
  { id: "instant", label: "Instant win" },
  { id: "table", label: "Table games" },
  { id: "live", label: "Live studio" },
];

// Self-hosted HTML5 games, each served from /public/games/<id>/index.html and
// rendered in an iframe - see GameModal.tsx and lib/game-bridge.ts. All of
// them speak the same postMessage protocol (CASINO_SPIN_REQUEST /
// CASINO_SPIN_RESULT), so adding a game is just dropping a new folder in
// here and registering it below; nothing else needs to change.
//
// Empty while the site is between in-house games and the Plurance
// aggregator integration - the game files themselves are still in
// public/games/ (demo-slot, neon-reels, vault-rush) and the wallet RPC
// they call is untouched, just nothing is listed here to launch them.
export const CASINO_GAMES: Html5CasinoGame[] = [];

export function getGameById(id: string): Html5CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
