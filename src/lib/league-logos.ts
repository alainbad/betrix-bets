/**
 * Real league brand marks are served by Logo.dev from each competition's
 * official domain, so we never ship hand-drawn imitations of trademarks.
 * Some leagues are overridden with user-provided assets when the Logo.dev
 * version is not visible on the dark UI.
 */
import championsLeagueAsset from "@/assets/champions-league.png.asset.json";

export type LeagueBrand = {
  name: string;
  domain: string;
  sportId: string;
  /** Optional CDN asset URL to use instead of Logo.dev. */
  assetUrl?: string;
  /**
   * Exact `competitions.name` and `.slug` values as synced from the sports
   * data provider (see supabase/functions/_shared/opticodds-provider.ts).
   * Providers name competitions like "England - Premier League", not just
   * "Premier League" - without these, logo lookup (by name) and per-league
   * routing (by slug) can't match a brand to its real competition rows.
   * Omitted for brands with no distinct competition in our data (Wimbledon
   * is a week inside the ATP/WTA tour, not its own league) - those fall
   * back to linking at the sport level instead of a specific league.
   */
  competitionName?: string;
  competitionSlug?: string;
};

export const LEAGUE_BRANDS: LeagueBrand[] = [
  {
    name: "Premier League",
    domain: "premierleague.com",
    sportId: "football",
    competitionName: "England - Premier League",
    competitionSlug: "england-premier-league",
  },
  {
    name: "LaLiga",
    domain: "laliga.com",
    sportId: "football",
    competitionName: "Spain - La Liga",
    competitionSlug: "spain-la-liga",
  },
  {
    name: "Champions League",
    domain: "uefa.com",
    sportId: "football",
    assetUrl: championsLeagueAsset.url,
    competitionName: "UEFA - Champions League",
    competitionSlug: "uefa-champions-league",
  },
  {
    name: "Serie A",
    domain: "legaseriea.it",
    sportId: "football",
    competitionName: "Italy - Serie A",
    competitionSlug: "italy-serie-a",
  },
  {
    name: "Bundesliga",
    domain: "bundesliga.com",
    sportId: "football",
    competitionName: "Germany - Bundesliga",
    competitionSlug: "germany-bundesliga",
  },
  {
    name: "NBA",
    domain: "nba.com",
    sportId: "basketball",
    competitionName: "NBA",
    competitionSlug: "nba",
  },
  { name: "NFL", domain: "nfl.com", sportId: "americanfootball" },
  { name: "MLB", domain: "mlb.com", sportId: "baseball" },
  { name: "Wimbledon", domain: "wimbledon.com", sportId: "tennis" },
  {
    name: "ATP Tour",
    domain: "atptour.com",
    sportId: "tennis",
    competitionName: "ATP",
    competitionSlug: "atp",
  },
  { name: "LCS", domain: "lolesports.com", sportId: "esports" },
];

export function getLeagueBrand(league: string): LeagueBrand | undefined {
  const key = league.trim().toLowerCase();
  return LEAGUE_BRANDS.find(
    (b) => b.name.toLowerCase() === key || b.competitionName?.toLowerCase() === key,
  );
}

export function getLeagueBrandBySlug(
  sportId: string,
  competitionSlug: string,
): LeagueBrand | undefined {
  return LEAGUE_BRANDS.find((b) => b.sportId === sportId && b.competitionSlug === competitionSlug);
}

export type LeagueLogoSource = {
  url: string;
  /** When true, the logo should be rendered as white on dark surfaces. */
  monochrome: boolean;
};

/** Resolves a league logo source. Returns null when no source is available. */
export function leagueLogoUrl(league: string, size = 64): LeagueLogoSource | null {
  const brand = getLeagueBrand(league);
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  if (!brand) return null;
  if (brand.assetUrl) {
    return { url: brand.assetUrl, monochrome: false };
  }
  if (!token) return null;
  return {
    url: `https://img.logo.dev/${brand.domain}?token=${token}&size=${size}&format=png&retina=true`,
    monochrome: true,
  };
}
