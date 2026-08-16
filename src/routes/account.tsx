import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, TrendingUp, UserCog, Wallet } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatOdds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — Betrix" },
      {
        name: "description",
        content: "Track your play-money balance and betting history on Betrix.",
      },
      { property: "og:title", content: "My Account — Betrix" },
      {
        property: "og:description",
        content: "Track your play-money balance and betting history on Betrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { balance, bets } = useBetting();
  const { user, loading, signOut } = useAuth();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const totalStaked = bets.reduce((sum, b) => sum + b.stake, 0);
  const totalPotential = bets.reduce((sum, b) => sum + b.potentialReturn, 0);

  useEffect(() => {
    if (!user) {
      setWalletBalance(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("wallets")
      .select("available_balance")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled && data) setWalletBalance(Number(data["available_balance"]));
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!loading && !user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Sign in to view your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in or create a free account to track your simulation credits and betting history.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/login">
              <Button variant="outline">Log in</Button>
            </Link>
            <Link to="/register">
              <Button>Sign up</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">My account</h1>
            <p className="text-muted-foreground">
              {user ? `Signed in as ${user.email}` : "Play-money balance and betting history."}
            </p>
          </div>
          {user && (
            <div className="flex gap-2">
              <Link to="/profile">
                <Button variant="outline" size="sm" className="gap-2">
                  <UserCog className="h-4 w-4" /> Profile
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => void signOut()} className="gap-2">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Balance"
            value={formatCurrency(balance)}
            icon={<Wallet className="h-5 w-5" />}
          />
          <StatCard
            label="Total staked"
            value={formatCurrency(totalStaked)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label="Potential wins"
            value={formatCurrency(totalPotential)}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </div>

        {walletBalance !== null && (
          <p className="mt-3 text-xs text-muted-foreground">
            Server wallet balance:{" "}
            <span className="font-semibold text-foreground">{formatCurrency(walletBalance)}</span> —
            not yet connected to bet placement above.
          </p>
        )}

        <h2 className="mb-4 mt-10 text-xl font-bold text-foreground">Betting history</h2>
        {bets.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center">
            <p className="text-muted-foreground">No bets placed yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-secondary text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Selection</th>
                  <th className="px-4 py-3 font-semibold">Odds</th>
                  <th className="px-4 py-3 font-semibold">Stake</th>
                  <th className="px-4 py-3 font-semibold">Return</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bets.map((bet) => (
                  <tr key={bet.id}>
                    <td className="px-4 py-3 font-medium text-foreground">{bet.eventName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bet.marketLabel} · {bet.selectionLabel}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {formatOdds(bet.odds)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{formatCurrency(bet.stake)}</td>
                    <td className="px-4 py-3 font-semibold text-primary">
                      {formatCurrency(bet.potentialReturn)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={bet.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-1 text-xs font-semibold",
        status === "won" && "bg-primary/10 text-primary",
        status === "lost" && "bg-destructive/10 text-destructive",
        status === "pending" && "bg-accent/10 text-accent",
      )}
    >
      {status}
    </span>
  );
}
