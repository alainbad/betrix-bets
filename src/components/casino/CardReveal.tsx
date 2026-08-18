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

function buildRound(style: CardStyle, outcome: "win" | "lose") {
  const total = style === "baccarat" ? baccaratTotal : versusTotal;
  const you = drawHand();
  const community = style === "poker" ? drawCommunity() : [];
  let house = drawHand();
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
  total: number;
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
  const totalFn = style === "baccarat" ? baccaratTotal : versusTotal;
  const youTotal = totalFn([...round.you, ...round.community]);
  const houseTotal = totalFn([...round.house, ...round.community]);
  const youWin = revealed && outcome === "win";

  const houseLabel = style === "baccarat" ? "Banker" : "Dealer";
  const youLabel = style === "baccarat" ? "Player" : "You";

  if (style === "poker") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Hand
          label={houseLabel}
          cards={round.house}
          total={houseTotal}
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
          total={youTotal}
          revealed={revealed}
          winner={youWin}
          delayOffset={600}
        />
      </div>
    );
  }

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
