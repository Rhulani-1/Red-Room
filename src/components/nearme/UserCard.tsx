import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  DollarSign,
  Eye,
  EyeOff,
  Send,
  Handshake,
  Crown,
  FileText,
} from "lucide-react";

interface UserCardProps {
  user: {
    id: string;
    username: string;
    avatar: string;
    distance: number | null;
    bio: string;
    availability: "public" | "private";
    hangoutType: "free" | "paid";
    rate?: number;
    purpose?: string;
    location?: string;
  };
  index: number;
  bidAmount: string;
  hasSentBid: boolean;
  onSendBid: () => void;
  onConnect: () => void;
}

const UserCard = ({ user, index, bidAmount, hasSentBid, onSendBid, onConnect }: UserCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl bg-card border border-border p-4 space-y-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img
              src={user.avatar}
              alt=""
              className="h-14 w-14 rounded-full object-cover ring-2 ring-border"
            />
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card",
                user.availability === "public" ? "bg-green-500" : "bg-amber-500"
              )}
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-sm font-bold">{user.username}</p>
            <p className="text-xs text-muted-foreground">{user.bio}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] gap-1",
                  user.availability === "public"
                    ? "bg-green-500/15 text-green-400 border-green-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                )}
              >
                {user.availability === "public" ? (
                  <Eye className="h-2.5 w-2.5" />
                ) : (
                  <EyeOff className="h-2.5 w-2.5" />
                )}
                {user.availability}
              </Badge>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] gap-1",
                  user.hangoutType === "free"
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                )}
              >
                {user.hangoutType === "free" ? (
                  <Handshake className="h-2.5 w-2.5" />
                ) : (
                  <Crown className="h-2.5 w-2.5" />
                )}
                {user.hangoutType}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1 text-xs text-primary font-semibold">
            <MapPin className="h-3 w-3" />
            {user.distance === null ? "N/A" : `${user.distance.toFixed(1)} km`}
          </div>
          {user.location && (
            <p className="text-[10px] text-muted-foreground text-right min-w-0 truncate">
              {user.location}
            </p>
          )}
        </div>
      </div>

      {/* User's stated purpose */}
      {user.purpose && (
        <div className="rounded-lg bg-secondary/50 p-2.5 space-y-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Looking for
            </span>
          </div>
          <p className="text-xs text-foreground leading-relaxed">{user.purpose}</p>
        </div>
      )}

      {/* Rate */}
      {user.hangoutType === "paid" && user.rate && (
        <div className="flex items-center gap-2 rounded-lg bg-secondary/60 px-3 py-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">R{user.rate.toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">/ session</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {user.hangoutType === "paid" && bidAmount && (
          <Button
            size="sm"
            onClick={onSendBid}
            disabled={hasSentBid}
            className={cn(
              "flex-1 text-xs",
              hasSentBid
                ? "bg-secondary text-muted-foreground"
                : "bg-gradient-red hover:opacity-90 glow"
            )}
          >
            <Send className="h-3.5 w-3.5 mr-1" />
            {hasSentBid ? `Bid sent · R${bidAmount}` : `Send Bid · R${bidAmount}`}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onConnect}
          className="flex-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
        >
          <Handshake className="h-3.5 w-3.5 mr-1" />
          Request Meetup
        </Button>
      </div>
    </motion.div>
  );
};

export default UserCard;
