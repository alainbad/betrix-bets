/**
 * Real league brand marks are served by Logo.dev from each competition's
 * official domain, so we never ship hand-drawn imitations of trademarks.
 */

export type LeagueBrand = {
  name: string;
  domain: string;
  sportId: string;
};

export const LEAGUE_BRANDS: LeagueBrand[] = [
  { name: "Premier League", domain: "premierleague.com", sportId: "football" },
  { name: "LaLiga", domain: "laliga.com", sportId: "football" },
  { name: "Champions League", domain: "uefa.com", sportId: "football" },
  { name: "Serie A", domain: "legaseriea.it", sportId: "football" },
  { name: "Bundesliga", domain: "bundesliga.com", sportId: "football" },
  { name: "NBA", domain: "nba.com", sportId: "basketball" },
  { name: "NFL", domain: "nfl.com", sportId: "americanfootball" },
  { name: "MLB", domain: "mlb.com", sportId: "baseball" },
  { name: "Wimbledon", domain: "wimbledon.com", sportId: "tennis" },
  { name: "ATP Tour", domain: "atptour.com", sportId: "tennis" },
  { name: "LCS", domain: "lolesports.com", sportId: "esports" },
];

const BY_NAME = new Map(LEAGUE_BRANDS.map((b) => [b.name.toLowerCase(), b]));

export function getLeagueBrand(league: string): LeagueBrand | undefined {
  return BY_NAME.get(league.trim().toLowerCase());
}

/** Logo.dev image URL for a league, or null when we have no verified domain. */
export function leagueLogoUrl(league: string, size = 64): string | null {
  const brand = getLeagueBrand(league);
  const token = import.meta.env["VITE_LOVABLE_CONNECTOR_LOGO_DEV_API_KEY"];
  if (!brand || !token) return null;
  return `https://img.logo.dev/${brand.domain}?token=${token}&size=${size}&format=png&retina=true`;
}
