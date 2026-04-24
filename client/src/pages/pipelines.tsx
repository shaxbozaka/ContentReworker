import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import ProPaywall from "@/components/ProPaywall";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  Plus,
  Loader2,
  Play,
  Pause,
  Trash2,
  Edit2,
  Clock,
  Target,
  MoreVertical,
  Zap,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
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

interface ContentPipeline {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  topics: string[];
  tone: string;
  platforms: string[];
  frequency: string;
  cronExpression: string | null;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  draftsPerRun: number;
  useHashtags: boolean;
  useEmojis: boolean;
  aiProvider: string;
  autoGenerateMedia: boolean;
  preferredMediaType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  every_other_day: "Every Other Day",
  weekly: "Weekly",
  custom: "Custom Schedule",
};

const toneOptions = ["Professional", "Conversational", "Enthusiastic", "Informative", "Persuasive"];
const platformOptions = ["LinkedIn"];
const frequencyOptions = ["daily", "every_other_day", "weekly"];

export default function PipelinesPage() {
  const { user, isLoggedIn } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // UI State
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<ContentPipeline | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTopics, setFormTopics] = useState<string[]>([]);
  const [formTopicInput, setFormTopicInput] = useState("");
  const [formTone, setFormTone] = useState("Professional");
  const [formPlatforms, setFormPlatforms] = useState<string[]>(["LinkedIn"]);
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formDraftsPerRun, setFormDraftsPerRun] = useState(1);
  const [formUseHashtags, setFormUseHashtags] = useState(true);
  const [formUseEmojis, setFormUseEmojis] = useState(true);

  const isPro = user?.plan === "pro";

  // Fetch pipelines
  const { data: pipelinesData, isLoading } = useQuery<{ pipelines: ContentPipeline[] }>({
    queryKey: ["/api/pipelines"],
    enabled: isLoggedIn && isPro,
    queryFn: async () => apiRequest<{ pipelines: ContentPipeline[] }>("/api/pipelines"),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("/api/pipelines", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline Created!", description: "Your content pipeline is now active." });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest(`/api/pipelines/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline Updated" });
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pipelines/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline Deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pipelines/${id}/pause`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline Paused" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/pipelines/${id}/resume`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      toast({ title: "Pipeline Resumed" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const triggerMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest<{ draftsGenerated: number }>(`/api/pipelines/${id}/trigger`, { method: "POST" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drafts/stats"] });
      toast({
        title: "Content Generated!",
        description: `Created ${data.draftsGenerated} draft${data.draftsGenerated !== 1 ? 's' : ''} for review.`,
      });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setShowCreateDialog(false);
    setEditingPipeline(null);
    setFormName("");
    setFormDescription("");
    setFormTopics([]);
    setFormTopicInput("");
    setFormTone("Professional");
    setFormPlatforms(["LinkedIn"]);
    setFormFrequency("daily");
    setFormDraftsPerRun(1);
    setFormUseHashtags(true);
    setFormUseEmojis(true);
  };

  const openEditDialog = (pipeline: ContentPipeline) => {
    setEditingPipeline(pipeline);
    setFormName(pipeline.name);
    setFormDescription(pipeline.description || "");
    setFormTopics(pipeline.topics);
    setFormTone(pipeline.tone);
    setFormPlatforms(pipeline.platforms);
    setFormFrequency(pipeline.frequency);
    setFormDraftsPerRun(pipeline.draftsPerRun);
    setFormUseHashtags(pipeline.useHashtags);
    setFormUseEmojis(pipeline.useEmojis);
    setShowCreateDialog(true);
  };

  const handleAddTopic = () => {
    if (formTopicInput.trim() && !formTopics.includes(formTopicInput.trim())) {
      setFormTopics([...formTopics, formTopicInput.trim()]);
      setFormTopicInput("");
    }
  };

  const handleRemoveTopic = (topic: string) => {
    setFormTopics(formTopics.filter((t) => t !== topic));
  };

  const togglePlatform = (platform: string) => {
    if (formPlatforms.includes(platform)) {
      if (formPlatforms.length > 1) {
        setFormPlatforms(formPlatforms.filter((p) => p !== platform));
      }
    } else {
      setFormPlatforms([...formPlatforms, platform]);
    }
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast({ title: "Error", description: "Pipeline name is required", variant: "destructive" });
      return;
    }
    if (formTopics.length === 0) {
      toast({ title: "Error", description: "At least one topic is required", variant: "destructive" });
      return;
    }

    const data = {
      name: formName,
      description: formDescription || null,
      topics: formTopics,
      tone: formTone,
      platforms: formPlatforms,
      frequency: formFrequency,
      draftsPerRun: formDraftsPerRun,
      useHashtags: formUseHashtags,
      useEmojis: formUseEmojis,
    };

    if (editingPipeline) {
      updateMutation.mutate({ id: editingPipeline.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatNextRun = (nextRunAt: string | null) => {
    if (!nextRunAt) return "Not scheduled";
    const date = new Date(nextRunAt);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Soon";
    if (diffHours < 24) return `In ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    if (diffDays < 7) return `In ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const pipelines = pipelinesData?.pipelines || [];
  const activePipelines = pipelines.filter((p) => p.status === "active");
  const pausedPipelines = pipelines.filter((p) => p.status === "paused");

  // Not logged in
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-6" />
            <h1 className="text-2xl font-semibold text-white mb-3 tracking-tight">Content Pipelines</h1>
            <p className="text-white/50 text-base mb-8 leading-relaxed">
              Sign in to create automated content generation pipelines.
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
          icon={Sparkles}
          title="Content Pipelines"
          description="Set it and forget it. AI generates content drafts automatically."
          features={[
            { text: "Define topics and themes" },
            { text: "AI generates drafts daily/weekly" },
            { text: "Review and approve before posting" },
            { text: "Never run out of content ideas" },
          ]}
          ctaText="Upgrade to Pro"
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col">
      <AppHeader />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight mb-1">Content Pipelines</h1>
            <p className="text-white/40 text-base">
              {pipelines.length === 0
                ? "Create your first content pipeline"
                : `${activePipelines.length} active pipeline${activePipelines.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-white text-black hover:bg-white/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Pipeline
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin mx-auto" />
          </div>
        ) : pipelines.length === 0 ? (
          <div className="py-16 text-center border border-white/10 rounded-xl">
            <Sparkles className="w-12 h-12 text-white/10 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-white mb-2">No pipelines yet</h2>
            <p className="text-white/40 text-base mb-6 max-w-sm mx-auto">
              Create a pipeline to automatically generate content drafts based on your topics.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} className="bg-white text-black hover:bg-white/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Pipeline
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {pipelines.map((pipeline) => (
              <div
                key={pipeline.id}
                className={`bg-white/[0.03] border rounded-xl p-5 ${
                  pipeline.status === "active" ? "border-white/10" : "border-white/5 opacity-60"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-medium text-white">{pipeline.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          pipeline.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {pipeline.status === "active" ? (
                          <>
                            <CheckCircle className="w-3 h-3 inline mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3 inline mr-1" />
                            Paused
                          </>
                        )}
                      </span>
                    </div>
                    {pipeline.description && (
                      <p className="text-white/50 text-sm">{pipeline.description}</p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white/40 hover:text-white hover:bg-white/10 h-8 w-8"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#1a1a1a] border-white/10">
                      <DropdownMenuItem
                        onClick={() => openEditDialog(pipeline)}
                        className="text-white/70 focus:text-white focus:bg-white/10"
                      >
                        <Edit2 className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      {pipeline.status === "active" ? (
                        <DropdownMenuItem
                          onClick={() => pauseMutation.mutate(pipeline.id)}
                          className="text-white/70 focus:text-white focus:bg-white/10"
                        >
                          <Pause className="w-4 h-4 mr-2" /> Pause
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => resumeMutation.mutate(pipeline.id)}
                          className="text-white/70 focus:text-white focus:bg-white/10"
                        >
                          <Play className="w-4 h-4 mr-2" /> Resume
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(pipeline.id)}
                        className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Topics */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {pipeline.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs px-2.5 py-1 bg-white/10 rounded-full text-white/70"
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-white/50 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-4 h-4" />
                    {pipeline.platforms.join(", ")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {frequencyLabels[pipeline.frequency] || pipeline.frequency}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    {pipeline.draftsPerRun} draft{pipeline.draftsPerRun !== 1 ? "s" : ""}/run
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="text-sm text-white/40">
                    Next run: <span className="text-white/60">{formatNextRun(pipeline.nextRunAt)}</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => triggerMutation.mutate(pipeline.id)}
                    disabled={triggerMutation.isPending}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    {triggerMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4 mr-1" />
                    )}
                    Generate Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={(open) => !open && resetForm()}>
          <DialogContent className="bg-[#141414] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingPipeline ? "Edit Pipeline" : "Create Pipeline"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Name */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Pipeline Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Daily LinkedIn Tips"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-[15px] focus:outline-none focus:border-white/20 placeholder:text-white/30"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Description (optional)</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What's this pipeline for?"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-[15px] focus:outline-none focus:border-white/20 placeholder:text-white/30"
                />
              </div>

              {/* Topics */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Topics *</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={formTopicInput}
                    onChange={(e) => setFormTopicInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTopic())}
                    placeholder="Add a topic and press Enter"
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 placeholder:text-white/30"
                  />
                  <Button onClick={handleAddTopic} variant="outline" className="border-white/10 text-white/70">
                    Add
                  </Button>
                </div>
                {formTopics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formTopics.map((topic) => (
                      <span
                        key={topic}
                        className="text-xs px-2.5 py-1.5 bg-purple-500/20 rounded-full text-purple-300 flex items-center gap-1"
                      >
                        {topic}
                        <button
                          onClick={() => handleRemoveTopic(topic)}
                          className="hover:text-white ml-1"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-white/30 mt-2">
                  AI will generate content about these topics
                </p>
              </div>

              {/* Platforms */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Platforms *</label>
                <div className="flex flex-wrap gap-2">
                  {platformOptions.map((platform) => (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formPlatforms.includes(platform)
                          ? "bg-white text-black"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Generation Frequency</label>
                <div className="flex flex-wrap gap-2">
                  {frequencyOptions.map((freq) => (
                    <button
                      key={freq}
                      onClick={() => setFormFrequency(freq)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formFrequency === freq
                          ? "bg-white text-black"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      {frequencyLabels[freq]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">Tone</label>
                <select
                  value={formTone}
                  onChange={(e) => setFormTone(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white text-[15px] focus:outline-none focus:border-white/20"
                >
                  {toneOptions.map((tone) => (
                    <option key={tone} value={tone} className="bg-[#1a1a1a]">
                      {tone}
                    </option>
                  ))}
                </select>
              </div>

              {/* Drafts per run */}
              <div>
                <label className="text-sm text-white/50 mb-2 block">
                  Drafts per run: {formDraftsPerRun}
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={formDraftsPerRun}
                  onChange={(e) => setFormDraftsPerRun(parseInt(e.target.value))}
                  className="w-full accent-white"
                />
                <p className="text-xs text-white/30 mt-1">
                  Number of drafts to generate each time the pipeline runs
                </p>
              </div>

              {/* Options */}
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formUseHashtags}
                    onChange={(e) => setFormUseHashtags(e.target.checked)}
                    className="rounded border-white/20 bg-white/5"
                  />
                  <span className="text-sm text-white/70">Include hashtags</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formUseEmojis}
                    onChange={(e) => setFormUseEmojis(e.target.checked)}
                    className="rounded border-white/20 bg-white/5"
                  />
                  <span className="text-sm text-white/70">Include emojis</span>
                </label>
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
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-white text-black hover:bg-white/90 font-medium"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingPipeline ? "Update Pipeline" : "Create Pipeline"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
}
