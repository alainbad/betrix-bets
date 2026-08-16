import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import { useBetting } from "@/lib/betting-store";
import { formatDateTime, formatOdds } from "@/lib/format";
import { OddsButton } from "./OddsButton";
import type { Event } from "@/lib/betting-data";

export function EventCard({ event }: { event: Event }) {
  const { addToSlip, isInSlip } = useBetting();
  const moneyline = event.markets.find((m) => m.type === "moneyline");

  return (
    <article className="group flex flex-col rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="rounded-md bg-secondary px-2 py-1 text-foreground">{event.league}</span>
          {event.status === "live" ? (
            <span className="flex items-center gap-1 text-accent">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(event.startTime)}
            </span>
          )}
        </div>
        <Link
          to="/events/$eventId"
          params={{ eventId: event.id }}
          className="text-xs font-medium text-primary hover:underline"
        >
          More markets
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamColumn name={event.awayTeam} />
        <span className="text-lg font-black text-muted-foreground">@</span>
        <TeamColumn name={event.homeTeam} align="right" />
      </div>

      {event.status === "live" && (
        <div className="mb-4 flex items-center justify-center gap-4 rounded-xl bg-betrix-surface-elevated py-2">
          <Score value={event.awayScore ?? 0} label={event.awayTeam} />
          <span className="text-xs font-bold uppercase text-muted-foreground">Score</span>
          <Score value={event.homeScore ?? 0} label={event.homeTeam} />
        </div>
      )}

      <div className="mt-auto grid grid-cols-2 gap-2">
        {moneyline?.selections.map((selection) => {
          const active = isInSlip(event.id, selection.id);
          return (
            <OddsButton
              key={selection.id}
              selection={selection}
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
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-sm font-bold text-foreground">{name}</p>
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
