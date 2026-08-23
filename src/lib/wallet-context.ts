import { createContext } from "react";

export interface CasinoRoundHistoryItem {
  id: string;
  gameId: string;
  stake: number;
  outcome: "win" | "lose" | "push";
  payout: number;
  createdAt: string;
}

export interface WalletContextValue {
  balance: number;
  rounds: CasinoRoundHistoryItem[];
  refresh: () => Promise<void>;
}

// Lives in its own module so React Fast Refresh of the provider file does not
// recreate the context identity (which caused "must be used within Provider").
export const WalletContext = createContext<WalletContextValue | null>(null);
