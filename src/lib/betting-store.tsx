import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Event, Selection } from "./betting-data";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import { americanToDecimal, decimalToAmerican } from "./format";

export interface BetSlipItem {
  id: string;
  eventId: string;
  eventName: string;
  marketLabel: string;
  selection: Selection;
  stake: number;
}

export interface PlacedBet {
  id: string;
  eventName: string;
  marketLabel: string;
  selectionLabel: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: "pending" | "won" | "lost" | "void";
  placedAt: string;
}

export interface PlaceBetsResult {
  ok: boolean;
  error?: string;
}

const SLIP_STORAGE_KEY = "betrix-slip-v1";

// The bet slip is just a local draft (a shopping cart), so it stays in
// localStorage. Balance and placed-bet history are wallet-backed (Phase 4)
// and always come from Supabase.
function loadSlip(): BetSlipItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SLIP_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BetSlipItem[]) : [];
  } catch {
    return [];
  }
}

function saveSlip(slip: BetSlipItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify(slip));
}

interface BetSelectionRow {
  event_name: string;
  market_label: string;
  selection_label: string;
  decimal_odds_at_placement: number;
}

interface BetRow {
  id: string;
  status: string;
  total_stake: number;
  potential_return: number;
  placed_at: string;
  bet_selections: BetSelectionRow[];
}

function mapBetRow(row: BetRow): PlacedBet {
  const leg = row.bet_selections[0];
  return {
    id: row.id,
    eventName: leg?.event_name ?? "",
    marketLabel: leg?.market_label ?? "",
    selectionLabel: leg?.selection_label ?? "",
    odds: leg ? decimalToAmerican(leg.decimal_odds_at_placement) : 0,
    stake: Number(row.total_stake),
    potentialReturn: Number(row.potential_return),
    status: (row.status as PlacedBet["status"]) ?? "pending",
    placedAt: row.placed_at,
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

async function fetchBets(userId: string): Promise<PlacedBet[]> {
  const { data, error } = await supabase
    .from("bets")
    .select(
      "id, status, total_stake, potential_return, placed_at, bet_selections ( event_name, market_label, selection_label, decimal_odds_at_placement )"
    )
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapBetRow(row as unknown as BetRow));
}

interface BettingContextValue {
  balance: number;
  slip: BetSlipItem[];
  bets: PlacedBet[];
  placing: boolean;
  addToSlip: (event: Event, marketLabel: string, selection: Selection) => void;
  removeFromSlip: (itemId: string) => void;
  updateStake: (itemId: string, stake: number) => void;
  clearSlip: () => void;
  placeBets: () => Promise<PlaceBetsResult>;
  totalStake: number;
  totalPotentialReturn: number;
  isInSlip: (eventId: string, selectionId: string) => boolean;
  // Refetches balance + bet history from Supabase. Exposed so other
  // wallet-backed features (the casino engine) can refresh the shared
  // balance after their own RPC calls without duplicating this fetch.
  refresh: () => Promise<void>;
}

const BettingContext = createContext<BettingContextValue | null>(null);

export function BettingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [slip, setSlip] = useState<BetSlipItem[]>(() => loadSlip());
  const [balance, setBalance] = useState(0);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    saveSlip(slip);
  }, [slip]);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setBets([]);
      return;
    }
    const [nextBalance, nextBets] = await Promise.all([fetchBalance(user.id), fetchBets(user.id)]);
    setBalance(nextBalance);
    setBets(nextBets);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalStake = slip.reduce((sum, item) => sum + (item.stake || 0), 0);
  const totalPotentialReturn = slip.reduce((sum, item) => {
    const stake = item.stake || 0;
    return sum + stake * americanToDecimal(item.selection.odds);
  }, 0);

  function addToSlip(event: Event, marketLabel: string, selection: Selection) {
    setSlip((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.eventId === event.id && item.selection.id === selection.id && item.marketLabel === marketLabel
      );
      if (existingIndex >= 0) {
        const newSlip = [...prev];
        newSlip.splice(existingIndex, 1);
        return newSlip;
      }
      const newItem: BetSlipItem = {
        id: `${event.id}-${marketLabel}-${selection.id}`,
        eventId: event.id,
        eventName: `${event.awayTeam} @ ${event.homeTeam}`,
        marketLabel,
        selection,
        stake: 10,
      };
      return [...prev, newItem];
    });
  }

  function removeFromSlip(itemId: string) {
    setSlip((prev) => prev.filter((item) => item.id !== itemId));
  }

  function updateStake(itemId: string, stake: number) {
    setSlip((prev) => prev.map((item) => (item.id === itemId ? { ...item, stake: Math.max(0, stake) } : item)));
  }

  function clearSlip() {
    setSlip([]);
  }

  async function placeBets(): Promise<PlaceBetsResult> {
    if (!user) return { ok: false, error: "Sign in to place bets." };
    if (slip.length === 0) return { ok: false, error: "Your bet slip is empty." };
    if (totalStake > balance) return { ok: false, error: "Insufficient balance." };

    setPlacing(true);
    try {
      const legs = slip.map((item) => ({ selection_id: item.selection.id, stake: item.stake }));
      const { error } = await supabase.rpc("place_simulated_bet", { _legs: legs });
      if (error) return { ok: false, error: error.message };
      clearSlip();
      await refresh();
      return { ok: true };
    } finally {
      setPlacing(false);
    }
  }

  function isInSlip(eventId: string, selectionId: string) {
    return slip.some((item) => item.eventId === eventId && item.selection.id === selectionId);
  }

  return (
    <BettingContext.Provider
      value={{
        balance,
        slip,
        bets,
        placing,
        addToSlip,
        removeFromSlip,
        updateStake,
        clearSlip,
        placeBets,
        totalStake,
        totalPotentialReturn,
        refresh,
        isInSlip,
      }}
    >
      {children}
    </BettingContext.Provider>
  );
}

export function useBetting() {
  const ctx = useContext(BettingContext);
  if (!ctx) throw new Error("useBetting must be used within BettingProvider");
  return ctx;
}
