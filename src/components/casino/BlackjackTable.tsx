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
  startBlackjack,
  hitBlackjack,
  standBlackjack,
  doubleBlackjack,
  type BlackjackState,
  type BlackjackCard,
} from "@/lib/blackjack-engine";
import { SuitIcon, suitFromSymbol } from "./icons";
import { cn } from "@/lib/utils";

const STAKE_STEP = 5;

function PlayingCard({ card, faceDown }: { card?: BlackjackCard | undefined; faceDown?: boolean }) {
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

function resultLabel(result: BlackjackState["result"]) {
  switch (result) {
    case "blackjack_win":
      return "Blackjack! 3:2";
    case "win":
      return "You win";
    case "push":
      return "Push - stake returned";
    case "lose":
      return "Dealer wins";
    default:
      return "";
  }
}

export function BlackjackTable({ game, rounds }: { game: CasinoGame; rounds: CasinoRound[] }) {
  const { balance, refresh } = useBetting();
  const { user } = useAuth();
  const [stake, setStake] = useState(() => Math.max(game.minStake, Math.min(game.maxStake, 10)));
  const [round, setRound] = useState<BlackjackState | null>(null);
  const [busy, setBusy] = useState(false);

  const insufficientFunds = stake > balance;
  const inRound = round !== null && round.status === "player_turn";
  const canDouble = inRound && round.playerCards.length === 2 && round.totalBet <= balance;

  async function handleDeal() {
    if (!user || busy) return;
    if (stake < game.minStake || stake > game.maxStake) {
      toast.error(
        `Stake must be between ${formatCurrency(game.minStake)} and ${formatCurrency(game.maxStake)}.`,
      );
      return;
    }
    if (insufficientFunds) {
      toast.error("Insufficient balance.");
      return;
    }
    setBusy(true);
    try {
      const next = await startBlackjack(stake);
      setRound(next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the round.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAction(action: (roundId: string) => Promise<BlackjackState>) {
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
            {round ? (
              round.status === "completed" ? (
                (round.dealerCards ?? []).map((c, i) => <PlayingCard key={i} card={c} />)
              ) : (
                <>
                  <PlayingCard card={round.dealerUpCard} />
                  <PlayingCard faceDown />
                </>
              )
            ) : (
              <>
                <PlayingCard faceDown />
                <PlayingCard faceDown />
              </>
            )}
          </div>
          {round?.status === "completed" && (
            <p className="text-sm font-black text-foreground">{round.dealerTotal}</p>
          )}
        </div>

        {round?.status === "completed" && (
          <div className="mb-6 flex flex-col items-center gap-1">
            <p
              className={cn(
                "text-lg font-black",
                round.result === "lose"
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
              <PlayingCard faceDown />
            )}
            {!round && <PlayingCard faceDown />}
          </div>
          <p className="text-sm font-black text-foreground">{round ? round.playerTotal : "?"}</p>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          {!user ? (
            <Link
              to="/login"
              className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Log in to play
            </Link>
          ) : inRound ? (
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAction(hitBlackjack)}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                Hit
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleAction(standBlackjack)}
                className="rounded-full border border-border bg-background px-6 py-2.5 text-sm font-bold text-foreground transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                Stand
              </button>
              {canDouble && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAction(doubleBlackjack)}
                  className="rounded-full border border-betrix-amber/60 bg-background px-6 py-2.5 text-sm font-bold text-betrix-amber transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                >
                  Double
                </button>
              )}
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
                  onClick={() => setStake((s) => Math.max(game.minStake, s - STAKE_STEP))}
                  className="px-3 py-2 text-muted-foreground hover:text-foreground"
                  aria-label="Decrease stake"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="min-w-[5rem] text-center text-base font-bold text-foreground">
                  {formatCurrency(stake)}
                </div>
                <button
                  type="button"
                  onClick={() => setStake((s) => Math.min(game.maxStake, s + STAKE_STEP))}
                  className="px-3 py-2 text-muted-foreground hover:text-foreground"
                  aria-label="Increase stake"
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
                {busy ? "Dealing…" : `Deal for ${formatCurrency(stake)}`}
              </button>
              {insufficientFunds && (
                <p className="text-xs font-medium text-destructive">Insufficient balance</p>
              )}
            </>
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
              <span className="text-muted-foreground">Bet</span>
              <span className="font-semibold text-foreground">
                {formatCurrency(round.totalBet)}
              </span>
            </div>
            {round.isDoubled && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-muted-foreground">Doubled</span>
                <span className="font-semibold text-betrix-amber">Yes</span>
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
            <dt className="text-muted-foreground">Stake range</dt>
            <dd className="font-semibold text-foreground">
              {formatCurrency(game.minStake)} – {formatCurrency(game.maxStake)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 pt-2">
            <dt className="text-muted-foreground">Blackjack payout</dt>
            <dd className="font-semibold text-foreground">3:2</dd>
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
