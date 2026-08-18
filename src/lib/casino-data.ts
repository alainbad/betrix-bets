export type CasinoCategory = "slots" | "table" | "instant" | "live";

// Which animated stage renders on the game page. The server always decides
// win/lose/payout first (play_casino_round) - these are cosmetic reveals
// that land on that pre-decided outcome, not independent game logic, so the
// mandated 15% win rate is unaffected by which mechanic a game uses.
export type CasinoMechanic =
  "slot" | "wheel" | "roulette" | "cards" | "tiles" | "vault" | "coinflip";

export interface CasinoGame {
  id: string;
  name: string;
  provider: string;
  category: CasinoCategory;
  mechanic: CasinoMechanic;
  rtp: number;
  volatility: "Low" | "Medium" | "High";
  minStake: number;
  maxStake: number;
  tagline: string;
  hue: string;
  badge?: "New" | "Hot" | "Exclusive";
  // Plain-language rules for the classic game this page is styled after,
  // shown in a "How to play" panel on the game page.
  howToPlay: string[];
  // Only for mechanic "cards" - which two-hand comparison labels/scoring to
  // use. "versus" = generic "Dealer"/"You" with blackjack-style totals.
  // "baccarat" = "Banker"/"Player" with a mod-10 point total.
  cardStyle?: "versus" | "baccarat";
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
    mechanic: "vault",
    rtp: 96.5,
    volatility: "Medium",
    minStake: 1,
    maxStake: 250,
    tagline: "Cash out before the vault slams shut.",
    hue: "from-primary/25 to-primary/5",
    badge: "Exclusive",
    howToPlay: [
      "Set your stake and press Play to send the vault door into motion.",
      "The door either swings open, paying out your win, or slams shut on a loss.",
      "Every round is independent - there's no pattern to read or timing to learn.",
    ],
  },
  {
    id: "neon-reels",
    name: "Neon Reels",
    provider: "Northgate Studio",
    category: "slots",
    mechanic: "slot",
    rtp: 95.8,
    volatility: "High",
    minStake: 0.5,
    maxStake: 100,
    tagline: "5 reels, 243 ways, cascading multipliers.",
    hue: "from-accent/25 to-accent/5",
    badge: "Hot",
    howToPlay: [
      "Classic slots pay when matching symbols line up across a payline after the reels stop.",
      "Set your stake and press Play - the reels spin and settle on this round's result.",
      "Three matching symbols across the reels means a win; anything else is a loss.",
    ],
  },
  {
    id: "coin-flip",
    name: "Double or Nothing",
    provider: "Betrix Originals",
    category: "instant",
    mechanic: "coinflip",
    rtp: 97.2,
    volatility: "Low",
    minStake: 1,
    maxStake: 500,
    tagline: "One call. One flip. Instant settlement.",
    hue: "from-chart-2/25 to-chart-2/5",
    howToPlay: [
      "The simplest game in the lobby: call heads or tails, then flip.",
      "Pick a side, set your stake, and press Play - the coin flips and lands on one face.",
      "If it lands on the side you called, the round is a win; the other face is a loss.",
    ],
  },
  {
    id: "blackjack-classic",
    name: "Blackjack Classic",
    provider: "Kingsway Tables",
    category: "table",
    mechanic: "cards",
    cardStyle: "versus",
    rtp: 99.1,
    volatility: "Low",
    minStake: 2,
    maxStake: 1000,
    tagline: "Eight decks, dealer stands on soft 17.",
    hue: "from-chart-3/25 to-chart-3/5",
    howToPlay: [
      "In classic blackjack, you and the dealer are each dealt cards and try to get closer to 21 than the other without going over.",
      "Number cards count at face value, face cards count as 10, and an Ace counts as 1 or 11.",
      "Here, set your stake and press Play - your hand and the dealer's are dealt and revealed together, settling the round.",
    ],
  },
  {
    id: "roulette-euro",
    name: "European Roulette",
    provider: "Kingsway Tables",
    category: "table",
    mechanic: "roulette",
    rtp: 97.3,
    volatility: "Medium",
    minStake: 1,
    maxStake: 750,
    tagline: "Single zero wheel with racetrack betting.",
    hue: "from-destructive/20 to-destructive/5",
    howToPlay: [
      "European roulette uses a single-zero wheel numbered 0-36; players bet on where the ball will land.",
      "Pick a number on the board, set your stake, and press Play - this simulation supports a straight-up single-number bet.",
      "If the ball lands on your number the round is a win; any other number is a loss.",
    ],
  },
  {
    id: "mine-field",
    name: "Minefield",
    provider: "Betrix Originals",
    category: "instant",
    mechanic: "tiles",
    rtp: 96.9,
    volatility: "High",
    minStake: 1,
    maxStake: 300,
    tagline: "Pick tiles, dodge mines, ride the multiplier.",
    hue: "from-accent/20 to-primary/5",
    badge: "New",
    howToPlay: [
      "A grid hides gems and mines beneath its tiles - the more gems you clear, the bigger the multiplier.",
      "Set your stake and press Play - the grid reveals itself; an all-clear is a win, hitting a mine is a loss.",
      "Higher stakes ride the same odds every round; there's no safer tile to pick.",
    ],
  },
  {
    id: "gold-frontier",
    name: "Gold Frontier",
    provider: "Northgate Studio",
    category: "slots",
    mechanic: "slot",
    rtp: 96.1,
    volatility: "Medium",
    minStake: 0.2,
    maxStake: 120,
    tagline: "Hold & win reels with progressive pots.",
    hue: "from-betrix-amber/25 to-betrix-amber/5",
    howToPlay: [
      "A hold-and-win style slot: land enough matching symbols and the reels pay out.",
      "Set your stake and press Play - the reels spin and settle on this round's result.",
      "A full match across the reels wins; a mixed result means the round is a loss.",
    ],
  },
  {
    id: "studio-baccarat",
    name: "Studio Baccarat",
    provider: "Kingsway Live",
    category: "live",
    mechanic: "cards",
    cardStyle: "baccarat",
    rtp: 98.9,
    volatility: "Low",
    minStake: 5,
    maxStake: 2000,
    tagline: "Hosted table, 24/7, squeeze mode enabled.",
    hue: "from-chart-4/25 to-chart-4/5",
    howToPlay: [
      "In baccarat, two hands - Player and Banker - are dealt and compared; the hand closest to 9 wins.",
      "You bet on which hand will win, or on a tie, before the cards are revealed.",
      "Here, set your stake and press Play - both hands are dealt and revealed together, settling the round.",
    ],
  },
  {
    id: "texas-holdem",
    name: "Texas Hold'em Poker",
    provider: "Kingsway Tables",
    category: "table",
    mechanic: "cards",
    cardStyle: "versus",
    rtp: 97.8,
    volatility: "Medium",
    minStake: 2,
    maxStake: 1500,
    tagline: "Heads-up against the house, ante and play.",
    hue: "from-primary/25 to-primary/5",
    badge: "Hot",
    howToPlay: [
      "In Texas Hold'em, each player gets two private cards and shares five community cards to build the best five-card hand.",
      "Higher-ranked hands (pairs, straights, flushes, and up) beat lower ones at showdown.",
      "Here, set your stake and press Play - your hand against the house is dealt and revealed together, settling the round.",
    ],
  },
  {
    id: "live-poker-room",
    name: "Live Poker Room",
    provider: "Kingsway Live",
    category: "live",
    mechanic: "cards",
    cardStyle: "versus",
    rtp: 98.4,
    volatility: "Medium",
    minStake: 5,
    maxStake: 5000,
    tagline: "Real dealers, six-seat tables, side bets open.",
    hue: "from-chart-3/25 to-chart-3/5",
    badge: "New",
    howToPlay: [
      "A poker-room style table: you play heads-up against the house instead of a full ring of opponents.",
      "The better five-card hand at showdown wins the round.",
      "Here, set your stake and press Play - hands are dealt and revealed together, settling the round instantly.",
    ],
  },
  {
    id: "video-poker-deuces",
    name: "Deuces Wild Poker",
    provider: "Northgate Studio",
    category: "instant",
    mechanic: "cards",
    cardStyle: "versus",
    rtp: 99.4,
    volatility: "Low",
    minStake: 0.25,
    maxStake: 200,
    tagline: "Jacks or better with wild deuces and a 4,000x royal.",
    hue: "from-betrix-amber/25 to-betrix-amber/5",
    howToPlay: [
      "Classic video poker deals a five-card hand where all 2s are wild and can complete any winning combination.",
      "Jacks-or-better and stronger hands pay out, up to a top prize for a royal flush.",
      "Here, set your stake and press Play - your hand is dealt and revealed in one motion, settling the round.",
    ],
  },
  {
    id: "lucky-wheel",
    name: "Lucky Wheel",
    provider: "Kingsway Live",
    category: "live",
    mechanic: "wheel",
    rtp: 96.5,
    volatility: "Medium",
    minStake: 1,
    maxStake: 1000,
    tagline: "Spin the big wheel for instant multipliers.",
    hue: "from-chart-2/25 to-chart-2/5",
    badge: "New",
    howToPlay: [
      "A single big wheel with win and blank segments spread around its edge.",
      "Set your stake and press Play - the wheel spins and settles wherever the pointer lands.",
      "Landing on a win segment pays out; landing on a blank segment is a loss.",
    ],
  },
];

export function getGameById(id: string): CasinoGame | undefined {
  return CASINO_GAMES.find((g) => g.id === id);
}
