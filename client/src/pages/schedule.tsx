import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import ProPaywall from "@/components/ProPaywall";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import SmartTimePicker from "@/components/SmartTimePicker";
import {
  Calendar,
  Clock,
  Trash2,
  Edit2,
  Plus,
  CheckCircle,
  XCircle,
  Linkedin,
  ChevronRight,
  MoreVertical,
  Copy,
  ExternalLink,
  RotateCcw,
  Check,
  Loader2,
  Bell,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Send,
  FileText,
} from "lucide-react";
import { FaLinkedin, FaXTwitter, FaInstagram, FaThreads } from "react-icons/fa6";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

interface ScheduledPost {
  id: number;
  userId: number;
  content: string;
  platform: string;
  scheduledAt: string;
  status: string;
  postedAt: string | null;
  postId: string | null;
  postUrl: string | null;
  errorMessage: string | null;
  source: string | null;
  createdAt: string;
}

interface PipelineDraft {
  id: number;
  userId: number;
  pipelineId: number;
  content: string;
  platform: string;
  topic: string | null;
  suggestedMediaType: string | null;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  scheduledPostId: number | null;
  createdAt: string;
  updatedAt: string;
}

interface DraftStats {
  pending: number;
  approved: number;
  rejected: number;
  scheduled: number;
  posted: number;
}

type TabType = "pending_review" | "scheduled" | "posted" | "rejected";

