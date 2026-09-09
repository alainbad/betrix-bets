import { supabase } from "./supabase";

export interface AgentNotification {
  id: string;
  playerId: string;
  playerUsername: string;
  playerAccountId: string;
  kind: "topup_request" | "cashout_request";
  amount: number;
  withdrawalRequestId: string | null;
  readAt: string | null;
  createdAt: string;
}

// Newest first, capped at 50 - this is a live alert feed, not a full
// history (the withdrawal_requests table / ledger already covers that).
export async function fetchAgentNotifications(agentId: string): Promise<AgentNotification[]> {
  const { data, error } = await supabase
    .from("agent_notifications")
    .select(
      "id, player_id, kind, amount, withdrawal_request_id, read_at, created_at, player:profiles!agent_notifications_player_id_fkey(username,account_id)",
    )
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const player = row.player as unknown as { username: string; account_id: string } | null;
    return {
      id: row.id as string,
      playerId: row.player_id as string,
      playerUsername: player?.username ?? "Player",
      playerAccountId: player?.account_id ?? "",
      kind: row.kind as AgentNotification["kind"],
      amount: Number(row.amount),
      withdrawalRequestId: row.withdrawal_request_id as string | null,
      readAt: row.read_at as string | null,
      createdAt: row.created_at as string,
    };
  });
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw error;
}
