import type {
  ProviderCompetition,
  ProviderCountry,
  ProviderFixture,
  ProviderMarket,
  ProviderSelection,
  ProviderSport,
  SportsDataProvider,
} from "./sports-types.ts";

// Adapter for https://the-odds-api.com (v4 REST API).
//
// KNOWN LIMITATIONS — this has been written against The Odds API's published
// docs but has NOT been exercised against a live key from this environment
// (no SPORTS_API_KEY was available, and this sandbox has no network path to
// external APIs). Validate it against a real key before relying on it, and
// expect to need small fixes:
//  - The Odds API models each *league* as a "sport" (sport_key like
//    "soccer_epl"); there's no single "football" key. getCompetitions()
//    fetches the live /v4/sports list and filters by the `group` field
//    ("Soccer" / "Basketball" / "Tennis") to bridge that to our sportCode.
//  - The /odds endpoint doesn't return a reliable live/finished flag — status
//    here is a heuristic (started but not obviously long over => "live").
//    Cross-referencing the separate /scores endpoint would be more accurate;
//    left as a follow-up rather than guessed at without a way to test it.
//  - Only the first bookmaker present in the response is used per market, to
//    keep one canonical selection per market (spec doesn't ask for multi-book
//    comparison at this phase).
//  - Tennis sport_keys on The Odds API are tournament-specific and change
//    over time (e.g. "tennis_atp_wimbledon"), not stable "atp"/"wta" keys —
//    the group-based discovery above handles that naturally since it reads
//    whatever's currently active rather than hardcoding keys.

const BASE_URL = "https://api.the-odds-api.com/v4";

const SPORT_GROUP_MAP: Record<string, string> = {
  football: "Soccer",
  basketball: "Basketball",
  tennis: "Tennis",
};

interface TheOddsApiSport {
  key: string;
  group: string;
  title: string;
  active: boolean;
}

interface TheOddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface TheOddsApiMarket {
  key: string;
  last_update: string;
  outcomes: TheOddsApiOutcome[];
}

interface TheOddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsApiMarket[];
}

interface TheOddsApiEvent {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: TheOddsApiBookmaker[];
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function mapMarket(
  marketId: string,
  marketType: string,
  label: string,
  outcomes: TheOddsApiOutcome[],
  homeTeam: string,
  awayTeam: string,
): ProviderMarket | null {
  const selections: ProviderSelection[] = [];
  for (const outcome of outcomes) {
    let id: string;
    if (outcome.name === homeTeam) id = "home";
    else if (outcome.name === awayTeam) id = "away";
    else if (outcome.name === "Draw") id = "draw";
    else if (outcome.name === "Over") id = "over";
    else if (outcome.name === "Under") id = "under";
    else continue;
    const selection: ProviderSelection = { id, name: outcome.name, decimalOdds: outcome.price };
    if (outcome.point !== undefined) selection.line = outcome.point;
    selections.push(selection);
  }
  if (selections.length === 0) return null;
  return { id: marketId, type: marketType, label, selections };
}

export class TheOddsApiProvider implements SportsDataProvider {
  readonly code = "the_odds_api";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetchSports(): Promise<TheOddsApiSport[]> {
    const res = await fetch(`${BASE_URL}/sports?apiKey=${this.apiKey}`);
    if (!res.ok) throw new Error(`The Odds API /sports failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as TheOddsApiSport[];
  }

  async getSports(): Promise<ProviderSport[]> {
    return Object.keys(SPORT_GROUP_MAP).map((code) => ({ code, name: code[0]!.toUpperCase() + code.slice(1) }));
  }

  async getCountries(): Promise<ProviderCountry[]> {
    // The Odds API doesn't expose a country list; countries are inferred per
    // competition where possible during ingestion instead.
    return [];
  }

  async getCompetitions(sportCode: string): Promise<ProviderCompetition[]> {
    const group = SPORT_GROUP_MAP[sportCode];
    if (!group) return [];
    const sports = await this.fetchSports();
    return sports
      .filter((s) => s.active && s.group.toLowerCase() === group.toLowerCase())
      .map((s) => ({ id: s.key, sportCode, name: s.title, slug: slugify(s.key) }));
  }

  async getFixtures(competitionId: string): Promise<ProviderFixture[]> {
    const url = `${BASE_URL}/sports/${competitionId}/odds?apiKey=${this.apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=decimal&dateFormat=iso`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`The Odds API /odds failed: ${res.status} ${await res.text()}`);
    const events = (await res.json()) as TheOddsApiEvent[];

    return events
      .map((event) => this.mapEvent(event, competitionId))
      .filter((fixture): fixture is ProviderFixture => fixture !== null);
  }

  async getLiveEvents(sportCode: string): Promise<ProviderFixture[]> {
    const competitions = await this.getCompetitions(sportCode);
    const fixturesByCompetition = await Promise.all(competitions.map((c) => this.getFixtures(c.id)));
    const now = Date.now();
    return fixturesByCompetition
      .flat()
      .filter((f) => new Date(f.scheduledStart).getTime() <= now && f.status !== "finished");
  }

  private mapEvent(event: TheOddsApiEvent, competitionId: string): ProviderFixture | null {
    const bookmaker = event.bookmakers[0];
    if (!bookmaker) return null;

    const markets: ProviderMarket[] = [];
    for (const m of bookmaker.markets) {
      const marketType = m.key === "h2h" ? "moneyline" : m.key === "spreads" ? "spread" : m.key === "totals" ? "total" : m.key;
      const label = m.key === "h2h" ? "Moneyline" : m.key === "spreads" ? "Spread" : m.key === "totals" ? "Total" : m.key;
      // Market id must be unique per event (not just per market type) — every
      // fixture has its own moneyline/spread/total, and this id becomes the
      // provider_mappings key the ingestion job upserts against.
      const marketId = `${event.id}-${marketType}`;
      const mapped = mapMarket(marketId, marketType, label, m.outcomes, event.home_team, event.away_team);
      if (mapped) markets.push(mapped);
    }

    const startMs = new Date(event.commence_time).getTime();
    const status = startMs > Date.now() ? "scheduled" : startMs > Date.now() - 3 * 3_600_000 ? "live" : "finished";

    return {
      id: event.id,
      competitionId,
      name: `${event.home_team} vs ${event.away_team}`,
      scheduledStart: event.commence_time,
      status,
      homeParticipant: { id: slugify(event.home_team), name: event.home_team, kind: "team" },
      awayParticipant: { id: slugify(event.away_team), name: event.away_team, kind: "team" },
      markets,
      updatedAt: bookmaker.last_update,
    };
  }
}
