import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Plus, Flame } from "lucide-react";

type StoryProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

const StoriesBar = () => {
  const [stories, setStories] = useState<StoryProfile[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .order("updated_at", { ascending: false })
        .limit(12);

      if (!active) return;
      setStories(data ?? []);
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex gap-2.5 overflow-x-auto px-4 py-3 scrollbar-hide">
    {/* Your story */}
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-14 w-14 rounded-2xl bg-secondary flex items-center justify-center overflow-hidden border border-border">
        <img src="https://i.pravatar.cc/100?img=32" alt="You" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        <div className="absolute bottom-0.5 right-0.5 rounded-lg bg-gradient-ember p-0.5">
          <Plus className="h-2.5 w-2.5 text-primary-foreground" />
        </div>
      </div>
      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">You</span>
    </div>

      {stories.map((story, index) => {
        const hasNew = index < 4;
        return (
        <div key={story.id} className="flex flex-col items-center gap-1.5">
        <div className={cn(
          "h-14 w-14 rounded-2xl p-[2px] transition-all",
          hasNew ? "bg-gradient-ember glow" : "bg-secondary"
        )}>
          <div className="relative h-full w-full rounded-[14px] overflow-hidden border border-background">
            <img
              src={story.avatar_url ?? "https://i.pravatar.cc/100"}
              alt={story.username ?? "User"}
              className="h-full w-full object-cover"
            />
            {hasNew && (
              <div className="absolute top-0.5 right-0.5">
                <Flame className="h-3 w-3 text-primary drop-shadow-lg" />
              </div>
            )}
          </div>
        </div>
        <span className="max-w-[56px] truncate text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
          {story.username ?? "unknown"}
        </span>
      </div>
      );
      })}
  </div>
  );
};

export default StoriesBar;
