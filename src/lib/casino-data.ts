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
  // True for a game whose client bundle never speaks the CASINO_SPIN_*
  // postMessage protocol at all (checked at integration time, not just
  // assumed) - it tracks its own internal demo balance and can never move
  // real wallet credits. GameModal skips attaching a wallet bridge and
  // always loads it in preview mode, and the catalogue only shows a single
  // "Play demo" action instead of the real-money Preview/Play pair.
  demoOnly?: boolean;
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
// Betrix Originals games use their dedicated Edge Function and game-specific rules.
// maxWinMultiplier is not used for their settlement.
export const CASINO_GAMES: Html5CasinoGame[] = [
  {
    id: "velvet-vault",
    name: "Midnight Vault",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/velvet/vault.html",
    thumbnail: "/games/velvet/assets/vault-room.png",
    tagline: "Expanding wilds. Three safes. One unforgettable heist.",
    maxWinMultiplier: 0,
  },
  {
    id: "velvet-roulette",
    name: "Royale Roulette",
    provider: "Betrix Originals",
    category: "table",
    path: "/games/velvet/roulette.html",
    thumbnail: "/games/velvet/assets/roulette-cover.png",
    tagline: "A classic single-zero wheel, with a private-table atmosphere.",
    maxWinMultiplier: 36,
  },
  {
    id: "velvet-candy",
    name: "Candy Cascade",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/velvet/candy.html",
    thumbnail: "/games/velvet/assets/candy-room.png",
    tagline: "Sweet tumbles, sparkling stars and sugar multipliers.",
    maxWinMultiplier: 0,
  },
  {
    id: "velvet-thunder",
    name: "Temple of Thunder",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/velvet/thunder.html",
    thumbnail: "/games/velvet/assets/thunder-room.png",
    tagline: "Lightning strikes and a growing storm of free-spin multipliers.",
    maxWinMultiplier: 0,
  },
  {
    id: "sugar-spark",
    name: "Sugar Spark",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/sugar-spark/sugar.html",
    thumbnail: "/games/sugar-spark/assets/sugar-room.png",
    tagline: "7×7 candy clusters that light up spots and grow to 128× the more you hit them.",
    maxWinMultiplier: 5000,
    demoOnly: true,
  },
];

export function getGameById(id: string): Html5CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
