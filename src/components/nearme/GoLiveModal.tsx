import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  X,
  Radio,
  Globe,
  Lock,
  DollarSign,
  Calendar,
  Clock,
  Sparkles,
} from "lucide-react";

export interface GoLiveData {
  title: string;
  category: string;
  visibility: "public" | "private";
  fee?: number;
  scheduleNow: boolean;
  scheduledAt?: string;
}

interface GoLiveModalProps {
  open: boolean;
  onClose: () => void;
  onGoLive: (data: GoLiveData) => void;
}

const categories = ["Music", "Tech", "Art", "Food", "Wellness", "Fitness", "Education", "Fashion", "Sports"];

const GoLiveModal = ({ open, onClose, onGoLive }: GoLiveModalProps) => {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Music");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [chargeFee, setChargeFee] = useState(false);
  const [fee, setFee] = useState("");
  const [scheduleNow, setScheduleNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState("");

  const reset = () => {
    setTitle("");
    setCategory("Music");
    setVisibility("public");
    setChargeFee(false);
    setFee("");
    setScheduleNow(true);
    setScheduledAt("");
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    if (!scheduleNow && !scheduledAt) return;
    onGoLive({
      title: title.trim(),
      category,
      visibility,
      fee: chargeFee && fee ? parseFloat(fee) : undefined,
      scheduleNow,
      scheduledAt: scheduleNow ? undefined : scheduledAt,
    });
    reset();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="fixed inset-x-3 top-1/2 -translate-y-1/2 max-w-md mx-auto z-50 rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[90dvh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-red">
              <div className="flex items-center gap-2">
                <Radio className="h-5 w-5 text-primary-foreground" />
                <h2 className="text-base font-bold text-primary-foreground">Go Live</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-black/20 transition-colors"
              >
                <X className="h-5 w-5 text-primary-foreground" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Stream Title
                </label>
                <Input
                  placeholder="What's your stream about?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  className="bg-secondary border-none rounded-lg h-10 text-sm"
                />
                <p className="text-[10px] text-muted-foreground text-right">{title.length}/80</p>
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Category
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategory(c)}
                      className={cn(
                        "rounded-full px-3 py-1 text-[11px] font-semibold transition-all border",
                        category === c
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Who can watch?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setVisibility("public")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      visibility === "public"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    )}
                  >
                    <Globe
                      className={cn(
                        "h-4 w-4 mb-1.5",
                        visibility === "public" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <div className="text-xs font-bold">Public</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Anyone can join
                    </div>
                  </button>
                  <button
                    onClick={() => setVisibility("private")}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-all",
                      visibility === "private"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    )}
                  >
                    <Lock
                      className={cn(
                        "h-4 w-4 mb-1.5",
                        visibility === "private" ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <div className="text-xs font-bold">Subscribers</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Only your subscribers
                    </div>
                  </button>
                </div>
              </div>

              {/* Attendance fee */}
              <div className="rounded-xl bg-secondary/50 border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold">Charge attendance fee</span>
                  </div>
                  <button
                    onClick={() => setChargeFee(!chargeFee)}
                    className={cn(
                      "relative h-5 w-9 rounded-full transition-colors",
                      chargeFee ? "bg-primary" : "bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                        chargeFee ? "translate-x-4" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
                {chargeFee && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">
                        R
                      </span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={fee}
                        onChange={(e) => setFee(e.target.value)}
                        className="pl-8 bg-card border-border h-9 rounded-lg text-sm"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Viewers pay this once to join your live stream
                    </p>
                  </div>
                )}
              </div>

              {/* Schedule */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  When?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setScheduleNow(true)}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-all",
                      scheduleNow
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    )}
                  >
                    <Sparkles
                      className={cn(
                        "h-4 w-4 mb-1",
                        scheduleNow ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <div className="text-xs font-bold">Start Now</div>
                  </button>
                  <button
                    onClick={() => setScheduleNow(false)}
                    className={cn(
                      "rounded-xl border p-2.5 text-left transition-all",
                      !scheduleNow
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    )}
                  >
                    <Calendar
                      className={cn(
                        "h-4 w-4 mb-1",
                        !scheduleNow ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                    <div className="text-xs font-bold">Schedule</div>
                  </button>
                </div>
                {!scheduleNow && (
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="bg-secondary border-none rounded-lg h-10 text-sm mt-2"
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border p-3 bg-card">
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || (!scheduleNow && !scheduledAt) || (chargeFee && !fee)}
                className="w-full bg-gradient-red hover:opacity-90 glow text-sm font-bold h-10"
              >
                {scheduleNow ? (
                  <>
                    <Radio className="h-4 w-4 mr-2" />
                    Start Streaming
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Schedule Stream
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default GoLiveModal;
