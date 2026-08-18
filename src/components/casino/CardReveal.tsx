import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SuitIcon, type SuitName } from "./icons";
import type { CasinoStageProps } from "./types";

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS: { name: SuitName; red: boolean }[] = [
  { name: "spade", red: false },
  { name: "heart", red: true },
  { name: "diamond", red: true },
  { name: "club", red: false },
];

type CardStyle = "versus" | "baccarat" | "poker";

interface Card {
  rank: string;
  suit: SuitName;
  red: boolean;
}

function randomCard(): Card {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)] ?? RANKS[0]!;
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? SUITS[0]!;
  return { rank, suit: suit.name, red: suit.red };
}

function drawHand(): [Card, Card] {
  return [randomCard(), randomCard()];
}

function drawCommunity(): Card[] {
  return Array.from({ length: 5 }, randomCard);
}

function versusTotal(hand: Card[]): number {
  return hand.reduce((sum, c) => {
    if (c.rank === "A") return sum + 11;
    if (["K", "Q", "J"].includes(c.rank)) return sum + 10;
    return sum + Number(c.rank);
  }, 0);
}

function baccaratTotal(hand: Card[]): number {
  const sum = hand.reduce((total, c) => {
    if (c.rank === "A") return total + 1;
    if (["K", "Q", "J", "10"].includes(c.rank)) return total;
    return total + Number(c.rank);
  }, 0);
  return sum % 10;
}

// Real Texas Hold'em hand ranking: best 5-of-7 across the 9 standard
// categories (10 counting Royal Flush as a named Straight Flush), with
// proper kicker tiebreaks and the A-2-3-4-5 "wheel" straight.
const HAND_CATEGORY = {
  HIGH_CARD: 0,
  PAIR: 1,
  TWO_PAIR: 2,
  THREE_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 5,
  FULL_HOUSE: 6,
  FOUR_KIND: 7,
  STRAIGHT_FLUSH: 8,
} as const;

const HAND_NAMES = [
  "High Card",
  "Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

interface HandScore {
  category: number;
  tiebreakers: number[];
}

function rankValue(rank: string): number {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return Number(rank);
}

function evaluate5(cards: Card[]): HandScore {
  const values = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0]!.suit);

  const uniqueDesc = Array.from(new Set(values)).sort((a, b) => b - a);
  let straightHigh: number | null = null;
  if (uniqueDesc.length === 5) {
    if (uniqueDesc[0]! - uniqueDesc[4]! === 4) {
      straightHigh = uniqueDesc[0]!;
    } else if (uniqueDesc.join(",") === "14,5,4,3,2") {
      straightHigh = 5; // wheel: A-2-3-4-5 plays as a 5-high straight
    }
  }
  const isStraight = straightHigh !== null;

  if (isStraight && isFlush) {
    return { category: HAND_CATEGORY.STRAIGHT_FLUSH, tiebreakers: [straightHigh!] };
  }

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const kickersOf = (count: number) =>
    groups
      .filter((g) => g[1] === count)
      .map((g) => g[0])
      .sort((a, b) => b - a);

  if (groups[0]![1] === 4) {
    return { category: HAND_CATEGORY.FOUR_KIND, tiebreakers: [groups[0]![0], ...kickersOf(1)] };
  }
  if (groups[0]![1] === 3 && groups[1]?.[1] === 2) {
    return { category: HAND_CATEGORY.FULL_HOUSE, tiebreakers: [groups[0]![0], groups[1]![0]] };
  }
  if (isFlush) {
    return { category: HAND_CATEGORY.FLUSH, tiebreakers: values };
  }
  if (isStraight) {
    return { category: HAND_CATEGORY.STRAIGHT, tiebreakers: [straightHigh!] };
  }
  if (groups[0]![1] === 3) {
    return { category: HAND_CATEGORY.THREE_KIND, tiebreakers: [groups[0]![0], ...kickersOf(1)] };
  }
  if (groups[0]![1] === 2 && groups[1]?.[1] === 2) {
    const pairValues = [groups[0]![0], groups[1]![0]].sort((a, b) => b - a);
    return { category: HAND_CATEGORY.TWO_PAIR, tiebreakers: [...pairValues, ...kickersOf(1)] };
  }
  if (groups[0]![1] === 2) {
    return { category: HAND_CATEGORY.PAIR, tiebreakers: [groups[0]![0], ...kickersOf(1)] };
  }
  return { category: HAND_CATEGORY.HIGH_CARD, tiebreakers: values };
}

