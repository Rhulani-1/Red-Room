import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Heart,
  Lock,
  Radio,
  Send,
  Share2,
  Sparkles,
  Users,
  Loader2,
  Pin,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { checkContentUnlocked, createPayFastPayment } from "@/lib/payfast";

interface ChatMessage {
  id: string;
  user: string;
  avatar: string;
  text: string;
  isHost?: boolean;
  isSystem?: boolean;
  tipAmount?: number;
}

const TIP_AMOUNTS = [10, 20, 50] as const;
const TIP_DURATION_MS = 15000; // pinned for 15s

// Mock stream metadata — should be replaced with real database query
const mockStreamMeta: Record<
  string,
  {
    username: string;
    avatar: string;
    title: string;
    category: string;
    fee?: number;
    isPaid: boolean;
  }
> = {
  // NOTE: For production, replace with live_streams table query
  // Kept minimal to avoid fake user experience with bot messages
};

const seedChat: ChatMessage[] = []; // Start with empty messages, load from database

const autoChatPool = [
  "🔥🔥🔥",
  "Sending love from Cape Town",
  "How long you been doing this?",
  "Drop the link please!",
  "First time here, loving it 💯",
  "Can you do that again?",
  "🙌🙌🙌",
  "Bro this is gold",
  "Repping Durban 🌴",
  "Quality content as always",
];

const LiveRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const meta = useMemo(
    () =>
      (id && mockStreamMeta[id]) || {
        username: "host",
        avatar: "https://i.pravatar.cc/100?img=30",
        title: "Live stream",
        category: "Live",
        isPaid: false,
      },
    [id]
  );

  const [checking, setChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [viewers, setViewers] = useState(0); // Real viewer count from realtime DB
  const [likes, setLikes] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pinnedTips, setPinnedTips] = useState<ChatMessage[]>([]);
  const [tipping, setTipping] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Access check
  useEffect(() => {
    let active = true;
    (async () => {
      if (!meta.isPaid) {
        if (active) {
          setHasAccess(true);
          setChecking(false);
        }
        return;
      }
      const unlocked = await checkContentUnlocked(id ?? "");
      if (active) {
        setHasAccess(unlocked);
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, meta.isPaid]);

  // Viewer count drift — DISABLED: Remove fake incrementing
  // In production, subscribe to live_stream_viewers realtime channel
  // useEffect(() => {
  //   if (!hasAccess) return;
  //   const t = setInterval(() => {
  //     setViewers((v) => Math.max(50, v + Math.floor(Math.random() * 11) - 4));
  //   }, 3500);
  //   return () => clearInterval(t);
  // }, [hasAccess]);

  // Auto chat — DISABLED: Remove fake bot messages
  // In production, subscribe to live_stream_messages with real user messages only
  // useEffect(() => {
  //   if (!hasAccess) return;
  //   const t = setInterval(() => {
  //     const text = autoChatPool[Math.floor(Math.random() * autoChatPool.length)];
  //     const idx = Math.floor(Math.random() * 30) + 1;
  //     setMessages((m) => [
  //       ...m,
  //       {
  //         id: `auto-${Date.now()}-${Math.random()}`,
  //         user: `user_${idx}`,
  //         avatar: `https://i.pravatar.cc/40?img=${idx}`,
  //         text,
  //       },
  //     ]);
  //   }, 4500);
  //   return () => clearInterval(t);
  // }, [hasAccess]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [
      ...m,
      {
        id: `me-${Date.now()}`,
        user: "you",
        avatar: "https://i.pravatar.cc/40?img=30",
        text,
      },
    ]);
    setInput("");
  };

  const pinTip = (tip: ChatMessage) => {
    setMessages((m) => [...m, tip]);
    setPinnedTips((p) => [...p, tip]);
    setTimeout(() => {
      setPinnedTips((p) => p.filter((t) => t.id !== tip.id));
    }, TIP_DURATION_MS);
  };

  const handleTip = async (amount: number) => {
    if (!hasAccess || tipping !== null || !id) return;
    setTipping(amount);
    try {
      const text = input.trim() || `Tipped R${amount} 🚀`;
      const tipContentId = `tip-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      // Stash so we can pin after the PayFast redirect returns
      sessionStorage.setItem(
        `pendingTip:${tipContentId}`,
        JSON.stringify({ streamId: id, amount, text, createdAt: Date.now() }),
      );
      const { redirectUrl } = await createPayFastPayment({
        contentId: tipContentId,
        amount,
        itemName: `Super Chat R${amount} — @${meta.username} live`,
        paymentType: "once_off",
        creatorId: id,
      });
      setInput("");
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Couldn't start tip";
      toast({ title: "Tip failed", description: msg, variant: "destructive" });
      setTipping(null);
    }
  };

  // Hydrate any pending super-chat tip after returning from PayFast
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const keys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith("pendingTip:")) keys.push(k);
      }
      for (const key of keys) {
        const raw = sessionStorage.getItem(key);
        if (!raw) continue;
        let parsed: { streamId: string; amount: number; text: string; createdAt: number };
        try {
          parsed = JSON.parse(raw);
        } catch {
          sessionStorage.removeItem(key);
          continue;
        }
        // expire stale tips after 30 min
        if (Date.now() - parsed.createdAt > 30 * 60 * 1000) {
          sessionStorage.removeItem(key);
          continue;
        }
        if (parsed.streamId !== id) continue;
        const tipContentId = key.slice("pendingTip:".length);
        const unlocked = await checkContentUnlocked(tipContentId);
        if (cancelled) return;
        if (unlocked) {
          pinTip({
            id: tipContentId,
            user: "you",
            avatar: "https://i.pravatar.cc/40?img=30",
            text: parsed.text,
            tipAmount: parsed.amount,
          });
          sessionStorage.removeItem(key);
          toast({
            title: `R${parsed.amount} super-chat sent 🎉`,
            description: "Your tip is pinned for everyone.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  const handleUnlock = async () => {
    if (!id || !meta.fee) return;
    setUnlocking(true);
    try {
      const { redirectUrl } = await createPayFastPayment({
        contentId: id,
        amount: meta.fee,
        itemName: `Attendance fee — @${meta.username} live`,
        paymentType: "once_off",
        creatorId: id,
      });
      window.location.href = redirectUrl;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Payment failed";
      toast({ title: "Couldn't start payment", description: msg, variant: "destructive" });
      setUnlocking(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: meta.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Share it anywhere." });
      }
    } catch {
      /* user cancelled */
    }
  };

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      {/* Immersive page with no app chrome, so safe-area insets are the only thing
          keeping this clear of the notch. */}
      <header className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2.5 pl-safe-l pr-safe-r pt-[calc(0.625rem+var(--sa-t))] bg-background/80 backdrop-blur border-b border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate(-1)}
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <img
          src={meta.avatar}
          alt={meta.username}
          className="h-8 w-8 rounded-full object-cover ring-2 ring-primary"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold truncate">@{meta.username}</span>
            <Badge className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0 h-4 gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{meta.title}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShare} aria-label="Share">
          <Share2 className="h-4 w-4" />
        </Button>
      </header>

      {/* Layout: video on top (mobile) or left (desktop), chat below/right */}
      <div className="flex-1 flex flex-col lg:flex-row lg:gap-3 lg:p-3">
        {/* Video Player */}
        <div className="relative lg:flex-1 lg:rounded-2xl overflow-hidden bg-black">
          <div className="relative aspect-video lg:aspect-auto lg:h-full w-full bg-black">
            {/* Mock animated background as video stand-in */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.4),transparent_60%),radial-gradient(circle_at_70%_70%,hsl(var(--primary)/0.25),transparent_55%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.5)_100%)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              {hasAccess ? (
                <div className="flex flex-col items-center gap-2 text-primary-foreground/90">
                  <div className="relative">
                    <Radio className="h-12 w-12 animate-pulse" />
                    <span className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse" />
                  </div>
                  <span className="text-xs font-semibold tracking-wider opacity-80">
                    LIVE STREAM
                  </span>
                </div>
              ) : (
                <PaywallScreen
                  username={meta.username}
                  fee={meta.fee ?? 0}
                  unlocking={unlocking}
                  onUnlock={handleUnlock}
                />
              )}
            </div>

            {/* Top overlay: live + viewers */}
            {hasAccess && (
              <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 rounded-full bg-primary/90 backdrop-blur px-2.5 py-1 text-[10px] font-bold text-primary-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-white">
                  <Eye className="h-3 w-3" /> {viewers.toLocaleString()}
                </div>
              </div>
            )}

            {/* Bottom overlay: floating reactions */}
            {hasAccess && (
              <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
                <button
                  onClick={() => setLikes((l) => l + 1)}
                  className="group h-11 w-11 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-primary/80 transition-colors"
                  aria-label="Like"
                >
                  <Heart className="h-5 w-5 text-white group-hover:fill-white" />
                </button>
                {likes > 0 && (
                  <span className="rounded-full bg-black/50 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-white">
                    {likes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <aside className="flex flex-col lg:w-96 lg:rounded-2xl lg:border lg:border-border lg:bg-card overflow-hidden flex-1 lg:flex-none lg:max-h-[calc(100dvh-var(--app-header-total))]">
          <div className="hidden lg:flex items-center gap-2 px-3 py-2.5 border-b border-border">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold">Live Chat</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              {viewers.toLocaleString()} watching
            </span>
          </div>

          {/* Pinned super-chats */}
          {pinnedTips.length > 0 && (
            <div className="border-b border-border bg-gradient-to-b from-primary/10 to-transparent px-2 py-2 space-y-1.5">
              <AnimatePresence initial={false}>
                {pinnedTips.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.9, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="rounded-xl bg-gradient-red glow px-3 py-2 text-primary-foreground shadow-lg"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-90">
                      <Pin className="h-3 w-3" />
                      Super Chat • R{t.tipAmount}
                    </div>
                    <div className="flex items-start gap-2 mt-1">
                      <img
                        src={t.avatar}
                        alt={t.user}
                        className="h-6 w-6 rounded-full object-cover ring-2 ring-white/40"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold opacity-95">@{t.user}</div>
                        <p className="text-[13px] leading-snug break-words">{t.text}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-[200px]">
            <AnimatePresence initial={false}>
              {messages.slice(-50).map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "flex items-start gap-2 text-sm",
                    m.isSystem && "justify-center"
                  )}
                >
                  {m.isSystem ? (
                    <div className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 px-2.5 py-0.5 text-[11px] text-primary">
                      <Sparkles className="h-3 w-3" />
                      {m.text}
                    </div>
                  ) : m.tipAmount ? (
                    <div className="w-full rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                        <Zap className="h-3 w-3 fill-primary" />
                        @{m.user} tipped R{m.tipAmount}
                      </div>
                      <p className="text-[13px] leading-snug break-words mt-0.5">{m.text}</p>
                    </div>
                  ) : (
                    <>
                      <img
                        src={m.avatar}
                        alt={m.user}
                        className="h-6 w-6 rounded-full object-cover flex-shrink-0 mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[11px] font-bold truncate",
                              m.isHost ? "text-primary" : "text-muted-foreground"
                            )}
                          >
                            @{m.user}
                          </span>
                          {m.isHost && (
                            <Badge
                              variant="outline"
                              className="text-[8px] px-1 py-0 h-3.5 border-primary/40 text-primary"
                            >
                              HOST
                            </Badge>
                          )}
                        </div>
                        <p className="text-[13px] leading-snug break-words">{m.text}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border bg-background px-2 pt-2 flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-1">
              Tip
            </span>
            {TIP_AMOUNTS.map((amt) => (
              <Button
                key={amt}
                type="button"
                size="sm"
                variant="outline"
                disabled={!hasAccess || tipping !== null}
                onClick={() => handleTip(amt)}
                className="h-7 px-2.5 rounded-full text-[11px] font-bold border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground gap-1"
              >
                {tipping === amt ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Zap className="h-3 w-3 fill-current" />
                )}
                R{amt}
              </Button>
            ))}
          </div>

          <form
            onSubmit={handleSend}
            className="border-t border-border p-2 flex items-center gap-2 bg-background"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={hasAccess ? "Say something…" : "Unlock to chat"}
              disabled={!hasAccess}
              className="h-9 text-sm rounded-full bg-secondary border-0"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!hasAccess || !input.trim()}
              className="h-9 w-9 rounded-full bg-gradient-red glow flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </aside>
      </div>
    </div>
  );
};

const PaywallScreen = ({
  username,
  fee,
  unlocking,
  onUnlock,
}: {
  username: string;
  fee: number;
  unlocking: boolean;
  onUnlock: () => void;
}) => (
  <div className="text-center px-6 py-8 max-w-sm">
    <div className="mx-auto h-14 w-14 rounded-full bg-primary/20 backdrop-blur flex items-center justify-center ring-2 ring-primary/40">
      <Lock className="h-6 w-6 text-primary-foreground" />
    </div>
    <h2 className="mt-4 text-lg font-bold text-primary-foreground">
      This stream is locked
    </h2>
    <p className="mt-1 text-xs text-primary-foreground/70">
      Pay the attendance fee to join @{username}'s live session.
    </p>
    <Button
      onClick={onUnlock}
      disabled={unlocking}
      className="mt-5 w-full bg-gradient-red glow gap-1.5"
    >
      {unlocking ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
        </>
      ) : (
        <>Pay R{fee} to Join</>
      )}
    </Button>
  </div>
);

export default LiveRoom;
