import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { LeagueLogo } from "@/components/LeagueLogo";
import { getLeagueBrandBySlug } from "@/lib/league-logos";
import { getEventsByCompetition, getSportByCode } from "@/lib/sports-data";

export const Route = createFileRoute("/sports/$sportId/$competitionSlug")({
  loader: async ({ params }) => {
    const brand = getLeagueBrandBySlug(params.sportId, params.competitionSlug);
    if (!brand?.competitionName) throw notFound();

    const [sport, events] = await Promise.all([
      getSportByCode(params.sportId),
      getEventsByCompetition(params.sportId, brand.competitionName),
    ]);
    if (!sport) throw notFound();
    return { sport, brand, events };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.brand?.name ?? "League"} — Betrix` },
      {
        name: "description",
        content: `Browse ${loaderData?.brand?.name ?? ""} events and odds on Betrix.`,
      },
      { property: "og:title", content: `${loaderData?.brand?.name ?? "League"} — Betrix` },
      {
        property: "og:description",
        content: `Browse ${loaderData?.brand?.name ?? ""} events and odds on Betrix.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompetitionPage,
});

function CompetitionPage() {
  const { sport, brand, events } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background pb-16">
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex gap-3 pb-2">
          <Link
            to="/sports/$sportId"
            params={{ sportId: sport.id }}
            className="flex h-10 items-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-semibold text-foreground transition-colors hover:bg-betrix-surface-elevated"
          >
            <Trophy className="h-4 w-4" />
            All {sport.name}
          </Link>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <LeagueLogo league={brand.competitionName ?? brand.name} size={48} />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {brand.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {events.length} events with open markets
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No {brand.name} games are scheduled right now — check back soon.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
