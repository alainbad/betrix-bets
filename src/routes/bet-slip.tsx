import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus, Plus, RefreshCw, Trash2, Ticket } from "lucide-react";
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
    oddsChanges,
    unavailableIds,
    syncingOdds,
    acceptOddsChanges,
    syncOdds,
  } = useBetting();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [placed, setPlaced] = useState(false);
  // Set when the final price check found movement: the punter must explicitly
  // accept the new price before the bet goes on.
  const [confirmPriceMove, setConfirmPriceMove] = useState(false);
  const insufficientFunds = totalStake > balance;
  const hasOddsChanges = Object.keys(oddsChanges).length > 0;
  const hasUnavailable = unavailableIds.length > 0;
  const missingStake = slip.some((item) => !item.stake || item.stake <= 0);
  const blocked = insufficientFunds || hasUnavailable || missingStake || slip.length === 0;

  async function handlePlace(acceptPriceMoves = false) {
    if (blocked || placing) return;
    const result = await placeBets({ acceptPriceMoves });
    if (result.ok) {
      setPlaced(true);
      setConfirmPriceMove(false);
      toast.success("Bet placed at live odds.");
      const receiptId = result.betIds?.[0];
      if (receiptId) {
        void navigate({ to: "/receipt/$betId", params: { betId: receiptId } });
        return;
      }
      setTimeout(() => setPlaced(false), 2000);
    } else if (result.priceMoved) {
      setConfirmPriceMove(true);
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
                {unavailableIds.includes(item.id) && (
                  <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Market suspended — remove this pick to continue
                  </p>
                )}
                {oddsChanges[item.id] && (
                  <p
                    className={cn(
                      "mb-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold",
                      oddsChanges[item.id]!.to > oddsChanges[item.id]!.from
                        ? "bg-accent/10 text-accent"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {oddsChanges[item.id]!.to > oddsChanges[item.id]!.from ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    Price moved {formatOdds(oddsChanges[item.id]!.from)} →{" "}
                    {formatOdds(oddsChanges[item.id]!.to)}
                  </p>
                )}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center rounded-xl border border-border bg-background">
                    <button
                      onClick={() => updateStake(item.id, Math.max(1, item.stake - 5))}
                      className="px-3 py-2 text-muted-foreground hover:text-foreground"
                      aria-label="Decrease stake"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <label className="sr-only" htmlFor={`stake-${item.id}`}>
                      Stake for {item.selection.label}
                    </label>
                    <input
                      id={`stake-${item.id}`}
                      inputMode="decimal"
                      value={item.stake === 0 ? "" : String(item.stake)}
                      onChange={(e) => {
                        const next = Number(e.target.value.replace(/[^0-9.]/g, ""));
                        updateStake(item.id, Number.isFinite(next) ? next : 0);
                      }}
                      className="w-[4.5rem] bg-transparent text-center text-base font-bold text-foreground outline-none"
                    />
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
                <div className="mt-3 flex flex-wrap gap-2">
                  {[5, 10, 25, 100].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => updateStake(item.id, amount)}
                      className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="space-y-2 border-b border-border pb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Live odds
                    <RefreshCw
                      className={cn("h-3 w-3", syncingOdds && "animate-spin text-primary")}
                    />
                  </span>
                  <button
                    onClick={() => void syncOdds()}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Refresh prices
                  </button>
                </div>
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
              {hasOddsChanges && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">
                    Odds updated since you picked — payouts recalculated.
                  </p>
                  <button
                    onClick={acceptOddsChanges}
                    className="shrink-0 text-xs font-bold text-primary hover:underline"
                  >
                    Accept
                  </button>
                </div>
              )}
              {insufficientFunds && (
                <p className="mt-3 text-center text-sm font-medium text-destructive">
                  Insufficient funds
                </p>
              )}
              {confirmPriceMove && (
                <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 p-3">
                  <p className="text-xs font-semibold text-foreground">
                    Prices moved while you were reviewing. Place at the new odds?
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => void handlePlace(true)}
                      disabled={placing}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                    >
                      Accept new odds & place
                    </button>
                    <button
                      onClick={() => setConfirmPriceMove(false)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {user ? (
                <button
                  onClick={() => void handlePlace()}
                  disabled={blocked || placed || placing}
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
                    <p
                      className={cn(
                        "text-xs font-semibold capitalize",
                        bet.status === "won"
                          ? "text-accent"
                          : bet.status === "lost"
                            ? "text-destructive"
                            : "text-muted-foreground",
                      )}
                    >
                      {bet.status === "pending"
                        ? `To return ${formatCurrency(bet.potentialReturn)}`
                        : bet.status === "lost"
                          ? "Lost"
                          : `${bet.status === "void" ? "Refunded" : "Paid"} ${formatCurrency(bet.payout)}`}
                    </p>
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
