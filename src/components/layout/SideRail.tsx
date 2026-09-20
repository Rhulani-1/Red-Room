import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { railNav } from "./nav-items";

/**
 * Desktop navigation. Deliberately a normal flex child rather than `fixed`, so its
 * width is reserved structurally and content can never drift away from it — the
 * previous `fixed left-0` rail plus a separately-centred `mx-auto` content box left a
 * widening gap on large screens.
 *
 * Widens from an icon rail to a labelled sidebar at xl via --app-rail-w.
 */
/** `withHeader` false on chrome variants that render no TopBar (e.g. chat), so the
 *  rail doesn't leave an empty header-height gap above itself. */
const SideRail = ({ withHeader = true }: { withHeader?: boolean }) => (
  <nav
    data-testid="side-rail"
    aria-label="Main navigation"
    className={cn(
      "sticky hidden w-rail shrink-0",
      withHeader
        ? "top-header-total h-[calc(100dvh-var(--app-header-total))]"
        : "top-0 h-dvh pt-safe-t",
      "flex-col gap-1 overflow-y-auto border-r border-border bg-background/75 py-4 pl-safe-l",
      "backdrop-blur-xl lg:flex",
    )}
  >
    {railNav.map(({ to, icon: Icon, label }) => (
      <NavLink
        key={to}
        to={to}
        end={to === "/"}
        className={({ isActive }) =>
          cn(
            "mx-2 flex min-h-[44px] items-center rounded-xl px-2 text-muted-foreground transition-colors",
            "flex-col justify-center gap-1 xl:flex-row xl:justify-start xl:gap-3 xl:px-3",
            isActive ? "bg-primary/10 text-primary" : "hover:bg-secondary hover:text-foreground",
          )
        }
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="text-[10px] font-semibold leading-tight xl:text-sm">{label}</span>
      </NavLink>
    ))}
  </nav>
);

export default SideRail;
