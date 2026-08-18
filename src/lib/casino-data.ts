export type CasinoCategory = "slots" | "table" | "instant" | "live";

// Which animated stage renders on the game page. The server always decides
// win/lose/payout first (play_casino_round) - these are cosmetic reveals
// that land on that pre-decided outcome, not independent game logic, so the
// mandated 15% win rate is unaffected by which mechanic a game uses.
export type CasinoMechanic = "slot" | "wheel" | "roulette" | "coinflip" | "blackjack" | "holdem";

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
    mechanic: "blackjack",
    rtp: 99.1,
    volatility: "Low",
    minStake: 2,
    maxStake: 1000,
    tagline: "Single deck, dealer stands on soft 17.",
    hue: "from-chart-3/25 to-chart-3/5",
    howToPlay: [
      "You and the dealer are each dealt two cards; the dealer keeps one face down.",
      "Get closer to 21 than the dealer without going over. Number cards count at face value, face cards count as 10, and an Ace counts as 1 or 11.",
      "Hit to take another card, Stand to hold your total, or Double to take exactly one more card on double the stake.",
      "A two-card 21 is a natural Blackjack, paying 3:2. A normal win pays 1:1, and a tied total returns your stake as a push.",
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
    id: "texas-holdem",
    name: "Texas Hold'em Poker",
    provider: "Kingsway Tables",
    category: "table",
    mechanic: "holdem",
    rtp: 97.8,
    volatility: "Medium",
    minStake: 2,
    maxStake: 500,
    tagline: "Casino Hold'em: post an ante, see the flop, call or fold.",
    hue: "from-primary/25 to-primary/5",
    badge: "Hot",
    howToPlay: [
      "Post an Ante. You get two hole cards, the dealer gets two hidden cards, and the flop (three community cards) is dealt face up.",
      "Decide: Fold and lose the ante, or Call for 2x the ante to stay in.",
      "The turn and river complete the board and the dealer reveals. The dealer must qualify with a pair or better.",
      "If the dealer doesn't qualify, the ante pays even money and the call pushes. If they qualify, the best five-card hands are compared - the call pays 1:1 on a win, and the ante pays a bonus up to 100:1 for a Royal Flush.",
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
