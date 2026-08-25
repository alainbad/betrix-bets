import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Coins, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-store";
import { supabase } from "@/lib/supabase";
import {
  fetchDownline,
  fetchLedger,
  type DownlineProfile,
  type LedgerEntry,
} from "@/lib/agent-hierarchy";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function AgentView() {
  const { user } = useAuth();
  const { balance, refresh: refreshWallet } = useWallet();
  const [players, setPlayers] = useState<DownlineProfile[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{
    player: DownlineProfile;
    mode: "topup" | "cashout";
  } | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    try {
      const [downline, txns] = await Promise.all([fetchDownline(user.id), fetchLedger(user.id)]);
      setPlayers(downline.filter((p) => p.parentId === user.id && p.role === "player"));
      setLedger(txns);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load cashier data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [user]);

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border bg-betrix-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Agent</p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Cashier console</h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Coins className="h-4 w-4" /> Cashier balance
            </p>
            <p className="mt-2 text-2xl font-black text-foreground">{formatCurrency(balance)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" /> Players in your book
            </p>
            <p className="mt-2 text-2xl font-black text-foreground">
              {loading ? "…" : players.length.toLocaleString()}
            </p>
          </div>
        </div>

        <PlayerManagement
          players={players}
          loading={loading}
          onChanged={() => {
            void reload();
            void refreshWallet();
          }}
          onAction={(player, mode) => setAction({ player, mode })}
        />

        <TransferHistory ledger={ledger} loading={loading} />
      </div>

      <ActionModal
        target={action}
        onClose={() => setAction(null)}
        onDone={() => {
          setAction(null);
          void reload();
          void refreshWallet();
        }}
      />
    </main>
  );
}

function PlayerManagement({
  players,
  loading,
  onChanged,
  onAction,
}: {
  players: DownlineProfile[];
  loading: boolean;
  onChanged: () => void;
  onAction: (player: DownlineProfile, mode: "topup" | "cashout") => void;
}) {
  const [claimEmail, setClaimEmail] = useState("");
  const [claiming, setClaiming] = useState(false);

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!claimEmail.trim()) {
      toast.error("Enter the player's email");
      return;
    }
    setClaiming(true);
    const { error } = await supabase.rpc("assign_player_to_agent", {
      p_player_email: claimEmail.trim(),
    });
    setClaiming(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${claimEmail.trim()} added to your book`);
    setClaimEmail("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleClaim}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_auto] sm:items-end"
      >
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Add an existing player to your book (by email)
          </label>
          <Input
            value={claimEmail}
            onChange={(e) => setClaimEmail(e.target.value)}
            type="email"
            placeholder="player@example.com"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            The player must already have an account (via the normal sign-up page) and not already
            belong to another agent.
          </p>
        </div>
        <Button type="submit" disabled={claiming}>
          {claiming ? "Adding…" : "Add player"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Player</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && players.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No players in your book yet.
                </td>
              </tr>
            )}
            {players.map((p) => (
              <tr
                key={p.id}
                className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-foreground">{p.username}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(p.balance)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onAction(p, "topup")}>
                      <ArrowUpFromLine className="h-3.5 w-3.5" /> Top up
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onAction(p, "cashout")}>
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Cash out
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionModal({
  target,
  onClose,
  onDone,
}: {
  target: { player: DownlineProfile; mode: "topup" | "cashout" } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!target) return;
    const coins = Number(amount);
    if (!Number.isFinite(coins) || coins <= 0) {
      toast.error("Enter a positive coin amount");
      return;
    }
    setSubmitting(true);
    const rpc = target.mode === "topup" ? "transfer_agent_to_player" : "cashout_player_to_agent";
    const { error } = await supabase.rpc(rpc, { p_player_id: target.player.id, p_amount: coins });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `${target.mode === "topup" ? "Topped up" : "Cashed out"} ${coins.toLocaleString()} coins ${
        target.mode === "topup" ? "for" : "from"
      } ${target.player.username}`,
    );
    setAmount("");
    onDone();
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target?.mode === "topup" ? "Top up" : "Cash out"} {target?.player.username}
          </DialogTitle>
        </DialogHeader>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Coins
          </label>
          <Input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min="1"
            step="1"
            placeholder="100"
            className="mt-1"
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferHistory({ ledger, loading }: { ledger: LedgerEntry[]; loading: boolean }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
        Transfer history
      </h2>
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
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && ledger.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No transfers yet.
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
    </div>
  );
}
