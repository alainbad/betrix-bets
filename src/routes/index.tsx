import { createFileRoute, Link } from "@tanstack/react-router";
import { EventCard } from "@/components/EventCard";
import { HeroCarousel } from "@/components/HeroCarousel";
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
      <HeroCarousel />


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
