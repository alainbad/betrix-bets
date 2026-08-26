// Ultra-admin-only: sets a temporary password directly for any account,
// bypassing email delivery entirely.
//
// Supabase's password-reset email flow depends on project-level SMTP and
// redirect-URL configuration that lives outside the app (Authentication ->
// Email / URL Configuration in the dashboard) - when that's misconfigured
// or the built-in email service is rate-limited, a player can be
// permanently locked out with nothing an ultra_admin can do about it from
// inside the app. The Auth Admin API (admin.updateUserById) is the only
// supported way to change a user's password server-side, and it requires
// the service-role key, which never leaves this Edge Function.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Postgrest/Auth errors aren't Error instances, so String(err) on them
// collapses to the useless "[object Object]" instead of their actual
// message/details/hint - same helper as sync-sports-data/index.ts.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(err);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      throw new Error(
        `Missing env vars: SUPABASE_URL=${!!supabaseUrl} SUPABASE_ANON_KEY=${!!anonKey} SUPABASE_SERVICE_ROLE_KEY=${!!serviceRoleKey}`,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Missing Authorization header" }, 401);
    }

    // Caller-scoped client (anon key + the caller's own JWT, forwarded
    // as-is) - only used to identify who's calling and to resolve the
    // target via the same resolve_account_id RPC every other admin action
    // in this app uses, so identifier lookup (UID/email/phone) and the
    // "must hold a hierarchy tier role" check stay in exactly one place
    // instead of being reimplemented here.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return json({ ok: false, error: "Not authenticated" }, 401);
    }

    const { data: isUltraAdmin, error: isUltraAdminError } = await callerClient.rpc(
      "is_ultra_admin",
      { _user_id: caller.id },
    );
    if (isUltraAdminError) throw isUltraAdminError;
    if (!isUltraAdmin) {
      return json({ ok: false, error: "Unauthorized: ultra_admin privileges required" }, 403);
    }

    const body = await req.json().catch(() => null);
    const targetIdentifier =
      typeof body?.target_identifier === "string" ? body.target_identifier.trim() : "";
    const newPassword = typeof body?.new_password === "string" ? body.new_password : "";

    if (!targetIdentifier) {
      return json({ ok: false, error: "target_identifier is required" }, 400);
    }
    if (newPassword.length < 6) {
      return json({ ok: false, error: "Password must be at least 6 characters" }, 400);
    }

    const { data: targetId, error: resolveError } = await callerClient.rpc("resolve_account_id", {
      p_identifier: targetIdentifier,
    });
    if (resolveError) {
      return json({ ok: false, error: resolveError.message }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      targetId as string,
      { password: newPassword },
    );
    if (updateError) throw updateError;

    return json({ ok: true });
  } catch (err) {
    console.error("admin-reset-password failed", err);
    return json({ ok: false, error: describeError(err) }, 500);
  }
});
