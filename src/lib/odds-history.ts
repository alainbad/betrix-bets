// Short-lived, client-side price history for selections.
//
// The book's authoritative history lives in the database; this store only
// remembers what this browser session has actually observed, so a punter can
// see how a price has drifted while they were looking at the board. It is
// intentionally in-memory: history is a glanceable cue, not a record.

export interface OddsPoint {
  odds: number;
  at: number;
}

const MAX_POINTS = 12;

const history = new Map<string, OddsPoint[]>();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function recordOdds(selectionId: string, odds: number) {
  const points = history.get(selectionId) ?? [];
  const last = points[points.length - 1];
  if (last && last.odds === odds) return;
  const next = [...points, { odds, at: Date.now() }].slice(-MAX_POINTS);
  history.set(selectionId, next);
  emit();
}

export function getOddsHistory(selectionId: string): OddsPoint[] {
  return history.get(selectionId) ?? [];
}

export function subscribeOddsHistory(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function openingOdds(selectionId: string): number | undefined {
  return history.get(selectionId)?.[0]?.odds;
}
