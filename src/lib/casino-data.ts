export type CasinoCategory = "slots" | "table" | "instant" | "live";

export interface CasinoGame {
  id: string;
  name: string;
  provider: string;
  category: CasinoCategory;
  rtp: number;
  volatility: "Low" | "Medium" | "High";
  minStake: number;
  maxStake: number;
  tagline: string;
  hue: string;
  badge?: "New" | "Hot" | "Exclusive";
}

export const CASINO_CATEGORIES: { id: CasinoCategory | "all"; label: string }[] = [
  { id: "all", label: "All games" },
  { id: "slots", label: "Slots" },
  { id: "instant", label: "Instant win" },
  { id: "table", label: "Table games" },
  { id: "live", label: "Live studio" },
];

export const CASINO_GAMES: CasinoGame[] = [
  {
    id: "vault-rush",
    name: "Vault Rush",
    provider: "Betrix Originals",
    category: "instant",
    rtp: 96.5,
    volatility: "Medium",
    minStake: 1,
    maxStake: 250,
    tagline: "Cash out before the vault slams shut.",
    hue: "from-primary/25 to-primary/5",
    badge: "Exclusive",
  },
  {
    id: "neon-reels",
    name: "Neon Reels",
    provider: "Northgate Studio",
    category: "slots",
    rtp: 95.8,
    volatility: "High",
    minStake: 0.5,
    maxStake: 100,
    tagline: "5 reels, 243 ways, cascading multipliers.",
    hue: "from-accent/25 to-accent/5",
    badge: "Hot",
  },
  {
    id: "coin-flip",
    name: "Double or Nothing",
    provider: "Betrix Originals",
    category: "instant",
    rtp: 97.2,
    volatility: "Low",
    minStake: 1,
    maxStake: 500,
    tagline: "One call. One flip. Instant settlement.",
    hue: "from-chart-2/25 to-chart-2/5",
  },
  {
    id: "blackjack-classic",
    name: "Blackjack Classic",
    provider: "Kingsway Tables",
    category: "table",
    rtp: 99.1,
    volatility: "Low",
    minStake: 2,
    maxStake: 1000,
    tagline: "Eight decks, dealer stands on soft 17.",
    hue: "from-chart-3/25 to-chart-3/5",
  },
  {
    id: "roulette-euro",
    name: "European Roulette",
    provider: "Kingsway Tables",
    category: "table",
    rtp: 97.3,
    volatility: "Medium",
    minStake: 1,
    maxStake: 750,
    tagline: "Single zero wheel with racetrack betting.",
    hue: "from-destructive/20 to-destructive/5",
  },
  {
    id: "mine-field",
    name: "Minefield",
    provider: "Betrix Originals",
    category: "instant",
    rtp: 96.9,
    volatility: "High",
    minStake: 1,
    maxStake: 300,
    tagline: "Pick tiles, dodge mines, ride the multiplier.",
    hue: "from-accent/20 to-primary/5",
    badge: "New",
  },
  {
    id: "gold-frontier",
    name: "Gold Frontier",
    provider: "Northgate Studio",
    category: "slots",
    rtp: 96.1,
    volatility: "Medium",
    minStake: 0.2,
    maxStake: 120,
    tagline: "Hold & win reels with progressive pots.",
    hue: "from-betrix-amber/25 to-betrix-amber/5",
  },
  {
    id: "studio-baccarat",
    name: "Studio Baccarat",
    provider: "Kingsway Live",
    category: "live",
    rtp: 98.9,
    volatility: "Low",
    minStake: 5,
    maxStake: 2000,
    tagline: "Hosted table, 24/7, squeeze mode enabled.",
    hue: "from-chart-4/25 to-chart-4/5",
  },
  {
    id: "texas-holdem",
    name: "Texas Hold'em Poker",
    provider: "Kingsway Tables",
    category: "table",
    rtp: 97.8,
    volatility: "Medium",
    minStake: 2,
    maxStake: 1500,
    tagline: "Heads-up against the house, ante and play.",
    hue: "from-primary/25 to-primary/5",
    badge: "Hot",
  },
  {
    id: "live-poker-room",
    name: "Live Poker Room",
    provider: "Kingsway Live",
    category: "live",
    rtp: 98.4,
    volatility: "Medium",
    minStake: 5,
    maxStake: 5000,
    tagline: "Real dealers, six-seat tables, side bets open.",
    hue: "from-chart-3/25 to-chart-3/5",
    badge: "New",
  },
  {
    id: "video-poker-deuces",
    name: "Deuces Wild Poker",
    provider: "Northgate Studio",
    category: "instant",
    rtp: 99.4,
    volatility: "Low",
    minStake: 0.25,
    maxStake: 200,
    tagline: "Jacks or better with wild deuces and a 4,000x royal.",
    hue: "from-betrix-amber/25 to-betrix-amber/5",
  },
];

export function getGameById(id: string): CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
