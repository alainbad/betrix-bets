import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Copy, Receipt, Ticket } from "lucide-react";
import { toast } from "sonner";
import { useBetting } from "@/lib/betting-store";
import { formatCurrency, formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/receipt/$betId")({
  head: () => ({
    meta: [
      { title: "Bet Receipt — Betrix" },
      { name: "description", content: "Your Betrix bet receipt: stake, price and potential return." },
      { property: "og:title", content: "Bet Receipt — Betrix" },
      {
        property: "og:description",
        content: "Your Betrix bet receipt: stake, price and potential return.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { betId } = Route.useParams();
  const { bets } = useBetting();
  const bet = bets.find((b) => b.id === betId);

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        {!bet ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <Receipt className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Receipt unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We couldn&apos;t find this bet on your account.
            </p>
            <Link
              to="/account"
              className="mt-5 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              View bet history
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-primary" />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">Bet placed</h1>
                <p className="text-sm text-muted-foreground">
                  Receipt {bet.id.slice(0, 8).toUpperCase()}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 border-b border-dashed border-border pb-4">
                <Ticket className="h-4 w-4 text-primary" />
                <p className="font-bold text-foreground">{bet.eventName}</p>
              </div>
              <dl className="space-y-3 py-4 text-sm">
                <Row label="Market" value={bet.marketLabel} />
                <Row label="Selection" value={bet.selectionLabel} />
                <Row label="Price taken" value={formatOdds(bet.odds)} />
                <Row label="Stake" value={formatCurrency(bet.stake)} />
                <Row
                  label="Potential return"
                  value={formatCurrency(bet.potentialReturn)}
                  emphasis
                />
                <Row label="Placed" value={new Date(bet.placedAt).toUTCString()} />
                <Row
                  label="Status"
                  value={
                    bet.status === "pending"
                      ? "Open"
                      : bet.status === "won"
                        ? `Won · paid ${formatCurrency(bet.payout)}`
                        : bet.status === "void"
                          ? `Void · refunded ${formatCurrency(bet.payout)}`
                          : "Lost"
                  }
                />
              </dl>
              <button
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText(bet.id)
                    .then(() => toast.success("Receipt ID copied"));
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy receipt ID
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                to="/"
                className="rounded-xl border border-border py-3 text-center text-sm font-bold text-foreground"
              >
                Keep betting
              </Link>
              <Link
                to="/account"
                className="rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground"
              >
                My bets
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-right font-semibold text-foreground",
          emphasis && "text-base font-bold text-primary",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
