import { createFileRoute, Link } from "@tanstack/react-router";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
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
      activeProps={{ className: "border-primary text-primary" }}
      className="flex min-w-[6rem] flex-col items-center gap-2 rounded-2xl border border-border bg-secondary p-4 text-center transition-all hover:border-primary/50 hover:bg-betrix-surface-elevated"
    >
      <span className="text-2xl" aria-hidden="true">
        🏆
      </span>
      <span className="text-sm font-semibold text-foreground">All</span>
    </Link>
  );
}
