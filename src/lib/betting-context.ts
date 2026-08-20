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
  settledAt?: string | undefined;
  // What the wallet actually received once the bet settled: the full return on
  // a win, the stake back on a void, nothing on a loss.
  payout: number;
}

export interface OddsChange {
  from: number;
  to: number;
}

export interface PlaceBetsResult {
  ok: boolean;
  error?: string;
  /** Set when the final price check found movement the user has not accepted. */
  priceMoved?: boolean;
  /** Ids of the bets created, for the receipt screen. */
  betIds?: string[];
}

export interface PlaceBetsOptions {
  /** Place at the new price without a second confirmation. */
  acceptPriceMoves?: boolean;
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
  placeBets: (options?: PlaceBetsOptions) => Promise<PlaceBetsResult>;
  totalStake: number;
  totalPotentialReturn: number;
  isInSlip: (eventId: string, selectionId: string) => boolean;
  refresh: () => Promise<void>;
  // Live-pricing state for the slip: prices that moved since the pick was
  // added, selections whose market suspended/closed, and whether a price
  // check is currently in flight.
  oddsChanges: Record<string, OddsChange>;
  unavailableIds: string[];
  syncingOdds: boolean;
  acceptOddsChanges: () => void;
  syncOdds: () => Promise<void>;
}

// Lives in its own module so React Fast Refresh of the provider file does not
// recreate the context identity (which caused "must be used within Provider").
export const BettingContext = createContext<BettingContextValue | null>(null);
