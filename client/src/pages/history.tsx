import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useContent } from "@/context/ContentContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  History,
  Trash2,
  Copy,
  Check,
  Clock,
  FileText,
  Mail,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Send,
  FileEdit,
} from "lucide-react";
import { FaXTwitter, FaLinkedin, FaInstagram } from "react-icons/fa6";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TransformationOutput {
  content: string;
  characterCount: number | null;
}

interface TransformationHistory {
  id: number;
  originalContent: string;
  contentSource: string;
  tone: string;
  outputLength: number;
  useHashtags: boolean;
  useEmojis: boolean;
  aiProvider: string;
  status: string;
  postedAt: string | null;
  postedPlatform: string | null;
  createdAt: string;
  outputs: Record<string, TransformationOutput>;
}

interface HistoryResponse {
  transformations: TransformationHistory[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const cls = `${className ?? ""} ${getPlatformIconColor(platform)} w-3 h-3`.trim();
  switch (platform) {
    case "Twitter": return <FaXTwitter className={cls} />;
    case "LinkedIn": return <FaLinkedin className={cls} />;
    case "Instagram": return <FaInstagram className={cls} />;
    case "Email": return <Mail className={cls} />;
    default: return <FileText className={cls} />;
  }
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "Twitter": return "bg-white";
    case "LinkedIn": return "bg-[#0A66C2]";
    case "Instagram": return "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";
    case "Email": return "bg-white/20";
    default: return "bg-white/20";
  }
}

function getPlatformIconColor(platform: string): string {
  switch (platform) {
    case "Twitter": return "text-black";
    case "Email": return "text-white";
    default: return "text-white";
  }
}

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const { user, isLoggedIn, isLoading: isAuthLoading } = useAuth();
  const { setContent } = useContent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Fetch history
  const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
  const { data, isLoading, isError } = useQuery<HistoryResponse>({
    queryKey: ["/api/users/me/transformations", statusFilter],
    enabled: isLoggedIn,
    queryFn: () => apiRequest<HistoryResponse>(`/api/users/me/transformations?limit=50${statusParam}`),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/transformations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Deleted", description: "Transformation removed from history" });
      queryClient.invalidateQueries({ queryKey: ["/api/users/me/transformations"] });
      setDeleteDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    },
  });

  const handleCopy = async (content: string, platform: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedPlatform(platform);
    toast({ title: "Copied!", description: `${platform} content copied to clipboard` });
    setTimeout(() => setCopiedPlatform(null), 2000);
  };

  const handleReuse = (item: TransformationHistory) => {
    setContent(item.originalContent);
    navigate("/");
    toast({ title: "Content loaded", description: "Ready to repurpose again" });
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Not logged in
  if (!isAuthLoading && !isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <History className="w-10 h-10 text-blue-400" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">Sign in to view history</h1>
            <p className="text-white/70 mb-8 text-lg">
              Your transformation history is saved when you're signed in.
            </p>
            <Button onClick={() => navigate("/")} className="bg-white text-black hover:bg-white/90 px-8 py-3 text-base font-semibold">
              Go to Home
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const transformations = data?.transformations || [];

  return (
    <div className="min-h-screen flex flex-col bg-[#0f0f0f]">
      <AppHeader />

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Transformation History</h1>
              <p className="text-white/70 mt-2">
                {data?.pagination.total || 0} transformations saved
              </p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { key: "all", label: "All" },
              { key: "draft", label: "Drafts", icon: FileEdit },
              { key: "posted", label: "Posted", icon: Send },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === key
                    ? "bg-white/10 text-white"
                    : "bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white/70"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-white/40" />
            </div>
          ) : transformations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">No history yet</h3>
              <p className="text-white/70 mb-8 text-lg">
                Your transformations will appear here after you repurpose content.
              </p>
              <Button onClick={() => navigate("/")} className="bg-white text-black hover:bg-white/90 px-8 py-3 text-base font-semibold">
                Start Repurposing
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {transformations.map((item) => {
                const isExpanded = expandedId === item.id;
                const platforms = Object.keys(item.outputs);

                return (
                  <div
                    key={item.id}
                    className="bg-white/[0.03] rounded-xl border border-white/10 overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-white/60">
                              {item.contentSource}
                            </span>
                            {item.status === "posted" ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                Posted{item.postedPlatform ? ` to ${item.postedPlatform}` : ""}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                <FileEdit className="w-3 h-3" />
                                Draft
                              </span>
                            )}
                            <span className="text-xs text-white/40 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-white font-medium line-clamp-2">
                            {item.originalContent.substring(0, 150)}
                            {item.originalContent.length > 150 && "..."}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {platforms.map((platform) => (
                              <div
                                key={platform}
                                className={`w-6 h-6 ${getPlatformColor(platform)} rounded flex items-center justify-center`}
                              >
                                <PlatformIcon platform={platform} />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReuse(item);
                            }}
                            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                          >
                            Reuse <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-white/40" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-white/40" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-white/10 p-4 bg-white/[0.02]">
                        <div className="grid gap-4">
                          {platforms.map((platform) => {
                            const output = item.outputs[platform];
                            const isCopied = copiedPlatform === `${item.id}-${platform}`;

                            return (
                              <div key={platform} className="bg-white/[0.03] rounded-lg p-4 border border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 ${getPlatformColor(platform)} rounded flex items-center justify-center`}>
                                      <PlatformIcon platform={platform} />
                                    </div>
                                    <span className="font-medium text-white">{platform}</span>
                                    {output.characterCount && (
                                      <span className="text-xs text-white/40">
                                        {output.characterCount} chars
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopy(output.content, `${item.id}-${platform}`)}
                                    className="border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check className="w-4 h-4 mr-1" /> Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-4 h-4 mr-1" /> Copy
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <p className="text-sm text-white/70 whitespace-pre-wrap">
                                  {output.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Delete button */}
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#141414] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete transformation?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              This will permanently remove this transformation from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-white/70 hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
