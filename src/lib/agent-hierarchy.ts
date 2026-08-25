// Shared types + data access for the 3-tier agent hierarchy dashboard
// (ultra_admin -> super_agent -> agent -> player). All balance mutations go
// through the SECURITY DEFINER RPCs in supabase/migrations/20260825050000_*
// - nothing here writes to wallets/profiles directly, only reads (RLS-gated
// via the policies in 20260825040000_*).

import { supabase } from "./supabase";

export type HierarchyTier = "ultra_admin" | "super_agent" | "agent";

export interface DownlineProfile {
  id: string;
  username: string;
  email: string;
  accountId: string;
  parentId: string | null;
  role: HierarchyTier | "player" | "unknown";
  balance: number;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string | null;
  createdAt: string;
}

// Checked in this order because a lower tier can never also hold a higher
// one (promote_to_super_agent/promote_to_agent both refuse to grant a tier
// role to an account that already has one).
export async function detectHierarchyTier(userId: string): Promise<HierarchyTier | null> {
  const [ultra, superAgent, agent] = await Promise.all([
    supabase.rpc("is_ultra_admin", { _user_id: userId }),
    supabase.rpc("is_super_agent", { _user_id: userId }),
    supabase.rpc("is_agent_tier", { _user_id: userId }),
  ]);
  if (ultra.data === true) return "ultra_admin";
  if (superAgent.data === true) return "super_agent";
  if (agent.data === true) return "agent";
  return null;
}

async function rolesByUserId(userIds: string[]): Promise<Map<string, DownlineProfile["role"]>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds)
    .in("role", ["ultra_admin", "super_agent", "agent", "player"]);
  if (error) throw error;
  const map = new Map<string, DownlineProfile["role"]>();
  for (const row of data ?? []) {
    map.set(row.user_id as string, row.role as DownlineProfile["role"]);
  }
  return map;
}

// Every descendant of rootId (children, grandchildren, ...) with their
// wallet balance and tier role attached, for rendering a downline table.
export async function fetchDownline(rootId: string): Promise<DownlineProfile[]> {
  const { data: idRows, error: idsError } = await supabase.rpc("get_all_downline_ids", {
    root_user_id: rootId,
  });
  if (idsError) throw idsError;

  const ids = (idRows ?? []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return [];

  const [{ data: profiles, error: profilesError }, { data: wallets, error: walletsError }, roles] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, email, account_id, parent_id, created_at")
        .in("id", ids),
      supabase.from("wallets").select("user_id, available_balance").in("user_id", ids),
      rolesByUserId(ids),
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
    parentId: p.parent_id as string | null,
    role: roles.get(p.id as string) ?? "unknown",
    balance: balanceByUserId.get(p.id as string) ?? 0,
    createdAt: p.created_at as string,
  }));
}

// Every profile on the platform, regardless of hierarchy position. Unlike
// fetchDownline (which walks the parent_id tree from a root), this has no
// root to scope from - a plain player who signed up outside the agent
// network, or an agent/super_agent who hasn't claimed anyone yet, has no
// path back to the ultra_admin in that tree at all, so a downline query
// would never surface them. Relies on the ultra_admin's blanket RLS grant
// (see "profiles select own or admin" in
// 20260825040000_agent_hierarchy_helpers_rls.sql) rather than the downline
// CTE - safe to call only for a caller the RLS policy actually grants
// full visibility to.
export async function fetchAllProfiles(): Promise<DownlineProfile[]> {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, username, email, account_id, parent_id, created_at")
    .order("created_at", { ascending: false });
  if (profilesError) throw profilesError;

  const ids = (profiles ?? []).map((p) => p.id as string);
  if (ids.length === 0) return [];

  const [{ data: wallets, error: walletsError }, roles] = await Promise.all([
    supabase.from("wallets").select("user_id, available_balance").in("user_id", ids),
    rolesByUserId(ids),
  ]);
  if (walletsError) throw walletsError;

  const balanceByUserId = new Map(
    (wallets ?? []).map((w) => [w.user_id as string, Number(w.available_balance)]),
  );

  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    email: p.email as string,
    accountId: p.account_id as string,
    parentId: p.parent_id as string | null,
    role: roles.get(p.id as string) ?? "unknown",
    balance: balanceByUserId.get(p.id as string) ?? 0,
    createdAt: p.created_at as string,
  }));
}

// The logged-in caller's own account_id, for the "your UID" badge shown at
// the top of each dashboard view.
export async function fetchOwnAccountId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data?.account_id as string) ?? null;
}

export async function fetchLedger(userId: string, limit = 50): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select(
      "id, user_id, transaction_type, amount, balance_before, balance_after, reference_type, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    transactionType: row.transaction_type as string,
    amount: Number(row.amount),
    balanceBefore: Number(row.balance_before),
    balanceAfter: Number(row.balance_after),
    referenceType: row.reference_type as string | null,
    createdAt: row.created_at as string,
  }));
}

export interface BranchTurnover {
  playerCount: number;
  totalStaked: number;
  totalPayout: number;
}

// Win/loss turnover across every player in rootId's branch, from the HTML5
// casino ledger (casino_rounds) - see the RLS note in
// 20260825040000_agent_hierarchy_helpers_rls.sql for why this table and not
// blackjack_rounds/holdem_rounds too.
export async function fetchBranchTurnover(rootId: string): Promise<BranchTurnover> {
  const players = (await fetchDownline(rootId)).filter((p) => p.role === "player");
  if (players.length === 0) return { playerCount: 0, totalStaked: 0, totalPayout: 0 };

  const { data, error } = await supabase
    .from("casino_rounds")
    .select("stake, payout")
    .in(
      "user_id",
      players.map((p) => p.id),
    );
  if (error) throw error;

  const totals = (data ?? []).reduce(
    (acc, row) => {
      acc.totalStaked += Number(row.stake);
      acc.totalPayout += Number(row.payout);
      return acc;
    },
    { totalStaked: 0, totalPayout: 0 },
  );

  return { playerCount: players.length, ...totals };
}
