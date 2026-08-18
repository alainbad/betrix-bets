import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { CasinoStageProps } from "./types";

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7"];
const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false },
];

function randomCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)] ?? RANKS[0]!;
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)] ?? SUITS[0]!;
  return { rank, suit: suit.symbol, red: suit.red };
}

export function CardReveal({ phase, outcome }: CasinoStageProps) {
  const [cards, setCards] = useState(() => [randomCard(), randomCard()]);

  useEffect(() => {
    if (phase === "spinning") setCards([randomCard(), randomCard()]);
  }, [phase]);

  return (
    <div className="flex items-center justify-center gap-4" style={{ perspective: "600px" }}>
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative h-24 w-16 transition-transform duration-500"
          style={{
            transformStyle: "preserve-3d",
            transform: phase === "revealed" ? "rotateY(180deg)" : "rotateY(0deg)",
            transitionDelay: phase === "revealed" ? `${i * 180}ms` : "0ms",
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-border bg-gradient-to-br from-secondary to-background"
            style={{ backfaceVisibility: "hidden" }}
          >
            <span className="text-lg font-black text-muted-foreground">?</span>
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 bg-card",
              phase === "revealed" && outcome === "win" ? "border-primary" : "border-border",
            )}
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span
              className={cn(
                "text-xl font-black leading-none",
                card.red ? "text-destructive" : "text-foreground",
              )}
            >
              {card.rank}
            </span>
            <span
              className={cn(
                "text-lg leading-none",
                card.red ? "text-destructive" : "text-foreground",
              )}
            >
              {card.suit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
