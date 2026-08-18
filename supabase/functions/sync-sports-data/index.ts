// Sports data ingestion job (spec sections 4-7, 79).
//
// Runs server-side only (Edge Function, service-role key never leaves this
// process). Picks a SportsDataProvider based on the SPORTS_PROVIDER env var,
// normalizes whatever it returns into our internal schema, and records a
// provider_mappings row for every entity so re-running this job updates the
// same rows instead of duplicating them. The frontend never calls this or any
// external sports API directly — it only ever reads the normalized tables
// through Supabase (with RLS), same as everything else in this app.
//
// Invoke manually for now (Dashboard "Invoke" button, or `curl -X POST
// .../functions/v1/sync-sports-data`); polling/scheduling per spec section 88
// is Phase 7 (realtime) work.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { MockSportsProvider } from "../_shared/mock-provider.ts";
import { TheOddsApiProvider } from "../_shared/the-odds-api-provider.ts";
import type {
  ProviderCompetition,
  ProviderFixture,
  SportsDataProvider,
} from "../_shared/sports-types.ts";

function getProvider(): SportsDataProvider {
  const kind = Deno.env.get("SPORTS_PROVIDER") ?? "mock";
  if (kind === "the_odds_api") {
    const apiKey = Deno.env.get("SPORTS_API_KEY");
    if (!apiKey)
      throw new Error("SPORTS_PROVIDER=the_odds_api requires the SPORTS_API_KEY secret to be set.");
    // Optional: SPORTS_COMPETITION_ALLOWLIST="soccer_epl,basketball_nba" to
    // sync only specific leagues. Unset caps at SPORTS_COMPETITION_CAP
    // leagues per sport (default 5) instead of every active league, since
    // each one costs a full /odds request against the API quota.
    const allowlist = (Deno.env.get("SPORTS_COMPETITION_ALLOWLIST") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const capEnv = Deno.env.get("SPORTS_COMPETITION_CAP");
    const cap = capEnv ? Number.parseInt(capEnv, 10) : undefined;
    return new TheOddsApiProvider(
      apiKey,
      allowlist,
      cap && Number.isFinite(cap) && cap > 0 ? cap : undefined,
    );
  }
  return new MockSportsProvider();
}

// Every write below is a bulk upsert (one round trip per table, not one per
// row) — the original row-at-a-time version made ~150+ sequential HTTP calls
// for this mock dataset and blew past the Edge Function execution timeout
// before finishing (confirmed via Logs: it got through football's ~50 rows
// in 51s, then silently ran out of time mid-basketball). New/existing rows
// are unified into a single upsert per table by generating the id
// client-side (crypto.randomUUID()) for new rows and reusing the previously
// mapped id for existing ones — Postgres upsert-by-primary-key handles both
// in one statement.

async function upsertProvider(supabase: SupabaseClient, code: string): Promise<string> {
  const { data, error } = await supabase
    .from("providers")
    .upsert({ code, name: code, active: true }, { onConflict: "code" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// A live provider can produce thousands of rows (real leagues run far
// bigger than the mock dataset), and a single upsert/insert/select-in call
// with that many rows can fail at the network layer sending the request
// rather than at Postgres - splitting into fixed-size batches keeps every
// individual request small regardless of how much the sync scales up.
const BATCH_SIZE = 200;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function chunkedUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
): Promise<void> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) throw error;
  }
}

async function chunkedUpsertReturning(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { data, error } = await supabase.from(table).upsert(batch, { onConflict }).select(select);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

async function chunkedInsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  for (const batch of chunk(rows, BATCH_SIZE)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) throw error;
  }
}

async function chunkedSelectIn(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  inColumn: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const batch of chunk(ids, BATCH_SIZE)) {
    const { data, error } = await supabase.from(table).select(columns).in(inColumn, batch);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}

interface SyncCounts {
  sports: number;
  competitions: number;
  events: number;
  markets: number;
  selections: number;
}

