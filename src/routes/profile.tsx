import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { detectHierarchyTier } from "@/lib/agent-hierarchy";
import { useProfile } from "@/lib/profile-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AccountIdBadge } from "@/components/dashboard/AccountIdBadge";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TheBetrix" },
      {
        name: "description",
        content: "Manage your TheBetrix profile: photo, phone number and email.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

interface ProfileRow {
  username: string;
  phone: string | null;
  avatar_url: string | null;
  account_id: string;
}

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { refresh: refreshProfile } = useProfile();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isUltraAdmin, setIsUltraAdmin] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    detectHierarchyTier(user.id)
      .then((tier) => setIsUltraAdmin(tier === "ultra_admin"))
      .catch(() => setIsUltraAdmin(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    supabase
      .from("profiles")
      .select("username, phone, avatar_url, account_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const row = data as ProfileRow;
        setProfile(row);
        setPhone(row.phone ?? "");
      });
  }, [user]);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setError(null);
    setStatus(null);
    setUploading(true);

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);
    setUploading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
    setStatus("Photo updated.");
    void refreshProfile();
  }

  async function handlePhoneSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setStatus(null);
    setSavingPhone(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ phone })
      .eq("id", user.id);
    setSavingPhone(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus("Phone number updated.");
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setStatus(null);
    setSavingEmail(true);
    const { error: updateError } = await supabase.auth.updateUser({ email });
    setSavingEmail(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setStatus(
      "Confirmation links sent — check your old and new inboxes to finish the email change.",
    );
  }

  if (!authLoading && !user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <h1 className="text-xl font-bold text-foreground">Sign in to manage your profile</h1>
          <div className="mt-6 flex justify-center gap-2">
            <Link to="/login">
              <Button variant="outline">Log in</Button>
            </Link>
            <Link to="/register">
              <Button>Sign up</Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <Link
          to="/account"
          className="text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          ← Back to account
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Profile</h1>
        <p className="text-muted-foreground">Update your photo, phone number and email.</p>

        {isUltraAdmin && (
          <Link
            to="/dashboard"
            className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
          >
            <ShieldCheck className="h-4 w-4" />
            Ultra Agent Dashboard
          </Link>
        )}

        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
          <Avatar className="h-16 w-16">
            <AvatarImage
              src={profile?.avatar_url ?? undefined}
              alt={profile?.username ?? "avatar"}
            />
            <AvatarFallback className="text-lg font-bold">
              {(profile?.username ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{profile?.username}</p>
            {profile?.account_id && (
              <AccountIdBadge accountId={profile.account_id} className="mt-1" />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 gap-2"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {uploading ? "Uploading…" : "Change photo"}
            </Button>
          </div>
        </div>

        <form
          onSubmit={handlePhoneSubmit}
          className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <Label htmlFor="phone">Mobile number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 000 0000"
            autoComplete="tel"
          />
          <Button type="submit" size="sm" disabled={savingPhone}>
            {savingPhone ? "Saving…" : "Save phone number"}
          </Button>
        </form>

        <form
          onSubmit={handleEmailSubmit}
          className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-5"
        >
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Button type="submit" size="sm" disabled={savingEmail}>
            {savingEmail ? "Saving…" : "Save email"}
          </Button>
        </form>

        {status && <p className="mt-4 text-sm font-medium text-primary">{status}</p>}
        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}
      </div>
    </main>
  );
}
