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
  // Sub-genre shown next to the card's numbered badge, e.g. "Slots".
  badge: string;
  // Small eyebrow tag in the top-right corner of the card image.
  collection: string;
  // Amber eyebrow line under the image, above the game name.
  hook: string;
  // Short punchy line shown below the card image.
  description: string;
  // 2-3 short feature bullets, joined with " · " below the description.
  features: string[];
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
    badge: "Slots",
    collection: "The Heist Collection",
    hook: "The night is yours",
    description: "Find the master key. Crack the safe.",
    features: ["5 reels", "Expanding wilds", "Pick-a-safe bonus"],
    maxWinMultiplier: 0,
  },
  {
    id: "velvet-roulette",
    name: "Royale Roulette",
    provider: "Betrix Originals",
    category: "table",
    path: "/games/velvet/roulette.html",
    thumbnail: "/games/velvet/assets/roulette-cover.png",
    badge: "Table game",
    collection: "Take your seat",
    hook: "The Velvet private table",
    description: "A classic table. A new spin.",
    features: ["Single zero", "Private table", "Multiple bets"],
    maxWinMultiplier: 36,
  },
  {
    id: "velvet-candy",
    name: "Candy Cascade",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/velvet/candy.html",
    thumbnail: "/games/velvet/assets/candy-room.png",
    badge: "Tumbling slots",
    collection: "A little sweet, a little wild",
    hook: "Follow the sugar rush",
    description: "Sweet drops. Sparkling combinations.",
    features: ["Star bursts", "Sugar multipliers", "10 free spins"],
    maxWinMultiplier: 0,
  },
  {
    id: "velvet-thunder",
    name: "Temple of Thunder",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/velvet/thunder.html",
    thumbnail: "/games/velvet/assets/thunder-room.png",
    badge: "Tumbling slots",
    collection: "Awaken the storm",
    hook: "Power beyond the clouds",
    description: "Summon lightning. Build your storm.",
    features: ["Lightning strikes", "Growing multipliers", "8 free spins"],
    maxWinMultiplier: 0,
  },
  {
    id: "velvet-sugar",
    name: "Sugar Spark",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/sugar-spark/sugar.html",
    thumbnail: "/games/sugar-spark/assets/sugar-room.png",
    badge: "Cluster slots",
    collection: "The candy afterparty",
    hook: "Every match leaves a spark",
    description: "Sweet spots. Bigger pops.",
    features: ["7×7 clusters", "Growing spots", "10 free spins"],
    maxWinMultiplier: 5000,
  },
  {
    id: "velvet-paw",
    name: "Paw Palace",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/paw-palace/paw.html",
    thumbnail: "/games/paw-palace/assets/paw-room-thumb.png",
    badge: "Dynamic ways",
    collection: "Betrix Originals",
    hook: "Good dogs. Great surprises.",
    description: "Your next winning pack.",
    features: ["117,649 ways", "Sticky wilds", "Free spins"],
    maxWinMultiplier: 5000,
  },
  {
    id: "velvet-bass",
    name: "Bass Harbour",
    provider: "Betrix Originals",
    category: "slots",
    path: "/games/bass-harbour/bass.html",
    thumbnail: "/games/bass-harbour/assets/bass-room.png",
    badge: "Fishing slots",
    collection: "Betrix Originals",
    hook: "The next catch could be the one",
    description: "Cast your luck. Collect your catch.",
    features: ["10 paylines", "Cash fish", "Angler free spins"],
    maxWinMultiplier: 5000,
  },
  {
    id: "velvet-grand",
    name: "Grand Spin",
    provider: "Betrix Originals",
    category: "instant",
    path: "/games/grand-spin/grand.html",
    thumbnail: "/games/grand-spin/assets/grand-room-thumb.png",
    badge: "Wheel show",
    collection: "Betrix Originals",
    hook: "Your moment on the wheel",
    description: "Pick your numbers. Make it grand.",
    features: ["40 segments", "Multiplier spotlight", "Wheel show"],
    maxWinMultiplier: 250,
  },
  {
    id: "velvet-blackjack",
    name: "Blackjack Royale",
    provider: "Betrix Originals",
    category: "table",
    path: "/games/betrix-tables/blackjack.html",
    thumbnail: "/games/betrix-tables/assets/table-room-thumb.png",
    badge: "Card table",
    collection: "Betrix Originals",
    hook: "Your private table",
    description: "Take your seat.",
    features: ["Animated cards", "Table sounds", "Betrix Originals"],
    maxWinMultiplier: 2.5,
  },
  {
    id: "velvet-baccarat",
    name: "Mega Baccarat",
    provider: "Betrix Originals",
    category: "table",
    path: "/games/betrix-tables/baccarat.html",
    thumbnail: "/games/betrix-tables/assets/table-room-thumb.png",
    badge: "Card table",
    collection: "Betrix Originals",
    hook: "Your private table",
    description: "Take your seat.",
    features: ["Animated cards", "Table sounds", "Betrix Originals"],
    maxWinMultiplier: 41,
  },
];

export function getGameById(id: string): Html5CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