function compareHandScore(a: HandScore, b: HandScore): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i = 0; i < len; i++) {
    const diff = (a.tiebreakers[i] ?? 0) - (b.tiebreakers[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function combinations5(cards: Card[]): Card[][] {
  const result: Card[][] = [];
  const n = cards.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++)
            result.push([cards[a]!, cards[b]!, cards[c]!, cards[d]!, cards[e]!]);
  return result;
}

function bestPokerHand(cards: Card[]): HandScore {
  let best: HandScore | null = null;
  for (const combo of combinations5(cards)) {
    const score = evaluate5(combo);
    if (!best || compareHandScore(score, best) > 0) best = score;
  }
  return best!;
}

function describePokerHand(score: HandScore): string {
  if (score.category === HAND_CATEGORY.STRAIGHT_FLUSH && score.tiebreakers[0] === 14) {
    return "Royal Flush";
  }
  return HAND_NAMES[score.category]!;
}

function buildRound(style: CardStyle, outcome: "win" | "lose") {
  const you = drawHand();
  const community = style === "poker" ? drawCommunity() : [];
  let house = drawHand();

  if (style === "poker") {
    for (let i = 0; i < 50; i++) {
      const cmp = compareHandScore(
        bestPokerHand([...you, ...community]),
        bestPokerHand([...house, ...community]),
      );
      const youWins = cmp > 0;
      if ((outcome === "win") === youWins) break;
      house = drawHand();
    }
    return { you, house, community };
  }

  const total = style === "baccarat" ? baccaratTotal : versusTotal;
  for (let i = 0; i < 50; i++) {
    const youWins = total([...you, ...community]) > total([...house, ...community]);
    if ((outcome === "win") === youWins) break;
    house = drawHand();
  }
  return { you, house, community };
}

function CardFace({
  card,
  revealed,
  delayMs,
  size = "md",
}: {
  card: Card;
  revealed: boolean;
  delayMs: number;
  size?: "md" | "sm";
}) {
  return (
    <div
      className={cn(
        "relative transition-transform duration-500 ease-out",
        size === "sm" ? "h-16 w-11" : "h-20 w-14",
      )}
      style={{
        transformStyle: "preserve-3d",
        transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)",
        transitionDelay: revealed ? `${delayMs}ms` : "0ms",
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center rounded-md border-2 border-betrix-amber/40 shadow"
        style={{
          backfaceVisibility: "hidden",
          background:
            "repeating-linear-gradient(45deg, hsl(240 8% 16%), hsl(240 8% 16%) 5px, hsl(240 8% 20%) 5px, hsl(240 8% 20%) 10px)",
        }}
      >
        <div className="h-6 w-6 rounded-full border-2 border-betrix-amber/50" />
      </div>
      <div
        className="absolute inset-0 flex flex-col justify-between rounded-md border-2 border-black/10 bg-white p-1 shadow"
        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
      >
        <span
          className={cn(
            "flex flex-col items-center text-xs font-black leading-none",
            card.red ? "text-red-600" : "text-neutral-900",
          )}
        >
          {card.rank}
          <SuitIcon suit={card.suit} className="mt-0.5 h-2.5 w-2.5" />
        </span>
        <SuitIcon
          suit={card.suit}
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2",
            card.red ? "text-red-600" : "text-neutral-900",
          )}
        />
        <span
          className={cn(
            "flex flex-col items-center self-end rotate-180 text-xs font-black leading-none",
            card.red ? "text-red-600" : "text-neutral-900",
          )}
        >
          {card.rank}
          <SuitIcon suit={card.suit} className="mt-0.5 h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}

function Hand({
  label,
  cards,
  total,
  revealed,
  winner,
  delayOffset,
}: {
  label: string;
  cards: [Card, Card];
  total: number | string;
  revealed: boolean;
  winner: boolean;
  delayOffset: number;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2 transition-colors duration-300",
        revealed && winner ? "border-primary bg-primary/5" : "border-transparent",
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="flex gap-1.5">
        <CardFace card={cards[0]} revealed={revealed} delayMs={delayOffset} />
        <CardFace card={cards[1]} revealed={revealed} delayMs={delayOffset + 120} />
      </div>
      <p
        className={cn(
          "text-xs font-black",
          revealed && winner ? "text-primary" : "text-foreground",
        )}
      >
        {revealed ? total : "?"}
      </p>
    </div>
  );
}

export function CardReveal({
  phase,
  outcome,
  cardStyle = "versus",
}: CasinoStageProps & { cardStyle?: CardStyle | undefined }) {
  const style = cardStyle;
  const [round, setRound] = useState(() => ({
    you: drawHand(),
    house: drawHand(),
    community: style === "poker" ? drawCommunity() : [],
  }));

  useEffect(() => {
    if (phase === "spinning")
      setRound({
        you: drawHand(),
        house: drawHand(),
        community: style === "poker" ? drawCommunity() : [],
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    if (phase === "revealed" && outcome) setRound(buildRound(style, outcome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, outcome]);

  const revealed = phase === "revealed";
  const youWin = revealed && outcome === "win";

  const houseLabel = style === "baccarat" ? "Banker" : "Dealer";
  const youLabel = style === "baccarat" ? "Player" : "You";

  if (style === "poker") {
    const youHandName = describePokerHand(bestPokerHand([...round.you, ...round.community]));
    const houseHandName = describePokerHand(bestPokerHand([...round.house, ...round.community]));
    return (
      <div className="flex flex-col items-center gap-3">
        <Hand
          label={houseLabel}
          cards={round.house}
          total={houseHandName}
          revealed={revealed}
          winner={!youWin}
          delayOffset={0}
        />
        <div className="flex flex-col items-center gap-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Community
          </p>
          <div className="flex gap-1">
            {round.community.map((card, i) => (
              <CardFace key={i} card={card} revealed={revealed} delayMs={120 + i * 90} size="sm" />
            ))}
          </div>
        </div>
        <Hand
          label={youLabel}
          cards={round.you}
          total={youHandName}
          revealed={revealed}
          winner={youWin}
          delayOffset={600}
        />
      </div>
    );
  }

  const totalFn = style === "baccarat" ? baccaratTotal : versusTotal;
  const youTotal = totalFn([...round.you, ...round.community]);
  const houseTotal = totalFn([...round.house, ...round.community]);

  return (
    <div className="flex items-center justify-center gap-4">
      <Hand
        label={houseLabel}
        cards={round.house}
        total={houseTotal}
        revealed={revealed}
        winner={!youWin}
        delayOffset={0}
      />
      <span className="text-xs font-black uppercase text-muted-foreground">vs</span>
      <Hand
        label={youLabel}
        cards={round.you}
        total={youTotal}
        revealed={revealed}
        winner={youWin}
        delayOffset={240}
      />
    </div>
  );
}
