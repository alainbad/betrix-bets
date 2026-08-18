// Client wrapper for the real Blackjack engine (supabase/migrations/20260818000000_blackjack_engine.sql).
// Every action is a round-trip to a SECURITY DEFINER RPC that owns the shoe,
// the dealer's hidden hole card, and all settlement math - this module never
// computes a hand total, decides a card, or touches the wallet itself.

import { supabase } from "./supabase";

export interface BlackjackCard {
  rank: string;
  suit: string;
}

export type BlackjackResult = "blackjack_win" | "win" | "push" | "lose";

export interface BlackjackState {
  id: string;
  status: "player_turn" | "completed";
  bet: number;
  totalBet: number;
  playerCards: BlackjackCard[];
  dealerCards?: BlackjackCard[];
  dealerUpCard?: BlackjackCard;
  playerTotal: number;
  dealerTotal?: number;
  result?: BlackjackResult;
  payout?: number;
  isDoubled: boolean;
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<BlackjackState> {
  const { data, error } = await supabase.rpc(fn, args);
  // Supabase/PostgREST errors are plain objects, not `instanceof Error` -
  // wrap in a real Error so callers that check `err instanceof Error` (to
  // safely read `.message`) actually see the real database message instead
  // of falling through to a generic fallback string.
  if (error) throw new Error(error.message);
  return data as BlackjackState;
}

export function startBlackjack(bet: number): Promise<BlackjackState> {
  return callRpc("blackjack_start", { _bet: bet });
}

export function hitBlackjack(roundId: string): Promise<BlackjackState> {
  return callRpc("blackjack_hit", { _round_id: roundId });
}

export function standBlackjack(roundId: string): Promise<BlackjackState> {
  return callRpc("blackjack_stand", { _round_id: roundId });
}

export function doubleBlackjack(roundId: string): Promise<BlackjackState> {
  return callRpc("blackjack_double", { _round_id: roundId });
}