async function runSync(
  supabase: SupabaseClient,
  provider: SportsDataProvider,
): Promise<SyncCounts> {
  const counts: SyncCounts = { sports: 0, competitions: 0, events: 0, markets: 0, selections: 0 };

  const providerId = await upsertProvider(supabase, provider.code);
  console.log("providerId", providerId);

  // Preload every mapping we already have for this provider so new-vs-existing
  // is a Map lookup, not a query, for every event/market/selection below.
  const { data: mappingRows, error: mappingsError } = await supabase
    .from("provider_mappings")
    .select("entity_type, provider_ref, internal_id")
    .eq("provider_id", providerId);
  if (mappingsError) throw mappingsError;
  const mappingCache = new Map<string, string>();
  for (const row of mappingRows ?? []) {
    mappingCache.set(`${row.entity_type}:${row.provider_ref}`, row.internal_id as string);
  }
  const newMappingRows: {
    provider_id: string;
    entity_type: string;
    internal_id: string;
    provider_ref: string;
  }[] = [];

  function resolveId(entityType: string, providerRef: string): { id: string; isNew: boolean } {
    const key = `${entityType}:${providerRef}`;
    const existing = mappingCache.get(key);
    if (existing) return { id: existing, isNew: false };
    const id = crypto.randomUUID();
    mappingCache.set(key, id);
    newMappingRows.push({
      provider_id: providerId,
      entity_type: entityType,
      internal_id: id,
      provider_ref: providerRef,
    });
    return { id, isNew: true };
  }

  console.log("step: countries");
  const countries = await provider.getCountries();
  const countryRows = await chunkedUpsertReturning(
    supabase,
    "countries",
    countries.map((c) => ({ code: c.code, name: c.name })),
    "code",
    "id, code",
  );
  const countryIdByCode = new Map<string, string>(
    countryRows.map((r) => [r.code as string, r.id as string]),
  );

  console.log("step: sports");
  const sports = await provider.getSports();
  const sportRows = await chunkedUpsertReturning(
    supabase,
    "sports",
    sports.map((s) => ({ code: s.code, name: s.name, icon: s.icon ?? null })),
    "code",
    "id, code",
  );
  const sportIdByCode = new Map<string, string>(
    sportRows.map((r) => [r.code as string, r.id as string]),
  );
  counts.sports = sports.length;

  console.log("step: competitions");
  const competitionEntries: { sportCode: string; comp: ProviderCompetition }[] = [];
  for (const sport of sports) {
    const comps = await provider.getCompetitions(sport.code);
    for (const comp of comps) competitionEntries.push({ sportCode: sport.code, comp });
  }
  const competitionRows = await chunkedUpsertReturning(
    supabase,
    "competitions",
    competitionEntries.map(({ sportCode, comp }) => ({
      sport_id: sportIdByCode.get(sportCode)!,
      country_id: comp.countryCode ? (countryIdByCode.get(comp.countryCode) ?? null) : null,
      name: comp.name,
      slug: comp.slug,
    })),
    "sport_id,slug",
    "id, sport_id, slug",
  );
  const competitionIdBySportSlug = new Map<string, string>(
    competitionRows.map((r) => [`${r.sport_id}:${r.slug}`, r.id as string]),
  );
  counts.competitions = competitionEntries.length;
  for (const { sportCode, comp } of competitionEntries) {
    const sportId = sportIdByCode.get(sportCode)!;
    const internalId = competitionIdBySportSlug.get(`${sportId}:${comp.slug}`)!;
    const key = `competition:${comp.id}`;
    if (!mappingCache.has(key)) {
      mappingCache.set(key, internalId);
      newMappingRows.push({
        provider_id: providerId,
        entity_type: "competition",
        internal_id: internalId,
        provider_ref: comp.id,
      });
    }
  }

  console.log("step: fixtures");
  const fixtureEntries: { sportCode: string; competitionId: string; fixture: ProviderFixture }[] =
    [];
  for (const { sportCode, comp } of competitionEntries) {
    const sportId = sportIdByCode.get(sportCode)!;
    const competitionId = competitionIdBySportSlug.get(`${sportId}:${comp.slug}`)!;
    let fixtures: ProviderFixture[];
    try {
      fixtures = await provider.getFixtures(comp.id);
    } catch (err) {
      // One league's quirks (unsupported markets, a transient error) shouldn't
      // abort the whole sync - log and keep going with the rest.
      console.error(`getFixtures failed for competition ${comp.id}, skipping`, err);
      continue;
    }
    for (const fixture of fixtures) fixtureEntries.push({ sportCode, competitionId, fixture });
  }

  console.log("step: participants", fixtureEntries.length, "fixtures");
  const participantByKey = new Map<
    string,
    { sportId: string; name: string; shortName?: string; kind: "team" | "individual" }
  >();
  for (const { sportCode, fixture } of fixtureEntries) {
    const sportId = sportIdByCode.get(sportCode)!;
    for (const p of [fixture.homeParticipant, fixture.awayParticipant]) {
      const entry: {
        sportId: string;
        name: string;
        shortName?: string;
        kind: "team" | "individual";
      } = {
        sportId,
        name: p.name,
        kind: p.kind,
      };
      if (p.shortName !== undefined) entry.shortName = p.shortName;
      participantByKey.set(`${sportId}:${p.name}`, entry);
    }
  }
  const participantRows = await chunkedUpsertReturning(
    supabase,
    "participants",
    [...participantByKey.values()].map((p) => ({
      sport_id: p.sportId,
      name: p.name,
      short_name: p.shortName ?? null,
      kind: p.kind,
    })),
    "sport_id,name",
    "id, sport_id, name",
  );
  const participantIdBySportName = new Map<string, string>(
    participantRows.map((r) => [`${r.sport_id}:${r.name}`, r.id as string]),
  );

  console.log("step: events");
  const eventIdByFixtureId = new Map<string, string>();
  const eventUpsertRows: Record<string, unknown>[] = [];
  for (const { sportCode, competitionId, fixture } of fixtureEntries) {
    const { id: eventId } = resolveId("event", fixture.id);
    eventIdByFixtureId.set(fixture.id, eventId);
    eventUpsertRows.push({
      id: eventId,
      sport_id: sportIdByCode.get(sportCode)!,
      competition_id: competitionId,
      name: fixture.name,
      scheduled_start: fixture.scheduledStart,
      status: fixture.status,
      home_score: fixture.homeScore ?? null,
      away_score: fixture.awayScore ?? null,
      current_period: fixture.currentPeriod ?? null,
      match_clock: fixture.matchClock ?? null,
      provider_updated_at: fixture.updatedAt ?? null,
      last_verified_at: new Date().toISOString(),
    });
  }
  await chunkedUpsert(supabase, "events", eventUpsertRows, "id");
  counts.events = eventUpsertRows.length;

  console.log("step: event_participants");
  const eventParticipantRows: Record<string, unknown>[] = [];
  for (const { sportCode, fixture } of fixtureEntries) {
    const sportId = sportIdByCode.get(sportCode)!;
    const eventId = eventIdByFixtureId.get(fixture.id)!;
    eventParticipantRows.push({
      event_id: eventId,
      side: "home",
      participant_id: participantIdBySportName.get(`${sportId}:${fixture.homeParticipant.name}`)!,
    });
    eventParticipantRows.push({
      event_id: eventId,
      side: "away",
      participant_id: participantIdBySportName.get(`${sportId}:${fixture.awayParticipant.name}`)!,
    });
  }
  await chunkedUpsert(supabase, "event_participants", eventParticipantRows, "event_id,side");

  console.log("step: markets");
  const marketIdByRef = new Map<string, string>();
  const marketUpsertRows: Record<string, unknown>[] = [];
  for (const { fixture } of fixtureEntries) {
    const eventId = eventIdByFixtureId.get(fixture.id)!;
    for (const market of fixture.markets) {
      const { id: marketId } = resolveId("market", market.id);
      marketIdByRef.set(market.id, marketId);
      marketUpsertRows.push({
        id: marketId,
        event_id: eventId,
        market_type: market.type,
        label: market.label,
        provider_updated_at: fixture.updatedAt ?? null,
      });
    }
  }
  await chunkedUpsert(supabase, "markets", marketUpsertRows, "id");
  counts.markets = marketUpsertRows.length;

  console.log("step: selections");
  const selectionUpsertRows: Record<string, unknown>[] = [];
  const selectionMeta: {
    id: string;
    newOdds: number;
    providerUpdatedAt: string | null;
    isNew: boolean;
  }[] = [];
  for (const { fixture } of fixtureEntries) {
    for (const market of fixture.markets) {
      for (const selection of market.selections) {
        const selectionRef = `${market.id}:${selection.id}`;
        const { id: selectionId, isNew } = resolveId("selection", selectionRef);
        selectionUpsertRows.push({
          id: selectionId,
          market_id: marketIdByRef.get(market.id)!,
          name: selection.name,
          decimal_odds: selection.decimalOdds,
          line: selection.line ?? null,
          provider_updated_at: fixture.updatedAt ?? null,
        });
        selectionMeta.push({
          id: selectionId,
          newOdds: selection.decimalOdds,
          providerUpdatedAt: fixture.updatedAt ?? null,
          isNew,
        });
      }
    }
  }

  const existingSelectionIds = selectionMeta.filter((s) => !s.isNew).map((s) => s.id);
  const oldOddsRows = await chunkedSelectIn(
    supabase,
    "selections",
    "id, decimal_odds",
    "id",
    existingSelectionIds,
  );
  const oldOddsById = new Map<string, number>(
    oldOddsRows.map((r) => [r.id as string, r.decimal_odds as number]),
  );

  await chunkedUpsert(supabase, "selections", selectionUpsertRows, "id");
  counts.selections = selectionUpsertRows.length;

  console.log("step: odds_history");
  const oddsHistoryRows = selectionMeta
    .filter((s) => !s.isNew && oldOddsById.has(s.id) && oldOddsById.get(s.id) !== s.newOdds)
    .map((s) => ({
      selection_id: s.id,
      old_odds: oldOddsById.get(s.id)!,
      new_odds: s.newOdds,
      provider_timestamp: s.providerUpdatedAt,
    }));
  await chunkedInsert(supabase, "odds_history", oddsHistoryRows);

  console.log("step: flush mappings", newMappingRows.length, "new");
  await chunkedUpsert(
    supabase,
    "provider_mappings",
    newMappingRows,
    "provider_id,entity_type,provider_ref",
  );

  return counts;
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("env check", { hasUrl: !!supabaseUrl, hasServiceRoleKey: !!serviceRoleKey });
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        `Missing env vars: SUPABASE_URL=${!!supabaseUrl} SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}`,
      );
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const provider = getProvider();
    console.log("provider", provider.code);
    const counts = await runSync(supabase, provider);
    console.log("sync done", counts);

    return new Response(JSON.stringify({ ok: true, provider: provider.code, counts }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("sync-sports-data failed", err);
    return new Response(JSON.stringify({ ok: false, error: describeError(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

// Supabase/Postgrest errors (thrown as `if (error) throw error` all over
// runSync) aren't Error instances, so `String(err)` on them collapses to the
// useless "[object Object]" instead of their actual message/details/hint.
// This pulls out whatever fields are present, in order of what's useful.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.stack ?? err.message;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (parts.length > 0) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      // falls through to String(err) below
    }
  }
  return String(err);
}
