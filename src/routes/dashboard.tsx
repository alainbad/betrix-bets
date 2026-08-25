import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { detectHierarchyTier, type HierarchyTier } from "@/lib/agent-hierarchy";
import { UltraAdminView } from "@/components/dashboard/UltraAdminView";
import { SuperAgentView } from "@/components/dashboard/SuperAgentView";
import { AgentView } from "@/components/dashboard/AgentView";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Agent Dashboard — TheBetrix" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [tier, setTier] = useState<HierarchyTier | null | "loading">("loading");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTier(null);
      return;
    }
    detectHierarchyTier(user.id)
      .then(setTier)
      .catch(() => setTier(null));
  }, [authLoading, user]);

  if (authLoading || tier === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </main>
    );
  }

  if (!tier) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Access denied</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This dashboard is restricted to the agent hierarchy (ultra_admin, super_agent, agent).
          </p>
        </div>
      </main>
    );
  }

  if (tier === "ultra_admin") return <UltraAdminView />;
  if (tier === "super_agent") return <SuperAgentView />;
  return <AgentView />;
}
