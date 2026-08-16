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
import type { ProviderFixture, ProviderParticipant, SportsDataProvider } from "../_shared/sports-types.ts";

function getProvider(): SportsDataProvider {
  const kind = Deno.env.get("SPORTS_PROVIDER") ?? "mock";
  if (kind === "the_odds_api") {
    const apiKey = Deno.env.get("SPORTS_API_KEY");
    if (!apiKey) throw new Error("SPORTS_PROVIDER=the_odds_api requires the SPORTS_API_KEY secret to be set.");
    return new TheOddsApiProvider(apiKey);
  }
  return new MockSportsProvider();
}

async function upsertProvider(supabase: SupabaseClient, code: string): Promise<string> {
  const { data, error } = await supabase
    .from("providers")
    .upsert({ code, name: code, active: true }, { onConflict: "code" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function getMappedInternalId(
  supabase: SupabaseClient,
  providerId: string,
  entityType: string,
  providerRef: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("provider_mappings")
    .select("internal_id")
    .eq("provider_id", providerId)
    .eq("entity_type", entityType)
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (error) throw error;
  return (data?.internal_id as string | undefined) ?? null;
}

async function recordMapping(
  supabase: SupabaseClient,
  providerId: string,
  entityType: string,
  internalId: string,
  providerRef: string,
) {
  const { error } = await supabase
    .from("provider_mappings")
    .upsert(
      { provider_id: providerId, entity_type: entityType, internal_id: internalId, provider_ref: providerRef },
      { onConflict: "provider_id,entity_type,provider_ref" },
    );
  if (error) throw error;
}

async function upsertParticipant(
  supabase: SupabaseClient,
  sportId: string,
  participant: ProviderParticipant,
): Promise<string> {
  const { data, error } = await supabase
    .from("participants")
    .upsert(
      { sport_id: sportId, name: participant.name, short_name: participant.shortName ?? null, kind: participant.kind },
      { onConflict: "sport_id,name" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

interface SyncCounts {
  sports: number;
  competitions: number;
  events: number;
  markets: number;
  selections: number;
}

async function syncFixture(
  supabase: SupabaseClient,
  providerId: string,
  sportId: string,
  competitionId: string,
  fixture: ProviderFixture,
  counts: SyncCounts,
) {
  const homeId = await upsertParticipant(supabase, sportId, fixture.homeParticipant);
  const awayId = await upsertParticipant(supabase, sportId, fixture.awayParticipant);

  const eventRow = {
    sport_id: sportId,
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
  };

  let eventId = await getMappedInternalId(supabase, providerId, "event", fixture.id);
  if (eventId) {
    const { error } = await supabase.from("events").update(eventRow).eq("id", eventId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("events").insert(eventRow).select("id").single();
    if (error) throw error;
    eventId = data.id as string;
    await recordMapping(supabase, providerId, "event", eventId, fixture.id);
  }
  counts.events += 1;

  for (const [side, participantId] of [
    ["home", homeId],
    ["away", awayId],
  ] as const) {
    const { error } = await supabase
      .from("event_participants")
      .upsert({ event_id: eventId, side, participant_id: participantId }, { onConflict: "event_id,side" });
    if (error) throw error;
  }

  for (const market of fixture.markets) {
    const marketRow = {
      event_id: eventId,
      market_type: market.type,
      label: market.label,
      provider_updated_at: fixture.updatedAt ?? null,
    };
    let marketId = await getMappedInternalId(supabase, providerId, "market", market.id);
    if (marketId) {
      const { error } = await supabase.from("markets").update(marketRow).eq("id", marketId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("markets").insert(marketRow).select("id").single();
      if (error) throw error;
      marketId = data.id as string;
      await recordMapping(supabase, providerId, "market", marketId, market.id);
    }
    counts.markets += 1;

    for (const selection of market.selections) {
      const selectionRef = `${market.id}:${selection.id}`;
      const existingId = await getMappedInternalId(supabase, providerId, "selection", selectionRef);

      if (existingId) {
        const { data: current, error: readError } = await supabase
          .from("selections")
          .select("decimal_odds")
          .eq("id", existingId)
          .single();
        if (readError) throw readError;

        const oldOdds = current.decimal_odds as number;
        if (oldOdds !== selection.decimalOdds) {
          const { error: historyError } = await supabase.from("odds_history").insert({
            selection_id: existingId,
            old_odds: oldOdds,
            new_odds: selection.decimalOdds,
            provider_timestamp: fixture.updatedAt ?? null,
          });
          if (historyError) throw historyError;
        }

        const { error } = await supabase
          .from("selections")
          .update({
            name: selection.name,
            decimal_odds: selection.decimalOdds,
            line: selection.line ?? null,
            provider_updated_at: fixture.updatedAt ?? null,
          })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("selections")
          .insert({
            market_id: marketId,
            name: selection.name,
            decimal_odds: selection.decimalOdds,
            line: selection.line ?? null,
            provider_updated_at: fixture.updatedAt ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        await recordMapping(supabase, providerId, "selection", data.id as string, selectionRef);
      }
      counts.selections += 1;
    }
  }
}

async function runSync(supabase: SupabaseClient, provider: SportsDataProvider): Promise<SyncCounts> {
  const counts: SyncCounts = { sports: 0, competitions: 0, events: 0, markets: 0, selections: 0 };
  const providerId = await upsertProvider(supabase, provider.code);

  const countries = await provider.getCountries();
  const countryIdByCode = new Map<string, string>();
  for (const country of countries) {
    const { data, error } = await supabase
      .from("countries")
      .upsert({ code: country.code, name: country.name }, { onConflict: "code" })
      .select("id")
      .single();
    if (error) throw error;
    countryIdByCode.set(country.code, data.id as string);
  }

  const sports = await provider.getSports();
  for (const sport of sports) {
    const { data: sportRow, error: sportError } = await supabase
      .from("sports")
      .upsert({ code: sport.code, name: sport.name, icon: sport.icon ?? null }, { onConflict: "code" })
      .select("id")
      .single();
    if (sportError) throw sportError;
    const sportId = sportRow.id as string;
    counts.sports += 1;

    const competitions = await provider.getCompetitions(sport.code);
    for (const competition of competitions) {
      const countryId = competition.countryCode ? (countryIdByCode.get(competition.countryCode) ?? null) : null;
      const { data: competitionRow, error: competitionError } = await supabase
        .from("competitions")
        .upsert(
          { sport_id: sportId, country_id: countryId, name: competition.name, slug: competition.slug },
          { onConflict: "sport_id,slug" },
        )
        .select("id")
        .single();
      if (competitionError) throw competitionError;
      const competitionId = competitionRow.id as string;
      counts.competitions += 1;
      await recordMapping(supabase, providerId, "competition", competitionId, competition.id);

      const fixtures = await provider.getFixtures(competition.id);
      for (const fixture of fixtures) {
        await syncFixture(supabase, providerId, sportId, competitionId, fixture, counts);
      }
    }
  }

  return counts;
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const provider = getProvider();
    const counts = await runSync(supabase, provider);

    return new Response(JSON.stringify({ ok: true, provider: provider.code, counts }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
