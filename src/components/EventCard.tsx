import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { formatDateTime, formatOdds } from "@/lib/format";
import { OddsButton } from "./OddsButton";
import { LeagueBadge } from "./LeagueLogo";
import { TeamLogo } from "./TeamLogo";
import type { Event } from "@/lib/betting-data";

export function EventCard({ event }: { event: Event }) {
  const { addToSlip, isInSlip } = useBetting();
  const moneyline = event.markets.find((m) => m.type === "moneyline");

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <LeagueBadge league={event.league} />
          {event.status === "live" ? (
            <span className="flex shrink-0 items-center gap-1 text-accent">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              <span className="truncate">{formatDateTime(event.startTime)}</span>
            </span>
          )}
        </div>
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="shrink-0 whitespace-nowrap text-xs font-medium text-primary hover:underline"
        >
          More markets
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
        <TeamColumn name={event.awayTeam} />
        <span className="shrink-0 text-lg font-black text-muted-foreground">@</span>
        <TeamColumn name={event.homeTeam} align="right" />
      </div>


      {event.status === "live" && (
        <div className="mb-4 flex items-center justify-center gap-4 rounded-xl bg-betrix-surface-elevated py-2">
          <Score value={event.awayScore ?? 0} label={event.awayTeam} />
          <span className="text-xs font-bold uppercase text-muted-foreground">Score</span>
          <Score value={event.homeScore ?? 0} label={event.homeTeam} />
        </div>
      )}

      <div
        className={`mt-auto grid gap-2 ${moneyline && moneyline.selections.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {moneyline?.selections.map((selection) => {
          const active = isInSlip(event.id, selection.id);
          const caption =
            selection.label === "Draw"
              ? "Draw"
              : selection.label === "Home"
                ? event.homeTeam
                : event.awayTeam;
          return (
            <OddsButton
              key={selection.id}
              selection={selection}
              caption={caption}
              active={active}
              onClick={() => addToSlip(event, moneyline.label, selection)}
              size="sm"
            />
          );
        })}
      </div>

    </article>
  );
}

function TeamColumn({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}
    >
      <TeamLogo team={name} size={44} />
      <p className="min-w-0 text-sm font-bold leading-tight text-foreground">{name}</p>
    </div>
  );
}

function Score({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="max-w-[80px] truncate text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
