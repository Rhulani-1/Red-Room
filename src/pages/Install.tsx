import { useEffect, useState } from "react";
import { Download, Share, Plus, Apple, Smartphone, Check, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import logoIcon from "@/assets/logo-icon.png";

const INSTALL_URL = "https://redroom.space/install";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type WindowWithMSStream = Window & { MSStream?: unknown };
type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const isIOS = () =>
  typeof navigator !== "undefined" &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !(window as WindowWithMSStream).MSStream;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true);

const Install = () => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const ios = isIOS();

  useEffect(() => {
    if (isStandalone()) setInstalled(true);
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  };

  return (
    <div className="py-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-ember blur-2xl opacity-40" />
            <img
              src={logoIcon}
              alt="RED RXXM app icon"
              className="relative h-24 w-24 rounded-3xl glow"
            />
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight uppercase">
              Get <span className="text-gradient">RED RXXM</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Install the app on your phone for a full-screen, native-like experience.
              Works offline-friendly, no app store needed.
            </p>
          </div>
        </div>

        <div className="mt-8 card-elevated rounded-2xl p-5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 self-start">
            <QrCode className="h-5 w-5 text-primary" />
            <h2 className="font-bold">Scan to install</h2>
          </div>
          <div className="rounded-2xl bg-white p-4 glow">
            <QRCodeSVG
              value={INSTALL_URL}
              size={200}
              level="H"
              fgColor="#0b0b0d"
              bgColor="#ffffff"
              imageSettings={{ src: logoIcon, height: 40, width: 40, excavate: true }}
            />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Point your phone camera at the code to open the install page.
          </p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(INSTALL_URL);
              toast.success("Install link copied");
            }}
            className="w-full rounded-xl border border-border bg-secondary/60 px-4 py-2.5 text-xs font-semibold text-foreground flex items-center justify-center gap-2 hover:bg-secondary break-all"
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            {INSTALL_URL}
          </button>
        </div>

        {installed ? (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/10 p-5 flex items-center gap-3">
            <Check className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold">RED RXXM is installed on this device.</p>
          </div>
        ) : ios ? (
          <div className="mt-8 card-elevated rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Apple className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Install on iPhone / iPad</h2>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="font-bold text-primary">1.</span>
                <span>
                  Open this page in <strong className="text-foreground">Safari</strong> (not Chrome).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary">2.</span>
                <span className="flex items-center gap-1.5">
                  Tap the <Share className="h-4 w-4 inline" /> <strong className="text-foreground">Share</strong> button.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary">3.</span>
                <span className="flex items-center gap-1.5">
                  Choose <Plus className="h-4 w-4 inline" /> <strong className="text-foreground">Add to Home Screen</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-primary">4.</span>
                <span>Tap <strong className="text-foreground">Add</strong>. RED RXXM will appear on your home screen.</span>
              </li>
            </ol>
          </div>
        ) : (
          <div className="mt-8 card-elevated rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <h2 className="font-bold">Install on Android / Desktop</h2>
            </div>
            <button
              onClick={() => {
                if (deferred) {
                  handleInstall();
                } else {
                  toast.info(
                    "Open your browser menu (⋮) and tap 'Install app' or 'Add to Home Screen'."
                  );
                }
              }}
              className="w-full rounded-xl bg-gradient-ember px-4 py-3 text-sm font-bold text-primary-foreground transition-transform active:scale-95 glow flex items-center justify-center gap-2"
            >
              <Download className="h-4 w-4" />
              {deferred ? "Install RED RXXM" : "How to install"}
            </button>
            {!deferred && (
              <ol className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <strong className="text-foreground">Chrome / Edge (Android & Desktop):</strong>{" "}
                  Open the browser menu (⋮) → tap{" "}
                  <strong className="text-foreground">"Install app"</strong> or{" "}
                  <strong className="text-foreground">"Add to Home Screen"</strong>.
                </li>
                <li>
                  <strong className="text-foreground">Firefox (Android):</strong> Menu (⋮) →{" "}
                  <strong className="text-foreground">"Install"</strong>.
                </li>
                <li className="text-[11px] opacity-80">
                  The automatic install button appears only on the live site
                  (redroom.space), not in the editor preview, and only once your
                  browser has visited the site for a few seconds.
                </li>
              </ol>
            )}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-border bg-card/40 p-4 text-xs text-muted-foreground">
          A native iOS & Android version (App Store / Play Store) is coming soon.
        </div>
    </div>
  );
};

export default Install;
