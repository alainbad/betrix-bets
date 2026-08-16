import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { americanToDecimal, formatCurrency, formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

export function BetSlipDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    slip,
    removeFromSlip,
    updateStake,
    clearSlip,
    placeBets,
    totalStake,
    totalPotentialReturn,
    balance,
    placing,
  } = useBetting();
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
    <>
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-md transform border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-bold text-foreground">Bet Slip ({slip.length})</h2>
            <div className="flex items-center gap-2">
              {slip.length > 0 && (
                <button
                  onClick={clearSlip}
                  className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                >
                  Clear
                </button>
              )}
              <button
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Close bet slip"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {slip.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                  <svg
                    className="h-8 w-8 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="text-sm text-muted-foreground">Your bet slip is empty.</p>
                <Link
                  to="/sports"
                  onClick={onClose}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
                >
                  Browse events
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {slip.map((item) => (
                  <div key={item.id} className="rounded-xl border border-border bg-betrix-surface p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-foreground">{item.eventName}</p>
                        <p className="text-xs text-muted-foreground">
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-lg border border-border bg-background">
                        <button
                          onClick={() => updateStake(item.id, Math.max(1, item.stake - 5))}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground"
                          aria-label="Decrease stake"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="min-w-[3.5rem] text-center text-sm font-bold text-foreground">
                          ${item.stake}
                        </div>
                        <button
                          onClick={() => updateStake(item.id, item.stake + 5)}
                          className="px-2 py-1 text-muted-foreground hover:text-foreground"
                          aria-label="Increase stake"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{formatOdds(item.selection.odds)}</p>
                        <p className="text-sm font-bold text-primary">
                          {formatCurrency(item.stake * americanToDecimal(item.selection.odds))}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {slip.length > 0 && (
            <div className="border-t border-border p-4">
              <div className="mb-3 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total stake</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totalStake)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Potential return</span>
                  <span className="font-bold text-primary">{formatCurrency(totalPotentialReturn)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={cn("font-semibold", insufficientFunds ? "text-destructive" : "text-foreground")}>
                    {formatCurrency(balance)}
                  </span>
                </div>
              </div>
              {insufficientFunds && (
                <p className="mb-2 text-center text-xs font-medium text-destructive">Insufficient funds</p>
              )}
              <button
                onClick={() => void handlePlace()}
                disabled={insufficientFunds || placed || placing}
                className={cn(
                  "w-full rounded-xl py-3 text-sm font-bold text-primary-foreground transition-all disabled:opacity-60",
                  placed ? "bg-accent text-accent-foreground" : "bg-primary hover:bg-primary/90"
                )}
              >
                {placed ? "Bets placed!" : placing ? "Placing…" : "Place bets"}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
