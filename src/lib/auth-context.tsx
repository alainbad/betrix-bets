import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthResult {
  error: string | null;
}

interface SignUpResult extends AuthResult {
  needsEmailConfirmation: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    username: string,
    referralCode: string,
  ) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signInWithOAuth: (provider: "google" | "apple", referralCode?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (newPassword: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signUp(
    email: string,
    password: string,
    username: string,
    referralCode: string,
  ): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, referral_code: referralCode } },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };
    return { error: null, needsEmailConfirmation: !data.session };
  }

  async function signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signInWithOAuth(
    provider: "google" | "apple",
    referralCode?: string,
  ): Promise<AuthResult> {
    // Google/Apple sign-in can't carry our own signup metadata into the new
    // auth.users row - GoTrue creates it directly from the provider's
    // profile. So a referral code (required for brand-new signups) is
    // staked out as a short-lived claim first, validated up front, and
    // redeemed once back in the app with a live session - see
    // src/routes/auth.callback.tsx.
    let claimId: string | null = null;
    if (referralCode) {
      const { data, error } = await supabase.rpc("create_pending_referral_claim", {
        _referral_code: referralCode,
      });
      if (error) return { error: error.message };
      claimId = data as string;
    }

    const redirectTo = new URL("/auth/callback", window.location.origin);
    if (claimId) redirectTo.searchParams.set("claim", claimId);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectTo.toString() },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string): Promise<AuthResult> {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
    return { error: error?.message ?? null };
  }

  async function updatePassword(newPassword: string): Promise<AuthResult> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        signUp,
        signIn,
        signInWithOAuth,
        signOut,
        sendPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
