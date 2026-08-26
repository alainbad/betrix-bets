import { cn } from "@/lib/utils";

// profiles.status check constraint (foundation migration):
// 'active' | 'suspended' | 'restricted' | 'self_excluded' | 'closed'.
// Only rendered when non-active - an "Active" badge on every row everywhere
// would just be noise.
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  if (status === "active") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider",
        status === "suspended"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-500/40 bg-amber-500/10 text-amber-500",
        className,
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
