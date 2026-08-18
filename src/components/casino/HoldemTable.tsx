import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BookOpen, Info, Minus, Plus, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { useBetting } from "@/lib/betting-store";
import { useAuth } from "@/lib/auth-context";
import type { CasinoGame } from "@/lib/casino-data";
import type { CasinoRound } from "@/lib/casino-engine";
import {
  startHoldem,
  foldHoldem,
  callHoldem,
  type HoldemState,
  type HoldemCard,
} from "@/lib/holdem-engine";
import { SuitIcon, suitFromSymbol } from "./icons";
import { cn } from "@/lib/utils";

const STAKE_STEP = 5;

const HAND_CATEGORY_NAMES = [
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

function handName(category: number, isRoyal: boolean) {
  if (category === 8 && isRoyal) return "Royal Flush";
  return HAND_CATEGORY_NAMES[category] ?? "High Card";
}

function resultLabel(result: HoldemState["result"]) {
  switch (result) {
    case "fold":
      return "You folded";
    case "no_qualify":
      return "Dealer doesn't qualify";
    case "win":
      return "You win";
    case "push":
      return "Push - stakes returned";
    case "lose":
      return "Dealer wins";
    default:
      return "";
  }
}

function PlayingCard({ card, faceDown }: { card?: HoldemCard | undefined; faceDown?: boolean }) {
  if (faceDown || !card) {
    return (
      <div
        className="h-20 w-14 rounded-md border-2 border-betrix-amber/40 shadow"
        style={{
          background:
            "repeating-linear-gradient(45deg, hsl(240 8% 16%), hsl(240 8% 16%) 5px, hsl(240 8% 20%) 5px, hsl(240 8% 20%) 10px)",
        }}
      >
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-betrix-amber/50" />
        </div>
      </div>
    );
  }

  const suit = suitFromSymbol(card.suit);
  const red = card.suit === "♥" || card.suit === "♦";

  return (
    <div className="relative flex h-20 w-14 flex-col justify-between rounded-md border-2 border-black/10 bg-white p-1 shadow">
      <span
        className={cn(
          "flex flex-col items-center text-xs font-black leading-none",
          red ? "text-red-600" : "text-neutral-900",
        )}
      >
        {card.rank}
        <SuitIcon suit={suit} className="mt-0.5 h-2.5 w-2.5" />
      </span>
      <SuitIcon
        suit={suit}
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2",
          red ? "text-red-600" : "text-neutral-900",
        )}
      />
      <span
        className={cn(
          "flex flex-col items-center self-end rotate-180 text-xs font-black leading-none",
          red ? "text-red-600" : "text-neutral-900",
        )}
      >
        {card.rank}
        <SuitIcon suit={suit} className="mt-0.5 h-2.5 w-2.5" />
      </span>
    </div>
  );
}

