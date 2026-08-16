import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Flame, Trophy } from "lucide-react";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { SPORTS, getFeaturedEvents } from "@/lib/betting-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Betrix — Play-Money Sports Betting" },
      { name: "description", content: "Betrix is a play-money sportsbook for tracking picks, exploring odds, and competing with friends." },
      { property: "og:title", content: "Betrix — Play-Money Sports Betting" },
      { property: "og:description", content: "Track picks, explore live odds, and compete with friends on Betrix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const featured = getFeaturedEvents(4);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="gradient-hero border-b border-border px-4 pb-12 pt-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Flame className="h-3.5 w-3.5" />
              Play-money sportsbook
            </div>
            <h1 className="text-4xl font-black leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Bet smarter. <span className="text-primary">Win bigger.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Explore live odds, build your bet slip, and track your play-money bankroll across every major sport.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/sports"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-105 active:scale-95"
              >
                Start betting
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/account"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-betrix-surface-elevated"
              >
                <Trophy className="h-4 w-4" />
                My bets
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Sports */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-4 text-lg font-bold text-foreground">Sports</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {SPORTS.map((sport) => (
              <SportPill key={sport.id} sport={sport} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured events */}
      <section className="px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Featured events</h2>
            <Link to="/sports" className="text-sm font-semibold text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
