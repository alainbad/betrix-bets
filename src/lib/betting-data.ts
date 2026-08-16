// Type contracts shared by the sportsbook UI. Data used to be hardcoded here
// (Phase 0/1); as of Phase 3 it's fetched live from Supabase via
// src/lib/sports-data.ts, in these same shapes so the UI components didn't
// need to change.

// Sports are database-driven (spec section 5) rather than a fixed set, so
// this is just `string` — the sport's `code` column.
export type SportId = string;

export interface Sport {
  id: SportId;
  name: string;
  icon: string;
}

export type MarketType = "moneyline" | "spread" | "total";

export interface Market {
  type: MarketType;
  label: string;
  selections: Selection[];
}

export interface Selection {
  id: string;
  label: string;
  value?: string;
  odds: number;
}

export type EventStatus = "upcoming" | "live" | "finished";

export interface Event {
  id: string;
  sportId: SportId;
  league: string;
  status: EventStatus;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  markets: Market[];
}
