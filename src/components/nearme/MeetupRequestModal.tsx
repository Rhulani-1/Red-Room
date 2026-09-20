import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Send,
  MapPin,
  FileText,
  DollarSign,
  Shield,
} from "lucide-react";

interface MeetupRequestModalProps {
  user: {
    id: string;
    username: string;
    avatar: string;
    distance: number | null;
    bio: string;
    rate?: number;
    hangoutType: "free" | "paid";
  };
  bidAmount: string;
  onClose: () => void;
  onSend: (purpose: string, bid: string) => void;
}

const MeetupRequestModal = ({ user, bidAmount, onClose, onSend }: MeetupRequestModalProps) => {
  const [purpose, setPurpose] = useState("");
  const [customBid, setCustomBid] = useState(bidAmount);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl bg-card border border-border p-5 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold">Request Meetup</h3>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* User info */}
          <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3">
            <img
              src={user.avatar}
              alt=""
              className="h-12 w-12 rounded-full object-cover ring-2 ring-border"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user.username}</p>
              <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary font-semibold">
              <MapPin className="h-3 w-3" />
              {user.distance === null ? "N/A" : `${user.distance.toFixed(1)} km`}
            </div>
          </div>

          {/* Purpose */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-primary" />
              Purpose of Meetup
            </label>
            <Textarea
              placeholder="Describe what you'd like to do — coffee, networking, collaboration, etc."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="bg-secondary border-none rounded-xl resize-none min-h-[100px] text-sm"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {purpose.length}/500
            </p>
          </div>

          {/* Bid (for paid users) */}
          {user.hangoutType === "paid" && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4 text-primary" />
                Your Offer
              </label>
              {user.rate && (
                <p className="text-xs text-muted-foreground">
                  Their rate: <span className="text-foreground font-semibold">R{user.rate.toFixed(2)}</span> / session
                </p>
              )}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">
                  R
                </span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={customBid}
                  onChange={(e) => setCustomBid(e.target.value)}
                  className="pl-8 bg-secondary border-none h-10 rounded-xl text-sm"
                />
              </div>
            </div>
          )}

          {/* Agreement notice */}
          <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 p-3">
            <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Both parties must confirm the meetup. Once confirmed, the agreement is <span className="text-foreground font-semibold">locked</span> and cannot be deleted until <span className="text-foreground font-semibold">7 days</span> after the session.
            </p>
          </div>

          {/* Send button */}
          <Button
            onClick={() => onSend(purpose, customBid)}
            disabled={!purpose.trim()}
            className="w-full bg-gradient-red hover:opacity-90 glow text-sm font-semibold"
          >
            <Send className="h-4 w-4 mr-2" />
            Send Request
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MeetupRequestModal;
