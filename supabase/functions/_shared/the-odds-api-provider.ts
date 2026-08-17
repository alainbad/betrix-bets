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
//  - Every league returned by /v4/sports for a group gets its own /odds call
//    (one full API request each), and The Odds API's free tier is a few
//    hundred requests/month total. Syncing every active soccer league alone
//    would burn that in one run, so getCompetitions() caps itself to
//    SPORTS_COMPETITION_ALLOWLIST_CAP leagues per sport (5 by default) unless
//    SPORTS_COMPETITION_ALLOWLIST names specific sport_keys to use instead.
//  - The /odds endpoint doesn't return scores or a reliable finished flag, so
//    status here only ever resolves to "scheduled" or "live" - never
//    "finished". A real match ending is only ever recorded through an admin
//    calling settle_event() (see the Settlement tab in /admin), same as the
//    mock provider's fixtures. Cross-referencing the separate /scores
//    endpoint to auto-detect finished games would be a reasonable follow-up.
//  - Only the first bookmaker present in the response is used per market, to
//    keep one canonical selection per market (spec doesn't ask for multi-book
//    comparison at this phase).
//  - Tennis sport_keys on The Odds API are tournament-specific and change
//    over time (e.g. "tennis_atp_wimbledon"), not stable "atp"/"wta" keys —
//    the group-based discovery above handles that naturally since it reads
//    whatever's currently active rather than hardcoding keys.

const BASE_URL = "https://api.the-odds-api.com/v4";
const DEFAULT_COMPETITION_CAP = 5;

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

// Selection `name` must be the generic "Home"/"Away"/"Draw"/"Over"/"Under"
// label, not the raw team name The Odds API returns in outcome.name - the
// betting engine's settle_event() and the frontend's EventCard both key off
// that exact convention (matching what MockSportsProvider already produces)
// to know which side a selection is. Using the literal team name here would
// silently void every moneyline/spread bet at settlement instead of grading
// it, since evaluate_selection_result() would never recognize the name.
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
    let name: string;
    if (outcome.name === homeTeam) { id = "home"; name = "Home"; }
    else if (outcome.name === awayTeam) { id = "away"; name = "Away"; }
    else if (outcome.name === "Draw") { id = "draw"; name = "Draw"; }
    else if (outcome.name === "Over") { id = "over"; name = "Over"; }
    else if (outcome.name === "Under") { id = "under"; name = "Under"; }
    else continue;
    const selection: ProviderSelection = { id, name, decimalOdds: outcome.price };
    if (outcome.point !== undefined) selection.line = outcome.point;
    selections.push(selection);
  }
  if (selections.length === 0) return null;
  return { id: marketId, type: marketType, label, selections };
}

export class TheOddsApiProvider implements SportsDataProvider {
  readonly code = "the_odds_api";
  private readonly apiKey: string;
  private readonly allowlist: string[];
  private readonly cap: number;

  constructor(apiKey: string, allowlist: string[] = [], cap: number = DEFAULT_COMPETITION_CAP) {
    this.apiKey = apiKey;
    this.allowlist = allowlist;
    this.cap = cap;
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
    const inGroup = sports.filter((s) => s.active && s.group.toLowerCase() === group.toLowerCase());
    const selected =
      this.allowlist.length > 0 ? inGroup.filter((s) => this.allowlist.includes(s.key)) : inGroup.slice(0, this.cap);
    return selected.map((s) => ({ id: s.key, sportCode, name: s.title, slug: slugify(s.key) }));
  }

  // Not every league supports spreads/totals in every region (The Odds API
  // returns 422 INVALID_MARKET_COMBO for those) - retry with moneyline only
  // rather than failing the whole sync over one league's market mix.
  async getFixtures(competitionId: string): Promise<ProviderFixture[]> {
    try {
      return await this.fetchOdds(competitionId, "h2h,spreads,totals");
    } catch (err) {
      if (err instanceof Error && err.message.includes("INVALID_MARKET_COMBO")) {
        console.warn(`${competitionId}: spreads/totals unsupported here, retrying with h2h only`);
        return await this.fetchOdds(competitionId, "h2h");
      }
      throw err;
    }
  }

  private async fetchOdds(competitionId: string, markets: string): Promise<ProviderFixture[]> {
    const url = `${BASE_URL}/sports/${competitionId}/odds?apiKey=${this.apiKey}&regions=us&markets=${markets}&oddsFormat=decimal&dateFormat=iso`;
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

    // Never "finished" here - see the file header note. Settlement only
    // happens through an admin declaring a final score in /admin.
    const startMs = new Date(event.commence_time).getTime();
    const status = startMs > Date.now() ? "scheduled" : "live";

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
