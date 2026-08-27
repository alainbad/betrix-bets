import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Agent Dashboard — TheBetrix" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  // Required: nested dashboard routes (e.g. /dashboard/users/$accountId) render here.
  return <Outlet />;
}
