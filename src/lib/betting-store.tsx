import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Event, Selection } from "./betting-data";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import { americanToDecimal, decimalToAmerican } from "./format";
import { getSelectionPrices } from "./sports-data";
import {
  BettingContext,
  type BetSlipItem,
  type OddsChange,
  type PlacedBet,
  type PlaceBetsResult,
  type PlaceBetsOptions,
} from "./betting-context";

export type { BetSlipItem, PlacedBet, PlaceBetsResult };

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
  settled_at: string | null;
  bet_selections: BetSelectionRow[];
}

function mapBetRow(row: BetRow): PlacedBet {
  const leg = row.bet_selections[0];
  const stake = Number(row.total_stake);
  const potentialReturn = Number(row.potential_return);
  const status = (row.status as PlacedBet["status"]) ?? "pending";
  // Mirrors settle_event(): a win pays the full return, a void refunds the
  // stake, a loss pays nothing.
  const payout = status === "won" ? potentialReturn : status === "void" ? stake : 0;
  return {
    id: row.id,
    eventName: leg?.event_name ?? "",
    marketLabel: leg?.market_label ?? "",
    selectionLabel: leg?.selection_label ?? "",
    odds: leg ? decimalToAmerican(leg.decimal_odds_at_placement) : 0,
    stake,
    potentialReturn,
    status,
    placedAt: row.placed_at,
    settledAt: row.settled_at ?? undefined,
    payout,
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
      "id, status, total_stake, potential_return, placed_at, settled_at, bet_selections ( event_name, market_label, selection_label, decimal_odds_at_placement )",
    )
    .eq("user_id", userId)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => mapBetRow(row as unknown as BetRow));
}


