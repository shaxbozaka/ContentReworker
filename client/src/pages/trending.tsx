import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import {
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  ArrowRight,
  Linkedin,
  Eye,
  Heart,
  MessageCircle,
  Play,
  Youtube,
  Instagram,
  Twitter,
  Music2,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrendingItem {
  id: number | string;
  source: string;
  externalUrl: string;
  title: string;
  content: string | null;
  hook: string | null;
  author: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  category: string;
  publishedAt: string;
  whyItWorks?: string;
  hookPattern?: string;
  mediaType?: "text" | "image" | "video" | "carousel";
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  duration?: number | null;
  platform?: string;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getPlatformIcon(platform?: string) {
  switch (platform) {
    case "youtube":
      return Youtube;
    case "linkedin":
      return Linkedin;
    case "instagram":
      return Instagram;
    case "tiktok":
      return Music2;
    case "twitter":
      return Twitter;
    default:
      return Linkedin;
  }
}

function formatNumber(num: number | null): string {
  if (!num) return "";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export default function TrendingPage() {
  const [filter, setFilter] = useState<"all" | "curated">("curated");
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const { setContent } = useContent();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["trending", filter],
    queryFn: async () => {
      if (filter === "curated") {
        const res = await fetch("/api/trending/curated");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        return (data.virals || []).map((v: any) => ({
          id: `curated-${v.id}`,
          source: v.platform,
          externalUrl: v.sourceUrl || "#",
          title: v.hook,
          content: v.content,
          hook: v.hook,
          author: v.authorName,
          views: v.views,
          likes: v.likes,
          comments: v.comments,
          category: v.category,
          publishedAt: v.publishedAt || v.createdAt,
          whyItWorks: v.whyItWorks,
          hookPattern: v.hookPattern,
          mediaType: v.mediaType || "text",
          videoUrl: v.videoUrl,
          thumbnailUrl: v.thumbnailUrl,
          duration: v.duration,
          platform: v.platform,
        }));
      }
      const res = await fetch("/api/trending");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      return data.content || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      // Viral Posts tab reads from curated_virals — refresh means re-seed (fast, ~150ms).
      // Trending tab reads from trending_content — refresh fetches Hacker News/Reddit/YouTube (slow, ~45s).
      const endpoint = filter === "curated" ? "/api/trending/seed-curated" : "/api/trending/refresh";
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Refreshed!" });
      refetch();
    },
    onError: () => {
      toast({ title: "Refresh failed", variant: "destructive" });
    },
  });

  const items: TrendingItem[] = data || [];
  const [hiddenIds, setHiddenIds] = useState<Set<number | string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<number | string>>(new Set());

  // Extract the raw curated_virals.id from our prefixed ids (e.g. "curated-123" → 123)
  const rawId = (id: number | string) =>
    typeof id === "string" && id.startsWith("curated-") ? parseInt(id.slice(8), 10) : Number(id);

  const recordInteraction = async (itemId: number | string, action: "use" | "copy" | "like" | "hide" | "view") => {
    try {
      const id = rawId(itemId);
      if (!Number.isFinite(id)) return;
      await fetch(`/api/viral/${id}/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
        credentials: "include",
      });
    } catch {
      // Non-critical — don't bother the user with a toast
    }
  };

  const handleCopy = async (item: TrendingItem) => {
    const text = item.content || item.hook || item.title;
    await navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    toast({ title: "Copied!" });
    recordInteraction(item.id, "copy");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (item: TrendingItem) => {
    const text = item.content || item.hook || item.title;
    setContent(text);
    navigate("/");
    toast({ title: "Content loaded", description: "Ready to repurpose" });
    recordInteraction(item.id, "use");
  };

  const handleLike = (item: TrendingItem) => {
    setLikedIds((prev) => new Set(prev).add(item.id));
    recordInteraction(item.id, "like");
    toast({ title: "Got it — more like this" });
  };

  const handleHide = (item: TrendingItem) => {
    setHiddenIds((prev) => new Set(prev).add(item.id));
    recordInteraction(item.id, "hide");
    toast({ title: "Hidden — less of this creator" });
  };

  const visibleItems = items.filter((i) => !hiddenIds.has(i.id));

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
      <AppHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">
            Content Ideas
          </h1>
          <p className="text-white/40">
            Viral posts to inspire your next LinkedIn content
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter("curated")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === "curated"
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Viral Posts
            </button>
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === "all"
                  ? "bg-white text-black"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              Trending
            </button>
          </div>

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isRefetching}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 ${(refreshMutation.isPending || isRefetching) ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin mx-auto" />
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="py-20 text-center border border-white/10 rounded-xl">
            <p className="text-white/50 mb-2 text-lg">No content yet</p>
            <p className="text-white/30 mb-6 text-sm max-w-md mx-auto">
              Add a few creators or competitors you want to pull viral posts from. We'll ingest their recent content into this feed.
            </p>
            <Link href="/creators">
              <Button className="bg-white text-black hover:bg-white/90">
                Pick creators to follow
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => {
              const PlatformIcon = getPlatformIcon(item.platform || item.source);
              return (
              <div
                key={item.id}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-5 hover:bg-white/[0.05] transition-all"
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <PlatformIcon className="w-4 h-4 text-white/40" />
                    <span className="text-white/50 text-sm">{item.author || "Unknown"}</span>
                  </div>
                  {item.hookPattern && (
                    <span className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/60">
                      {item.hookPattern}
                    </span>
                  )}
                </div>

                {/* Video embed or thumbnail for video content */}
                {item.mediaType === "video" && item.videoUrl && (
                  <div className="relative mb-4 rounded-lg overflow-hidden bg-black aspect-video">
                    {/youtube\.com\/embed/.test(item.videoUrl) ? (
                      <iframe
                        src={item.videoUrl}
                        className="w-full h-full"
                        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video
                        src={item.videoUrl}
                        poster={item.thumbnailUrl || undefined}
                        controls
                        preload="metadata"
                        className="w-full h-full"
                      />
                    )}
                    {item.duration ? (
                      <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {formatDuration(item.duration)}
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Content */}
                <p className="text-white/80 text-[15px] leading-relaxed mb-4 whitespace-pre-wrap">
                  {item.content || item.hook || item.title}
                </p>

                {/* Why it works */}
                {item.whyItWorks && (
                  <div className="bg-white/5 rounded-lg px-3 py-2 mb-4">
                    <p className="text-white/50 text-sm">
                      <span className="text-white/70">Why it works:</span> {item.whyItWorks}
                    </p>
                  </div>
                )}

                {/* Metrics & Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-white/40 text-sm">
                    {item.views && item.views > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        {formatNumber(item.views)}
                      </span>
                    )}
                    {item.likes && item.likes > 0 && (
                      <span className="flex items-center gap-1">
                        <Heart className="w-4 h-4" />
                        {formatNumber(item.likes)}
                      </span>
                    )}
                    {item.comments && item.comments > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-4 h-4" />
                        {formatNumber(item.comments)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleLike(item)}
                      title="More like this"
                      className={`p-2 rounded-lg hover:bg-white/10 ${
                        likedIds.has(item.id) ? "text-green-400" : "text-white/40 hover:text-white"
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleHide(item)}
                      title="Less of this creator"
                      className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <ThumbsDown className="w-4 h-4" />
                    </button>
                    {item.externalUrl && item.externalUrl !== "#" && (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleCopy(item)}
                      className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleUse(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90"
                    >
                      Use This
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
