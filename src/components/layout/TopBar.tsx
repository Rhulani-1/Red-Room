import { Bell, MapPin, LogIn, LogOut, Wallet, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import logoIcon from "@/assets/logo-icon.png";

const TopBar = () => {
  const { user, signOut } = useAuth();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/70 pt-safe-t backdrop-blur-2xl">
      {/* Spans the viewport rather than being centred in its own max-width: with the
          rail in normal flow, the logo belongs over the rail and the actions at the
          far right. This also removes the old max-w-7xl vs max-w-5xl misalignment. */}
      <div className="flex h-header items-center justify-between px-4 pl-safe-l pr-safe-r sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <img
            src={logoIcon}
            alt="RED RXXM logo"
            className="h-8 w-8 rounded-lg object-cover glow"
          />
          <Link to="/" aria-label="RED RXXM home" className="text-xl font-extrabold tracking-tighter uppercase">
            <span className="text-gradient">Red</span>
            <span className="text-foreground">Rxxm</span>
          </Link>
          <span className="hidden lg:inline text-xs text-muted-foreground ml-2 border-l border-border pl-3">
            Desktop Workspace
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {user && (
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-xl" aria-label="RED BUSKET wallet">
              <Link to="/wallet">
                <Wallet className="h-5 w-5" />
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-xl" aria-label="Install app">
            <Link to="/install">
              <Download className="h-5 w-5" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Set location" className="text-muted-foreground hover:text-primary rounded-xl hidden sm:inline-flex">
            <MapPin className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative text-muted-foreground hover:text-primary rounded-xl">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-gradient-ember" />
          </Button>
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="text-muted-foreground hover:text-primary rounded-xl"
              aria-label="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-primary rounded-xl" aria-label="Sign in">
              <Link to="/auth">
                <LogIn className="h-5 w-5" />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
