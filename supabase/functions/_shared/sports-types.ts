// Sports data provider abstraction (spec section 5).
//
// The rest of the system — the ingestion job, the normalized database, the
// frontend, the betting engine — never talks to an external sports/odds API
// directly and never sees a provider's own ids. Everything goes through this
// interface, gets normalized into our schema, and the frontend reads only our
// internal uuids. Swapping MockSportsProvider for TheOddsApiProvider (or a
// future licensed provider) is a one-line change in sync-sports-data/index.ts.

export type EventStatus =
  | "scheduled"
  | "live"
  | "halftime"
  | "suspended"
  | "finished"
  | "postponed"
  | "cancelled"
  | "abandoned";

export interface ProviderSport {
  code: string;
  name: string;
  icon?: string;
}

export interface ProviderCountry {
  code: string;
  name: string;
}

export interface ProviderCompetition {
  id: string;
  sportCode: string;
  countryCode?: string;
  name: string;
  slug: string;
}

export interface ProviderParticipant {
  id: string;
  name: string;
  shortName?: string;
  countryCode?: string;
  kind: "team" | "individual";
}

export interface ProviderSelection {
  id: string;
  name: string;
  decimalOdds: number;
  line?: number;
}

export interface ProviderMarket {
  id: string;
  type: string;
  label: string;
  selections: ProviderSelection[];
}

export interface ProviderFixture {
  id: string;
  competitionId: string;
  name: string;
  scheduledStart: string; // ISO 8601
  status: EventStatus;
  homeParticipant: ProviderParticipant;
  awayParticipant: ProviderParticipant;
  homeScore?: number;
  awayScore?: number;
  currentPeriod?: string;
  matchClock?: string;
  venue?: string;
  markets: ProviderMarket[];
  updatedAt?: string; // ISO 8601, provider's own last-updated timestamp
}

/**
 * Conceptual interface from spec section 5, trimmed to what an ingestion job
 * actually calls: markets/odds/scores/results are embedded in ProviderFixture
 * rather than fetched separately, matching how real odds APIs (including The
 * Odds API) shape their responses.
 */
export interface SportsDataProvider {
  readonly code: string;
  getSports(): Promise<ProviderSport[]>;
  getCountries(): Promise<ProviderCountry[]>;
  getCompetitions(sportCode: string): Promise<ProviderCompetition[]>;
  getFixtures(competitionId: string): Promise<ProviderFixture[]>;
  getLiveEvents(sportCode: string): Promise<ProviderFixture[]>;
}
