import type {
  EventStatus,
  ProviderCompetition,
  ProviderCountry,
  ProviderFixture,
  ProviderMarket,
  ProviderSelection,
  ProviderSport,
  SportsDataProvider,
} from "./sports-types.ts";

// Adapter for https://api.opticodds.com (v3 REST API).
//
// KNOWN LIMITATIONS — written against OpticOdds' published docs but NOT
// exercised against a live key from this environment (no OPTICODDS key was
// available, and this sandbox has no network path to external APIs).
// Validate against a real key before relying on it.
//
//  - Auth is a single `X-Api-Key` header (docs.opticodds.com), reusing the
//    same SPORTS_API_KEY secret the_odds_api used — no separate secret name.
//  - IMPORTANT sport-id gotcha: OpticOdds' own "football" sport id means
//    American football (NFL). Our internal "football" sport code means
//    soccer (see mock-provider.ts's SPORTS seed: `{ code: "football", icon:
//    "⚽" }`), matching the convention the_odds_api's adapter already uses.
//    SPORT_ID_MAP below maps our "football" -> OpticOdds' "soccer" id -
//    getting this backwards would silently sync NFL fixtures into a
//    football/soccer competition list.
//  - Leagues (OpticOdds' term) map onto our `competitions`. `getCompetitions`
//    fetches GET /leagues?sport=<id> and caps itself to SPORTS_COMPETITION_CAP
//    leagues (default 5) unless SPORTS_COMPETITION_ALLOWLIST names specific
//    league ids, same pattern as the_odds_api's adapter.
//  - `getFixtures` similarly caps at SPORTS_FIXTURE_CAP fixtures per league
//    per sync (default 20) as a cost/quota control, even though OpticOdds'
//    documented rate limit (2,500 req/15s for fixtures/odds) is generous.
//  - Each league response includes `sport.main_markets` (the sport's primary
//    bettable market ids, e.g. moneyline/point_spread/total_points for
//    basketball) - getCompetitions() caches that list per league id and
//    getFixtures() passes it as the `market` filter on /fixtures/odds, so
//    only the sport's real main markets are ever requested.
//  - /fixtures/odds accepts `fixture_id` as a repeatable array param, so
//    odds for every fixture in a league are fetched in batches of
//    ODDS_BATCH_SIZE (5 - OpticOdds' own hard cap, see the constant below)
//    rather than one request per fixture.
//  - Selection mapping uses `team_id` (matched against the fixture's
//    home/away competitor ids) and `selection_line` ("over"/"under") rather
//    than string-matching team names against outcome labels - more robust
//    than the_odds_api adapter's approach, since OpticOdds gives us a stable
//    id instead of just a display name.
//  - Only one sportsbook's odds are requested (SPORTS_SPORTSBOOK env var,
//    default "DraftKings") to keep one canonical selection per market, same
//    simplification the_odds_api adapter makes by using only the first
//    bookmaker in its response.
//  - `is_main=true` is always passed so alternate lines never get pulled in
//    alongside the main line for the same market.

const BASE_URL = "https://api.opticodds.com/api/v3";
const DEFAULT_COMPETITION_CAP = 5;
const DEFAULT_FIXTURE_CAP = 20;
// OpticOdds enforces a hard limit of 5 total fixture_id/player_id/team_id
// values per /fixtures/odds request ("maximum 5 total fixture_id/player_id/
// team_id allowed") - confirmed against a live trial key, since the
// published docs don't call this limit out explicitly. Any league with more
// than 5 scheduled fixtures throws a 400 on a bigger batch, which used to
// take the whole league down with it (see fetchOddsBatched below).
const ODDS_BATCH_SIZE = 5;

// Our sport code -> OpticOdds sport id. See the sport-id gotcha note above.
const SPORT_ID_MAP: Record<string, string> = {
  football: "soccer",
  basketball: "basketball",
  tennis: "tennis",
};

// Secondary markets beyond the sport's `main_markets` (which only cover
// 1X2 / handicap / totals). Requested in a SEPARATE /fixtures/odds call so
// that an id this league doesn't price can only cost us the extras, never
// the main board. Override per deployment with SPORTS_EXTRA_MARKETS.
const EXTRA_MARKETS_BY_SPORT: Record<string, string[]> = {
  football: [
    "both_teams_to_score",
    "double_chance",
    "draw_no_bet",
    "1st_half_moneyline",
    "1st_half_total_goals",
    "total_corners",
  ],
  basketball: ["1st_half_moneyline", "1st_quarter_moneyline", "team_total_points"],
  tennis: ["total_sets", "set_betting"],
};

interface OpticOddsSportRef {
  id: string;
  name: string;
  main_markets?: { id: string; name: string }[] | null;
}

interface OpticOddsLeague {
  id: string;
  name: string;
  sport: OpticOddsSportRef;
  region: string;
  region_code: string | null;
}

interface OpticOddsCompetitor {
  id: string;
  name: string;
  abbreviation?: string;
}

