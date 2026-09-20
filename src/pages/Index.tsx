import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import ForYouFeed from "@/components/feed/ForYouFeed";
import StoriesBar from "@/components/feed/StoriesBar";

const tabs = ["For You", "Following"] as const;

/**
 * The shell (top bar, rail, tab bar, content width) comes from the layout route in
 * App.tsx. This page previously reimplemented it with its own offsets, which is how
 * `top-[53px]`, `md:left-[84px]` and `md:pl-[96px]` drifted apart.
 */
const Index = () => {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>("For You");

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 border-b border-border bg-card/80 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-center gap-6 py-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative min-h-[40px] px-2 text-sm font-semibold transition-colors",
                activeTab === tab ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-red"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-2">
        {activeTab === "For You" ? (
          <ForYouFeed scope="all" />
        ) : (
          <>
            <StoriesBar />
            <div className="border-t border-border pt-2">
              <ForYouFeed scope="mine" />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default Index;
