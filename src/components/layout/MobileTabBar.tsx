import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { tabBarNav } from "./nav-items";

/**
 * Phone/tablet-portrait navigation. Hidden from lg up, where SideRail takes over.
 *
 * `pb-safe-b` keeps the tabs clear of the iPhone home indicator — without it the bar
 * sits underneath it in the installed PWA.
 */
const MobileTabBar = () => (
  <nav
    data-testid="tab-bar"
    aria-label="Main navigation"
    className={cn(
      "fixed bottom-0 left-0 right-0 z-50 border-t border-border",
      "bg-background/70 pb-safe-b backdrop-blur-2xl lg:hidden",
    )}
  >
    <div className="mx-auto flex max-w-xl items-stretch justify-around pl-safe-l pr-safe-r">
      {tabBarNav.map(({ to, icon: Icon, label }) => {
        const isCreate = label === "Create";
        return (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-end gap-0.5 text-muted-foreground transition-colors",
                // The raised Create button needs the link's own box to grow upward,
                // otherwise the top of the largest icon isn't actually tappable.
                isCreate ? "-mt-5 min-h-[68px] pt-5" : "min-h-[48px] py-1.5",
                isActive && "text-primary",
              )
            }
          >
            {({ isActive }) =>
              isCreate ? (
                <div
                  className={cn(
                    "mb-1 rounded-2xl p-2.5 shadow-lg transition-all",
                    isActive
                      ? "bg-gradient-ember glow scale-110"
                      : "border border-border bg-secondary",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-primary-foreground" : "text-foreground",
                    )}
                  />
                </div>
              ) : (
                <>
                  <div className={cn("rounded-xl p-1.5 transition-all", isActive && "bg-primary/10")}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span
                    className={cn(
                      "text-[9px] font-semibold uppercase tracking-wide",
                      isActive && "text-primary",
                    )}
                  >
                    {label}
                  </span>
                </>
              )
            }
          </NavLink>
        );
      })}
    </div>
  </nav>
);

export default MobileTabBar;
