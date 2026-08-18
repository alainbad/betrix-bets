// Client wrapper for the real Casino Hold'em engine
// (supabase/migrations/20260818020000_holdem_engine.sql). Every action is a
// round-trip to a SECURITY DEFINER RPC that owns the shoe, the dealer's
// hidden hole cards, and all settlement math - this module never evaluates
// a hand, decides a card, or touches the wallet itself.

import { supabase } from "./supabase";

export interface HoldemCard {
  rank: string;
  suit: string;
}

export type HoldemResult = "fold" | "no_qualify" | "win" | "push" | "lose";

export interface HoldemState {
  id: string;
  status: "awaiting_decision" | "completed";
  ante: number;
  callBet?: number;
  totalBet: number;
  playerCards: HoldemCard[];
  flop: HoldemCard[];
  dealerCards?: HoldemCard[];
  turn?: HoldemCard;
  river?: HoldemCard;
  dealerQualified?: boolean;
  handCategory: number;
  isRoyal: boolean;
  result?: HoldemResult;
  payout?: number;
}

async function callRpc(fn: string, args: Record<string, unknown>): Promise<HoldemState> {
  const { data, error } = await supabase.rpc(fn, args);
  // Supabase/PostgREST errors are plain objects, not `instanceof Error` -
  // wrap in a real Error so callers that check `err instanceof Error` (to
  // safely read `.message`) actually see the real database message instead
  // of falling through to a generic fallback string.
  if (error) throw new Error(error.message);
  return data as HoldemState;
}

export function startHoldem(ante: number): Promise<HoldemState> {
  return callRpc("holdem_start", { _ante: ante });
}

export function foldHoldem(roundId: string): Promise<HoldemState> {
  return callRpc("holdem_fold", { _round_id: roundId });
}

export function callHoldem(roundId: string): Promise<HoldemState> {
  return callRpc("holdem_call", { _round_id: roundId });
}
