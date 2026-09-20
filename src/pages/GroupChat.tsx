import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Image as ImageIcon, Mic, Smile, Reply, X, MoreVertical, Trash2, UserMinus, VolumeX, Volume2, Crown, Loader2, Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Group {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
}

interface Message {
  id: string;
  group_id: string;
  author_id: string;
  body: string | null;
  media_url: string | null;
  media_type: "none" | "image" | "video" | "voice";
  reply_to_id: string | null;
  deleted_at: string | null;
  created_at: string;
}

interface Member {
  user_id: string;
  role: "owner" | "admin" | "member";
  muted: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

const REACTIONS = ["❤️", "🔥", "😂", "😮", "😢", "👏"];

const SignedMedia = ({ path, kind }: { path: string; kind: "image" | "video" | "voice" }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Backward compat: if it's already a full URL, use it directly.
    if (/^https?:\/\//i.test(path)) {
      setUrl(path);
      return;
    }
    supabase.storage
      .from("group-media")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!url) return <div className="mb-1 h-32 w-full animate-pulse rounded-lg bg-muted" />;
  if (kind === "image") return <img src={url} alt="" className="mb-1 max-h-64 rounded-lg object-cover" />;
  if (kind === "video") return <video src={url} controls className="mb-1 max-h-64 rounded-lg" />;
  return <audio src={url} controls className="mb-1 w-full" />;
};

