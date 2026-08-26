import { useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { supabase } from "./supabase";
import { ProfileContext } from "./profile-context";

// Small, header-facing slice of the profile row (avatar + username) kept in
// its own store rather than folded into auth-context - auth.users has no
// avatar_url/username of its own, that lives in public.profiles, and unlike
// the auth session this needs an explicit refresh() so profile.tsx can push
// a newly-uploaded photo out to the Header immediately, same pattern as
// wallet-store's refresh() after a balance-changing action.
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setAvatarUrl(null);
      setUsername(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, username")
      .eq("id", user.id)
      .single();
    setAvatarUrl((data?.avatar_url as string | null) ?? null);
    setUsername((data?.username as string | null) ?? null);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ProfileContext.Provider value={{ avatarUrl, username, refresh }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}
