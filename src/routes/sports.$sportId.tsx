import { createFileRoute, notFound } from "@tanstack/react-router";
import { EventCard } from "@/components/EventCard";
import { SportPill } from "@/components/SportPill";
import { SPORTS, getEventsBySport, getSportById, type SportId } from "@/lib/betting-data";

export const Route = createFileRoute("/sports/$sportId")({
  loader: ({ params }) => {
    const sport = getSportById(params.sportId as SportId);
    if (!sport) throw notFound();
    return { sport, events: getEventsBySport(params.sportId as SportId) };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.sport?.name ?? "Sport"} — Betrix` },
      { name: "description", content: `Browse ${loaderData?.sport?.name ?? ""} events and odds on Betrix.` },
      { property: "og:title", content: `${loaderData?.sport?.name ?? "Sport"} — Betrix` },
      { property: "og:description", content: `Browse ${loaderData?.sport?.name ?? ""} events and odds on Betrix.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SportPage,
});

function SportPage() {
  const { sport, events } = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{sport.icon}</span>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">{sport.name}</h1>
            <p className="text-muted-foreground">{events.length} upcoming events</p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
          <SportPillPlaceholder />
          {SPORTS.map((s) => (
            <SportPill key={s.id} sport={s} />
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      </div>
    </main>
  );
}

function SportPillPlaceholder() {
  return (
    <div className="flex min-w-[6rem] flex-col items-center gap-2 rounded-2xl border border-border bg-secondary p-4 text-center opacity-50">
      <span className="text-2xl">🏆</span>
      <span className="text-sm font-semibold text-foreground">All</span>
    </div>
  );
}
