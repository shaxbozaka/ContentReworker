import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Youtube,
  Linkedin,
  Instagram,
  Music2,
  Twitter,
  RefreshCw,
  Trash2,
  Plus,
  Loader2,
  Clock,
} from "lucide-react";

type Platform = "youtube" | "linkedin" | "instagram" | "tiktok" | "twitter";

interface TrackedAccount {
  id: number;
  userId: number;
  platform: Platform;
  handle: string;
  displayName: string | null;
  profileUrl: string | null;
  lastFetchedAt: string | null;
  lastPostCount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const PLATFORMS: Array<{
  id: Platform;
  label: string;
  icon: typeof Youtube;
  serverIngest: boolean;
  placeholder: string;
  help: string;
}> = [
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    serverIngest: true,
    placeholder: "https://youtube.com/@mkbhd or UC6nSFpj9HTCZ5t-N3Rm3-HA",
    help: "Paste a channel URL or handle. Ingested daily via YouTube Data API.",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    serverIngest: false,
    placeholder: "https://linkedin.com/in/justinwelsh",
    help: "Captured by the browser extension while you're logged into LinkedIn.",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: Instagram,
    serverIngest: false,
    placeholder: "https://instagram.com/garyvee",
    help: "Reels captured by the browser extension while you browse Instagram.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: Music2,
    serverIngest: false,
    placeholder: "https://tiktok.com/@alexhormozi",
    help: "Captured by the browser extension while you browse TikTok.",
  },
  {
    id: "twitter",
    label: "X / Twitter",
    icon: Twitter,
    serverIngest: false,
    placeholder: "https://x.com/naval",
    help: "Captured by the browser extension while you browse X.",
  },
];

function formatAge(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CreatorsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tracked-accounts"],
    queryFn: async () => apiRequest<{ accounts: TrackedAccount[] }>("/api/tracked-accounts"),
  });

  const accounts = data?.accounts ?? [];

  const addMutation = useMutation({
    mutationFn: async (body: { platform: Platform; handle: string }) =>
      apiRequest<{ account: TrackedAccount }>("/api/tracked-accounts", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tracked-accounts"] });
      toast({ title: "Added" });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't add", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest(`/api/tracked-accounts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tracked-accounts"] }),
  });

  const refreshMutation = useMutation({
    mutationFn: async (id: number) =>
      apiRequest<{ platform: string; added: number; skipped: number; error?: string }>(
        `/api/tracked-accounts/${id}/refresh`,
        { method: "POST" },
      ),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["tracked-accounts"] });
      qc.invalidateQueries({ queryKey: ["trending"] });
      if (result.error) {
        toast({ title: result.error, variant: "destructive" });
      } else if (result.added === 0) {
        toast({
          title: "Up to date",
          description: `${result.skipped} post${result.skipped === 1 ? "" : "s"} already in your feed. Open Ideas to browse them.`,
        });
      } else {
        toast({
          title: `${result.added} new post${result.added === 1 ? "" : "s"} added`,
          description: "Open Ideas to see them.",
        });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Refresh failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
      <AppHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">Creators</h1>
          <p className="text-white/40">
            Track competitors and creators you admire. We'll pull their recent posts into your Ideas feed.
          </p>
        </div>

        <div className="space-y-8">
          {PLATFORMS.map((p) => (
            <PlatformSection
              key={p.id}
              platform={p}
              accounts={accounts.filter((a) => a.platform === p.id)}
              isLoading={isLoading}
              onAdd={(handle) => addMutation.mutate({ platform: p.id, handle })}
              onRemove={(id) => removeMutation.mutate(id)}
              onRefresh={(id) => refreshMutation.mutate(id)}
              addPending={addMutation.isPending && addMutation.variables?.platform === p.id}
              refreshingId={refreshMutation.isPending ? refreshMutation.variables ?? null : null}
            />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}

interface PlatformSectionProps {
  platform: (typeof PLATFORMS)[number];
  accounts: TrackedAccount[];
  isLoading: boolean;
  onAdd: (handle: string) => void;
  onRemove: (id: number) => void;
  onRefresh: (id: number) => void;
  addPending: boolean;
  refreshingId: number | null;
}

function PlatformSection({
  platform,
  accounts,
  isLoading,
  onAdd,
  onRemove,
  onRefresh,
  addPending,
  refreshingId,
}: PlatformSectionProps) {
  const [input, setInput] = useState("");
  const Icon = platform.icon;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
  };

  return (
    <section className="border border-white/10 rounded-xl bg-white/[0.02] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-white/70" />
          <h2 className="text-lg font-semibold text-white">{platform.label}</h2>
          {!platform.serverIngest && (
            <span className="text-[11px] font-medium text-amber-300/80 bg-amber-300/10 border border-amber-300/20 rounded px-2 py-0.5">
              needs extension
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-white/40 mb-4">{platform.help}</p>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={platform.placeholder}
          className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
        />
        <Button type="submit" disabled={!input.trim() || addPending} className="bg-white text-black hover:bg-white/90">
          {addPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
        </Button>
      </form>

      {isLoading ? (
        <div className="text-white/30 text-sm">Loading...</div>
      ) : accounts.length === 0 ? (
        <div className="text-white/30 text-sm">No accounts yet.</div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white font-medium truncate">{a.displayName || a.handle}</div>
                <div className="flex items-center gap-3 text-xs text-white/40">
                  <span className="truncate">@{a.handle}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatAge(a.lastFetchedAt)}
                  </span>
                  {a.lastPostCount ? <span>• {a.lastPostCount} posts</span> : null}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {platform.serverIngest && (
                  <button
                    onClick={() => onRefresh(a.id)}
                    disabled={refreshingId === a.id}
                    className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-50"
                    title="Refresh now"
                  >
                    <RefreshCw className={`w-4 h-4 ${refreshingId === a.id ? "animate-spin" : ""}`} />
                  </button>
                )}
                <button
                  onClick={() => onRemove(a.id)}
                  className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
