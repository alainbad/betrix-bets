import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccountIdBadge({
  accountId,
  className,
}: {
  accountId: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) - the ID is still
      // visible on the badge to copy by hand, nothing else to do here.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 font-mono text-xs font-semibold text-foreground transition-colors hover:border-primary/50",
        className,
      )}
      title="Copy account ID"
    >
      {accountId}
      {copied ? (
        <Check className="h-3 w-3 text-primary" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}
