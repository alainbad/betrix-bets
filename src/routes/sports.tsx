import { createFileRoute, Link } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { LeagueLogo } from "@/components/LeagueLogo";
import { LEAGUE_BRANDS } from "@/lib/league-logos";
import { EVENTS, SPORTS } from "@/lib/betting-data";


export const Route = createFileRoute("/sports")({
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
  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-black tracking-tight text-foreground">Sports</h1>
        <p className="mt-1 text-muted-foreground">Pick a sport and start building your bet slip.</p>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          <AllSportsPill active />
          {SPORTS.map((sport) => (
            <SportPill key={sport.id} sport={sport} />
          ))}
        </div>

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Top competitions
          </h2>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {LEAGUE_BRANDS.filter((b) => SPORTS.some((s) => s.id === b.sportId)).map((brand) => (
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

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EVENTS.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
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

