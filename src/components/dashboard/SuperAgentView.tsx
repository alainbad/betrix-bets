import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Coins, TrendingUp, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWallet } from "@/lib/wallet-store";
import { supabase } from "@/lib/supabase";
import {
  fetchDownline,
  fetchBranchTurnover,
  fetchOwnAccountId,
  type DownlineProfile,
  type BranchTurnover,
} from "@/lib/agent-hierarchy";
import { formatCurrency } from "@/lib/format";
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
import { AccountIdBadge } from "@/components/dashboard/AccountIdBadge";
import { IdentifierTransferModal } from "@/components/dashboard/IdentifierTransferModal";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

export function SuperAgentView() {
  const { user } = useAuth();
  const { balance, refresh: refreshWallet } = useWallet();
  const [subAgents, setSubAgents] = useState<DownlineProfile[]>([]);
  const [turnover, setTurnover] = useState<BranchTurnover>({
    playerCount: 0,
    totalStaked: 0,
    totalPayout: 0,
  });
  const [loading, setLoading] = useState(true);
  const [ownAccountId, setOwnAccountId] = useState<string | null>(null);
  const [allocateTarget, setAllocateTarget] = useState<DownlineProfile | null>(null);
  const [reclaimTarget, setReclaimTarget] = useState<DownlineProfile | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    try {
      const downline = await fetchDownline(user.id);
      setSubAgents(downline.filter((p) => p.parentId === user.id && p.role === "agent"));
      setTurnover(await fetchBranchTurnover(user.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load branch data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchOwnAccountId(user.id)
      .then(setOwnAccountId)
      .catch(() => setOwnAccountId(null));
  }, [user]);

  const net = turnover.totalPayout - turnover.totalStaked;

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border bg-betrix-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Super agent
            {ownAccountId && <AccountIdBadge accountId={ownAccountId} />}
          </p>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Branch console</h1>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            icon={<Coins className="h-4 w-4" />}
            label="Master float"
            value={formatCurrency(balance)}
          />
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Sub-agents"
            value={loading ? "…" : subAgents.length.toLocaleString()}
          />
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Players in branch"
            value={loading ? "…" : turnover.playerCount.toLocaleString()}
          />
          <Metric
            icon={<TrendingUp className="h-4 w-4" />}
            label="Branch net (payout - stake)"
            value={loading ? "…" : formatCurrency(net)}
            negative={net < 0}
          />
        </div>

        <SubAgentManagement
          subAgents={subAgents}
          loading={loading}
          onChanged={() => {
            void reload();
            void refreshWallet();
          }}
          onAllocate={setAllocateTarget}
          onReclaim={setReclaimTarget}
        />
      </div>

      <IdentifierTransferModal
        open={allocateTarget !== null}
        title={allocateTarget ? `Allocate to ${allocateTarget.username}` : "Allocate"}
        actionLabel="Allocate"
        amountLabel="Coins to allocate"
        rpcName="transfer_agent_to_agent"
        initialIdentifier={allocateTarget?.accountId}
        onClose={() => setAllocateTarget(null)}
        onDone={() => {
          setAllocateTarget(null);
          void reload();
          void refreshWallet();
        }}
      />

      <ReclaimModal
        target={reclaimTarget}
        onClose={() => setReclaimTarget(null)}
        onDone={() => {
          setReclaimTarget(null);
          void reload();
          void refreshWallet();
        }}
      />
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  negative,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-2xl font-black",
          negative ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function SubAgentManagement({
  subAgents,
  loading,
  onChanged,
  onAllocate,
  onReclaim,
}: {
  subAgents: DownlineProfile[];
  loading: boolean;
  onChanged: () => void;
  onAllocate: (agent: DownlineProfile) => void;
  onReclaim: (agent: DownlineProfile) => void;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreateSubAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) {
      toast.error("Enter the account's email");
      return;
    }
    setCreating(true);
    const { error } = await supabase.rpc("promote_to_agent", { p_target_email: newEmail.trim() });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${newEmail.trim()} promoted to agent under your branch`);
    setNewEmail("");
    onChanged();
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleCreateSubAgent}
        className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[2fr_auto] sm:items-end"
      >
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Promote an existing account to Sub-Agent (by email)
          </label>
          <Input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            type="email"
            placeholder="cashier@example.com"
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={creating}>
          {creating ? (
            "Promoting…"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="h-4 w-4" /> Create Sub-Agent
            </span>
          )}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Sub-Agent</th>
              <th className="px-4 py-3 font-semibold">Account ID</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
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
            {!loading && subAgents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No sub-agents yet.
                </td>
              </tr>
            )}
            {subAgents.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/dashboard/users/$accountId"
                    params={{ accountId: a.accountId }}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {a.username}
                    <StatusBadge status={a.status} />
                  </Link>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                </td>
                <td className="px-4 py-3">
                  <AccountIdBadge accountId={a.accountId} />
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(a.balance)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onAllocate(a)}>
                      <ArrowUpFromLine className="h-3.5 w-3.5" /> Allocate
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => onReclaim(a)}>
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Reclaim
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

// Reclaim isn't part of the identifier-lookup feature - it always targets
// an already-known, already-listed direct sub-agent row, so it keeps the
// simple fixed-target modal (and reclaim_agent_balance's original
// uuid-based signature, unchanged).
function ReclaimModal({
  target,
  onClose,
  onDone,
}: {
  target: DownlineProfile | null;
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
    const { error } = await supabase.rpc("reclaim_agent_balance", {
      p_agent_id: target.id,
      p_amount: coins,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Reclaimed ${coins.toLocaleString()} coins from ${target.username}`);
    setAmount("");
    onDone();
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reclaim from {target?.username}</DialogTitle>
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
            placeholder="1000"
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
