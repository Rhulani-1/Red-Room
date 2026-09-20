import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useSensitivePref, type SensitivePref } from "@/hooks/useSensitivePref";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  disablePush,
  enablePush,
  getPushStatus,
  type PushStatus,
} from "@/lib/push";
import {
  User as UserIcon,
  ShieldCheck,
  Bell,
  Eye,
  EyeOff,
  AlertTriangle,
  KeyRound,
  Lock,
  LogOut,
  Trash2,
  Loader2,
  Globe,
} from "lucide-react";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: () => void;
}

const SENSITIVE_OPTIONS: { value: SensitivePref; label: string; icon: typeof Eye }[] = [
  { value: "hide", label: "Hide", icon: EyeOff },
  { value: "blur", label: "Blur (default)", icon: AlertTriangle },
  { value: "show", label: "Always show", icon: Eye },
];

const TOGGLES_KEY = "red-rxxm:settings";
type Toggles = {
  notifLikes: boolean;
  notifComments: boolean;
  notifFollows: boolean;
  notifMessages: boolean;
  notifLive: boolean;
  privateAccount: boolean;
  showOnlineStatus: boolean;
  shareLocation: boolean;
};
const DEFAULT_TOGGLES: Toggles = {
  notifLikes: true,
  notifComments: true,
  notifFollows: true,
  notifMessages: true,
  notifLive: true,
  privateAccount: false,
  showOnlineStatus: true,
  shareLocation: true,
};

const readToggles = (): Toggles => {
  if (typeof window === "undefined") return DEFAULT_TOGGLES;
  try {
    const raw = window.localStorage.getItem(TOGGLES_KEY);
    return raw ? { ...DEFAULT_TOGGLES, ...JSON.parse(raw) } : DEFAULT_TOGGLES;
  } catch {
    return DEFAULT_TOGGLES;
  }
};

const SectionTitle = ({ icon: Icon, title }: { icon: typeof Eye; title: string }) => (
  <div className="mt-5 mb-2 flex items-center gap-2">
    <Icon className="h-4 w-4 text-primary" />
    <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
  </div>
);