const GroupChat = () => {
  const { id: groupId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const myRole = members.find((m) => m.user_id === user?.id)?.role;
  const isAdmin = myRole === "owner" || myRole === "admin";

  const loadAll = useCallback(async () => {
    if (!groupId || !user) return;
    setLoading(true);
    const [{ data: g }, { data: msgsWithReacts }, { data: mems }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).single(),
      supabase
        .from("group_messages")
        .select("*, group_message_reactions(*)")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase.from("group_members").select("user_id, role, muted").eq("group_id", groupId),
    ]);

    if (!g) {
      toast.error("Group not found or no access");
      navigate("/groups");
      return;
    }

    // Split messages and reactions from the embedded result
    const msgs: Message[] = (msgsWithReacts ?? []).map(({ group_message_reactions: _r, ...m }) => m as Message);
    const reacts: Reaction[] = (msgsWithReacts ?? []).flatMap(
      (m: { group_message_reactions?: Reaction[] }) => m.group_message_reactions ?? []
    );

    // Enrich members with profiles
    const userIds = (mems ?? []).map((m) => m.user_id);
    const { data: profiles } = userIds.length
      ? await supabase
          .from("profiles")
          .select("user_id, display_name, avatar_url")
          .in("user_id", userIds)
      : { data: [] as Array<{ user_id: string; display_name: string | null; avatar_url: string | null }> };

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) ?? []);
    const enriched: Member[] = (mems ?? []).map((m) => ({
      ...m,
      display_name: profileMap.get(m.user_id)?.display_name,
      avatar_url: profileMap.get(m.user_id)?.avatar_url,
    }));

    setGroup(g as Group);
    setMessages(msgs);
    setMembers(enriched);
    setReactions(reacts);
    setLoading(false);
  }, [groupId, user, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime subscriptions with event dedupe
  const seenEventsRef = useRef<Map<string, number>>(new Map());

  const isDuplicate = useCallback((key: string) => {
    const now = Date.now();
    const seen = seenEventsRef.current;
    if (seen.has(key)) return true;
    seen.set(key, now);
    // Sliding window: drop entries older than 30s, cap size at 500
    if (seen.size > 500) {
      const cutoff = now - 30_000;
      for (const [k, ts] of seen) {
        if (ts < cutoff) seen.delete(k);
        if (seen.size <= 400) break;
      }
    }
    return false;
  }, []);

  // Batched flush of realtime events (~80ms window)
  const pendingRef = useRef({
    msgUpserts: new Map<string, Message>(),
    msgDeletes: new Set<string>(),
    reactInserts: new Map<string, Reaction>(),
    reactDeletes: new Set<string>(),
  });
  const flushTimerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    flushTimerRef.current = null;
    const p = pendingRef.current;

    if (p.msgUpserts.size || p.msgDeletes.size) {
      const upserts = Array.from(p.msgUpserts.values());
      const deletes = p.msgDeletes;
      p.msgUpserts = new Map();
      p.msgDeletes = new Set();

      setMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        for (const m of upserts) map.set(m.id, m);
        for (const id of deletes) map.delete(id);
        return Array.from(map.values()).sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
    }

    if (p.reactInserts.size || p.reactDeletes.size) {
      const inserts = Array.from(p.reactInserts.values());
      const deletes = p.reactDeletes;
      p.reactInserts = new Map();
      p.reactDeletes = new Set();

      setReactions((prev) => {
        const map = new Map(prev.map((r) => [r.id, r]));
        for (const r of inserts) map.set(r.id, r);
        for (const id of deletes) map.delete(id);
        return Array.from(map.values());
      });
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current != null) return;
    flushTimerRef.current = window.setTimeout(flush, 80);
  }, [flush]);

  useEffect(() => {
    if (!groupId) return;
    const dedupeKey = (
      table: string,
      event: string,
      row: { id?: string; updated_at?: string; created_at?: string }
    ) => `${table}:${event}:${row.id}:${row.updated_at ?? row.created_at ?? ""}`;

    const channel = supabase
      .channel(`group-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as Message;
          if (isDuplicate(dedupeKey("group_messages", "INSERT", m))) return;
          pendingRef.current.msgUpserts.set(m.id, m);
          pendingRef.current.msgDeletes.delete(m.id);
          scheduleFlush();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.new as Message;
          if (isDuplicate(dedupeKey("group_messages", "UPDATE", m))) return;
          pendingRef.current.msgUpserts.set(m.id, m);
          scheduleFlush();
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const m = payload.old as Message;
          if (!m.id || isDuplicate(dedupeKey("group_messages", "DELETE", m))) return;
          pendingRef.current.msgUpserts.delete(m.id);
          pendingRef.current.msgDeletes.add(m.id);
          scheduleFlush();
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          if (isDuplicate(dedupeKey("group_message_reactions", "INSERT", r))) return;
          pendingRef.current.reactInserts.set(r.id, r);
          pendingRef.current.reactDeletes.delete(r.id);
          scheduleFlush();
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_message_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          if (!r.id || isDuplicate(dedupeKey("group_message_reactions", "DELETE", r))) return;
          pendingRef.current.reactInserts.delete(r.id);
          pendingRef.current.reactDeletes.add(r.id);
          scheduleFlush();
        })
      .subscribe();
    return () => {
      if (flushTimerRef.current != null) {
        clearTimeout(flushTimerRef.current);
        flush();
      }
      supabase.removeChannel(channel);
    };
  }, [groupId, isDuplicate, scheduleFlush, flush]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark last message read
  useEffect(() => {
    if (!user || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.author_id !== user.id) {
      supabase.from("group_message_reads").upsert({ message_id: last.id, user_id: user.id }, { onConflict: "message_id,user_id" });
    }
  }, [messages, user]);

  const sendMessage = async (overrides?: Partial<Message>) => {
    if (!user || !groupId) return;
    const body = overrides?.body ?? text.trim();
    if (!body && !overrides?.media_url) return;
    setSending(true);
    const { error } = await supabase.from("group_messages").insert({
      group_id: groupId,
      author_id: user.id,
      body: body || null,
      media_url: overrides?.media_url ?? null,
      media_type: overrides?.media_type ?? "none",
      reply_to_id: replyTo?.id ?? null,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
    setReplyTo(null);
  };

  const uploadFile = async (file: File, type: "image" | "video" | "voice") => {
    if (!user || !groupId) return;
    const ext = file.name.split(".").pop() || (type === "voice" ? "webm" : "bin");
    const path = `${user.id}/${groupId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("group-media").upload(path, file, { upsert: false, contentType: file.type });
    if (error) {
      toast.error("Upload failed");
      return;
    }
    // Store the storage path; signed URLs are generated at render time (bucket is private).
    await sendMessage({ media_url: path, media_type: type, body: null });
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const type: "image" | "video" = f.type.startsWith("video") ? "video" : "image";
    uploadFile(f, type);
    e.target.value = "";
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        await uploadFile(file, "voice");
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.message_id === messageId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("group_message_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("group_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    }
  };

  const deleteMessage = async (m: Message) => {
    await supabase.from("group_messages").delete().eq("id", m.id);
  };

  const removeMember = async (uid: string) => {
    if (!groupId) return;
    await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", uid);
    toast.success("Member removed");
    loadAll();
  };

  const toggleMute = async (m: Member) => {
    if (!groupId) return;
    await supabase.from("group_members").update({ muted: !m.muted }).eq("group_id", groupId).eq("user_id", m.user_id);
    loadAll();
  };

  const memberMap = new Map(members.map((m) => [m.user_id, m]));
  const reactionsByMsg = reactions.reduce<Record<string, Reaction[]>>((acc, r) => {
    (acc[r.message_id] ??= []).push(r);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex h-full min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) return null;

  return (
    // h-full inside the shell's h-dvh chat wrapper; mx-auto caps the conversation
    // column so bubbles don't span a 1920px screen.
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card/50 px-4 py-3 pt-safe-t backdrop-blur-xl">
        <button onClick={() => navigate("/groups")}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-ember">
          <Crown className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">{group.name}</p>
          <p className="text-[11px] text-muted-foreground">{members.length} member{members.length !== 1 && "s"}</p>
        </div>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 text-[11px] font-bold uppercase text-muted-foreground">Members</div>
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center justify-between gap-2 px-2 py-1.5">
                  <span className="truncate text-xs">{m.display_name ?? "User"} {m.role !== "member" && <span className="text-primary">·{m.role}</span>}</span>
                  <div className="flex gap-1">
                    <button onClick={() => toggleMute(m)} className="rounded p-1 hover:bg-secondary">
                      {m.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                    </button>
                    {m.user_id !== group.creator_id && m.user_id !== user?.id && (
                      <button onClick={() => removeMember(m.user_id)} className="rounded p-1 hover:bg-secondary">
                        <UserMinus className="h-3 w-3 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Start the conversation 🔥</p>
        ) : (
          messages.map((m) => {
            const isMine = m.author_id === user?.id;
            const author = memberMap.get(m.author_id);
            const replyMsg = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
            const msgReactions = reactionsByMsg[m.id] ?? [];
            const grouped = msgReactions.reduce<Record<string, number>>((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
              return acc;
            }, {});

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex gap-2", isMine && "flex-row-reverse")}
              >
                {!isMine && (
                  <img
                    src={author?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${m.author_id}`}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                  />
                )}
                <div className={cn("group max-w-[85%] space-y-1 sm:max-w-[70%] lg:max-w-[560px]", isMine && "items-end")}>
                  {!isMine && <p className="text-[11px] text-muted-foreground px-1">{author?.display_name ?? "User"}</p>}
                  <div className={cn(
                    "rounded-2xl px-3 py-2",
                    isMine ? "bg-gradient-ember text-primary-foreground" : "bg-card border border-border"
                  )}>
                    {replyMsg && (
                      <div className="mb-1.5 rounded-lg border-l-2 border-primary bg-background/30 px-2 py-1 text-[11px] opacity-80">
                        <p className="font-semibold">{memberMap.get(replyMsg.author_id)?.display_name ?? "User"}</p>
                        <p className="line-clamp-1">{replyMsg.body || "[media]"}</p>
                      </div>
                    )}
                    {m.media_type === "image" && m.media_url && (
                      <SignedMedia path={m.media_url} kind="image" />
                    )}
                    {m.media_type === "video" && m.media_url && (
                      <SignedMedia path={m.media_url} kind="video" />
                    )}
                    {m.media_type === "voice" && m.media_url && (
                      <SignedMedia path={m.media_url} kind="voice" />
                    )}
                    {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                    <div className={cn("mt-1 flex items-center gap-1 text-[10px]", isMine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {isMine && <CheckCheck className="h-3 w-3" />}
                    </div>
                  </div>

                  {Object.keys(grouped).length > 0 && (
                    <div className={cn("flex flex-wrap gap-1", isMine && "justify-end")}>
                      {Object.entries(grouped).map(([emoji, count]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(m.id, emoji)}
                          className="rounded-full bg-card border border-border px-1.5 py-0.5 text-[11px]"
                        >
                          {emoji} {count}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={cn("flex gap-1 opacity-0 transition-opacity group-hover:opacity-100", isMine && "justify-end")}>
                    {REACTIONS.map((e) => (
                      <button key={e} onClick={() => toggleReaction(m.id, e)} className="text-xs hover:scale-125 transition-transform">{e}</button>
                    ))}
                    <button onClick={() => setReplyTo(m)} className="text-muted-foreground"><Reply className="h-3 w-3" /></button>
                    {(isMine || isAdmin) && (
                      <button onClick={() => deleteMessage(m)} className="text-destructive"><Trash2 className="h-3 w-3" /></button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-card/50 px-4 py-2"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-primary">Replying to {memberMap.get(replyTo.author_id)?.display_name ?? "User"}</p>
                <p className="truncate text-xs text-muted-foreground">{replyTo.body || "[media]"}</p>
              </div>
              <button onClick={() => setReplyTo(null)}><X className="h-4 w-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      {/* pb-safe-b: the send button otherwise sits on the iPhone home indicator */}
      <footer className="border-t border-border bg-card/50 p-3 pb-[calc(0.75rem+var(--sa-b))] backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
            <ImageIcon className="h-4 w-4" />
          </Button>
          {recording ? (
            <Button size="icon" variant="destructive" onClick={stopRecording}>
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={startRecording}>
              <Mic className="h-4 w-4" />
            </Button>
          )}
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={recording ? "Recording..." : "Message"}
            disabled={recording}
            className="flex-1"
          />
          <Button onClick={() => sendMessage()} disabled={sending || (!text.trim() && !recording)} className="bg-gradient-ember glow" size="icon">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default GroupChat;