export default function SchedulePage() {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>("pending_review");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  const [editingDraft, setEditingDraft] = useState<PipelineDraft | null>(null);
  const [formContent, setFormContent] = useState("");
  const [formPlatform, setFormPlatform] = useState("linkedin");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [scheduleDialogDraft, setScheduleDialogDraft] = useState<PipelineDraft | null>(null);

  const isPro = user?.plan === "pro";

  // Fetch draft stats
  const { data: statsData } = useQuery<{ stats: DraftStats }>({
    queryKey: ["/api/drafts/stats"],
    enabled: isLoggedIn && isPro,
    queryFn: async () => apiRequest<{ stats: DraftStats }>("/api/drafts/stats"),
  });

  // Fetch pending review drafts
  const { data: pendingDraftsData, isLoading: isLoadingDrafts } = useQuery<{ drafts: PipelineDraft[] }>({
    queryKey: ["/api/drafts/pending"],
    enabled: isLoggedIn && isPro,
    queryFn: async () => apiRequest<{ drafts: PipelineDraft[] }>("/api/drafts/pending"),
  });

  // Fetch all drafts (for other tabs)
  const { data: allDraftsData } = useQuery<{ drafts: PipelineDraft[] }>({
    queryKey: ["/api/drafts"],
    enabled: isLoggedIn && isPro,
    queryFn: async () => apiRequest<{ drafts: PipelineDraft[] }>("/api/drafts"),
  });

  // Fetch scheduled posts
  const { data: postsData, isLoading: isLoadingPosts } = useQuery<{ posts: ScheduledPost[] }>({
    queryKey: ["/api/scheduled-posts"],
    enabled: isLoggedIn && isPro,
    queryFn: async () => apiRequest<{ posts: ScheduledPost[] }>("/api/scheduled-posts"),
  });

  // Mutations for drafts
  const approveDraftMutation = useMutation({
    mutationFn: async (draftId: number) => {
      return apiRequest(`/api/drafts/${draftId}/approve`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/stats"] });
      toast({ title: "Draft Approved", description: "Ready to schedule." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async ({ draftId, reason }: { draftId: number; reason?: string }) => {
      return apiRequest(`/api/drafts/${draftId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/stats"] });
      toast({ title: "Draft Rejected" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const scheduleDraftMutation = useMutation({
    mutationFn: async ({ draftId, scheduledAt }: { draftId: number; scheduledAt: string }) => {
      return apiRequest(`/api/drafts/${draftId}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduledAt }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({ title: "Draft Scheduled!", description: "Post will go live at the scheduled time." });
      setScheduleDialogDraft(null);
      setSelectedDate(undefined);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateDraftMutation = useMutation({
    mutationFn: async ({ draftId, content }: { draftId: number; content: string }) => {
      return apiRequest(`/api/drafts/${draftId}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      toast({ title: "Draft Updated" });
      setEditingDraft(null);
      setFormContent("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteDraftMutation = useMutation({
    mutationFn: async (draftId: number) => {
      return apiRequest(`/api/drafts/${draftId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/stats"] });
      toast({ title: "Draft Deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Mutations for scheduled posts
  const createPostMutation = useMutation({
    mutationFn: async (data: { content: string; platform: string; scheduledAt: string }) => {
      return apiRequest("/api/scheduled-posts", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({ title: "Post Scheduled!" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/scheduled-posts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({ title: "Post Updated" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/scheduled-posts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-posts"] });
      toast({ title: "Post Removed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowCreateDialog(false);
    setEditingPost(null);
    setEditingDraft(null);
    setFormContent("");
    setFormPlatform("linkedin");
    setSelectedDate(undefined);
  };

  const handleSubmit = () => {
    if (!formContent.trim() || !selectedDate) {
      toast({ title: "Missing info", description: "Write content and pick a time.", variant: "destructive" });
      return;
    }

    const scheduledAt = selectedDate.toISOString();

    if (editingPost) {
      updatePostMutation.mutate({
        id: editingPost.id,
        data: { content: formContent, platform: formPlatform, scheduledAt },
      });
    } else {
      createPostMutation.mutate({ content: formContent, platform: formPlatform, scheduledAt });
    }
  };

  const handleScheduleDraft = () => {
    if (!scheduleDialogDraft || !selectedDate) return;
    scheduleDraftMutation.mutate({
      draftId: scheduleDialogDraft.id,
      scheduledAt: selectedDate.toISOString(),
    });
  };

  const openEditPostDialog = (post: ScheduledPost) => {
    setEditingPost(post);
    setFormContent(post.content);
    setFormPlatform(post.platform);
    setSelectedDate(new Date(post.scheduledAt));
    setShowCreateDialog(true);
  };

  const openEditDraftDialog = (draft: PipelineDraft) => {
    setEditingDraft(draft);
    setFormContent(draft.content);
  };

  const copyContent = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copied!" });
  };

  // Data processing
  const stats = statsData?.stats || { pending: 0, approved: 0, rejected: 0, scheduled: 0, posted: 0 };
  const pendingDrafts = pendingDraftsData?.drafts || [];
  const allDrafts = allDraftsData?.drafts || [];
  const posts = postsData?.posts || [];

  const pendingPosts = posts.filter((p) => p.status === "pending");
  const completedPosts = posts.filter((p) => p.status === "posted");
  const failedPosts = posts.filter((p) => p.status === "failed");
  const rejectedDrafts = allDrafts.filter((d) => d.status === "rejected");

  const existingDates = pendingPosts.map(p => new Date(p.scheduledAt));

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'linkedin':
        return <FaLinkedin className="w-4 h-4 text-[#0A66C2]" />;
      case 'twitter':
        return <FaXTwitter className="w-4 h-4" />;
      case 'instagram':
        return <FaInstagram className="w-4 h-4 text-pink-500" />;
      case 'threads':
        return <FaThreads className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <Calendar className="w-12 h-12 text-white/20 mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-white mb-3 tracking-tight">Content Pipeline</h1>
            <p className="text-white/50 text-base mb-8 leading-relaxed">
              Sign in to manage your content pipeline and scheduled posts.
            </p>
            <Link href="/">
              <Button className="bg-white text-black hover:bg-white/90 font-medium px-8 h-11">
                Get Started
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not Pro
  if (!isPro) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
        <AppHeader />
        <ProPaywall
          icon={Calendar}
          title="Content Pipeline"
          description="Auto-generate content, review before posting, and schedule across platforms."
          features={[
            { text: "AI auto-generates content for you" },
            { text: "Review and approve before posting" },
            { text: "Schedule posts in advance" },
            { text: "Nothing posts without your approval" },
          ]}
          ctaText="Upgrade to Pro"
        />
        <Footer />
      </div>
    );
  }

  const tabs = [
    { id: "pending_review" as TabType, label: "Pending Review", count: stats.pending, icon: Bell },
    { id: "scheduled" as TabType, label: "Scheduled", count: pendingPosts.length, icon: Clock },
    { id: "posted" as TabType, label: "Posted", count: completedPosts.length, icon: CheckCircle },
    { id: "rejected" as TabType, label: "Rejected", count: rejectedDrafts.length, icon: XCircle },
  ];

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">Content Pipeline</h1>
            <p className="text-white/40 text-base">
              Review, approve, and schedule your content
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/pipelines">
              <Button variant="outline" className="border-white/10 text-white/70 hover:bg-white/10 hover:text-white">
                <Sparkles className="w-4 h-4 mr-2" />
                Manage Pipelines
              </Button>
            </Link>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Post
            </Button>
          </div>
        </div>

        {/* Pending Review Alert */}
        {stats.pending > 0 && activeTab !== "pending_review" && (
          <button
            onClick={() => setActiveTab("pending_review")}
            className="w-full mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 hover:bg-amber-500/15 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-medium">{stats.pending} draft{stats.pending > 1 ? 's' : ''} pending review</p>
              <p className="text-white/50 text-sm">Click to review and approve</p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                  activeTab === tab.id ? "bg-black/10" : "bg-white/10"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "pending_review" && (
          <div className="space-y-4">
            {isLoadingDrafts ? (
              <div className="py-20 text-center">
                <Loader2 className="w-6 h-6 text-white/30 animate-spin mx-auto" />
              </div>
            ) : pendingDrafts.length === 0 ? (
              <div className="py-16 text-center border border-white/10 rounded-xl">
                <Bell className="w-10 h-10 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-base mb-2">No drafts pending review</p>
                <p className="text-white/30 text-sm">
                  Set up a <Link href="/pipelines" className="text-amber-500 hover:underline">content pipeline</Link> to auto-generate drafts
                </p>
              </div>
            ) : (
              pendingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="bg-white/[0.03] border border-white/10 rounded-xl p-5"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getPlatformIcon(draft.platform)}</span>
                      <span className="text-white/60 text-sm font-medium capitalize">{draft.platform}</span>
                      {draft.topic && (
                        <span className="text-xs px-2 py-0.5 bg-white/10 rounded text-white/50">
                          {draft.topic}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/30">{formatDate(draft.createdAt)}</span>
                  </div>

                  {/* Content */}
                  {editingDraft?.id === draft.id ? (
                    <div className="mb-4">
                      <textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        className="w-full min-h-[120px] px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-[15px] resize-none focus:outline-none focus:border-white/20"
                      />
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => updateDraftMutation.mutate({ draftId: draft.id, content: formContent })}
                          disabled={updateDraftMutation.isPending}
                          className="bg-white text-black hover:bg-white/90"
                        >
                          {updateDraftMutation.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setEditingDraft(null); setFormContent(""); }}
                          className="text-white/50 hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/80 text-[15px] leading-relaxed whitespace-pre-wrap mb-4">
                      {draft.content}
                    </p>
                  )}

                  {/* Suggested Media */}
                  {draft.suggestedMediaType && (
                    <div className="mb-4 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg inline-flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-sm text-purple-300">
                        Suggested: Add {draft.suggestedMediaType}
                      </span>
                    </div>
                  )}

                  {/* Actions */}
                  {editingDraft?.id !== draft.id && (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                      <Button
                        size="sm"
                        onClick={() => {
                          setScheduleDialogDraft(draft);
                          setSelectedDate(undefined);
                        }}
                        className="bg-green-500 hover:bg-green-600 text-white"
                      >
                        <ThumbsUp className="w-4 h-4 mr-1" />
                        Approve & Schedule
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => approveDraftMutation.mutate(draft.id)}
                        disabled={approveDraftMutation.isPending}
                        variant="outline"
                        className="border-white/10 text-white/70 hover:bg-white/10"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Approve Only
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => openEditDraftDialog(draft)}
                        variant="ghost"
                        className="text-white/50 hover:text-white"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <div className="flex-1" />
                      <Button
                        size="sm"
                        onClick={() => copyContent(draft.content)}
                        variant="ghost"
                        className="text-white/40 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => rejectDraftMutation.mutate({ draftId: draft.id })}
                        disabled={rejectDraftMutation.isPending}
                        variant="ghost"
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <ThumbsDown className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "scheduled" && (
          <div className="space-y-3">
            {isLoadingPosts ? (
              <div className="py-20 text-center">
                <Loader2 className="w-6 h-6 text-white/30 animate-spin mx-auto" />
              </div>
            ) : pendingPosts.length === 0 ? (
              <div className="py-16 text-center border border-white/10 rounded-xl">
                <Clock className="w-10 h-10 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-base">No posts scheduled</p>
              </div>
            ) : (
              pendingPosts.map((post) => (
                <div
                  key={post.id}
                  className="bg-white/[0.03] border border-white/10 rounded-xl p-5 group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getPlatformIcon(post.platform)}</span>
                      <span className="text-white/70 text-sm font-medium">
                        {formatDate(post.scheduledAt)} at {formatTime(post.scheduledAt)}
                      </span>
                      {post.source === 'pipeline' && (
                        <span className="text-xs px-2 py-0.5 bg-purple-500/20 rounded text-purple-300">
                          <Sparkles className="w-3 h-3 inline mr-1" />
                          Auto-generated
                        </span>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-white hover:bg-white/10 h-8 w-8"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
                        <DropdownMenuItem onClick={() => openEditPostDialog(post)} className="text-white/70 focus:text-white focus:bg-white/10">
                          <Edit2 className="w-4 h-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyContent(post.content)} className="text-white/70 focus:text-white focus:bg-white/10">
                          <Copy className="w-4 h-4 mr-2" /> Copy
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deletePostMutation.mutate(post.id)}
                          className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-white/80 text-[15px] leading-relaxed line-clamp-3">
                    {post.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "posted" && (
          <div className="space-y-2">
            {completedPosts.length === 0 ? (
              <div className="py-16 text-center border border-white/10 rounded-xl">
                <CheckCircle className="w-10 h-10 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-base">No posts published yet</p>
              </div>
            ) : (
              completedPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-lg flex-shrink-0">{getPlatformIcon(post.platform)}</span>
                    <p className="text-white/50 text-sm truncate flex-1">{post.content.substring(0, 60)}...</p>
                    <span className="text-white/30 text-xs flex-shrink-0">{formatDate(post.postedAt || post.scheduledAt)}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {(post.postUrl || post.postId) && (
                      <a
                        href={post.postUrl || `https://www.linkedin.com/feed/update/${post.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="text-white/30 hover:text-white h-8 w-8">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePostMutation.mutate(post.id)}
                      className="text-white/30 hover:text-red-400 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "rejected" && (
          <div className="space-y-2">
            {rejectedDrafts.length === 0 ? (
              <div className="py-16 text-center border border-white/10 rounded-xl">
                <XCircle className="w-10 h-10 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-base">No rejected drafts</p>
              </div>
            ) : (
              rejectedDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span className="text-lg flex-shrink-0">{getPlatformIcon(draft.platform)}</span>
                    <p className="text-white/50 text-sm truncate flex-1">{draft.content.substring(0, 60)}...</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDraftMutation.mutate(draft.id)}
                    className="text-white/30 hover:text-red-400 h-8 w-8 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Schedule Draft Dialog */}
        <Dialog open={!!scheduleDialogDraft} onOpenChange={(open) => !open && setScheduleDialogDraft(null)}>
          <DialogContent className="bg-[#141414] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">Schedule Post</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white/70 text-sm leading-relaxed line-clamp-4">
                  {scheduleDialogDraft?.content}
                </p>
              </div>

              <div>
                <label className="text-sm text-white/50 mb-2 block">When to post</label>
                <SmartTimePicker
                  onSelect={setSelectedDate}
                  selectedDate={selectedDate}
                  existingPostDates={existingDates}
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button
                variant="ghost"
                onClick={() => setScheduleDialogDraft(null)}
                className="text-white/50 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleScheduleDraft}
                disabled={scheduleDraftMutation.isPending || !selectedDate}
                className="bg-green-500 hover:bg-green-600 text-white font-medium"
              >
                {scheduleDraftMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Schedule
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create/Edit Post Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="bg-[#141414] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingPost ? "Edit Post" : "Schedule Post"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div>
                <label className="text-sm text-white/50 mb-2 block">Content</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write your post..."
                  className="w-full min-h-[160px] px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-[15px] leading-relaxed resize-none focus:outline-none focus:border-white/20 placeholder:text-white/30"
                />
                <p className={`text-xs mt-2 ${formContent.length > 3000 ? 'text-red-400' : 'text-white/30'}`}>
                  {formContent.length} / 3,000
                </p>
              </div>

              <div>
                <label className="text-sm text-white/50 mb-2 block">When to post</label>
                <SmartTimePicker
                  onSelect={setSelectedDate}
                  selectedDate={selectedDate}
                  existingPostDates={existingDates}
                />
              </div>
            </div>

            <DialogFooter className="gap-3">
              <Button
                variant="ghost"
                onClick={resetForm}
                className="text-white/50 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createPostMutation.isPending || updatePostMutation.isPending || !formContent.trim() || !selectedDate}
                className="bg-white text-black hover:bg-white/90 font-medium"
              >
                {createPostMutation.isPending || updatePostMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                {editingPost ? "Update" : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
}
