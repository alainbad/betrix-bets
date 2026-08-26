// Shared types + data access for the 3-tier agent hierarchy dashboard
// (ultra_admin -> super_agent -> agent -> player). All balance mutations go
// through the SECURITY DEFINER RPCs in supabase/migrations/20260825050000_*
// - nothing here writes to wallets/profiles directly, only reads (RLS-gated
// via the policies in 20260825040000_*).

import { supabase } from "./supabase";
import type { CasinoRoundHistoryItem } from "./wallet-context";

export type HierarchyTier = "ultra_admin" | "super_agent" | "agent";

export interface DownlineProfile {
  id: string;
  username: string;
  email: string;
  accountId: string;
  parentId: string | null;
  role: HierarchyTier | "player" | "unknown";
  balance: number;
  status: string;
  createdAt: string;
}

export interface ProfileDetail extends DownlineProfile {
  phone: string | null;
  avatarUrl: string | null;
  referralCode: string | null;
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
        .select("id, username, email, account_id, parent_id, status, created_at")
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
    status: p.status as string,
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
    .select("id, username, email, account_id, parent_id, status, created_at")
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
    status: p.status as string,
    createdAt: p.created_at as string,
  }));
}

// Full detail for one account, looked up by its account_id (the value that
// shows up in every dashboard URL/badge) - the profile-detail page's single
// source of data. Relies on the same RLS visibility as fetchAllProfiles/
// fetchDownline (ultra_admin sees everyone, super_agent/agent see their own
// downline), so a caller outside that scope simply gets no row back rather
// than an error - the page renders that as "not found".
export async function fetchProfileByAccountId(accountId: string): Promise<ProfileDetail | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, username, email, account_id, parent_id, status, phone, avatar_url, referral_code, created_at",
    )
    .eq("account_id", accountId.toUpperCase())
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const [{ data: wallet }, roles] = await Promise.all([
    supabase
      .from("wallets")
      .select("available_balance")
      .eq("user_id", profile.id as string)
      .maybeSingle(),
    rolesByUserId([profile.id as string]),
  ]);

  return {
    id: profile.id as string,
    username: profile.username as string,
    email: profile.email as string,
    accountId: profile.account_id as string,
    parentId: profile.parent_id as string | null,
    role: roles.get(profile.id as string) ?? "unknown",
    balance: Number(wallet?.available_balance ?? 0),
    status: profile.status as string,
    phone: profile.phone as string | null,
    avatarUrl: profile.avatar_url as string | null,
    referralCode: profile.referral_code as string | null,
    createdAt: profile.created_at as string,
  };
}

// A target account's casino round history (wins/losses/pushes) - the same
// shape wallet-store.tsx fetches for the logged-in player's own history,
// generalized to any account the caller's RLS grant reaches.
export async function fetchCasinoRounds(
  userId: string,
  limit = 50,
): Promise<CasinoRoundHistoryItem[]> {
  const { data, error } = await supabase
    .from("casino_rounds")
    .select("id, game_id, stake, outcome, payout, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    gameId: row.game_id as string,
    stake: Number(row.stake),
    outcome: row.outcome === "win" || row.outcome === "push" ? row.outcome : "lose",
    payout: Number(row.payout),
    createdAt: row.created_at as string,
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

// The logged-in super_agent/agent's own referral code, for the "share this
// with new signups" copy pill on their dashboard. Null for tiers that don't
// get one (player, ultra_admin) - generate_agent_referral_code only ever
// sets this column for super_agent/agent.
export async function fetchOwnReferralCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("referral_code")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return (data?.referral_code as string) ?? null;
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
