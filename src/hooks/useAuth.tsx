import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { reportError, setMonitoringUser } from "@/lib/monitoring";

const LAST_ACTIVE_KEY = "auth:last-active-at";
const MAX_INACTIVE_MS = 10 * 24 * 60 * 60 * 1000;

const now = () => Date.now();

const readLastActive = (): number | null => {
  const raw = window.localStorage.getItem(LAST_ACTIVE_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const writeLastActive = () => {
  window.localStorage.setItem(LAST_ACTIVE_KEY, String(now()));
};

const clearLastActive = () => {
  window.localStorage.removeItem(LAST_ACTIVE_KEY);
};

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Read by the activity listener without making it an effect dependency — having
  // `user` in the dep array tore down and rebuilt the auth subscription on every
  // sign-in/sign-out, and re-ran getSession each time.
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // Ties a reported crash to the account that hit it. Id only — no email.
  useEffect(() => {
    setMonitoringUser(user?.id ?? null);
  }, [user]);

  useEffect(() => {
    // Set listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === "SIGNED_OUT") {
        clearLastActive();
        return;
      }

      if (newSession) {
        writeLastActive();
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session: existing } }) => {
        if (existing) {
          const lastActive = readLastActive();
          if (lastActive && now() - lastActive > MAX_INACTIVE_MS) {
            await supabase.auth.signOut();
            clearLastActive();
            setSession(null);
            setUser(null);
            setLoading(false);
            return;
          }
          writeLastActive();
        }

        setSession(existing);
        setUser(existing?.user ?? null);
        setLoading(false);
      })
      .catch((error) => {
        // Without this the app hangs on a full-page spinner forever whenever Supabase
        // is unreachable (offline, DNS failure, outage). Fail closed instead: treat it
        // as signed out so the user reaches the auth screen rather than a dead loader.
        console.error("Failed to restore auth session:", error);
        reportError(error, { phase: "session-restore" });
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    let lastWrite = 0;
    const onActivity = () => {
      if (!userRef.current) return;
      const ts = now();
      // Throttle writes to once every 15 seconds.
      if (ts - lastWrite < 15000) return;
      writeLastActive();
      lastWrite = ts;
    };

    const events: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "scroll",
      "mousemove",
      "touchstart",
      "focus",
    ];

    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onActivity);

    return () => {
      subscription.unsubscribe();
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      document.removeEventListener("visibilitychange", onActivity);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    clearLastActive();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
