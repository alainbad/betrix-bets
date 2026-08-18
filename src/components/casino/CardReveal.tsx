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
  const revealed = phase === "revealed";

  useEffect(() => {
    if (phase === "spinning") setCards([randomCard(), randomCard()]);
  }, [phase]);

  return (
    <div className="flex items-center justify-center gap-5" style={{ perspective: "700px" }}>
      {cards.map((card, i) => (
        <div
          key={i}
          className={cn(
            "relative h-28 w-[4.5rem] transition-transform duration-500 ease-out",
            phase === "spinning" && "animate-[casino-pulse-soft_0.9s_ease-in-out_infinite]",
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: revealed ? "rotateY(180deg) scale(1)" : "rotateY(0deg) scale(1)",
            transitionDelay: revealed ? `${i * 200}ms` : "0ms",
            animationDelay: `${i * 150}ms`,
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg border-2 border-betrix-amber/40 shadow-lg"
            style={{
              backfaceVisibility: "hidden",
              background:
                "repeating-linear-gradient(45deg, hsl(240 8% 16%), hsl(240 8% 16%) 6px, hsl(240 8% 20%) 6px, hsl(240 8% 20%) 12px)",
            }}
          >
            <div className="h-9 w-9 rounded-full border-2 border-betrix-amber/50" />
          </div>
          <div
            className={cn(
              "absolute inset-0 flex flex-col justify-between rounded-lg border-2 bg-white p-1.5 shadow-lg",
              revealed && outcome === "win" ? "border-primary" : "border-black/10",
            )}
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <span
              className={cn(
                "text-sm font-black leading-none",
                card.red ? "text-red-600" : "text-neutral-900",
              )}
            >
              {card.rank}
              <br />
              {card.suit}
            </span>
            <span
              className={cn("self-center text-2xl", card.red ? "text-red-600" : "text-neutral-900")}
            >
              {card.suit}
            </span>
            <span
              className={cn(
                "self-end rotate-180 text-sm font-black leading-none",
                card.red ? "text-red-600" : "text-neutral-900",
              )}
            >
              {card.rank}
              <br />
              {card.suit}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
