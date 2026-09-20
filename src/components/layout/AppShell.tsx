import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import TopBar from "./TopBar";
import SideRail from "./SideRail";
import MobileTabBar from "./MobileTabBar";

/**
 * Content width. A single global max-width was the root cause of the feed looking
 * broken on desktop: a column of media cards and a table of admin data want very
 * different measures.
 */
export type ShellWidth = "feed" | "form" | "wide" | "full";

/**
 * `default` — top bar, tab bar on mobile, rail on desktop.
 * `minimal` — top bar and content only (no primary nav), e.g. the install page.
 * `chat`    — no top bar, no mobile tab bar, but the desktop rail stays, so
 *             navigation doesn't disappear inside a conversation.
 */
export type ShellChrome = "default" | "minimal" | "chat";

const widthClass: Record<ShellWidth, string> = {
  feed: "max-w-feed",
  form: "max-w-2xl",
  wide: "max-w-6xl",
  full: "max-w-none",
};

interface AppShellProps {
  children: ReactNode;
  width?: ShellWidth;
  chrome?: ShellChrome;
}

const AppShell = ({ children, width = "wide", chrome = "default" }: AppShellProps) => {
  const showTopBar = chrome !== "chat";
  const showRail = chrome === "default" || chrome === "chat";
  const showTabBar = chrome === "default";

  return (
    <div className="min-h-dvh bg-background">
      {showTopBar && <TopBar />}
      <div className={cn("flex", showTopBar ? "pt-header-total" : "h-dvh")}>
        {showRail && <SideRail withHeader={showTopBar} />}
        {/* min-w-0 is load-bearing: without it flex children refuse to shrink and
            every `truncate` in the app needs a fixed-px crutch to work. */}
        <main
          className={cn(
            "min-w-0 flex-1",
            chrome === "chat" ? "pb-0" : "pb-tabbar-total lg:pb-8",
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              chrome === "chat" ? "h-full" : "px-4 sm:px-6 lg:px-8",
              widthClass[width],
            )}
          >
            {children}
          </div>
        </main>
      </div>
      {showTabBar && <MobileTabBar />}
    </div>
  );
};

export default AppShell;
