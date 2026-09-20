import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Check,
  Clock,
  Trash2,
  FileText,
  Shield,
  DollarSign,
  Star,
  QrCode,
  ScanLine,
  CheckCircle2,
} from "lucide-react";

export interface Agreement {
  id: string;
  requester: { username: string; avatar: string };
  target: { username: string; avatar: string };
  purpose: string;
  bidAmount?: string;
  requesterConfirmed: boolean;
  targetConfirmed: boolean;
  sessionDate?: string;
  createdAt: string;
  paymentConfirmed?: boolean;
}

interface AgreementCardProps {
  agreement: Agreement;
  currentUser: string;
  onConfirm: (id: string) => void;
  onDelete: (id: string) => void;
  onRate?: (id: string) => void;
  onShowPaymentQR?: (id: string) => void;
  onScanPaymentQR?: (id: string) => void;
}

const AgreementCard = ({ agreement, currentUser, onConfirm, onDelete, onRate, onShowPaymentQR, onScanPaymentQR }: AgreementCardProps) => {
  const bothConfirmed = agreement.requesterConfirmed && agreement.targetConfirmed;
  const isRequester = agreement.requester.username === currentUser;
  const myConfirmed = isRequester ? agreement.requesterConfirmed : agreement.targetConfirmed;
  const otherParty = isRequester ? agreement.target : agreement.requester;
  // Requester offers the bid (pays). Target receives payment.
  const isPayer = isRequester;
  const isPayee = !isRequester;
  const hasPayment = !!agreement.bidAmount;
  const paymentConfirmed = !!agreement.paymentConfirmed;

  // Check if 7 days have passed since session
  const canDelete = (() => {
    if (!bothConfirmed || !agreement.sessionDate) return false;
    const session = new Date(agreement.sessionDate);
    const now = new Date();
    const diff = now.getTime() - session.getTime();
    return diff > 7 * 24 * 60 * 60 * 1000;
  })();

  return (
    <div className="rounded-xl bg-card border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            <img
              src={agreement.requester.avatar}
              alt=""
              className="h-8 w-8 rounded-full ring-2 ring-card object-cover"
            />
            <img
              src={agreement.target.avatar}
              alt=""
              className="h-8 w-8 rounded-full ring-2 ring-card object-cover"
            />
          </div>
          <div>
            <p className="text-xs font-bold">
              {agreement.requester.username} × {agreement.target.username}
            </p>
            <p className="text-[10px] text-muted-foreground">{agreement.createdAt}</p>
          </div>
        </div>
        <Badge
          className={cn(
            "text-[10px] gap-1",
            bothConfirmed
              ? "bg-green-500/15 text-green-400 border-green-500/30"
              : "bg-amber-500/15 text-amber-400 border-amber-500/30"
          )}
        >
          {bothConfirmed ? (
            <>
              <Lock className="h-2.5 w-2.5" />
              Locked
            </>
          ) : (
            <>
              <Clock className="h-2.5 w-2.5" />
              Pending
            </>
          )}
        </Badge>
      </div>

      {/* Purpose */}
      <div className="rounded-lg bg-secondary/50 p-3 space-y-1">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Purpose
          </span>
        </div>
        <p className="text-sm text-foreground leading-relaxed">{agreement.purpose}</p>
      </div>

      {/* Bid amount */}
      {agreement.bidAmount && (
        <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
          <DollarSign className="h-3.5 w-3.5 text-primary" />
          <span className="text-sm font-bold">R{parseFloat(agreement.bidAmount).toFixed(2)}</span>
          <span className="text-xs text-muted-foreground">agreed amount</span>
        </div>
      )}

      {/* Confirmation status */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className={cn(
            "rounded-lg p-2.5 text-center border",
            agreement.requesterConfirmed
              ? "bg-green-500/10 border-green-500/30"
              : "bg-secondary/50 border-border"
          )}
        >
          <p className="text-[10px] text-muted-foreground mb-0.5">
            {agreement.requester.username}
          </p>
          {agreement.requesterConfirmed ? (
            <div className="flex items-center justify-center gap-1 text-green-400 text-xs font-semibold">
              <Check className="h-3 w-3" />
              Confirmed
            </div>
          ) : (
            <p className="text-xs text-amber-400 font-semibold">Awaiting</p>
          )}
        </div>
        <div
          className={cn(
            "rounded-lg p-2.5 text-center border",
            agreement.targetConfirmed
              ? "bg-green-500/10 border-green-500/30"
              : "bg-secondary/50 border-border"
          )}
        >
          <p className="text-[10px] text-muted-foreground mb-0.5">
            {agreement.target.username}
          </p>
          {agreement.targetConfirmed ? (
            <div className="flex items-center justify-center gap-1 text-green-400 text-xs font-semibold">
              <Check className="h-3 w-3" />
              Confirmed
            </div>
          ) : (
            <p className="text-xs text-amber-400 font-semibold">Awaiting</p>
          )}
        </div>
      </div>

      {/* Lock notice */}
      {bothConfirmed && !canDelete && (
        <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
          <Shield className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            This agreement is locked and cannot be deleted until 7 days after the session.
          </p>
        </div>
      )}


      {/* Payment confirmation status */}
      {bothConfirmed && hasPayment && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg p-2.5 border",
            paymentConfirmed
              ? "bg-green-500/10 border-green-500/30"
              : "bg-secondary/50 border-border"
          )}
        >
          {paymentConfirmed ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
          ) : (
            <DollarSign className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
          <p className="text-[11px] leading-relaxed flex-1">
            {paymentConfirmed
              ? "Payment confirmed via QR scan."
              : isPayee
                ? "Show your payment QR at the meet-up so the payer can scan it to confirm."
                : "Scan the payee's QR at the meet-up to confirm payment."}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!myConfirmed && !bothConfirmed && (
          <Button
            size="sm"
            onClick={() => onConfirm(agreement.id)}
            className="flex-1 text-xs bg-gradient-red hover:opacity-90 glow"
          >
            <Check className="h-3.5 w-3.5 mr-1" />
            Confirm Agreement
          </Button>
        )}
        {bothConfirmed && hasPayment && !paymentConfirmed && isPayee && onShowPaymentQR && (
          <Button
            size="sm"
            onClick={() => onShowPaymentQR(agreement.id)}
            className="flex-1 text-xs bg-gradient-red hover:opacity-90 glow"
          >
            <QrCode className="h-3.5 w-3.5 mr-1" />
            Show Payment QR
          </Button>
        )}
        {bothConfirmed && hasPayment && !paymentConfirmed && isPayer && onScanPaymentQR && (
          <Button
            size="sm"
            onClick={() => onScanPaymentQR(agreement.id)}
            className="flex-1 text-xs bg-gradient-red hover:opacity-90 glow"
          >
            <ScanLine className="h-3.5 w-3.5 mr-1" />
            Scan to Pay
          </Button>
        )}
        {bothConfirmed && onRate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRate(agreement.id)}
            className="flex-1 text-xs border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <Star className="h-3.5 w-3.5 mr-1" />
            Rate {otherParty.username}
          </Button>
        )}
        {canDelete && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(agreement.id)}
            className="flex-1 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

export default AgreementCard;
