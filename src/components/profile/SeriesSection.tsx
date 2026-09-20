import { useState } from "react";
import { Play, Lock, ChevronRight, Clock, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Episode {
  id: string;
  title: string;
  thumbnail: string;
  duration: string;
  views: number;
  isLocked: boolean;
}

interface Series {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  episodeCount: number;
  category: string;
  isPrivate: boolean;
  price?: number;
  episodes: Episode[];
}

const mockSeries: Series[] = [];
// Real series loaded from database
// Series table should contain: id, creator_id, title, description, coverImage, category, isPrivate, price, created_at

const formatViews = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`);

const SeriesSection = () => {
  const [expandedSeries, setExpandedSeries] = useState<string | null>(null);

  return (
    <div className="space-y-4 mt-3">
      {/* Create Series CTA */}
      <Button
        variant="outline"
        className="w-full border-dashed border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:border-primary/50 h-12 gap-2"
      >
        <Plus className="h-4 w-4" />
        <span className="text-xs font-medium tracking-wide uppercase">Create New Series</span>
      </Button>

      {mockSeries && mockSeries.length > 0 ? (
        mockSeries.map((series) => {
          const isExpanded = expandedSeries === series.id;

          return (
            <div key={series.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
              {/* Series Cover */}
              <button
                onClick={() => setExpandedSeries(isExpanded ? null : series.id)}
                className="w-full text-left"
              >
                <div className="relative">
                  <img
                    src={series.coverImage}
                    alt={series.title}
                    className="w-full h-36 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-white/15 backdrop-blur-sm text-white border-0 uppercase tracking-wider"
                      >
                        {series.category}
                      </Badge>
                      {series.isPrivate && (
                        <Badge className="text-[10px] bg-primary/80 text-primary-foreground border-0">
                          R{series.price}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white leading-tight">{series.title}</h3>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      {series.episodeCount} episodes · {series.description}
                    </p>
                  </div>
                  <div className="absolute top-3 right-3">
                    <ChevronRight
                      className={`h-5 w-5 text-white/70 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </div>
                </div>
              </button>

              {/* Episode List */}
              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {series.episodes.map((ep, idx) => (
                    <div
                      key={ep.id}
                      className="flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-24 h-14 rounded-lg overflow-hidden shrink-0">
                        <img src={ep.thumbnail} alt={ep.title} className="w-full h-full object-cover" />
                        {ep.isLocked ? (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <Lock className="h-4 w-4 text-white/80" />
                          </div>
                        ) : (
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <Play className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <span className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1 rounded">
                          {ep.duration}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{ep.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Eye className="h-3 w-3" />
                            {formatViews(ep.views)}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {ep.duration}
                          </span>
                        </div>
                      </div>

                      {/* Action */}
                      {ep.isLocked ? (
                        <Button size="sm" className="bg-primary text-primary-foreground text-[10px] h-7 px-3">
                          Unlock
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2">
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No series yet. Create your first series to share curated content with your audience.
        </div>
      )}
    </div>
  );
};

export default SeriesSection;
