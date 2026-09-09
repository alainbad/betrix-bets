import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Coins, ShieldCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { fetchAllProfiles, fetchOwnAccountId, type DownlineProfile } from "@/lib/agent-hierarchy";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccountIdBadge } from "@/components/dashboard/AccountIdBadge";
import { CopyBadge } from "@/components/dashboard/CopyBadge";
import { IdentifierTransferModal } from "@/components/dashboard/IdentifierTransferModal";
import { MasterCodeSettings } from "@/components/dashboard/MasterCodeSettings";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { WithdrawalPanel } from "@/components/dashboard/WithdrawalPanel";

interface TierAccount {
  id: string;
  username: string;
  email: string;
  accountId: string;
  balance: number;
  status: string;
  createdAt: string;
}

interface LedgerRow {
  id: string;
  userId: string;
  username: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  createdAt: string;
}

const TABS = ["Overview", "Agents", "Players", "All Users", "Transactions"] as const;
type Tab = (typeof TABS)[number];

async function fetchAccountsWithRole(role: "agent"): Promise<TierAccount[]> {
  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);
  if (roleError) throw roleError;

  const ids = (roleRows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return [];

  const [{ data: profiles, error: profilesError }, { data: wallets, error: walletsError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, email, account_id, status, created_at")
        .in("id", ids),
      supabase.from("wallets").select("user_id, available_balance").in("user_id", ids),
    ]);
  if (profilesError) throw profilesError;
  if (walletsError) throw walletsError;

  const balanceByUserId = new Map(
    (wallets ?? []).map((w) => [w.user_id as string, Number(w.available_balance)]),
  );

  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    email: p.email as string,
    accountId: p.account_id as string,
    balance: balanceByUserId.get(p.id as string) ?? 0,
    status: p.status as string,
    createdAt: p.created_at as string,
  }));
}

export function UltraAdminView() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");
  const [agents, setAgents] = useState<TierAccount[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [platformFloat, setPlatformFloat] = useState(0);
  const [ownAccountId, setOwnAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      const [ag, playersRes, walletsRes] = await Promise.all([
        fetchAccountsWithRole("agent"),
        supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "player"),
        supabase.from("wallets").select("available_balance"),
      ]);
      setAgents(ag);
      setPlayerCount(playersRes.count ?? 0);
      setPlatformFloat(
        (walletsRes.data ?? []).reduce((sum, w) => sum + Number(w.available_balance), 0),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchOwnAccountId(user.id)
      .then(setOwnAccountId)
      .catch(() => setOwnAccountId(null));
  }, [user]);

  return (
    <main className="min-h-screen bg-background">
      <div className="border-b border-border bg-betrix-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Ultra admin
                {ownAccountId && <AccountIdBadge accountId={ownAccountId} />}
              </p>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Platform mint &amp; oversight
              </h1>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> Central mint
            </span>
          </div>
          <nav className="mt-6 flex flex-wrap gap-1">
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
        {tab === "Overview" && (
          <Overview
            platformFloat={platformFloat}
            playerCount={playerCount}
            activeAgents={agents.length}
            loading={loading}
          />
        )}
        {tab === "Agents" && <AgentsManagement />}
        {tab === "Players" && <PlayersManagement />}
        {tab === "All Users" && <AllUsersManagement />}
        {tab === "Transactions" && <GlobalTransactions />}
      </div>

      <WithdrawalPanel tier="ultra_admin" />
    </main>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-foreground">{value}</p>
    </div>
  );
}

function Overview({
  platformFloat,
  playerCount,
  activeAgents,
  loading,
}: {
  platformFloat: number;
  playerCount: number;
  activeAgents: number;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric
          icon={<Coins className="h-4 w-4" />}
          label="Total platform float"
          value={loading ? "…" : formatCurrency(platformFloat)}
        />
        <Metric
          icon={<Users className="h-4 w-4" />}
          label="Total players"
          value={loading ? "…" : playerCount.toLocaleString()}
        />
        <Metric
          icon={<UserPlus className="h-4 w-4" />}
          label="Active agents"
          value={loading ? "…" : activeAgents.toLocaleString()}
        />
      </div>

      <MasterCodeSettings />
    </div>
  );
}

const ROLE_LABEL: Record<DownlineProfile["role"], string> = {
  ultra_admin: "Ultra Admin",
  agent: "Agent",
  player: "Player",
  unknown: "Unknown",
};

