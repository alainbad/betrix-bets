// Casino round engine (Phase 6). Every game in the lobby - slot, instant-win,
// table, or live-studio skin - plays through the same server-side RPC
// (play_casino_round, supabase/migrations/20260817000000_casino_engine.sql):
// place a stake, the server rolls win/lose and pays out, this module just
// calls that RPC and reads the round history back. No outcome is ever
// decided in the browser.

import { supabase } from "./supabase";

export interface CasinoRound {
  id: string;
  gameId: string;
  stake: number;
  outcome: "win" | "lose";
  multiplier: number;
  payout: number;
  createdAt: string;
}

export interface PlayRoundResult {
  ok: boolean;
  round?: CasinoRound;
  error?: string;
}

interface CasinoRoundRow {
  id: string;
  game_id: string;
  stake: number;
  outcome: string;
  multiplier: number;
  payout: number;
  created_at: string;
}

function mapRound(row: CasinoRoundRow): CasinoRound {
  return {
    id: row.id,
    gameId: row.game_id,
    stake: Number(row.stake),
    outcome: row.outcome === "win" ? "win" : "lose",
    multiplier: Number(row.multiplier),
    payout: Number(row.payout),
    createdAt: row.created_at,
  };
}

export async function playCasinoRound(gameId: string, stake: number): Promise<PlayRoundResult> {
  const { data, error } = await supabase.rpc("play_casino_round", { _game_id: gameId, _stake: stake }).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, round: mapRound(data as CasinoRoundRow) };
}

export async function getRecentRounds(userId: string, gameId?: string, limit = 10): Promise<CasinoRound[]> {
  let query = supabase
    .from("casino_rounds")
    .select("id, game_id, stake, outcome, multiplier, payout, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (gameId) query = query.eq("game_id", gameId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => mapRound(row as CasinoRoundRow));
}