export function BettingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [slip, setSlip] = useState<BetSlipItem[]>(() => loadSlip());
  const [balance, setBalance] = useState(0);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [placing, setPlacing] = useState(false);
  const [oddsChanges, setOddsChanges] = useState<Record<string, OddsChange>>({});
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [syncingOdds, setSyncingOdds] = useState(false);
  const slipRef = useRef(slip);
  slipRef.current = slip;
  // The price each pick was last *reviewed* at — set when it is added and when
  // the user accepts a move. Placement compares against this, not the live
  // price, so movement always needs an explicit confirmation.
  const priceAtReviewRef = useRef<Record<string, number>>(
    Object.fromEntries(slip.map((item) => [item.id, item.selection.odds])),
  );


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

  // Re-price the slip against the database. The odds a user clicked can be
  // minutes old; a book must place the bet at the price that is live now, so
  // the slip pulls the authoritative price, surfaces any movement, and flags
  // selections whose market has suspended or closed.
  // Returns the ids of slip legs that are no longer bettable, so callers can
  // act on the fresh result instead of state that has not re-rendered yet.
  const runOddsSync = useCallback(async (): Promise<string[]> => {
    const current = slipRef.current;
    if (current.length === 0) {
      setOddsChanges({});
      setUnavailableIds([]);
      return [];
    }
    setSyncingOdds(true);
    try {
      const prices = await getSelectionPrices(current.map((item) => item.selection.id));
      const byId = new Map(prices.map((p) => [p.id, p]));
      const changes: Record<string, OddsChange> = {};
      const gone: string[] = [];

      for (const item of current) {
        const price = byId.get(item.selection.id);
        if (!price) {
          gone.push(item.id);
          continue;
        }
        if (!price.available) gone.push(item.id);
        if (price.odds !== item.selection.odds) {
          changes[item.id] = { from: item.selection.odds, to: price.odds };
        }
      }

      if (Object.keys(changes).length > 0) {
        setSlip((prev) =>
          prev.map((item) => {
            const price = byId.get(item.selection.id);
            return price && price.odds !== item.selection.odds
              ? { ...item, selection: { ...item.selection, odds: price.odds } }
              : item;
          }),
        );
      }
      setOddsChanges(changes);
      setUnavailableIds(gone);
      return gone;
    } catch {
      // A failed price check must not wipe the slip; keep the last known state.
      return [];
    } finally {
      setSyncingOdds(false);
    }
  }, []);

  const syncOdds = useCallback(async () => {
    await runOddsSync();
  }, [runOddsSync]);

  // Re-price whenever the set of picks changes, and on a timer while the slip
  // is open.
  const slipKey = slip.map((item) => item.selection.id).join(",");
  useEffect(() => {
    if (!slipKey) return;
    void syncOdds();
    const interval = setInterval(() => void syncOdds(), 15_000);
    return () => clearInterval(interval);
  }, [slipKey, syncOdds]);

  // Wallet + settlement pushes: a payout credited by settle_event should show
  // up without a reload.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bets", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, refresh]);

  const totalStake = slip.reduce((sum, item) => sum + (item.stake || 0), 0);
  const totalPotentialReturn = slip.reduce((sum, item) => {
    const stake = item.stake || 0;
    return sum + stake * americanToDecimal(item.selection.odds);
  }, 0);

  function addToSlip(event: Event, marketLabel: string, selection: Selection) {
    setSlip((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.eventId === event.id &&
          item.selection.id === selection.id &&
          item.marketLabel === marketLabel,
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
      priceAtReviewRef.current[newItem.id] = selection.odds;
      return [...prev, newItem];
    });
  }

  function removeFromSlip(itemId: string) {
    setSlip((prev) => prev.filter((item) => item.id !== itemId));
  }

  function updateStake(itemId: string, stake: number) {
    setSlip((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, stake: Math.max(0, stake) } : item)),
    );
  }

  function clearSlip() {
    priceAtReviewRef.current = {};
    setSlip([]);
    setOddsChanges({});
    setUnavailableIds([]);
  }

  function acceptOddsChanges() {
    for (const item of slipRef.current) {
      priceAtReviewRef.current[item.id] = item.selection.odds;
    }
    setOddsChanges({});
  }

  async function placeBets(options: PlaceBetsOptions = {}): Promise<PlaceBetsResult> {
    if (!user) return { ok: false, error: "Sign in to place bets." };
    if (slip.length === 0) return { ok: false, error: "Your bet slip is empty." };
    if (totalStake > balance) return { ok: false, error: "Insufficient balance." };
    if (slip.some((item) => item.stake <= 0))
      return { ok: false, error: "Every selection needs a stake." };

    // Final price check at the moment of placement. If anything moved or
    // closed in the meantime, stop and let the user re-confirm rather than
    // silently placing at a price they never saw.
    const gone = await runOddsSync();
    if (gone.length > 0) return { ok: false, error: "Some selections are no longer available." };
    // A price that moved between the click and the check is a different bet
    // than the one the punter reviewed: never place it without consent.
    const moved = slipRef.current.some(
      (item) => (priceAtReviewRef.current[item.id] ?? item.selection.odds) !== item.selection.odds,
    );
    if (moved && !options.acceptPriceMoves) {
      return { ok: false, priceMoved: true, error: "Odds changed — confirm the new price." };
    }

    setPlacing(true);
    try {
      const legs = slip.map((item) => ({ selection_id: item.selection.id, stake: item.stake }));
      const knownIds = new Set(bets.map((bet) => bet.id));
      const { error } = await supabase.rpc("place_simulated_bet", { _legs: legs });
      if (error) return { ok: false, error: error.message };
      clearSlip();
      await refresh();
      // The RPC does not hand back ids, so the receipt is keyed off whichever
      // bets are new since placement started.
      let betIds: string[] = [];
      try {
        const fresh = await fetchBets(user.id);
        setBets(fresh);
        betIds = fresh.filter((bet) => !knownIds.has(bet.id)).map((bet) => bet.id);
      } catch {
        betIds = [];
      }
      return { ok: true, betIds };
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
        oddsChanges,
        unavailableIds,
        syncingOdds,
        acceptOddsChanges,
        syncOdds,
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
