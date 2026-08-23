import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Gauge, Search, ShieldCheck, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import {
  ADMIN_PLAYERS,
  AUDIT_LOG,
  EXPOSURE,
  PLATFORM_METRICS,
  TRAFFIC_SERIES,
} from "@/lib/admin-data";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Operator Console — Betrix Admin" },
      {
        name: "description",
        content:
          "Betrix operator console: player monitoring, liability and exposure analytics, casino performance and the audit trail.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Betrix Operator Console" },
      {
        property: "og:description",
        content:
          "Player monitoring, exposure analytics and audit trail for the Betrix simulation platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Overview", "Players", "Exposure", "Casino", "Audit"] as const;
type Tab = (typeof TABS)[number];

function AdminPage() {
  const [tab, setTab] = useState<Tab>("Overview");
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .rpc("is_admin", { _user_id: user.id })
      .then(({ data, error }) => setIsAdmin(!error && data === true));
  }, [authLoading, user]);

  // This page is decorative reporting for most tabs, but Players now performs
  // a real balance-changing action - the RPC itself enforces is_admin server
  // side, this is just so a non-admin doesn't land on the console at all.
  if (authLoading || isAdmin === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The operator console is restricted to administrators.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border bg-betrix-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Operator console
              </p>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Platform control room
              </h1>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Feed healthy ·{" "}
              {PLATFORM_METRICS.feedLatencyMs} ms
            </span>
          </div>
          <nav className="mt-6 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "whitespace-nowrap rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {tab === "Overview" && <Overview />}
        {tab === "Players" && <Players />}
        {tab === "Exposure" && <Exposure />}
        {tab === "Casino" && <Casino />}
        {tab === "Audit" && <Audit />}
      </div>
    </main>
  );
}

