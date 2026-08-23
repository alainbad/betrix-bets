import { createFileRoute, redirect } from "@tanstack/react-router";

// The site is casino-only - /casino is the whole app, so send the homepage
// straight there instead of duplicating a landing page.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/casino" });
  },
});
