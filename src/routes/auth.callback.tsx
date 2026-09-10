import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";

interface CallbackSearch {
  claim?: string | undefined;
}

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearch => ({
    claim: typeof search["claim"] === "string" ? search["claim"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Signing in — TheBetrix" }, { name: "robots", content: "noindex" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { user, loading } = useAuth();
  const { claim } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (loading || ran.current) return;
    ran.current = true;

    if (!user) {
      setError("Sign-in was cancelled or failed. Please try again.");
      return;
    }

    (async () => {
      if (claim) {
        const { error: claimError } = await supabase.rpc("claim_pending_referral", {
          _claim_id: claim,
        });
        if (claimError) {
          await supabase.auth.signOut();
          setError(claimError.message);
          return;
        }
        navigate({ to: "/account" });
        return;
      }

      // No claim - either an existing player logging back in (already has
      // a referrer), or a brand-new visitor who hit "Continue with Google"
      // straight from the login page without ever entering a code. Only
      // the latter needs turning away, so check which one this is.
      const { data: profile } = await supabase
        .from("profiles")
        .select("parent_id")
        .eq("id", user.id)
        .single();

      if (!profile?.parent_id) {
        await supabase.auth.signOut();
        setError("A referral code is required to sign up. Please register with a code first.");
        return;
      }

      navigate({ to: "/account" });
    })();
  }, [loading, user, claim, navigate]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Sign-in failed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link
            to="/register"
            className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Back to registration
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </main>
  );
}