interface OpticOddsFixture {
  id: string;
  start_date: string;
  status: string; // "unplayed" | "live" | "completed" | "cancelled"
  is_live: boolean;
  home_competitors: OpticOddsCompetitor[];
  away_competitors: OpticOddsCompetitor[];
  result: {
    scores?: {
      home?: { total: number | null };
      away?: { total: number | null };
    };
  } | null;
}

interface OpticOddsOdd {
  market_id: string;
  market: string; // display label, e.g. "Point Spread"
  name: string;
  selection_line: "over" | "under" | null;
  price: number;
  points: number | null;
  team_id: string | null;
}

interface OpticOddsFixtureOdds {
  id: string;
  odds: OpticOddsOdd[];
}

interface OpticOddsListResponse<T> {
  data: T[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function titleCaseRegion(region: string): string {
  return region
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ");
}

function mapStatus(status: string, isLive: boolean): EventStatus {
  if (status === "completed") return "finished";
  if (status === "cancelled") return "cancelled";
  if (isLive || status === "live") return "live";
  return "scheduled";
}

// Normalizes OpticOdds' market ids (which vary per sport - "run_line" for
// baseball, "point_spread" for basketball, "spread" for football/soccer,
// "puck_line" for hockey, etc) down to the three market_type values
// evaluate_selection_result() actually understands. Anything unrecognized
// falls through unchanged and settle_event() will grade it 'void' rather
// than mis-grade it, same safe default the_odds_api adapter relies on.
function mapMarketType(marketId: string): string {
  const id = marketId.toLowerCase();
  if (id.includes("moneyline") || id === "winner" || id === "match_winner") return "moneyline";
  if (id.includes("spread") || id.includes("run_line") || id.includes("puck_line")) return "spread";
  if (id.includes("total")) return "total";
  return marketId;
}

// Selection `id`/`name` must be the generic "home"/"away"/"draw"/"over"/
// "under" convention (see the_odds_api adapter's mapMarket for why) - the
// betting engine's settle_event() and the frontend both key off it exactly.
function mapSelection(
  odd: OpticOddsOdd,
  home: OpticOddsCompetitor | undefined,
  away: OpticOddsCompetitor | undefined,
): ProviderSelection | null {
  if (odd.selection_line === "over") {
    const s: ProviderSelection = { id: "over", name: "Over", decimalOdds: odd.price };
    if (odd.points !== null) s.line = odd.points;
    return s;
  }
  if (odd.selection_line === "under") {
    const s: ProviderSelection = { id: "under", name: "Under", decimalOdds: odd.price };
    if (odd.points !== null) s.line = odd.points;
    return s;
  }
  if (odd.team_id && home && odd.team_id === home.id) {
    const s: ProviderSelection = { id: "home", name: "Home", decimalOdds: odd.price };
    if (odd.points !== null) s.line = odd.points;
    return s;
  }
  if (odd.team_id && away && odd.team_id === away.id) {
    const s: ProviderSelection = { id: "away", name: "Away", decimalOdds: odd.price };
    if (odd.points !== null) s.line = odd.points;
    return s;
  }
  if (!odd.team_id && /\b(draw|tie)\b/i.test(odd.name)) {
    return { id: "draw", name: "Draw", decimalOdds: odd.price };
  }
  return null;
}

export class OpticOddsProvider implements SportsDataProvider {
  readonly code = "opticodds";
  private readonly apiKey: string;
  private readonly sportsbook: string;
  private readonly leagueAllowlist: string[];
  private readonly leagueCap: number;
  private readonly fixtureCap: number;
  private readonly mainMarketsByLeague = new Map<string, string[]>();

  constructor(
    apiKey: string,
    sportsbook: string = "DraftKings",
    leagueAllowlist: string[] = [],
    leagueCap: number = DEFAULT_COMPETITION_CAP,
    fixtureCap: number = DEFAULT_FIXTURE_CAP,
  ) {
    this.apiKey = apiKey;
    this.sportsbook = sportsbook;
    this.leagueAllowlist = leagueAllowlist;
    this.leagueCap = leagueCap;
    this.fixtureCap = fixtureCap;
  }

  private async get<T>(path: string, params: Record<string, string | string[]>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, item);
      } else {
        url.searchParams.set(key, value);
      }
    }
    const res = await fetch(url, { headers: { "X-Api-Key": this.apiKey } });
    if (!res.ok) throw new Error(`OpticOdds ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  async getSports(): Promise<ProviderSport[]> {
    return Object.keys(SPORT_ID_MAP).map((code) => ({
      code,
      name: code[0]!.toUpperCase() + code.slice(1),
    }));
  }

  async getCountries(): Promise<ProviderCountry[]> {
    const seen = new Map<string, string>();
    for (const opticoddsSportId of Object.values(SPORT_ID_MAP)) {
      const { data } = await this.get<OpticOddsListResponse<OpticOddsLeague>>("/leagues", {
        sport: opticoddsSportId,
      });
      for (const league of data) {
        if (league.region_code && !seen.has(league.region_code)) {
          seen.set(league.region_code, titleCaseRegion(league.region));
        }
      }
    }
    return [...seen.entries()].map(([code, name]) => ({ code, name }));
  }

  async getCompetitions(sportCode: string): Promise<ProviderCompetition[]> {
    const opticoddsSportId = SPORT_ID_MAP[sportCode];
    if (!opticoddsSportId) return [];

    const { data } = await this.get<OpticOddsListResponse<OpticOddsLeague>>("/leagues", {
      sport: opticoddsSportId,
    });
    const selected =
      this.leagueAllowlist.length > 0
        ? data.filter((l) => this.leagueAllowlist.includes(l.id))
        : data.slice(0, this.leagueCap);

    for (const league of selected) {
      this.mainMarketsByLeague.set(
        league.id,
        (league.sport.main_markets ?? []).map((m) => m.id),
      );
    }

    return selected.map((league) => {
      const comp: ProviderCompetition = {
        id: league.id,
        sportCode,
        name: league.name,
        slug: slugify(league.id),
      };
      if (league.region_code) comp.countryCode = league.region_code;
      return comp;
    });
  }

  async getFixtures(competitionId: string): Promise<ProviderFixture[]> {
    const { data } = await this.get<OpticOddsListResponse<OpticOddsFixture>>("/fixtures", {
      league: competitionId,
      start_date_after: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      start_date_before: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const fixtures = data.slice(0, this.fixtureCap);
    if (fixtures.length === 0) return [];

    const markets = this.mainMarketsByLeague.get(competitionId);
    const oddsByFixtureId = await this.fetchOddsBatched(
      fixtures.map((f) => f.id),
      markets,
    );

    return fixtures.map((fixture) =>
      this.mapFixture(fixture, competitionId, oddsByFixtureId.get(fixture.id) ?? []),
    );
  }

  private async fetchOddsBatched(
    fixtureIds: string[],
    markets: string[] | undefined,
  ): Promise<Map<string, OpticOddsOdd[]>> {
    const out = new Map<string, OpticOddsOdd[]>();
    for (let i = 0; i < fixtureIds.length; i += ODDS_BATCH_SIZE) {
      const batch = fixtureIds.slice(i, i + ODDS_BATCH_SIZE);
      const params: Record<string, string | string[]> = {
        fixture_id: batch,
        sportsbook: this.sportsbook,
        odds_format: "DECIMAL",
        is_main: "true",
      };
      if (markets && markets.length > 0) params.market = markets;

      // One bad batch (a transient error, an unsupported market for this
      // subset of fixtures) shouldn't cost every other fixture in the
      // league its odds too - catch per batch and leave those fixtures
      // with no markets rather than losing the whole league.
      try {
        const { data } = await this.get<OpticOddsListResponse<OpticOddsFixtureOdds>>(
          "/fixtures/odds",
          params,
        );
        for (const entry of data) out.set(entry.id, entry.odds);
      } catch (err) {
        console.warn(`OpticOdds odds batch failed for ${batch.length} fixture(s), skipping`, err);
      }
    }
    return out;
  }

  async getLiveEvents(sportCode: string): Promise<ProviderFixture[]> {
    const competitions = await this.getCompetitions(sportCode);
    const fixturesByCompetition = await Promise.all(
      competitions.map((c) => this.getFixtures(c.id)),
    );
    return fixturesByCompetition.flat().filter((f) => f.status === "live");
  }

  private mapFixture(
    fixture: OpticOddsFixture,
    competitionId: string,
    odds: OpticOddsOdd[],
  ): ProviderFixture {
    const home = fixture.home_competitors[0];
    const away = fixture.away_competitors[0];

    const marketsById = new Map<string, ProviderMarket>();
    for (const odd of odds) {
      if (odd.price === null || odd.price === undefined) continue;
      let market = marketsById.get(odd.market_id);
      if (!market) {
        market = {
          id: `${fixture.id}-${odd.market_id}`,
          type: mapMarketType(odd.market_id),
          label: odd.market,
          selections: [],
        };
        marketsById.set(odd.market_id, market);
      }
      const selection = mapSelection(odd, home, away);
      if (selection) market.selections.push(selection);
    }

    const result: ProviderFixture = {
      id: fixture.id,
      competitionId,
      name: `${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`,
      scheduledStart: fixture.start_date,
      status: mapStatus(fixture.status, fixture.is_live),
      homeParticipant: { id: home?.id ?? "home", name: home?.name ?? "Home", kind: "team" },
      awayParticipant: { id: away?.id ?? "away", name: away?.name ?? "Away", kind: "team" },
      markets: [...marketsById.values()].filter((m) => m.selections.length > 0),
    };
    const homeScore = fixture.result?.scores?.home?.total;
    const awayScore = fixture.result?.scores?.away?.total;
    if (homeScore !== null && homeScore !== undefined) result.homeScore = homeScore;
    if (awayScore !== null && awayScore !== undefined) result.awayScore = awayScore;
    return result;
  }
}