const ToggleRow = ({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card/50 p-2.5">
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      {desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const SettingsSheet = ({ open, onOpenChange, onProfileUpdated }: SettingsSheetProps) => {
  const { user, signOut } = useAuth();
  const [pref, setPref] = useSensitivePref();
  const [toggles, setToggles] = useState<Toggles>(readToggles);

  // Per-device push. Separate from the preference toggles below: those choose which
  // alerts you want, this decides whether this browser receives any at all.
  const [pushStatus, setPushStatus] = useState<PushStatus>("unconfigured");
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    getPushStatus().then(setPushStatus);
  }, [open]);

  const handlePushToggle = async (next: boolean) => {
    setPushBusy(true);
    try {
      const status = next ? await enablePush() : await disablePush();
      setPushStatus(status);
      if (next && status === "denied") {
        toast({
          title: "Notifications blocked",
          description: "Allow notifications for this site in your browser settings.",
          variant: "destructive",
        });
      } else if (next && status === "on") {
        toast({ title: "Notifications enabled on this device" });
      }
    } catch (error) {
      console.error("Push toggle failed:", error);
      setPushStatus(await getPushStatus());
      toast({
        title: "Couldn't change notification settings",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPushBusy(false);
    }
  };

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Account
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, bio, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? "");
      }
      setNewEmail(user.email ?? "");

      const { data: prefRow } = await supabase
        .from("notification_preferences")
        .select("notif_likes, notif_comments, notif_follows, notif_messages, notif_live")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prefRow) {
        setToggles((t) => ({
          ...t,
          notifLikes: prefRow.notif_likes,
          notifComments: prefRow.notif_comments,
          notifFollows: prefRow.notif_follows,
          notifMessages: prefRow.notif_messages,
          notifLive: prefRow.notif_live,
        }));
      } else {
        await supabase.from("notification_preferences").insert({ user_id: user.id });
      }
    })();
  }, [open, user]);

  const NOTIF_DB_COL: Partial<Record<keyof Toggles, string>> = {
    notifLikes: "notif_likes",
    notifComments: "notif_comments",
    notifFollows: "notif_follows",
    notifMessages: "notif_messages",
    notifLive: "notif_live",
  };

  const updateToggle = async (k: keyof Toggles, v: boolean) => {
    const prev = toggles;
    const next = { ...toggles, [k]: v };
    setToggles(next);

    const dbCol = NOTIF_DB_COL[k];
    if (dbCol && user) {
      const updatePatch: Record<string, boolean> = { [dbCol]: v };
      const { error } = await supabase
        .from("notification_preferences")
        .update(updatePatch)
        .eq("user_id", user.id);
      if (error) {
        toast({ title: "Could not save preference", description: error.message, variant: "destructive" });
        setToggles(prev);
      }
    } else {
      try {
        window.localStorage.setItem(TOGGLES_KEY, JSON.stringify(next));
      } catch {
        return;
      }
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        username: username || null,
        bio: bio || null,
        avatar_url: avatarUrl || null,
      })
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Profile updated" });
    onProfileUpdated?.();
  };

  const updateEmail = async () => {
    if (!newEmail || newEmail === user?.email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSavingEmail(false);
    if (error) {
      toast({ title: "Email update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Check your inbox", description: "Confirm the change from both addresses." });
  };

  const updatePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters.", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      toast({ title: "Password update failed", description: error.message, variant: "destructive" });
      return;
    }
    setNewPassword("");
    toast({ title: "Password updated" });
  };

  const handleSignOut = async () => {
    await signOut();
    onOpenChange(false);
  };

  const handleDelete = () => {
    toast({
      title: "Account deletion requested",
      description: "Email support@redroom.space to permanently delete your account.",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="text-gradient text-xl font-extrabold tracking-tight">Settings</SheetTitle>
          <SheetDescription className="text-xs">Manage your profile, privacy, and notifications.</SheetDescription>
        </SheetHeader>

        {/* Edit Profile */}
        <SectionTitle icon={UserIcon} title="Edit profile" />
        <div className="space-y-2.5">
          <div>
            <Label className="text-[11px]">Display name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px]">Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px]">Avatar URL</Label>
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[11px]">Bio</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about you" className="text-sm min-h-[64px]" />
          </div>
          <Button onClick={saveProfile} disabled={savingProfile} className="w-full bg-gradient-red glow h-9 text-xs">
            {savingProfile && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Save profile
          </Button>
        </div>

        {/* Content preferences */}
        <SectionTitle icon={AlertTriangle} title="Sensitive content" />
        <div className="grid grid-cols-3 gap-1.5">
          {SENSITIVE_OPTIONS.map((opt) => {
            const active = pref === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setPref(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-colors",
                  active ? "border-primary bg-primary/10" : "border-border bg-card/50 hover:bg-secondary"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                <span className="text-[10px] font-semibold leading-tight">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Privacy */}
        <SectionTitle icon={Lock} title="Privacy" />
        <div className="space-y-2">
          <ToggleRow
            label="Private account"
            desc="Only approved followers see your posts."
            checked={toggles.privateAccount}
            onChange={(v) => updateToggle("privateAccount", v)}
          />
          <ToggleRow
            label="Show online status"
            desc="Let others see when you're active."
            checked={toggles.showOnlineStatus}
            onChange={(v) => updateToggle("showOnlineStatus", v)}
          />
          <ToggleRow
            label="Share location"
            desc="Required for proximity discovery and Near Me."
            checked={toggles.shareLocation}
            onChange={(v) => updateToggle("shareLocation", v)}
          />
        </div>

        {/* Notifications */}
        <SectionTitle icon={Bell} title="Notifications" />
        <div className="space-y-2">
          {pushStatus !== "unconfigured" && (
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">Notifications on this device</p>
                  <p className="text-[11px] text-muted-foreground">
                    {pushStatus === "unsupported"
                      ? "This browser can't show notifications. On iPhone, add the app to your Home Screen first."
                      : pushStatus === "denied"
                        ? "Blocked. Allow notifications for this site in your browser settings."
                        : pushStatus === "on"
                          ? "This device will receive alerts."
                          : "Get alerts when the app is closed."}
                  </p>
                </div>
                <Switch
                  checked={pushStatus === "on"}
                  disabled={
                    pushBusy || pushStatus === "unsupported" || pushStatus === "denied"
                  }
                  onCheckedChange={handlePushToggle}
                  aria-label="Notifications on this device"
                />
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                The switches below choose which alerts you get. This one controls whether
                this device receives them at all.
              </p>
            </div>
          )}
          <ToggleRow label="Likes" checked={toggles.notifLikes} onChange={(v) => updateToggle("notifLikes", v)} />
          <ToggleRow label="Comments" checked={toggles.notifComments} onChange={(v) => updateToggle("notifComments", v)} />
          <ToggleRow label="New followers" checked={toggles.notifFollows} onChange={(v) => updateToggle("notifFollows", v)} />
          <ToggleRow label="Direct messages" checked={toggles.notifMessages} onChange={(v) => updateToggle("notifMessages", v)} />
          <ToggleRow label="Live & scheduled streams" checked={toggles.notifLive} onChange={(v) => updateToggle("notifLive", v)} />
        </div>

        {/* Account */}
        <SectionTitle icon={ShieldCheck} title="Account" />
        <div className="space-y-2.5">
          <div>
            <Label className="text-[11px] flex items-center gap-1"><Globe className="h-3 w-3" /> Email</Label>
            <div className="flex gap-2">
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} type="email" className="h-9 text-sm" />
              <Button onClick={updateEmail} disabled={savingEmail || newEmail === user?.email} variant="secondary" className="h-9 text-xs">
                {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Update"}
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-[11px] flex items-center gap-1"><KeyRound className="h-3 w-3" /> New password</Label>
            <div className="flex gap-2">
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" placeholder="••••••••" className="h-9 text-sm" />
              <Button onClick={updatePassword} disabled={savingPassword || !newPassword} variant="secondary" className="h-9 text-xs">
                {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Change"}
              </Button>
            </div>
          </div>
        </div>

        <Separator className="my-5" />

        {/* Danger / session */}
        <div className="space-y-2 mb-6">
          <Button onClick={handleSignOut} variant="secondary" className="w-full h-9 text-xs gap-2">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
          <Button onClick={handleDelete} variant="ghost" className="w-full h-9 text-xs gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" /> Delete account
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SettingsSheet;
