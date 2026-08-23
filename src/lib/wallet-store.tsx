import { useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import { WalletContext, type CasinoRoundHistoryItem } from "./wallet-context";

interface CasinoRoundRow {
  id: string;
  game_id: string;
  stake: number;
  outcome: string;
  payout: number;
  created_at: string;
}

function mapRound(row: CasinoRoundRow): CasinoRoundHistoryItem {
  return {
    id: row.id,
    gameId: row.game_id,
    stake: Number(row.stake),
    outcome: row.outcome === "win" || row.outcome === "push" ? row.outcome : "lose",
    payout: Number(row.payout),
    createdAt: row.created_at,
  };
}

async function fetchBalance(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from("wallets")
    .select("available_balance")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return Number(data.available_balance);
}

async function fetchRounds(userId: string): Promise<CasinoRoundHistoryItem[]> {
  const { data, error } = await supabase
    .from("casino_rounds")
    .select("id, game_id, stake, outcome, payout, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => mapRound(row as CasinoRoundRow));
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [rounds, setRounds] = useState<CasinoRoundHistoryItem[]>([]);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setRounds([]);
      return;
    }
    const [nextBalance, nextRounds] = await Promise.all([
      fetchBalance(user.id),
      fetchRounds(user.id),
    ]);
    setBalance(nextBalance);
    setRounds(nextRounds);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <WalletContext.Provider value={{ balance, rounds, refresh }}>{children}</WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