// Agents only, with their referral code front and center - the ultra_admin
// couldn't otherwise see an agent's code without logging in as that agent.
function AgentsManagement() {
  const [rows, setRows] = useState<DownlineProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [topupTarget, setTopupTarget] = useState<DownlineProfile | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setRows((await fetchAllProfiles()).filter((p) => p.role === "agent"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = rows.filter((r) =>
    `${r.username} ${r.email} ${r.accountId}`.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleDemote(target: DownlineProfile) {
    if (
      !window.confirm(
        `Make ${target.username} a Player again? This removes their Agent role - you can re-promote them any time.`,
      )
    ) {
      return;
    }
    setActingOnId(target.id);
    const { error } = await supabase.rpc("ultra_admin_set_hierarchy_role", {
      p_target_identifier: target.accountId,
      p_role: "player",
    });
    setActingOnId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${target.username} is now a Player`);
    void reload();
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username, email or account ID"
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[58rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Agent</th>
              <th className="px-4 py-3 font-semibold">Account ID</th>
              <th className="px-4 py-3 font-semibold">Referral code</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-right font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No agents yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/dashboard/users/$accountId"
                    params={{ accountId: r.accountId }}
                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {r.username}
                    <StatusBadge status={r.status} />
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <AccountIdBadge accountId={r.accountId} />
                </td>
                <td className="px-4 py-3">
                  {r.referralCode ? (
                    <CopyBadge value={r.referralCode} title="Copy referral code" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(r.balance)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingOnId === r.id}
                      onClick={() => void handleDemote(r)}
                    >
                      Make Player
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTopupTarget(r)}>
                      Top Up
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IdentifierTransferModal
        open={topupTarget !== null}
        title={topupTarget ? `Top up ${topupTarget.username}` : "Top up"}
        actionLabel="Top Up"
        amountLabel="Coins to add"
        rpcName="ultra_admin_topup_wallet"
        initialIdentifier={topupTarget?.accountId}
        onClose={() => setTopupTarget(null)}
        onDone={() => {
          setTopupTarget(null);
          void reload();
        }}
      />
    </div>
  );
}

// Players only, with the agent they're assigned to (if any) so the
// ultra_admin can see the downline shape without cross-referencing the
// Agents tab by hand.
function PlayersManagement() {
  const [rows, setRows] = useState<DownlineProfile[]>([]);
  const [agentUsernameById, setAgentUsernameById] = useState<Map<string, string>>(new Map());
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [topupTarget, setTopupTarget] = useState<DownlineProfile | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const all = await fetchAllProfiles();
      setRows(all.filter((p) => p.role === "player"));
      setAgentUsernameById(
        new Map(all.filter((p) => p.role === "agent").map((a) => [a.id, a.username])),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load players");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = rows.filter((r) =>
    `${r.username} ${r.email} ${r.accountId}`.toLowerCase().includes(query.toLowerCase()),
  );

  async function handlePromote(target: DownlineProfile) {
    if (
      !window.confirm(
        `Make ${target.username} an Agent? You can undo this later with "Make Player".`,
      )
    ) {
      return;
    }
    setActingOnId(target.id);
    const { error } = await supabase.rpc("ultra_admin_set_hierarchy_role", {
      p_target_identifier: target.accountId,
      p_role: "agent",
    });
    setActingOnId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${target.username} is now an Agent`);
    void reload();
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username, email or account ID"
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[58rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Player</th>
              <th className="px-4 py-3 font-semibold">Account ID</th>
              <th className="px-4 py-3 font-semibold">Agent</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-right font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No players yet.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/dashboard/users/$accountId"
                    params={{ accountId: r.accountId }}
                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {r.username}
                    <StatusBadge status={r.status} />
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <AccountIdBadge accountId={r.accountId} />
                </td>
                <td className="px-4 py-3 text-foreground">
                  {r.parentId ? (agentUsernameById.get(r.parentId) ?? "Unknown") : "Unassigned"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(r.balance)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingOnId === r.id}
                      onClick={() => void handlePromote(r)}
                    >
                      Make Agent
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setTopupTarget(r)}>
                      Top Up
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IdentifierTransferModal
        open={topupTarget !== null}
        title={topupTarget ? `Top up ${topupTarget.username}` : "Top up"}
        actionLabel="Top Up"
        amountLabel="Coins to add"
        rpcName="ultra_admin_topup_wallet"
        initialIdentifier={topupTarget?.accountId}
        onClose={() => setTopupTarget(null)}
        onDone={() => {
          setTopupTarget(null);
          void reload();
        }}
      />
    </div>
  );
}

// Every account on the platform, with one-click promotion into the
// hierarchy - the "report for all agents" the ultra_admin also asked for is
// this same list, since every agent already shows up here with
// their role and balance (no separate report view needed on top of it).
function AllUsersManagement() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DownlineProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [actingOnId, setActingOnId] = useState<string | null>(null);
  const [topupTarget, setTopupTarget] = useState<DownlineProfile | null>(null);

  async function reload() {
    setLoading(true);
    try {
      setRows(await fetchAllProfiles());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = rows.filter((r) =>
    `${r.username} ${r.email} ${r.accountId}`.toLowerCase().includes(query.toLowerCase()),
  );

  async function handleSetRole(target: DownlineProfile, role: "agent" | "player") {
    const label = role === "agent" ? "Agent" : "Player";
    const confirmMessage =
      role === "player"
        ? `Make ${target.username} a Player again? This removes their ${ROLE_LABEL[target.role]} role - you can re-promote them any time.`
        : `Make ${target.username} a ${label}? You can undo this later with "Make Player".`;
    if (!window.confirm(confirmMessage)) {
      return;
    }
    setActingOnId(target.id);
    const { error } = await supabase.rpc("ultra_admin_set_hierarchy_role", {
      p_target_identifier: target.accountId,
      p_role: role,
    });
    setActingOnId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${target.username} is now a ${label}`);
    void reload();
  }

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username, email or account ID"
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[54rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Account ID</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 text-right font-semibold">Balance</th>
              <th className="px-4 py-3 text-right font-semibold">Joined</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No users found.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border/60 last:border-0 hover:bg-betrix-surface-elevated"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/dashboard/users/$accountId"
                    params={{ accountId: r.accountId }}
                    className="flex items-center gap-2 font-semibold text-foreground hover:text-primary hover:underline"
                  >
                    {r.username}
                    <StatusBadge status={r.status} />
                  </Link>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </td>
                <td className="px-4 py-3">
                  <AccountIdBadge accountId={r.accountId} />
                </td>
                <td className="px-4 py-3 text-foreground">{ROLE_LABEL[r.role]}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(r.balance)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-wrap justify-end gap-2">
                    {r.role === "player" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingOnId === r.id}
                        onClick={() => void handleSetRole(r, "agent")}
                      >
                        Make Agent
                      </Button>
                    )}
                    {r.role === "agent" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actingOnId === r.id}
                        onClick={() => void handleSetRole(r, "player")}
                      >
                        Make Player
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setTopupTarget(r)}>
                      {r.id === user?.id ? "Mint" : "Top Up"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <IdentifierTransferModal
        open={topupTarget !== null}
        title={
          topupTarget
            ? topupTarget.id === user?.id
              ? `Mint balance for ${topupTarget.username} (you)`
              : `Top up ${topupTarget.username}`
            : "Top up"
        }
        actionLabel={topupTarget?.id === user?.id ? "Mint" : "Top Up"}
        amountLabel={topupTarget?.id === user?.id ? "Coins to mint" : "Coins to add"}
        rpcName="ultra_admin_topup_wallet"
        initialIdentifier={topupTarget?.accountId}
        onClose={() => setTopupTarget(null)}
        onDone={() => {
          setTopupTarget(null);
          void reload();
        }}
      />
    </div>
  );
}

function GlobalTransactions() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("wallet_transactions")
          .select("id, user_id, transaction_type, amount, balance_after, created_at")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;

        const userIds = [...new Set((data ?? []).map((r) => r.user_id as string))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", userIds);
        const usernameByUserId = new Map(
          (profiles ?? []).map((p) => [p.id as string, p.username as string]),
        );

        setRows(
          (data ?? []).map((r) => ({
            id: r.id as string,
            userId: r.user_id as string,
            username: usernameByUserId.get(r.user_id as string) ?? (r.user_id as string),
            transactionType: r.transaction_type as string,
            amount: Number(r.amount),
            balanceAfter: Number(r.balance_after),
            createdAt: r.created_at as string,
          })),
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load transactions");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const types = [...new Set(rows.map((r) => r.transactionType))].sort();
  const filtered =
    typeFilter === "all" ? rows : rows.filter((r) => r.transactionType === typeFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTypeFilter("all")}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            typeFilter === "all"
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground",
          )}
        >
          All
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTypeFilter(t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold",
              typeFilter === t
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
              <th className="px-4 py-3 text-right font-semibold">Balance after</th>
              <th className="px-4 py-3 text-right font-semibold">When</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                  No transactions.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-semibold text-foreground">{r.username}</td>
                <td className="px-4 py-3 font-mono text-xs text-accent">{r.transactionType}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-semibold",
                    r.amount >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {formatCurrency(r.amount)}
                </td>
                <td className="px-4 py-3 text-right text-foreground">
                  {formatCurrency(r.balanceAfter)}
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  {formatDateTime(r.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
