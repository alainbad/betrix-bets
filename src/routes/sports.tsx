import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { LeagueLogo } from "@/components/LeagueLogo";
import { LEAGUE_BRANDS } from "@/lib/league-logos";
import { getAllEvents, getSports } from "@/lib/sports-data";

export const Route = createFileRoute("/sports")({
  loader: async () => {
    const [sports, events] = await Promise.all([getSports(), getAllEvents(200)]);
    return { sports, events };
  },
  head: () => ({
    meta: [
      { title: "All Sports — Betrix" },
      { name: "description", content: "Browse every sport and upcoming event on Betrix." },
      { property: "og:title", content: "All Sports — Betrix" },
      { property: "og:description", content: "Browse every sport and upcoming event on Betrix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportsPage,
});

function SportsPage() {
  const { sports, events } = Route.useLoaderData();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filteredEvents = q
    ? events.filter(
        (event) =>
          event.homeTeam.toLowerCase().includes(q) ||
          event.awayTeam.toLowerCase().includes(q) ||
          event.league.toLowerCase().includes(q),
      )
    : events;

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Sports</h1>
        <p className="mt-1 text-muted-foreground">Pick a sport and start building your bet slip.</p>

        <label className="relative mt-5 flex max-w-md items-center">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams, players or leagues"
            className="w-full rounded-full border border-border bg-secondary py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </label>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          <AllSportsPill active />
          {sports.map((sport) => (
            <SportPill key={sport.id} sport={sport} />
          ))}
        </div>

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Top competitions
          </h2>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {LEAGUE_BRANDS.filter((b) => sports.some((s) => s.id === b.sportId)).map((brand) => (
              <Link
                key={brand.name}
                to="/sports/$sportId"
                params={{ sportId: brand.sportId }}
                className="flex shrink-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-betrix-surface-elevated"
              >
                <LeagueLogo league={brand.name} size={44} />
                {brand.name}
              </Link>
            ))}
          </div>
        </section>

        {filteredEvents.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No games or teams match "{query}".</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function AllSportsPill({ active }: { active?: boolean }) {
  return (
    <Link
      to="/sports"
      className={`flex h-24 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border bg-secondary text-center transition-colors hover:bg-betrix-surface-elevated ${active ? "border-primary text-primary" : "border-border text-foreground"}`}
    >
      <Trophy className="h-5 w-5" />
      <span className="text-sm font-semibold">All sports</span>
    </Link>
  );
}
