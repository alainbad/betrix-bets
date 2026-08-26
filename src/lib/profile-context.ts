import { createContext } from "react";

export interface ProfileContextValue {
  avatarUrl: string | null;
  username: string | null;
  refresh: () => Promise<void>;
}

// Lives in its own module so React Fast Refresh of the provider file does not
// recreate the context identity (same rationale as wallet-context.ts).
export const ProfileContext = createContext<ProfileContextValue | null>(null);
