import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Radio, Timer } from "lucide-react";
import { getLiveEvents, getUpcomingEvents } from "@/lib/sports-data";
import { EventCard } from "@/components/EventCard";

export const Route = createFileRoute("/live")({
  loader: async () => {
    const [live, soon] = await Promise.all([getLiveEvents(), getUpcomingEvents(3)]);
    return { live, soon };
  },
  head: () => ({
    meta: [
      { title: "Live Betting — In-Play Odds on Betrix" },
      {
        name: "description",
        content:
          "Follow in-play matches on Betrix with live scores, momentum and continuously updating simulated odds.",
      },
      { property: "og:title", content: "Live Betting on Betrix" },
      {
        property: "og:description",
        content:
          "In-play scores, momentum and simulated odds across football, basketball, tennis and esports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LivePage,
});

function LivePage() {
  const { live, soon } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
              <Radio className="h-3 w-3 animate-pulse" /> In-play now
            </p>
            <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Live betting
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Prices update as the game moves. Markets suspend automatically around scoring events,
              exactly as they would on a regulated book.
            </p>
          </div>
          <dl className="flex gap-6 text-right">
            <Stat
              icon={<Activity className="h-4 w-4" />}
              label="Live events"
              value={String(live.length)}
            />
            <Stat icon={<Timer className="h-4 w-4" />} label="Feed latency" value="340 ms" />
          </dl>
        </div>

        {live.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-sm text-muted-foreground">No events are in play right now.</p>
            <Link
              to="/sports"
              className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
            >
              Browse upcoming fixtures
            </Link>
          </div>
        )}

        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-foreground">Starting soon</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {soon.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center justify-end gap-1 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-2xl font-black text-foreground">{value}</dd>
    </div>
  );
}
