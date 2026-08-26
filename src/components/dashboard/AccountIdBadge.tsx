import { CopyBadge } from "@/components/dashboard/CopyBadge";

export function AccountIdBadge({
  accountId,
  className,
}: {
  accountId: string;
  className?: string;
}) {
  return <CopyBadge value={accountId} title="Copy account ID" className={className} />;
}
