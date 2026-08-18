import { createContext } from "react";
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

export interface BettingContextValue {
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
  refresh: () => Promise<void>;
}

// Lives in its own module so React Fast Refresh of the provider file does not
// recreate the context identity (which caused "must be used within Provider").
export const BettingContext = createContext<BettingContextValue | null>(null);
