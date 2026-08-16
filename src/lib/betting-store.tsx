import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Event, Selection } from "./betting-data";

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
  eventId: string;
  eventName: string;
  marketLabel: string;
  selectionLabel: string;
  odds: number;
  stake: number;
  potentialReturn: number;
  status: "pending" | "won" | "lost";
  placedAt: string;
}

interface BettingState {
  balance: number;
  slip: BetSlipItem[];
  bets: PlacedBet[];
}

const STORAGE_KEY = "betrix-state-v1";
const DEFAULT_BALANCE = 1000;

function loadState(): BettingState {
  if (typeof window === "undefined") {
    return { balance: DEFAULT_BALANCE, slip: [], bets: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BettingState;
      return { balance: parsed.balance ?? DEFAULT_BALANCE, slip: parsed.slip ?? [], bets: parsed.bets ?? [] };
    }
  } catch {
    // ignore
  }
  return { balance: DEFAULT_BALANCE, slip: [], bets: [] };
}

function saveState(state: BettingState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

interface BettingContextValue {
  balance: number;
  slip: BetSlipItem[];
  bets: PlacedBet[];
  addToSlip: (event: Event, marketLabel: string, selection: Selection) => void;
  removeFromSlip: (itemId: string) => void;
  updateStake: (itemId: string, stake: number) => void;
  clearSlip: () => void;
  placeBets: () => boolean;
  totalStake: number;
  totalPotentialReturn: number;
  isInSlip: (eventId: string, selectionId: string) => boolean;
}

const BettingContext = createContext<BettingContextValue | null>(null);

export function BettingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BettingState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const totalStake = state.slip.reduce((sum, item) => sum + (item.stake || 0), 0);
  const totalPotentialReturn = state.slip.reduce((sum, item) => {
    const stake = item.stake || 0;
    const decimalOdds = item.selection.odds > 0 ? item.selection.odds / 100 + 1 : 1 - 100 / item.selection.odds;
    return sum + stake * decimalOdds;
  }, 0);

  function addToSlip(event: Event, marketLabel: string, selection: Selection) {
    setState((prev) => {
      const existingIndex = prev.slip.findIndex(
        (item) => item.eventId === event.id && item.selection.id === selection.id && item.marketLabel === marketLabel
      );
      if (existingIndex >= 0) {
        const newSlip = [...prev.slip];
        newSlip.splice(existingIndex, 1);
        return { ...prev, slip: newSlip };
      }
      const newItem: BetSlipItem = {
        id: `${event.id}-${marketLabel}-${selection.id}`,
        eventId: event.id,
        eventName: `${event.awayTeam} @ ${event.homeTeam}`,
        marketLabel,
        selection,
        stake: 10,
      };
      return { ...prev, slip: [...prev.slip, newItem] };
    });
  }

  function removeFromSlip(itemId: string) {
    setState((prev) => ({ ...prev, slip: prev.slip.filter((item) => item.id !== itemId) }));
  }

  function updateStake(itemId: string, stake: number) {
    setState((prev) => ({
      ...prev,
      slip: prev.slip.map((item) => (item.id === itemId ? { ...item, stake: Math.max(0, stake) } : item)),
    }));
  }

  function clearSlip() {
    setState((prev) => ({ ...prev, slip: [] }));
  }

  function placeBets(): boolean {
    if (state.slip.length === 0) return false;
    if (totalStake > state.balance) return false;

    const newBets: PlacedBet[] = state.slip.map((item) => {
      const decimalOdds = item.selection.odds > 0 ? item.selection.odds / 100 + 1 : 1 - 100 / item.selection.odds;
      return {
        id: crypto.randomUUID(),
        eventId: item.eventId,
        eventName: item.eventName,
        marketLabel: item.marketLabel,
        selectionLabel: item.selection.label + (item.selection.value ? ` ${item.selection.value}` : ""),
        odds: item.selection.odds,
        stake: item.stake,
        potentialReturn: Math.round(item.stake * decimalOdds * 100) / 100,
        status: "pending",
        placedAt: new Date().toISOString(),
      };
    });

    setState((prev) => ({
      balance: Math.round((prev.balance - totalStake) * 100) / 100,
      slip: [],
      bets: [...newBets, ...prev.bets],
    }));
    return true;
  }

  function isInSlip(eventId: string, selectionId: string) {
    return state.slip.some((item) => item.eventId === eventId && item.selection.id === selectionId);
  }

  return (
    <BettingContext.Provider
      value={{
        balance: state.balance,
        slip: state.slip,
        bets: state.bets,
        addToSlip,
        removeFromSlip,
        updateStake,
        clearSlip,
        placeBets,
        totalStake,
        totalPotentialReturn,
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