function Overview() {
  const max = Math.max(...TRAFFIC_SERIES.map((d) => d.bets));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={<Users className="h-4 w-4" />}
          label="Active players"
          value={PLATFORM_METRICS.activePlayers.toLocaleString()}
          delta="+6.2%"
        />
        <Metric
          icon={<TrendingUp className="h-4 w-4" />}
          label="Bets today"
          value={PLATFORM_METRICS.betsToday.toLocaleString()}
          delta="+11.4%"
        />
        <Metric
          icon={<Gauge className="h-4 w-4" />}
          label="Stake volume"
          value={formatCurrency(PLATFORM_METRICS.stakeVolume)}
          delta="+3.1%"
        />
        <Metric
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Open liability"
          value={formatCurrency(PLATFORM_METRICS.openLiability)}
          delta="-1.8%"
          negative
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Bet volume by hour (UTC)
        </h2>
        <div className="flex h-48 items-end gap-3">
          {TRAFFIC_SERIES.map((d) => (
            <div key={d.hour} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-primary/70 transition-all hover:bg-primary"
                style={{ height: `${(d.bets / max) * 100}%` }}
                title={`${d.bets} bets`}
              />
              <span className="text-[11px] text-muted-foreground">{d.hour}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Sportsbook margin
          </h2>
          <p className="text-4xl font-black text-foreground">{PLATFORM_METRICS.houseMargin}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Theoretical hold across settled markets in the last 24 hours.
          </p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Casino actual RTP
          </h2>
          <p className="text-4xl font-black text-foreground">{PLATFORM_METRICS.casinoRtp}%</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {PLATFORM_METRICS.casinoRounds.toLocaleString()} rounds settled today.
          </p>
        </section>
      </div>
    </div>
  );
}

function Players() {
  const [q, setQ] = useState("");
  const rows = ADMIN_PLAYERS.filter((p) =>
    `${p.username} ${p.email} ${p.id}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <TopUpForm />

      <div className="space-y-4">
        <label className="relative flex max-w-sm items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by username, email or ID"
            className="w-full rounded-full border border-border bg-secondary py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Player</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Credits</th>
                <th className="px-4 py-3 text-right font-semibold">Sports net</th>
                <th className="px-4 py-3 text-right font-semibold">Casino net</th>
                <th className="px-4 py-3 text-right font-semibold">Bets</th>
                <th className="px-4 py-3 text-right font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{p.username}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.email} · {p.country}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {formatCurrency(p.credits)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold",
                      p.sportsNet >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {formatCurrency(p.sportsNet)}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold",
                      p.casinoNet >= 0 ? "text-primary" : "text-destructive",
                    )}
                  >
                    {formatCurrency(p.casinoNet)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.betsPlaced}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{p.lastActive}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          The player table above is still sample data. Top-ups above use the real admin_topup_wallet
          RPC against whichever email you enter.
        </p>
      </div>
    </div>
  );
}

function TopUpForm() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const coins = Number(amount);
    if (!email.trim()) {
      toast.error("Enter the player's email");
      return;
    }
    if (!Number.isFinite(coins) || coins <= 0) {
      toast.error("Enter a positive coin amount");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc("admin_topup_wallet", {
      p_target_email: email.trim(),
      p_coins_to_add: coins,
      p_notes: notes.trim() || "Manual top-up",
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const result = data as { new_balance: number };
    toast.success(
      `Credited ${coins.toLocaleString()} coins - new balance ${result.new_balance.toLocaleString()}`,
    );
    setAmount("");
    setNotes("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_1fr_2fr_auto] sm:items-end"
    >
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Player email
        </label>
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="player@example.com"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Coins to add
        </label>
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          type="number"
          min="1"
          step="1"
          placeholder="10000"
          className="mt-1"
        />
      </div>
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notes (optional)
        </label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Manual top-up after offline payment"
          className="mt-1"
        />
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Crediting…" : "Credit wallet"}
      </Button>
    </form>
  );
}

function Exposure() {
  const max = Math.max(...EXPOSURE.map((e) => e.liability));
  return (
    <div className="space-y-4">
      {EXPOSURE.map((row) => (
        <div key={row.event} className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-foreground">{row.event}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{row.league}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Worst-case liability
              </p>
              <p className="text-xl font-black text-foreground">{formatCurrency(row.liability)}</p>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(row.liability / max) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground">
            <span>Stake volume {formatCurrency(row.stakeVolume)}</span>
            <span>Margin {row.margin}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Casino() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[
        { name: "Vault Rush", rounds: 18420, rtp: 96.2, hit: 31.4 },
        { name: "Neon Reels", rounds: 14110, rtp: 95.4, hit: 24.8 },
        { name: "Double or Nothing", rounds: 12880, rtp: 97.6, hit: 49.1 },
        { name: "Blackjack Classic", rounds: 8340, rtp: 99.0, hit: 43.2 },
        { name: "European Roulette", rounds: 6902, rtp: 97.1, hit: 35.5 },
        { name: "Minefield", rounds: 4239, rtp: 96.8, hit: 28.9 },
      ].map((g) => (
        <div key={g.name} className="rounded-2xl border border-border bg-card p-5">
          <p className="font-bold text-foreground">{g.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {g.rounds.toLocaleString()} rounds today
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Actual RTP</p>
              <p className="text-lg font-black text-foreground">{g.rtp}%</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Hit rate</p>
              <p className="text-lg font-black text-foreground">{g.hit}%</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Audit() {
  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {AUDIT_LOG.map((entry) => (
        <li key={entry.id} className="relative rounded-2xl border border-border bg-card p-4">
          <span className="absolute -left-[1.9rem] top-6 h-2.5 w-2.5 rounded-full bg-primary" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-accent">
              {entry.action}
            </p>
            <p className="text-xs text-muted-foreground">{entry.at}</p>
          </div>
          <p className="mt-2 text-sm text-foreground">{entry.detail}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {entry.actor} → {entry.target}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Metric({
  icon,
  label,
  value,
  delta,
  negative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
      <p
        className={cn("mt-1 text-xs font-semibold", negative ? "text-destructive" : "text-primary")}
      >
        {delta} vs yesterday
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: "active" | "restricted" | "review" }) {
  const map = {
    active: "border-primary/40 bg-primary/10 text-primary",
    review: "border-accent/40 bg-accent/10 text-accent",
    restricted: "border-destructive/40 bg-destructive/10 text-destructive",
  } as const;
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize",
        map[status],
      )}
    >
      {status}
    </span>
  );
}
