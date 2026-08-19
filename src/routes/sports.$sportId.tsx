import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { LeagueLogo } from "@/components/LeagueLogo";
import { getLeagueBrandBySlug } from "@/lib/league-logos";
import { getSportImage } from "@/lib/sport-media";
import {
  getEventsByCompetition,
  getEventsBySport,
  getSportByCode,
  getSports,
} from "@/lib/sports-data";

// League filtering is a search param (?league=<slug>) rather than a nested
// path segment (/sports/$sportId/$competitionSlug). A prior attempt used a
// separate route file for that nested path; it worked in every local check
// (build, tsc, the generated route registry) and in the Lovable editor's
// synced source, but never actually worked once deployed - new route files
// apparently don't reliably make it into whatever Lovable's pipeline
// actually ships. A search param on this already-deployed, already-working
// route sidesteps that entirely, since it's not a new route registration.
export const Route = createFileRoute("/sports/$sportId")({
  validateSearch: z.object({ league: z.string().optional() }),
  loaderDeps: ({ search }) => ({ league: search.league }),
  loader: async ({ params, deps }) => {
    const brand = deps.league ? getLeagueBrandBySlug(params.sportId, deps.league) : undefined;

    const [sport, events, sports] = await Promise.all([
      getSportByCode(params.sportId),
      brand?.competitionName
        ? getEventsByCompetition(params.sportId, brand.competitionName)
        : getEventsBySport(params.sportId),
      getSports(),
    ]);
    if (!sport) throw notFound();
    return { sport, events, sports, brand: deps.league ? brand : undefined };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.brand?.name ?? loaderData?.sport?.name ?? "Sport";
    return {
      meta: [
        { title: `${name} — Betrix` },
        { name: "description", content: `Browse ${name} events and odds on Betrix.` },
        { property: "og:title", content: `${name} — Betrix` },
        { property: "og:description", content: `Browse ${name} events and odds on Betrix.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: SportPage,
});

function SportPage() {
  const { sport, events, sports, brand } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background pb-16">
      <section className="relative h-52 overflow-hidden border-b border-border sm:h-64">
        <img
          src={getSportImage(sport.id)}
          alt={`${sport.name} action`}
          width={640}
          height={640}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/75 to-background/20" />
        <div className="absolute inset-0 flex items-end px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
            {brand && <LeagueLogo league={brand.competitionName ?? brand.name} size={44} />}
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                {brand?.name ?? sport.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {events.length} events with open markets
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {brand && (
          <Link
            to="/sports/$sportId"
            params={{ sportId: sport.id }}
            className="mb-4 inline-flex items-center text-sm font-semibold text-primary hover:underline"
          >
            ← All {sport.name}
          </Link>
        )}

        <div className="flex gap-3 overflow-x-auto pb-2">
          <Link
            to="/sports"
            className="flex h-24 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-secondary text-center text-foreground transition-colors hover:bg-betrix-surface-elevated"
          >
            <Trophy className="h-5 w-5" />
            <span className="text-sm font-semibold">All sports</span>
          </Link>
          {sports.map((s) => (
            <SportPill key={s.id} sport={s} />
          ))}
        </div>

        {events.length === 0 && brand ? (
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