export function HoldemTable({ game, rounds }: { game: CasinoGame; rounds: CasinoRound[] }) {
  const { balance, refresh } = useBetting();
  const { user } = useAuth();
  const [ante, setAnte] = useState(() => Math.max(game.minStake, Math.min(game.maxStake, 10)));
  const [round, setRound] = useState<HoldemState | null>(null);
  const [busy, setBusy] = useState(false);

  const insufficientFunds = ante > balance;
  const awaitingDecision = round !== null && round.status === "awaiting_decision";
  const insufficientForCall = round !== null && round.ante * 2 > balance;
  const dealt = round?.status === "completed" && round.result !== "fold";

  async function handleDeal() {
    if (!user || busy) return;
    if (ante < game.minStake || ante > game.maxStake) {
      toast.error(
        `Ante must be between ${formatCurrency(game.minStake)} and ${formatCurrency(game.maxStake)}.`,
      );
      return;
    }
    if (insufficientFunds) {
      toast.error("Insufficient balance.");
      return;
    }
    setBusy(true);
    try {
      const next = await startHoldem(ante);
      setRound(next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the round.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: (roundId: string) => Promise<HoldemState>) {
    if (!round || busy) return;
    setBusy(true);
    try {
      const next = await action(round.id);
      setRound(next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That action failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function playAgain() {
    setRound(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dealer</p>
          <div className="flex gap-2">
            {dealt ? (
              (round.dealerCards ?? []).map((c, i) => <PlayingCard key={i} card={c} />)
            ) : (
              <>
                <PlayingCard faceDown />
                <PlayingCard faceDown />
              </>
            )}
          </div>
          {dealt && (
            <p className="text-sm font-black text-foreground">
              {round.dealerQualified ? "Qualifies" : "Doesn't qualify"}
            </p>
          )}
        </div>

        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Community
          </p>
          <div className="flex gap-2">
            {round ? (
              round.flop.map((c, i) => <PlayingCard key={i} card={c} />)
            ) : (
              <>
                <PlayingCard faceDown />
                <PlayingCard faceDown />
                <PlayingCard faceDown />
              </>
            )}
            <PlayingCard card={dealt ? round.turn : undefined} faceDown={!dealt} />
            <PlayingCard card={dealt ? round.river : undefined} faceDown={!dealt} />
          </div>
        </div>

        {round?.status === "completed" && (
          <div className="mb-6 flex flex-col items-center gap-1">
            <p
              className={cn(
                "text-lg font-black",
                round.result === "lose" || round.result === "fold"
                  ? "text-destructive"
                  : round.result === "push"
                    ? "text-muted-foreground"
                    : "text-primary",
              )}
            >
              {resultLabel(round.result)}
            </p>
            {round.payout !== undefined && round.payout > 0 && round.result !== "push" && (
              <p className="text-sm font-semibold text-primary">+{formatCurrency(round.payout)}</p>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">You</p>
          <div className="flex gap-2">
            {round ? (
              round.playerCards.map((c, i) => <PlayingCard key={i} card={c} />)
            ) : (
              <>
                <PlayingCard faceDown />
                <PlayingCard faceDown />
              </>
            )}
          </div>
          {round && (
            <p className="text-sm font-black text-foreground">
              {handName(round.handCategory, round.isRoyal)}
            </p>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          {!user ? (
            <Link
              to="/login"
              className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Log in to play
            </Link>
          ) : awaitingDecision ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAction(foldHoldem)}
                className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-bold text-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                Fold
              </button>
              <button
                type="button"
                disabled={busy || insufficientForCall}
                onClick={() => void handleAction(callHoldem)}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                Call for {formatCurrency(round.ante * 2)}
              </button>
            </div>
          ) : round?.status === "completed" ? (
            <button
              type="button"
              onClick={playAgain}
              className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Play again
            </button>
          ) : (
            <>
              <div className="flex items-center rounded-xl border border-border bg-background/90">
                <button
                  type="button"
                  onClick={() => setAnte((s) => Math.max(game.minStake, s - STAKE_STEP))}
                  className="px-3 py-2 text-muted-foreground hover:text-foreground"
                  aria-label="Decrease ante"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="min-w-[5rem] text-center text-base font-bold text-foreground">
                  {formatCurrency(ante)}
                </div>
                <button
                  type="button"
                  onClick={() => setAnte((s) => Math.min(game.maxStake, s + STAKE_STEP))}
                  className="px-3 py-2 text-muted-foreground hover:text-foreground"
                  aria-label="Increase ante"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={busy || insufficientFunds}
                onClick={() => void handleDeal()}
                className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {busy ? "Dealing…" : `Ante ${formatCurrency(ante)}`}
              </button>
              {insufficientFunds && (
                <p className="text-xs font-medium text-destructive">Insufficient balance</p>
              )}
            </>
          )}
          {awaitingDecision && insufficientForCall && (
            <p className="text-xs font-medium text-destructive">
              Insufficient balance to call - you can still fold.
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Virtual balance</p>
          <p className="text-2xl font-black text-foreground">{formatCurrency(balance)}</p>
        </div>
        {round && (
          <div className="rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">Ante</span>
              <span className="font-semibold text-foreground">{formatCurrency(round.ante)}</span>
            </div>
            {round.callBet !== undefined && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Call</span>
                <span className="font-semibold text-foreground">
                  {formatCurrency(round.callBet)}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <BookOpen className="h-3.5 w-3.5" /> How to play
          </p>
          <ul className="space-y-2 text-sm text-foreground">
            {game.howToPlay.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-2">
            <dt className="text-muted-foreground">Ante range</dt>
            <dd className="font-semibold text-foreground">
              {formatCurrency(game.minStake)} – {formatCurrency(game.maxStake)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2">
            <dt className="text-muted-foreground">Royal Flush ante bonus</dt>
            <dd className="font-semibold text-foreground">100:1</dd>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2">
            <dt className="text-muted-foreground">Dealer qualifies with</dt>
            <dd className="font-semibold text-foreground">Pair or better</dd>
          </div>
        </dl>

        {user && rounds.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
              Recent rounds
            </p>
            <ul className="space-y-2">
              {rounds.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{formatCurrency(r.stake)} stake</span>
                  <span
                    className={cn(
                      "font-semibold",
                      r.outcome === "win"
                        ? "text-primary"
                        : r.outcome === "lose"
                          ? "text-destructive"
                          : "text-muted-foreground",
                    )}
                  >
                    {r.outcome === "win"
                      ? `+${formatCurrency(r.payout)}`
                      : r.outcome === "lose"
                        ? "Lost"
                        : "Push"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="flex gap-2 rounded-2xl border border-border bg-secondary p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          Credits carry no monetary value and cannot be purchased, withdrawn or exchanged.
        </p>
        <p className="flex gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Every card, hand, and payout is generated and settled server-side - nothing is decided in
          this browser.
        </p>
      </aside>
    </div>
  );
}
