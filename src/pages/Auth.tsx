import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Loader2, Mail, Lock, User as UserIcon, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { isValidOAuthRedirect } from "@/lib/env";

const emailSchema = z.string().trim().email({ message: "Invalid email" }).max(255);
const passwordSchema = z
  .string()
  .min(8, { message: "Min 8 characters" })
  .max(72, { message: "Too long" });
const nameSchema = z
  .string()
  .trim()
  .min(2, { message: "Min 2 characters" })
  .max(60, { message: "Too long" });

const Auth = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/", { replace: true });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailParse = emailSchema.safeParse(email);
    const passParse = passwordSchema.safeParse(password);
    if (!emailParse.success) {
      toast({ title: emailParse.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (!passParse.success) {
      toast({ title: passParse.error.errors[0].message, variant: "destructive" });
      return;
    }
    if (mode === "signup") {
      const nameParse = nameSchema.safeParse(displayName);
      if (!nameParse.success) {
        toast({ title: nameParse.error.errors[0].message, variant: "destructive" });
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/`;
        if (!isValidOAuthRedirect(redirectTo)) {
          throw new Error("The email redirect URL is not allowed by the current configuration.");
        }

        const { error } = await supabase.auth.signUp({
          email: emailParse.data,
          password: passParse.data,
          options: {
            emailRedirectTo: redirectTo,
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        toast({
          title: "Check your inbox",
          description: "Confirm your email to start rating and being rated.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailParse.data,
          password: passParse.data,
        });
        if (error) throw error;
        navigate("/", { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast({ title: "Authentication failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleBusy(true);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      if (!isValidOAuthRedirect(redirectTo)) {
        throw new Error("The OAuth redirect URL is not allowed by the current configuration.");
      }

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast({ title: "Sign-in failed", description: msg, variant: "destructive" });
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background text-foreground grid grid-cols-1 lg:grid-cols-2">
      <section className="hidden lg:flex flex-col justify-center px-12 xl:px-20 border-r border-border bg-card/40">
        <div className="max-w-md space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Welcome Back
          </div>
          <h1 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight">
            Sign In To Continue Your RED RXXM Session
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your session stays active between visits. For security, accounts are automatically signed out after 10 days of inactivity.
          </p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border bg-background/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Session Policy</p>
              <p className="text-lg font-bold">10 Days</p>
            </div>
            <div className="rounded-xl border border-border bg-background/70 p-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Auth Methods</p>
              <p className="text-lg font-bold">Google + Email</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-10 sm:px-6">
        <Link to="/auth" className="flex items-center gap-2 mb-8 lg:hidden">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-xl font-black tracking-tight">RED RXXM</span>
        </Link>

        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="m-0">
            <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Pick up where you left off.
            </p>
          </TabsContent>
          <TabsContent value="signup" className="m-0">
            <h1 className="text-2xl font-bold mb-1">Join RED RXXM</h1>
            <p className="text-sm text-muted-foreground mb-5">
              Create your profile to rate and be rated.
            </p>
          </TabsContent>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={googleBusy || busy}
            className="w-full h-11 mb-4 gap-2"
          >
            {googleBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34.5 6.5 29.5 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                <path fill="#4CAF50" d="M24 43.5c5.4 0 10.3-2 14-5.4l-6.5-5.5C29.5 34 26.9 35 24 35c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39 16.2 43.5 24 43.5z"/>
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.6l6.5 5.5c-.5.4 7-5.1 7-15.1 0-1.2-.1-2.3-.4-3.5z"/>
              </svg>
            )}
            Continue with Google
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
              <span className="bg-card px-2 text-muted-foreground">Or with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs">Display name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                    maxLength={60}
                    className="pl-9 h-11"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  maxLength={255}
                  className="pl-9 h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  maxLength={72}
                  className="pl-9 h-11"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={busy || googleBusy}
              className="w-full h-11 bg-gradient-red glow gap-2"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "signup" ? "Create account" : "Sign in"}
            </Button>
          </form>
        </Tabs>

        <p className="mt-5 text-center text-[11px] text-muted-foreground">
          By continuing you agree to our Terms and Privacy Policy.
        </p>
        </div>
      </section>
      </div>
  );
};

export default Auth;
