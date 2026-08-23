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
  // Hard cap on payout as a multiple of stake, enforced server-side in
  // play_html5_casino_round (supabase/migrations/*_html5_casino_engine.sql).
  // Self-hosted game files run their own client-side logic, so unlike the
  // old in-house games the server can't roll the outcome itself - this cap
  // is what stops a forged postMessage from minting unbounded coins.
  maxWinMultiplier: number;
}

export const CASINO_CATEGORIES: { id: CasinoCategory | "all"; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "slots", label: "Slots" },
  { id: "instant", label: "Instant win" },
  { id: "table", label: "Table games" },
  { id: "live", label: "Live studio" },
];

// No real game bundles yet (user is sourcing HTML5 game files separately) -
// this one demo game exercises the full pipeline (balance-in-URL, postMessage
// round-trip, wallet RPC, balance refresh) end to end. Swap/add real entries
// here once game files are provided; nothing else needs to change.
export const CASINO_GAMES: Html5CasinoGame[] = [
  {
    id: "demo-slot",
    name: "Demo Slot (test game)",
    provider: "Betrix (placeholder)",
    category: "slots",
    path: "/games/demo-slot/index.html",
    tagline: "Placeholder game for testing the wallet bridge end to end.",
    maxWinMultiplier: 20,
  },
];

export function getGameById(id: string): Html5CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
