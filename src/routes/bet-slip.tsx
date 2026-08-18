import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, Ticket } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { useAuth } from "@/lib/auth-context";
import { americanToDecimal, formatCurrency, formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bet-slip")({
  head: () => ({
    meta: [
      { title: "Bet Slip — Betrix" },
      {
        name: "description",
        content: "Review your picks and place your play-money bets on Betrix.",
      },
      { property: "og:title", content: "Bet Slip — Betrix" },
      {
        property: "og:description",
        content: "Review your picks and place your play-money bets on Betrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BetSlipPage,
});

function BetSlipPage() {
  const {
    slip,
    bets,
    removeFromSlip,
    updateStake,
    clearSlip,
    placeBets,
    totalStake,
    totalPotentialReturn,
    balance,
    placing,
  } = useBetting();
  const { user } = useAuth();
  const [placed, setPlaced] = useState(false);
  const insufficientFunds = totalStake > balance;

  async function handlePlace() {
    if (insufficientFunds || slip.length === 0 || placing) return;
    const result = await placeBets();
    if (result.ok) {
      setPlaced(true);
      setTimeout(() => setPlaced(false), 2000);
    } else if (result.error) {
      toast.error(result.error);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Bet Slip</h1>
            <p className="text-muted-foreground">
              {slip.length} selection{slip.length === 1 ? "" : "s"}
            </p>
          </div>
          {slip.length > 0 && (
            <button
              onClick={clearSlip}
              className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear all
            </button>
          )}
        </div>

        {slip.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Ticket className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground">Your bet slip is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add picks from upcoming events to get started.
            </p>
            <Link
              to="/sports"
              className="mt-6 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
            >
              Browse events
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {slip.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground">{item.eventName}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.marketLabel} · {item.selection.label}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromSlip(item.id)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label="Remove selection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center rounded-xl border border-border bg-background">
                    <button
                      onClick={() => updateStake(item.id, Math.max(1, item.stake - 5))}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      aria-label="Decrease stake"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[4rem] text-center text-base font-bold text-foreground">
                      ${item.stake}
                    </div>
                    <button
                      onClick={() => updateStake(item.id, item.stake + 5)}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      aria-label="Increase stake"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {formatOdds(item.selection.odds)}
                    </p>
                    <p className="font-bold text-primary">
                      {formatCurrency(item.stake * americanToDecimal(item.selection.odds))}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="space-y-2 border-b border-border pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total stake</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(totalStake)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Potential return</span>
                  <span className="font-bold text-primary">
                    {formatCurrency(totalPotentialReturn)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span
                    className={cn(
                      "font-semibold",
                      insufficientFunds ? "text-destructive" : "text-foreground",
                    )}
                  >
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
              {insufficientFunds && (
                <p className="mt-3 text-center text-sm font-medium text-destructive">
                  Insufficient funds
                </p>
              )}
              {user ? (
                <button
                  onClick={() => void handlePlace()}
                  disabled={insufficientFunds || placed || placing}
                  className={cn(
                    "mt-4 w-full rounded-xl py-3.5 text-sm font-bold text-primary-foreground transition-all disabled:opacity-60",
                    placed ? "bg-accent text-accent-foreground" : "bg-primary hover:bg-primary/90",
                  )}
                >
                  {placed ? "Bets placed!" : placing ? "Placing…" : "Place bets"}
                </button>
              ) : (
                <Link
                  to="/login"
                  className="mt-4 block w-full rounded-xl bg-primary py-3.5 text-center text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90"
                >
                  Log in to place bets
                </Link>
              )}
            </div>
          </div>
        )}

        {bets.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-xl font-bold text-foreground">Recent bets</h2>
            <div className="space-y-3">
              {bets.slice(0, 5).map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <div>
                    <p className="font-semibold text-foreground">{bet.eventName}</p>
                    <p className="text-xs text-muted-foreground">
                      {bet.marketLabel} · {bet.selectionLabel} · {formatOdds(bet.odds)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatCurrency(bet.stake)}</p>
                    <p className="text-xs text-muted-foreground">{bet.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
