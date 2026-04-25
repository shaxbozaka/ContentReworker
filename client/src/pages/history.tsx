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
    case "Twitter": return "bg-slate-950";
    case "LinkedIn": return "bg-[#0A66C2]";
    case "Instagram": return "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600";
    case "Email": return "bg-slate-100";
    default: return "bg-slate-100";
  }
}

function getPlatformIconColor(platform: string): string {
  switch (platform) {
    case "Twitter": return "text-white";
    case "LinkedIn": return "text-white";
    case "Instagram": return "text-white";
    case "Email": return "text-slate-700";
    default: return "text-slate-700";
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
      <div className="app-page">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md mx-auto px-4">
            <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <History className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-3xl font-extrabold text-slate-950 mb-3 tracking-tight">Sign in to view history</h1>
            <p className="text-slate-600 mb-8 text-lg">
              Your transformation history is saved when you're signed in.
            </p>
            <Button onClick={() => navigate("/")} className="bg-slate-950 text-white hover:bg-slate-800 px-8 py-3 text-base font-semibold">
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
    <div className="app-page">
      <AppHeader />

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight">Transformation History</h1>
              <p className="text-slate-600 mt-2">
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
                    ? "bg-slate-950 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : transformations.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="w-10 h-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-950 mb-3">No history yet</h3>
              <p className="text-slate-600 mb-8 text-lg">
                Your transformations will appear here after you repurpose content.
              </p>
              <Button onClick={() => navigate("/")} className="bg-slate-950 text-white hover:bg-slate-800 px-8 py-3 text-base font-semibold">
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
                    className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    {/* Header */}
                    <div
                      className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                              {item.contentSource}
                            </span>
                            {item.status === "posted" ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                Posted{item.postedPlatform ? ` to ${item.postedPlatform}` : ""}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                                <FileEdit className="w-3 h-3" />
                                Draft
                              </span>
                            )}
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-slate-900 font-medium line-clamp-2">
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
                            className="text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                          >
                            Reuse <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-slate-200 p-4 bg-slate-50">
                        <div className="grid gap-4">
                          {platforms.map((platform) => {
                            const output = item.outputs[platform];
                            const isCopied = copiedPlatform === `${item.id}-${platform}`;

                            return (
                              <div key={platform} className="bg-white rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 ${getPlatformColor(platform)} rounded flex items-center justify-center`}>
                                      <PlatformIcon platform={platform} />
                                    </div>
                                    <span className="font-medium text-slate-900">{platform}</span>
                                    {output.characterCount && (
                                      <span className="text-xs text-slate-500">
                                        {output.characterCount} chars
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCopy(output.content, `${item.id}-${platform}`)}
                                    className="border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                  {output.content}
                                </p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Delete button */}
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        <AlertDialogContent className="bg-white border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-slate-950">Delete transformation?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              This will permanently remove this transformation from your history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900">Cancel</AlertDialogCancel>
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
