import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import {
  detectHierarchyTier,
  fetchCasinoRounds,
  fetchLedger,
  fetchProfileByAccountId,
  type HierarchyTier,
  type LedgerEntry,
  type ProfileDetail,
} from "@/lib/agent-hierarchy";
import type { CasinoRoundHistoryItem } from "@/lib/wallet-context";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AccountIdBadge } from "@/components/dashboard/AccountIdBadge";
import { CopyBadge } from "@/components/dashboard/CopyBadge";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { SuspendUserDialog } from "@/components/dashboard/SuspendUserDialog";

export const Route = createFileRoute("/dashboard/users/$accountId")({
  head: () => ({
    meta: [{ title: "Account details — TheBetrix" }, { name: "robots", content: "noindex" }],
  }),
  component: UserDetailPage,
});

const ROLE_LABEL: Record<ProfileDetail["role"], string> = {
  ultra_admin: "Ultra Admin",
  super_agent: "Super Agent",
  agent: "Agent",
  player: "Player",
  unknown: "Unknown",
};

function UserDetailPage() {
  const { accountId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<HierarchyTier | null | "loading">("loading");
  const [profile, setProfile] = useState<ProfileDetail | null | "loading">("loading");
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [rounds, setRounds] = useState<CasinoRoundHistoryItem[]>([]);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTier(null);
      return;
    }
    detectHierarchyTier(user.id)
      .then(setTier)
      .catch(() => setTier(null));
  }, [authLoading, user]);

  async function reload() {
    setProfile("loading");
    try {
      const p = await fetchProfileByAccountId(accountId);
      setProfile(p);
      if (p) {
        const [l, r] = await Promise.all([fetchLedger(p.id, 100), fetchCasinoRounds(p.id, 100)]);
        setLedger(l);
        setRounds(r);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load account");
      setProfile(null);
    }
  }

  useEffect(() => {
    if (tier === "loading" || tier === null) return;
    void reload();
    // Only reload when the gate resolves or the URL param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, accountId]);

  async function handleReactivate() {
    if (!profile || profile === "loading") return;
    if (!window.confirm(`Reactivate ${profile.username}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("reactivate_user", {
      p_target_identifier: profile.accountId,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${profile.username} reactivated`);
    void reload();
  }

  if (authLoading || tier === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </main>
    );
  }

  if (!tier) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to the agent hierarchy (ultra_admin, super_agent, agent).
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>

        {profile === "loading" && (
          <p className="mt-8 text-sm text-muted-foreground">Loading account…</p>
        )}

        {profile === null && (
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 text-center">
            <h1 className="text-xl font-bold text-foreground">Account not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No account matches "{accountId}", or it's outside what you have access to view.
            </p>
          </div>
        )}

        {profile && profile !== "loading" && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.username} />
                  <AvatarFallback className="text-lg font-bold">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-black text-foreground">{profile.username}</h1>
                    <StatusBadge status={profile.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  {profile.phone && (
                    <p className="text-sm text-muted-foreground">{profile.phone}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AccountIdBadge accountId={profile.accountId} />
                    <span className="rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                      {ROLE_LABEL[profile.role]}
                    </span>
                    {profile.referralCode && (
                      <CopyBadge value={profile.referralCode} title="Copy referral code" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <p className="text-xs text-muted-foreground">
                  Joined {formatDateTime(profile.createdAt)}
                </p>
                <p className="text-lg font-black text-foreground">
                  {formatCurrency(profile.balance)}
                </p>
                {profile.status === "suspended" ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={handleReactivate}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={profile.role === "ultra_admin"}
                    onClick={() => setSuspendOpen(true)}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" /> Suspend user
                  </Button>
                )}
              </div>
            </div>

            <section className="mt-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Wallet transactions (top-ups &amp; adjustments)
              </h2>
              <LedgerTable ledger={ledger} />
            </section>

            <section className="mt-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Casino rounds (wins &amp; losses)
              </h2>
              <RoundsTable rounds={rounds} />
            </section>

            <SuspendUserDialog
              open={suspendOpen}
              targetUsername={profile.username}
              targetAccountId={profile.accountId}
              onClose={() => setSuspendOpen(false)}
              onDone={() => {
                setSuspendOpen(false);
                void reload();
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}

function LedgerTable({ ledger }: { ledger: LedgerEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 text-right font-semibold">Amount</th>
            <th className="px-4 py-3 text-right font-semibold">Balance after</th>
            <th className="px-4 py-3 text-right font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {ledger.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                No transactions yet.
              </td>
            </tr>
          )}
          {ledger.map((entry) => (
            <tr key={entry.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-accent">{entry.transactionType}</td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-semibold",
                  entry.amount >= 0 ? "text-primary" : "text-destructive",
                )}
              >
                {formatCurrency(entry.amount)}
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                {formatCurrency(entry.balanceAfter)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RoundsTable({ rounds }: { rounds: CasinoRoundHistoryItem[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Game</th>
            <th className="px-4 py-3 font-semibold">Outcome</th>
            <th className="px-4 py-3 text-right font-semibold">Stake</th>
            <th className="px-4 py-3 text-right font-semibold">Payout</th>
            <th className="px-4 py-3 text-right font-semibold">When</th>
          </tr>
        </thead>
        <tbody>
          {rounds.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                No casino rounds yet.
              </td>
            </tr>
          )}
          {rounds.map((round) => (
            <tr key={round.id} className="border-b border-border/60 last:border-0">
              <td className="px-4 py-3 text-foreground">{round.gameId}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-bold uppercase",
                    round.outcome === "win" && "bg-primary/10 text-primary",
                    round.outcome === "lose" && "bg-destructive/10 text-destructive",
                    round.outcome === "push" && "bg-secondary text-muted-foreground",
                  )}
                >
                  {round.outcome}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-foreground">
                {formatCurrency(round.stake)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-foreground">
                {formatCurrency(round.payout)}
              </td>
              <td className="px-4 py-3 text-right text-muted-foreground">
                {formatDateTime(round.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
