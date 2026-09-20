import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Html5Qrcode } from "html5-qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, ScanLine, CheckCircle2, AlertCircle } from "lucide-react";
import { confirmAgreementPayment } from "./confirmAgreementPayment";
import type { Agreement } from "./AgreementCard";

interface PaymentQRDialogProps {
  agreement: Agreement | null;
  mode: "show" | "scan" | null;
  onClose: () => void;
  onPaymentConfirmed: (agreementId: string) => void;
}

const PAYLOAD_PREFIX = "redrxxm:agreement:";

const PaymentQRDialog = ({ agreement, mode, onClose, onPaymentConfirmed }: PaymentQRDialogProps) => {
  const open = !!agreement && !!mode;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = "payment-qr-scanner-region";
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || mode !== "scan" || !agreement) return;
    setScanError(null);

    let cancelled = false;
    const start = async () => {
      try {
        const scanner = new Html5Qrcode(elementId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decoded) => {
            if (cancelled) return;
            const expected = `${PAYLOAD_PREFIX}${agreement.id}`;
            if (decoded !== expected) {
              setScanError("This QR doesn't match the agreement.");
              return;
            }
            // Server-side single-confirmation enforcement (toasts handled inside helper)
            cancelled = true;
            const result = await confirmAgreementPayment(agreement.id);
            if (!result.ok) {
              cancelled = false;
              return;
            }
            onPaymentConfirmed(agreement.id);
            onClose();
          },
          () => {
            // ignore per-frame decode errors
          }
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera unavailable";
        setScanError(msg);
      }
    };
    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => undefined).finally(() => {
          try { s.clear(); } catch { /* noop */ }
        });
      }
    };
  }, [open, mode, agreement, onPaymentConfirmed, onClose]);

  if (!agreement) return null;

  const payload = `${PAYLOAD_PREFIX}${agreement.id}`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "show" ? <QrCode className="h-4 w-4 text-primary" /> : <ScanLine className="h-4 w-4 text-primary" />}
            {mode === "show" ? "Your Payment QR" : "Scan to Confirm Payment"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === "show"
              ? "Have the paying party scan this QR upon meet-up to finalize payment."
              : "Point your camera at the recipient's QR to finalize payment."}
          </DialogDescription>
        </DialogHeader>

        {mode === "show" ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG value={payload} size={220} level="M" includeMargin={false} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-primary" />
              Agreement #{agreement.id.slice(0, 8)}
            </div>
            {agreement.bidAmount && (
              <p className="text-sm font-bold">R{parseFloat(agreement.bidAmount).toFixed(2)}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div
              id={elementId}
              className="overflow-hidden rounded-xl bg-black aspect-square w-full"
            />
            {scanError && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-2.5">
                <AlertCircle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-[11px] text-destructive leading-relaxed">{scanError}</p>
              </div>
            )}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentQRDialog;
