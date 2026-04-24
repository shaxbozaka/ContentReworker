import { useState } from "react";
import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import ProPaywall from "@/components/ProPaywall";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ImagePlus,
  Sparkles,
  Download,
  Loader2,
  Twitter,
  Linkedin,
  Instagram,
  Image as ImageIcon,
  Wand2,
  RefreshCw,
} from "lucide-react";

type ImageStyle = "creative" | "professional" | "minimal";
type Platform = "twitter" | "linkedin" | "instagram" | "custom";

const platformConfig = {
  twitter: {
    icon: Twitter,
    label: "Twitter/X Banner",
    description: "Wide format, perfect for posts and profile banners",
    color: "text-sky-500",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
  },
  linkedin: {
    icon: Linkedin,
    label: "LinkedIn",
    description: "Professional wide format for business posts",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    description: "Square format, ideal for feed posts",
    color: "text-pink-500",
    bgColor: "bg-pink-50",
    borderColor: "border-pink-200",
  },
  custom: {
    icon: ImageIcon,
    label: "Custom Prompt",
    description: "Enter your own prompt for complete control",
    color: "text-purple-500",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
};

const styleConfig = {
  creative: {
    label: "Creative",
    description: "Vibrant, eye-catching, bold colors",
  },
  professional: {
    label: "Professional",
    description: "Clean, corporate, subtle colors",
  },
  minimal: {
    label: "Minimal",
    description: "Simple, elegant, lots of white space",
  },
};

export default function GeneratePage() {
  const { user, isLoggedIn, loginWithGoogle, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const isPro = user?.plan === "pro";

  const [content, setContent] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] = useState<Platform>("linkedin");
  const [style, setStyle] = useState<ImageStyle>("creative");
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{
    url: string;
    revisedPrompt: string;
  } | null>(null);

  const handleGenerate = async () => {
    if (!isLoggedIn) {
      toast({
        title: "Sign in required",
        description: "Please sign in to generate images.",
      });
      loginWithGoogle();
      return;
    }

    if (!isPro) {
      toast({
        title: "Pro subscription required",
        description: "Upgrade to Pro to access AI image generation.",
        variant: "destructive",
      });
      return;
    }

    const promptText = platform === "custom" ? customPrompt : content;
    if (!promptText.trim()) {
      toast({
        title: "Content required",
        description: platform === "custom"
          ? "Please enter a prompt for your image."
          : "Please enter content to base your image on.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGeneratedImage(null);

    try {
      const endpoint = platform === "custom"
        ? "/api/generate/custom-image"
        : "/api/generate/image";

      const body = platform === "custom"
        ? { prompt: customPrompt }
        : { content, platform, style };

      const response = await apiRequest<{
        success: boolean;
        imageUrl: string;
        revisedPrompt: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });

      setGeneratedImage({
        url: response.imageUrl,
        revisedPrompt: response.revisedPrompt,
      });
      toast({
        title: "Image generated!",
        description: "Your AI image is ready to download.",
      });
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage?.url) return;

    try {
      const response = await fetch(generatedImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-image-${platform}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Download failed",
        description: "Failed to download image. Try right-clicking and saving.",
        variant: "destructive",
      });
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0077b5]" />
        </main>
        <Footer />
      </div>
    );
  }

  // Show upgrade prompt for non-Pro users
  if (!isPro) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
        <AppHeader />
        <ProPaywall
          icon={ImagePlus}
          title="AI Image Generation"
          description="Create scroll-stopping visuals for your posts using DALL-E 3. From LinkedIn banners to Instagram graphics."
          features={[
            { text: "Generate images from your content" },
            { text: "Multiple platform formats supported" },
            { text: "Creative, professional & minimal styles" },
            { text: "Custom prompts for full control" },
          ]}
          ctaText="Unlock AI Images"
        />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <AppHeader />

      {/* Hero */}
      <section className="py-8 md:py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Pro Feature
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#faf7f2] mb-4 tracking-tight">
            AI Image Generator
          </h1>
          <p className="text-lg text-[#faf7f2]/60 max-w-2xl mx-auto">
            Create stunning images for your social media posts using DALL-E 3.
            Just describe what you want or let AI create visuals based on your content.
          </p>
        </div>
      </section>

      <main className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Input Section */}
            <div className="space-y-6">
              {/* Platform Selection */}
              <div className="bg-[#111111] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold text-[#faf7f2] mb-4">
                  Choose Format
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(platformConfig) as Platform[]).map((p) => {
                    const config = platformConfig[p];
                    const Icon = config.icon;
                    const isSelected = platform === p;
                    return (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? "border-[#0077b5] bg-[#0077b5]/10"
                            : "border-white/10 hover:border-white/20 bg-white/5"
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isSelected ? 'text-[#0077b5]' : 'text-[#faf7f2]/60'} mb-2`} />
                        <div className={`font-medium text-sm ${isSelected ? 'text-[#faf7f2]' : 'text-[#faf7f2]/80'}`}>
                          {config.label}
                        </div>
                        <div className="text-xs text-[#faf7f2]/40 mt-0.5">
                          {config.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Style Selection (only for social platforms) */}
              {platform !== "custom" && (
                <div className="bg-[#111111] rounded-xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold text-[#faf7f2] mb-4">
                    Choose Style
                  </h2>
                  <div className="flex gap-3">
                    {(Object.keys(styleConfig) as ImageStyle[]).map((s) => {
                      const config = styleConfig[s];
                      const isSelected = style === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStyle(s)}
                          className={`flex-1 p-3 rounded-xl border-2 text-center transition-all ${
                            isSelected
                              ? "border-[#0077b5] bg-[#0077b5]/10"
                              : "border-white/10 hover:border-white/20 bg-white/5"
                          }`}
                        >
                          <div className={`font-medium text-sm ${isSelected ? 'text-[#faf7f2]' : 'text-[#faf7f2]/80'}`}>
                            {config.label}
                          </div>
                          <div className="text-xs text-[#faf7f2]/40 mt-0.5">
                            {config.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content Input */}
              <div className="bg-[#111111] rounded-xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold text-[#faf7f2] mb-4">
                  {platform === "custom" ? "Enter Prompt" : "Describe Your Content"}
                </h2>
                <Textarea
                  placeholder={
                    platform === "custom"
                      ? "Describe the image you want to create in detail..."
                      : "Paste your content or describe what your post is about. The AI will create a matching visual..."
                  }
                  value={platform === "custom" ? customPrompt : content}
                  onChange={(e) =>
                    platform === "custom"
                      ? setCustomPrompt(e.target.value)
                      : setContent(e.target.value)
                  }
                  className="min-h-[150px] resize-none bg-[#0a0a0a] border-white/10 text-[#faf7f2] placeholder:text-[#faf7f2]/30"
                />
                <p className="text-xs text-[#faf7f2]/40 mt-2">
                  {platform === "custom"
                    ? "Be specific about colors, style, composition, and mood for best results."
                    : "The AI will analyze your content and create a relevant visual without text overlays."}
                </p>
              </div>

              {/* Generate Button */}
              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full py-6 bg-gradient-to-r from-[#0077b5] to-[#005885] hover:from-[#0088cc] hover:to-[#006699] text-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5 mr-2" />
                    Generate Image
                  </>
                )}
              </Button>
            </div>

            {/* Output Section */}
            <div className="bg-[#111111] rounded-xl p-6 border border-white/10 min-h-[500px] flex flex-col">
              <h2 className="text-lg font-semibold text-[#faf7f2] mb-4">
                Generated Image
              </h2>

              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-[#0077b5]/20 border-t-[#0077b5] animate-spin" />
                    <ImagePlus className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[#0077b5]" />
                  </div>
                  <p className="mt-6 text-[#faf7f2] font-medium">Creating your image...</p>
                  <p className="text-sm text-[#faf7f2]/40 mt-1">This may take 10-20 seconds</p>
                </div>
              ) : generatedImage ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 rounded-lg overflow-hidden bg-[#0a0a0a] mb-4">
                    <img
                      src={generatedImage.url}
                      alt="Generated AI image"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <Button
                        onClick={handleDownload}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download Image
                      </Button>
                      <Button
                        onClick={handleGenerate}
                        variant="outline"
                        className="flex-1 border-white/10 text-[#faf7f2] hover:bg-white/5"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                    {generatedImage.revisedPrompt && (
                      <details className="text-xs text-[#faf7f2]/40">
                        <summary className="cursor-pointer hover:text-[#faf7f2]/60">
                          View AI's interpretation
                        </summary>
                        <p className="mt-2 p-3 bg-[#0a0a0a] rounded-lg text-[#faf7f2]/60">
                          {generatedImage.revisedPrompt}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <ImagePlus className="w-10 h-10 text-[#faf7f2]/20" />
                  </div>
                  <p className="text-[#faf7f2]/60 font-medium">No image generated yet</p>
                  <p className="text-sm text-[#faf7f2]/40 mt-1 text-center max-w-xs">
                    Select a format, describe your content, and click Generate
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tips */}
          <div className="mt-12 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-[#faf7f2] text-center mb-6">
              Tips for Great Images
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-[#111111] rounded-xl p-5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-[#0077b5]/20 flex items-center justify-center mb-3">
                  <span className="text-lg text-[#0077b5]">1</span>
                </div>
                <h3 className="font-semibold text-[#faf7f2] mb-2">Be Specific</h3>
                <p className="text-sm text-[#faf7f2]/50">
                  Include details about colors, mood, composition, and style for better results.
                </p>
              </div>
              <div className="bg-[#111111] rounded-xl p-5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-[#0077b5]/20 flex items-center justify-center mb-3">
                  <span className="text-lg text-[#0077b5]">2</span>
                </div>
                <h3 className="font-semibold text-[#faf7f2] mb-2">No Text in Images</h3>
                <p className="text-sm text-[#faf7f2]/50">
                  AI-generated text often looks odd. Add text overlays separately in your editor.
                </p>
              </div>
              <div className="bg-[#111111] rounded-xl p-5 border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-[#0077b5]/20 flex items-center justify-center mb-3">
                  <span className="text-lg text-[#0077b5]">3</span>
                </div>
                <h3 className="font-semibold text-[#faf7f2] mb-2">Iterate</h3>
                <p className="text-sm text-[#faf7f2]/50">
                  Not happy with the first result? Regenerate or tweak your prompt for variations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
