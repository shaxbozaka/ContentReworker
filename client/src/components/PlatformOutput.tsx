import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PlatformType, PlatformOutput as PlatformOutputType } from "@shared/schema";
import LinkedInPostModal from "./LinkedInPostModal";
import ScheduleModal from "./ScheduleModal";
import { ImagePlus, Download, Loader2, X, Copy, RefreshCw, Edit3, Check, Sparkles, Clock, Zap, ArrowRight, ThumbsUp, ThumbsDown } from "lucide-react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { analytics } from "@/lib/analytics";

interface PlatformOutputProps {
  platform: PlatformType;
  content: string;
  characterCount?: number;
  hooks?: string[];
  body?: string;
  cta?: string;
  transformationId?: number | null;
}

interface LinkedInStatus {
  connected: boolean;
  profile?: { firstName?: string; lastName?: string };
}

interface TwitterStatus {
  connected: boolean;
  username?: string;
}

// Track hook analytics (fire-and-forget)
const trackHookAnalytics = (data: {
  hookType: string;
  hookIndex: number;
  hookContent?: string;
  platform?: string;
  contentLength?: number;
  action?: 'select' | 'copy' | 'post' | 'feedback';
  feedback?: number; // 1 = thumbs up, -1 = thumbs down
}) => {
  fetch('/api/analytics/hook-selection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  }).catch(() => {}); // Silently fail
};

// Fire-and-forget status update for transformations
const markTransformationPosted = (transformationId: number, platform: string) => {
  fetch(`/api/transformations/${transformationId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ status: 'posted', platform }),
  }).catch(() => {}); // Silently fail
};

export default function PlatformOutput({
  platform,
  content,
  characterCount,
  hooks,
  body,
  cta,
  transformationId
}: PlatformOutputProps) {
  const { copyToClipboard, regenerateOutput, isRepurposing } = useContent();
  const { user, isLoggedIn, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [selectedHookIndex, setSelectedHookIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [hookFeedback, setHookFeedback] = useState<Record<number, number>>({}); // index -> 1 or -1

  // LinkedIn-specific state
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Twitter/X-specific state
  const [twitterStatus, setTwitterStatus] = useState<TwitterStatus | null>(null);
  const [isPostingToTwitter, setIsPostingToTwitter] = useState(false);
  const [postedTweetUrl, setPostedTweetUrl] = useState<string | null>(null);

  // Image generation state (Pro feature)
  const [generatedImage, setGeneratedImage] = useState<{ url: string; revisedPrompt: string } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const isPro = user?.plan === 'pro';

  // Pipeline suggestion state
  const [showPipelineSuggestion, setShowPipelineSuggestion] = useState(false);
  const [pipelineCreated, setPipelineCreated] = useState(false);
  const queryClient = useQueryClient();

  // Check LinkedIn status on mount for LinkedIn platform (only if logged in)
  useEffect(() => {
    if (platform === "LinkedIn" && isLoggedIn && user?.id) {
      fetch('/api/social/linkedin/status', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setLinkedInStatus(data))
        .catch(() => setLinkedInStatus({ connected: false }));
    } else if (platform === "LinkedIn" && !isLoggedIn) {
      setLinkedInStatus({ connected: false });
    }
  }, [platform, isLoggedIn, user?.id]);

  // Check Twitter/X status on mount for Twitter platform
  useEffect(() => {
    if (platform === "Twitter" && isLoggedIn) {
      fetch('/api/social/twitter/status', { credentials: 'include' })
        .then(res => res.json())
        .then(data => setTwitterStatus(data))
        .catch(() => setTwitterStatus({ connected: false }));
    } else if (platform === "Twitter" && !isLoggedIn) {
      setTwitterStatus({ connected: false });
    }
  }, [platform, isLoggedIn]);

  // Open LinkedIn post modal
  const handleOpenPostModal = () => {
    setIsPostModalOpen(true);
  };

  // Connect to LinkedIn
  const handleConnectLinkedIn = () => {
    fetch('/api/social/linkedin/auth')
      .then(res => res.json())
      .then(data => {
        if (data.url || data.authUrl) {
          window.location.href = data.url || data.authUrl;
        }
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Could not start LinkedIn connection. Please try again.",
          variant: "destructive"
        });
      });
  };

  // Connect to Twitter/X
  const handleConnectTwitter = () => {
    fetch('/api/auth/twitter', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else if (data.error) {
          toast({
            title: "Connection Error",
            description: data.error,
            variant: "destructive"
          });
        }
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Could not start X connection. Please try again.",
          variant: "destructive"
        });
      });
  };

  // Post to Twitter/X
  const handlePostToTwitter = async () => {
    const textToPost = isEditing ? editedContent : currentContent;

    // Check if it's a thread (multiple tweets)
    const tweets = textToPost.split(/\(\d+\/\d+\)/).map(t => t.trim()).filter(t => t);

    setIsPostingToTwitter(true);
    try {
      if (tweets.length > 1) {
        // Post as thread
        const response = await apiRequest<{ success: boolean; threadUrl?: string; error?: string }>(
          '/api/social/twitter/thread',
          {
            method: 'POST',
            body: JSON.stringify({ tweets }),
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (response.success) {
          toast({
            title: "Thread posted!",
            description: "Your thread is now live on X.",
          });
          if (response.threadUrl) {
            setPostedTweetUrl(response.threadUrl);
          }
          if (transformationId) markTransformationPosted(transformationId, 'Twitter');
        }
      } else {
        // Post as single tweet
        const response = await apiRequest<{ success: boolean; tweetUrl?: string; error?: string }>(
          '/api/social/twitter/post',
          {
            method: 'POST',
            body: JSON.stringify({ content: textToPost }),
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (response.success) {
          toast({
            title: "Posted to X!",
            description: "Your post is now live.",
          });
          if (response.tweetUrl) {
            setPostedTweetUrl(response.tweetUrl);
          }
          if (transformationId) markTransformationPosted(transformationId, 'Twitter');
        }
      }
    } catch (error: any) {
      toast({
        title: "Failed to post",
        description: error.message || "Could not post to X. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPostingToTwitter(false);
    }
  };

  // Build current content based on selected hook
  const getCurrentContent = () => {
    if (platform === "LinkedIn" && hooks && hooks.length > 0 && body) {
      let fullContent = hooks[selectedHookIndex] + '\n\n' + body;
      if (cta) {
        fullContent += '\n\n' + cta;
      }
      return fullContent;
    }
    return content;
  };

  const currentContent = getCurrentContent();
  const currentCharCount = currentContent.length;

  // Update edited content when hook changes
  useEffect(() => {
    if (!isEditing) {
      setEditedContent(currentContent);
    }
  }, [selectedHookIndex, currentContent, isEditing]);

  const handleCopy = () => {
    copyToClipboard(isEditing ? editedContent : currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Track copy action (internal + Umami)
    analytics.contentCopied(platform);
    if (platform === 'LinkedIn' && hooks && hooks.length > 0) {
      const hookLabels = ["bold_take", "results_story", "pain_point"];
      trackHookAnalytics({
        hookType: hookLabels[selectedHookIndex] || `hook_${selectedHookIndex}`,
        hookIndex: selectedHookIndex,
        hookContent: hooks[selectedHookIndex],
        platform,
        contentLength: content?.length,
        action: 'copy',
      });
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(currentContent);
  };

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(currentContent);
  };

  const handleRegenerate = () => {
    regenerateOutput(platform);
  };

  // Generate image for this platform's content (Pro only)
  const handleGenerateImage = async () => {
    if (!isPro) {
      toast({
        title: "Pro feature",
        description: "Upgrade to Pro to generate images for your posts.",
      });
      return;
    }

    setImageLoading(true);
    try {
      const platformMap: Record<string, string> = {
        Twitter: 'twitter',
        LinkedIn: 'linkedin',
        Instagram: 'instagram',
      };

      const response = await apiRequest<{
        success: boolean;
        imageUrl: string;
        revisedPrompt: string;
      }>('/api/generate/image', {
        method: 'POST',
        body: JSON.stringify({
          content: currentContent,
          platform: platformMap[platform] || 'linkedin',
          style: 'creative',
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      setGeneratedImage({
        url: response.imageUrl,
        revisedPrompt: response.revisedPrompt,
      });

      toast({
        title: "Image generated!",
        description: "Your matching visual is ready to download.",
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setImageLoading(false);
    }
  };

  // Create quick pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: async (data: { name: string; topics: string[]; platforms: string[] }) => {
      return apiRequest('/api/pipelines', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          tone: 'Professional',
          frequency: 'daily',
          draftsPerRun: 1,
          useHashtags: true,
          useEmojis: false,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      setPipelineCreated(true);
      queryClient.invalidateQueries({ queryKey: ['/api/pipelines'] });
      toast({
        title: "Pipeline Created!",
        description: "We'll generate drafts for you to review daily.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Could not create pipeline",
        variant: "destructive",
      });
    },
  });

  // Quick create pipeline from current content
  const handleQuickCreatePipeline = () => {
    // Extract a topic from the content (first 3 words or so)
    const words = currentContent.split(/\s+/).slice(0, 5).join(' ');
    const topic = words.length > 30 ? words.substring(0, 30) + '...' : words;

    createPipelineMutation.mutate({
      name: `LinkedIn Content Pipeline`,
      topics: [topic, platform.toLowerCase()],
      platforms: ["LinkedIn"],
    });
  };

  // Download generated image (using proxy to bypass CORS)
  const handleDownloadImage = async () => {
    if (!generatedImage?.url) return;
    try {
      // Use server proxy to bypass CORS restrictions
      const proxyUrl = `/api/image/proxy?url=${encodeURIComponent(generatedImage.url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${platform.toLowerCase()}-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({
        title: "Downloaded!",
        description: "Image saved to your downloads folder.",
      });
    } catch {
      toast({
        title: "Download failed",
        description: "Try right-clicking the image and saving.",
        variant: "destructive",
      });
    }
  };

  // Render pipeline suggestion after successful post
  const renderPipelineSuggestion = () => {
    if (platform !== "LinkedIn" || !showPipelineSuggestion || !isPro) return null;

    if (pipelineCreated) {
      return (
        <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-white">Pipeline Created!</p>
              <p className="text-sm text-white/60">Check your drafts daily at /schedule</p>
            </div>
            <Link href="/pipelines">
              <button className="px-3 py-1.5 text-sm font-medium text-green-400 hover:text-green-300 transition-colors">
                Manage Pipelines
              </button>
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white">Want more content like this?</p>
            <p className="text-sm text-white/60 mb-3">
              We can auto-generate similar posts for you to review & schedule.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleQuickCreatePipeline}
                disabled={createPipelineMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white transition-all disabled:opacity-50"
              >
                {createPipelineMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Yes, Set Up Pipeline
              </button>
              <Link href="/pipelines">
                <button className="flex items-center gap-1 px-3 py-2 text-sm text-white/60 hover:text-white transition-colors">
                  Customize First <ArrowRight className="w-3 h-3" />
                </button>
              </Link>
              <button
                onClick={() => setShowPipelineSuggestion(false)}
                className="px-3 py-2 text-sm text-white/40 hover:text-white/60 transition-colors"
              >
                Not Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const platformInfo = getPlatformInfo(platform);

  // Function to format content based on platform type
  const formatContent = (displayContent: string) => {
    if (platform === "Twitter") {
      // For Twitter, split by (1/4) style numbering pattern
      const tweets = displayContent.split(/\(\d+\/\d+\)/).map(t => t.trim()).filter(t => t);

      return (
        <div className="space-y-3">
          {tweets.map((tweet, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <span className="rounded bg-white px-2 py-0.5 font-mono text-xs font-bold text-slate-500 shadow-sm">
                  {index + 1}/{tweets.length}
                </span>
                <div className="flex-1">
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{tweet}</p>
                  <span className={`mt-2 block text-xs font-semibold ${tweet.length > 280 ? 'text-red-500' : 'text-slate-500'}`}>
                    {tweet.length}/280
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // For other platforms
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="whitespace-pre-wrap text-sm leading-7 text-slate-800" dangerouslySetInnerHTML={{ __html: displayContent.replace(/\n/g, "<br/>") }} />
      </div>
    );
  };

  const getCharacterLimit = () => {
    switch (platform) {
      case "Twitter":
        return 280;
      case "Instagram":
        return 2200;
      case "LinkedIn":
        return 3000;
      case "Threads":
        return 500;
      default:
        return undefined;
    }
  };

  const limit = getCharacterLimit();
  const displayCharCount = isEditing ? editedContent.length : currentCharCount;

  // LinkedIn hook selector component
  const renderHookSelector = () => {
    if (platform !== "LinkedIn" || !hooks || hooks.length === 0) {
      return null;
    }

    return (
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-[rgb(var(--color-linkedin))]" />
          <h4 className="font-black text-slate-950">Choose Your Hook</h4>
          <span className="text-xs font-semibold text-slate-500">First 210 chars show in feed</span>
        </div>
        <div className="space-y-2">
          {hooks.map((hook, index) => {
            const hookLabels = ["Bold Take", "Results Story", "Pain Point"];
            return (
              <button
                key={index}
                onClick={() => {
                  setSelectedHookIndex(index);
                  // Track hook selection (internal + Umami)
                  const hookType = hookLabels[index]?.toLowerCase().replace(' ', '_') || `hook_${index}`;
                  trackHookAnalytics({
                    hookType,
                    hookIndex: index,
                    hookContent: hook,
                    platform,
                    contentLength: content?.length,
                    action: 'select',
                  });
                  analytics.hookSelected(index, hookType);
                }}
                className={`w-full rounded-lg border p-3 text-left transition-all ${
                  selectedHookIndex === index
                    ? 'border-[rgb(var(--color-linkedin))] bg-white shadow-sm'
                    : 'border-blue-100 bg-white/70 hover:bg-white'
                }`}
              >
                <div className="flex items-start">
                  <div className={`mr-3 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    selectedHookIndex === index
                      ? 'border-[rgb(var(--color-linkedin))] bg-[rgb(var(--color-linkedin))]'
                      : 'border-slate-300'
                  }`}>
                    {selectedHookIndex === index && (
                      <Check className="h-3 w-3 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-black uppercase tracking-[0.14em] text-[rgb(var(--color-linkedin))]">
                      {hookLabels[index] || `Hook ${index + 1}`}
                    </span>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{hook}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {hook.length} chars
                        {hook.length > 210 && (
                          <span className="ml-2 text-[rgb(var(--color-coral))]">
                            May be truncated
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setHookFeedback(prev => ({ ...prev, [index]: 1 }));
                            trackHookAnalytics({
                              hookType: hookLabels[index]?.toLowerCase().replace(' ', '_') || `hook_${index}`,
                              hookIndex: index,
                              hookContent: hook,
                              platform,
                              action: 'feedback',
                              feedback: 1,
                            });
                            analytics.hookFeedback(index, 'up');
                            toast({ title: "Thanks for the feedback!", description: "This helps us improve hook quality." });
                          }}
                          className={`p-1.5 rounded-md transition-all ${
                            hookFeedback[index] === 1
                              ? 'bg-green-100 text-green-700'
                              : 'text-slate-400 hover:bg-green-50 hover:text-green-700'
                          }`}
                          title="Good hook"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setHookFeedback(prev => ({ ...prev, [index]: -1 }));
                            trackHookAnalytics({
                              hookType: hookLabels[index]?.toLowerCase().replace(' ', '_') || `hook_${index}`,
                              hookIndex: index,
                              hookContent: hook,
                              platform,
                              action: 'feedback',
                              feedback: -1,
                            });
                            analytics.hookFeedback(index, 'down');
                            toast({ title: "Thanks for the feedback!", description: "We'll work on improving this." });
                          }}
                          className={`p-1.5 rounded-md transition-all ${
                            hookFeedback[index] === -1
                              ? 'bg-red-100 text-red-700'
                              : 'text-slate-400 hover:bg-red-50 hover:text-red-700'
                          }`}
                          title="Needs improvement"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // LinkedIn post action bar
  const renderLinkedInActions = () => {
    if (platform !== "LinkedIn") {
      return null;
    }

    // Not logged in state
    if (!isLoggedIn) {
      return (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <i className="fab fa-linkedin text-[#0A66C2] text-2xl mr-3"></i>
              <div>
                <h4 className="font-bold text-slate-950">Post to LinkedIn</h4>
                <p className="text-sm font-medium text-slate-500">Sign in to connect your account</p>
              </div>
            </div>
            <Button
              onClick={loginWithGoogle}
              className="bg-slate-950 font-bold text-white hover:bg-slate-800"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </Button>
          </div>
        </div>
      );
    }

    // Not connected state
    if (!linkedInStatus?.connected) {
      return (
        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <i className="fab fa-linkedin text-[#0A66C2] text-2xl mr-3"></i>
              <div>
                <h4 className="font-bold text-slate-950">Post to LinkedIn</h4>
                <p className="text-sm font-medium text-slate-500">Connect your account to publish</p>
              </div>
            </div>
            <Button
              onClick={handleConnectLinkedIn}
              className="bg-[#0A66C2] hover:bg-[#004182] text-white"
            >
              <i className="fab fa-linkedin mr-2"></i> Connect LinkedIn
            </Button>
          </div>
        </div>
      );
    }

    // Connected state - show preview and post button
    const previewText = isEditing ? editedContent : currentContent;
    const first210 = previewText.substring(0, 210);
    const hasMore = previewText.length > 210;

    return (
      <>
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-3">
            <div className="w-12 h-12 bg-[#0A66C2] rounded-full flex items-center justify-center">
              <i className="fab fa-linkedin text-white text-xl"></i>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-950">
                {linkedInStatus.profile?.firstName} {linkedInStatus.profile?.lastName}
              </p>
              <p className="text-xs font-semibold text-slate-500">Post to LinkedIn</p>
            </div>
          </div>

          <div className="bg-white p-4">
            <p className="mb-2 flex items-center text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              <i className="fas fa-eye mr-1"></i> Feed Preview
            </p>
            <div className="text-sm leading-7 text-slate-700">
              <span>{first210}</span>
              {hasMore && <span className="text-[#0A66C2] font-medium cursor-pointer">...see more</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
            <Button
              onClick={() => setIsScheduleModalOpen(true)}
              variant="outline"
              className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            >
              <Clock className="w-4 h-4 mr-2" /> Schedule for Later
            </Button>
            <Button
              onClick={handleOpenPostModal}
              className="bg-[#0A66C2] hover:bg-[#004182] text-white"
            >
              <Edit3 className="w-4 h-4 mr-2" /> Preview & Post
            </Button>
          </div>
        </div>

        <ScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          content={isEditing ? editedContent : currentContent}
          platform={platform}
          hookLabel={hooks && hooks.length > 0 ? ["Bold Take", "Results Story", "Pain Point"][selectedHookIndex] : undefined}
        />

        <LinkedInPostModal
          isOpen={isPostModalOpen}
          onClose={() => setIsPostModalOpen(false)}
          initialContent={getCurrentContent()}
          profile={linkedInStatus.profile}
          userId={user?.id}
          generatedImageUrl={generatedImage?.url}
          hookIndex={selectedHookIndex}
          hookLabel={hooks && hooks.length > 0 ? ["Bold Take", "Results Story", "Pain Point"][selectedHookIndex] : undefined}
          transformationId={transformationId}
        />
      </>
    );
  };

  // Twitter/X post action bar
  const renderTwitterActions = () => {
    if (platform !== "Twitter") {
      return null;
    }

    // Not logged in state
    if (!isLoggedIn) {
      return (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <i className="fab fa-x-twitter text-slate-950 text-2xl mr-3"></i>
              <div>
                <h4 className="font-bold text-slate-950">Post to X</h4>
                <p className="text-sm font-medium text-slate-500">Sign in to connect your account</p>
              </div>
            </div>
            <Button
              onClick={loginWithGoogle}
              className="bg-slate-950 font-bold text-white hover:bg-slate-800"
            >
              Sign in first
            </Button>
          </div>
        </div>
      );
    }

    // Not connected state
    if (!twitterStatus?.connected) {
      return (
        <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              <i className="fab fa-x-twitter text-slate-950 text-2xl mr-3"></i>
              <div>
                <h4 className="font-bold text-slate-950">Post to X</h4>
                <p className="text-sm font-medium text-slate-500">Connect your account to publish</p>
              </div>
            </div>
            <Button
              onClick={handleConnectTwitter}
              className="bg-white hover:bg-white/90 text-black"
            >
              <i className="fab fa-x-twitter mr-2"></i> Connect X
            </Button>
          </div>
        </div>
      );
    }

    // Connected state - show post button
    const textToPost = isEditing ? editedContent : currentContent;
    const tweets = textToPost.split(/\(\d+\/\d+\)/).map(t => t.trim()).filter(t => t);
    const isThread = tweets.length > 1;

    return (
      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center">
            <i className="fab fa-x-twitter text-slate-950 text-2xl mr-3"></i>
            <div>
              <p className="font-bold text-slate-950">@{twitterStatus.username}</p>
              <p className="text-sm font-medium text-slate-500">
                {postedTweetUrl ? (
                  <span className="text-green-400">Posted successfully</span>
                ) : (
                  isThread ? `${tweets.length} tweets ready` : 'Ready to post'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {postedTweetUrl && (
              <a
                href={postedTweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all"
              >
                <i className="fas fa-external-link-alt text-xs"></i>
                View Post
              </a>
            )}
            <Button
              onClick={() => {
                setPostedTweetUrl(null);
                handlePostToTwitter();
              }}
              disabled={isPostingToTwitter}
              className="bg-white hover:bg-white/90 text-black"
            >
              {isPostingToTwitter ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <i className="fab fa-x-twitter mr-2"></i>
              )}
              {postedTweetUrl ? 'Post Again' : (isThread ? 'Post Thread' : 'Post to X')}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // Count tweets for Twitter threads
  const tweetCount = platform === "Twitter"
    ? currentContent.split(/\(\d+\/\d+\)/).map(t => t.trim()).filter(t => t).length
    : 0;

  return (
    <div className="platform-output">
      <div className={`${platformInfo.bgClass} flex items-center justify-between rounded-t-lg px-4 py-3`}>
        <div className="flex items-center">
          <i className={`${platformInfo.icon} text-lg`}></i>
          <h3 className="ml-2 font-bold text-white">{platformInfo.title}</h3>
        </div>
        {platform === "Twitter" && tweetCount > 1 ? (
          <div className="text-sm font-semibold text-white/70">
            <span className="font-black text-white">{tweetCount}</span> tweets
          </div>
        ) : limit && (
          <div className="text-sm font-semibold text-white/70">
            <span className={`font-black ${displayCharCount > limit ? 'text-red-200' : 'text-white'}`}>
              {displayCharCount}
            </span>/{limit}
          </div>
        )}
      </div>

      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white p-4">
        {!isEditing && renderHookSelector()}

        {isEditing ? (
          <textarea
            className="input-dark min-h-[250px] p-4 text-sm leading-7"
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
          />
        ) : (
          formatContent(currentContent)
        )}

        {/* LinkedIn Post Action */}
        {renderLinkedInActions()}

        {/* Twitter/X Post Action */}
        {renderTwitterActions()}

        {/* Pipeline Suggestion (after successful post) */}
        {renderPipelineSuggestion()}

        {/* Generated Image Display (Pro feature) */}
        {generatedImage && (
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="relative">
              <img
                src={generatedImage.url}
                alt={`Generated image for ${platform}`}
                className="w-full h-auto"
              />
              <button
                onClick={() => setGeneratedImage(null)}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-3">
              <span className="text-xs font-semibold text-slate-500">AI-generated image</span>
              <Button
                size="sm"
                onClick={handleDownloadImage}
                className="bg-green-600 hover:bg-green-700 text-white text-xs"
              >
                <Download className="w-3 h-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        )}

        {/* Image Generation Loading State */}
        {imageLoading && (
          <div className="mt-4 flex flex-col items-center rounded-lg border border-blue-100 bg-blue-50 p-6">
            <Loader2 className="h-10 w-10 animate-spin text-[rgb(var(--color-linkedin))]" />
            <p className="mt-3 text-sm font-bold text-slate-950">Creating your image...</p>
            <p className="text-xs font-semibold text-slate-500">This takes about 10-15 seconds</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={isRepurposing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-950 disabled:opacity-50"
            >
              {isRepurposing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Regenerate
            </button>

            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-green-100 px-3 py-2 text-xs font-bold text-green-700 transition-all hover:bg-green-200"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
              </>
            ) : (
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-950"
              >
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Generate Image Button (Pro feature) - only show for supported platforms */}
            {(platform === 'Twitter' || platform === 'LinkedIn' || platform === 'Instagram' || platform === 'Threads') && (
              <button
                onClick={handleGenerateImage}
                disabled={imageLoading || !currentContent}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all disabled:opacity-50 ${
                  isPro
                    ? 'bg-slate-950 text-white shadow-sm hover:bg-slate-800'
                    : 'border border-slate-200 bg-slate-50 text-slate-400'
                }`}
                title={isPro ? "Generate matching image with DALL-E 3" : "Pro feature - Upgrade to unlock"}
              >
                {imageLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ImagePlus className="w-3 h-3" />
                )}
                {generatedImage ? 'New Image' : 'Generate Image'}
                {!isPro && <span className="ml-1 text-[10px] opacity-60">PRO</span>}
              </button>
            )}

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--color-linkedin))] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-[rgb(var(--color-linkedin-dark))]"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" /> Copy All
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPlatformInfo(platform: PlatformType) {
  switch (platform) {
    case 'Twitter':
      return {
        icon: 'fab fa-x-twitter text-white',
        bgClass: 'bg-black',
        title: 'Twitter / X'
      };
    case 'LinkedIn':
      return {
        icon: 'fab fa-linkedin text-white',
        bgClass: 'bg-[#0A66C2]',
        title: 'LinkedIn Post'
      };
    case 'Instagram':
      return {
        icon: 'fab fa-instagram text-white',
        bgClass: 'bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500',
        title: 'Instagram Caption'
      };
    case 'Threads':
      return {
        icon: 'fab fa-threads text-white',
        bgClass: 'bg-black',
        title: 'Threads'
      };
    case 'Email':
      return {
        icon: 'fas fa-envelope text-white',
        bgClass: 'bg-[#4a5568]',
        title: 'Email Newsletter'
      };
    default:
      return {
        icon: 'fas fa-file-alt text-white',
        bgClass: 'bg-[#4a5568]',
        title: 'Content'
      };
  }
}
