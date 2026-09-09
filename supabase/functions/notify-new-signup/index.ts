// Emails the current ultra_admin whenever a new player signs up. Triggered
// by a pg_net call from public.notify_admin_of_new_signup() (see
// supabase/migrations/*_signup_admin_notification.sql) - that trigger does
// every bit of DB work (who's the ultra_admin right now, who signed up, who
// referred them) and hands over a finished payload, so this function has no
// database access at all and exists purely to hold the Resend API key and
// make the one outbound call that needs it.
//
// Not a user-facing endpoint: verify_jwt is off (the caller is Postgres,
// not a signed-in user) and instead every request must carry the shared
// x-hook-secret header, checked against the SIGNUP_HOOK_SECRET Edge
// Function secret - the same value the trigger reads out of Supabase Vault.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-hook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface SignupPayload {
  admin_email: string;
  username: string;
  email: string;
  account_id: string;
  referred_by: string | null;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const hookSecret = Deno.env.get("SIGNUP_HOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!hookSecret || !resendApiKey) {
      throw new Error(
        `Missing env vars: SIGNUP_HOOK_SECRET=${!!hookSecret} RESEND_API_KEY=${!!resendApiKey}`,
      );
    }

    if (req.headers.get("x-hook-secret") !== hookSecret) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    const payload = (await req.json().catch(() => null)) as SignupPayload | null;
    if (!payload?.admin_email || !payload.username || !payload.account_id) {
      return json({ ok: false, error: "Malformed signup payload" }, 400);
    }

    const when = new Date(payload.created_at).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#111">New Betrix sign-up</h2>
        <table cellpadding="6" style="border-collapse:collapse;width:100%">
          <tr><td style="color:#666">Username</td><td><b>${escapeHtml(payload.username)}</b></td></tr>
          <tr><td style="color:#666">Account ID</td><td><b>${escapeHtml(payload.account_id)}</b></td></tr>
          <tr><td style="color:#666">Email</td><td>${escapeHtml(payload.email)}</td></tr>
          <tr><td style="color:#666">Referred by</td><td>${payload.referred_by ? escapeHtml(payload.referred_by) : "—"}</td></tr>
          <tr><td style="color:#666">Signed up</td><td>${escapeHtml(when)}</td></tr>
        </table>
      </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Betrix Alerts <onboarding@resend.dev>",
        to: [payload.admin_email],
        subject: `New sign-up: ${payload.username} (${payload.account_id})`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const detail = await resendRes.text().catch(() => "");
      throw new Error(`Resend API ${resendRes.status}: ${detail}`);
    }

    return json({ ok: true });
  } catch (err) {
    console.error("notify-new-signup failed", err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
