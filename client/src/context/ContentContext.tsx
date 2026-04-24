import { createContext, useContext, useState, ReactNode } from "react";
import { 
  ContentSource, 
  PlatformType, 
  ToneType, 
  AIProvider,
  contentSources, 
  platformTypes, 
  toneTypes,
  aiProviders,
  TransformationRequest,
  TransformationResponse
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { analytics } from "@/lib/analytics";

// Sample content for instant demo
const SAMPLE_CONTENT = `The Future of Remote Work: Why Hybrid is Here to Stay

After three years of the remote work experiment, one thing is clear: the future isn't fully remote or fully in-office—it's hybrid.

Our research shows that 73% of employees want flexible remote work options to continue. But here's what's interesting: 67% also miss the spontaneous collaboration that happens in person.

The companies winning the talent war aren't forcing people back to cubicles. They're designing intentional in-person time for collaboration, while protecting deep work time at home.

Three keys to making hybrid work:
1. Async-first communication (not everything needs a meeting)
2. Clear expectations about when to be in-office
3. Investment in home office setups

The old 9-to-5, five-days-a-week model? It's not coming back. Smart companies are adapting. Are you?`;

// Sample output to show immediately
const SAMPLE_OUTPUT = {
  LinkedIn: {
    content: "The 9-to-5 office model is dead. Here's what's replacing it... 🏠💼\n\nAfter analyzing 3 years of remote work data, the verdict is in:\n\n→ 73% of employees want flexible remote options\n→ 67% miss in-person collaboration\n→ The winners? Companies embracing HYBRID.\n\nBut hybrid only works with intention:\n\n1️⃣ Async-first communication\n2️⃣ Clear in-office expectations  \n3️⃣ Real investment in home setups\n\nThe companies forcing people back to cubicles? They're losing the talent war.\n\nThe future of work isn't about where you work—it's about how you work.\n\n#FutureOfWork #RemoteWork #HybridWork #Leadership",
    characterCount: 612,
    hooks: [
      "The 9-to-5 office model is dead. Here's what's replacing it... 🏠💼",
      "73% of employees want this. Is your company listening? 👀",
      "We analyzed 3 years of remote work data. The results surprised us..."
    ],
    body: "After analyzing 3 years of remote work data, the verdict is in:\n\n→ 73% of employees want flexible remote options\n→ 67% miss in-person collaboration\n→ The winners? Companies embracing HYBRID.\n\nBut hybrid only works with intention:\n\n1️⃣ Async-first communication\n2️⃣ Clear in-office expectations  \n3️⃣ Real investment in home setups\n\nThe companies forcing people back to cubicles? They're losing the talent war.\n\nThe future of work isn't about where you work—it's about how you work.\n\n#FutureOfWork #RemoteWork #HybridWork #Leadership",
    cta: "What's your take—is hybrid the answer? Share below 👇",
    selectedHook: 0
  },
  Twitter: {
    content: "The future of work isn't remote OR in-office.\n\nIt's hybrid. Here's why:\n\n• 73% want flexible remote options\n• 67% miss in-person collaboration\n\nSmart companies are designing intentional in-person time while protecting deep work at home.\n\nThe 9-5 cubicle model? It's not coming back. 🧵",
    characterCount: 278
  },
  Instagram: {
    content: "💼 THE FUTURE OF WORK IS HERE\n\nAnd it's not what you think...\n\nAfter 3 years of the great remote work experiment:\n\n✨ 73% of employees want flexibility\n✨ 67% miss the office energy\n✨ The answer? HYBRID done right\n\nSwipe for the 3 keys to making it work →\n\n#futureofwork #remotework #hybridwork #careeradvice #worklifebalance #productivity #leadership #officelife #wfh #careertips",
    characterCount: 412
  },
  Email: {
    content: "Subject: The Office Model That's Actually Working in 2024\n\nHi there,\n\nRemember when everyone said remote work would never last?\n\nThree years later, we have the data—and it tells an interesting story.\n\n73% of employees want remote flexibility to continue. But 67% also miss something about the office.\n\nThe answer isn't picking sides. It's hybrid—done intentionally.\n\nHere's what's working:\n→ Async-first communication (fewer meetings, more deep work)\n→ Clear expectations about in-office days\n→ Real investment in home office setups\n\nThe companies winning the talent war right now? They're not forcing anyone back to cubicles. They're redesigning how work happens.\n\nFood for thought as you plan your week.\n\nBest,\n[Your name]",
    characterCount: 724
  }
};

interface ContentContextType {
  // Input state
  content: string;
  setContent: (content: string) => void;
  contentSource: ContentSource;
  setContentSource: (source: ContentSource) => void;

  // Demo functionality
  loadSampleContent: () => void;
  showSampleOutput: (silent?: boolean) => void;
  
  // Platform selection
  selectedPlatforms: PlatformType[];
  togglePlatform: (platform: PlatformType) => void;
  isPlatformSelected: (platform: PlatformType) => boolean;
  
  // AI settings
  tone: ToneType;
  setTone: (tone: ToneType) => void;
  outputLength: number;
  setOutputLength: (length: number) => void;
  useHashtags: boolean;
  setUseHashtags: (use: boolean) => void;
  useEmojis: boolean;
  setUseEmojis: (use: boolean) => void;
  aiProvider: AIProvider;
  setAIProvider: (provider: AIProvider) => void;
  
  // Results
  isRepurposing: boolean;
  repurposeContent: () => Promise<void>;
  outputs: TransformationResponse['outputs'] | null;
  transformationId: number | null;
  resetOutputs: () => void;
  activeTab: PlatformType;
  setActiveTab: (tab: PlatformType) => void;
  
  // Utilities
  getWordCount: () => number;
  copyToClipboard: (text: string) => void;
  regenerateOutput: (platform: PlatformType) => Promise<void>;
}

const ContentContext = createContext<ContentContextType | undefined>(undefined);

export function ContentProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  
  // Input state
  const [content, setContent] = useState<string>("");
  const [contentSource, setContentSource] = useState<ContentSource>(contentSources[0]);
  
  // Platform selection - default to LinkedIn only (most common use case)
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([
    "LinkedIn"
  ]);
  
  // AI settings
  const [tone, setTone] = useState<ToneType>(toneTypes[0]);
  const [outputLength, setOutputLength] = useState<number>(3);
  const [useHashtags, setUseHashtags] = useState<boolean>(true);
  const [useEmojis, setUseEmojis] = useState<boolean>(true);
  const [aiProvider, setAIProvider] = useState<AIProvider>("Gemini");
  
  // Results
  const [isRepurposing, setIsRepurposing] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<TransformationResponse['outputs'] | null>(null);
  const [transformationId, setTransformationId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformType>("LinkedIn");
  
  const togglePlatform = (platform: PlatformType) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platform)) {
        // Don't allow deselecting the last platform
        if (prev.length === 1) {
          toast({
            title: "At least one platform is required",
            description: "Please select at least one platform for repurposing",
            variant: "destructive"
          });
          return prev;
        }
        return prev.filter(p => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };
  
  const isPlatformSelected = (platform: PlatformType) => {
    return selectedPlatforms.includes(platform);
  };
  
  const getWordCount = () => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        toast({
          title: "Copied to clipboard",
          description: "The content has been copied to your clipboard",
          duration: 2000,
        });
      })
      .catch(() => {
        toast({
          title: "Copy failed",
          description: "Failed to copy to clipboard. Please try again.",
          variant: "destructive",
        });
      });
  };
  
  const repurposeContent = async () => {
    // Validate content
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please enter some content to repurpose",
        variant: "destructive"
      });
      return;
    }
    
    // Prepare request data
    const transformationRequest: TransformationRequest = {
      content,
      contentSource,
      platforms: selectedPlatforms,
      tone,
      outputLength,
      useHashtags,
      useEmojis,
      aiProvider
    };
    
    try {
      setIsRepurposing(true);
      
      // Call the API to repurpose content
      const data = await apiRequest<TransformationResponse & { transformationId?: number }>('/api/repurpose', {
        method: 'POST',
        body: JSON.stringify(transformationRequest),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setOutputs(data.outputs);
      if (data.transformationId) {
        setTransformationId(data.transformationId);
      }

      // Set active tab to first available platform
      if (selectedPlatforms.length > 0 && (!activeTab || !selectedPlatforms.includes(activeTab))) {
        setActiveTab(selectedPlatforms[0]);
      }

      // Track content generation
      const linkedinOutput = data.outputs?.LinkedIn;
      analytics.contentGenerated(
        selectedPlatforms[0] || 'LinkedIn',
        linkedinOutput?.hooks?.length || 0
      );

      toast({
        title: "Content repurposed",
        description: "Your content has been successfully repurposed",
      });
      
    } catch (error) {
      console.error("Repurposing failed:", error);

      // Check for rate limit error (429)
      const errorMessage = error instanceof Error ? error.message : '';
      if (errorMessage.includes('429')) {
        try {
          const errorJson = JSON.parse(errorMessage.substring(errorMessage.indexOf('{')));
          toast({
            title: "Daily limit reached",
            description: errorJson.message || "Upgrade to Pro for unlimited posts.",
            variant: "destructive"
          });
        } catch {
          toast({
            title: "Daily limit reached",
            description: "You've used all 3 free posts today. Upgrade to Pro for unlimited posts.",
            variant: "destructive"
          });
        }
      } else {
        toast({
          title: "Repurposing failed",
          description: "There was an error repurposing your content. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setIsRepurposing(false);
    }
  };
  
  const resetOutputs = () => {
    setOutputs(null);
    setTransformationId(null);
  };

  const loadSampleContent = () => {
    setContent(SAMPLE_CONTENT);
    setContentSource("Blog Post");
    toast({
      title: "Sample content loaded",
      description: "Click 'Repurpose Content' to see the magic!",
      duration: 3000,
    });
  };

  const showSampleOutput = (silent = false) => {
    setContent(SAMPLE_CONTENT);
    setContentSource("Blog Post");
    setOutputs(SAMPLE_OUTPUT as TransformationResponse['outputs']);
    setActiveTab("LinkedIn");

    // Scroll to output panel after a brief delay
    setTimeout(() => {
      const outputPanel = document.getElementById('output-panel');
      if (outputPanel) {
        outputPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);

    if (!silent) {
      toast({
        title: "Sample loaded!",
        description: "See the LinkedIn post below",
        duration: 2000,
      });
    }
  };
  
  const regenerateOutput = async (platform: PlatformType) => {
    if (!isPlatformSelected(platform)) return;
    
    try {
      setIsRepurposing(true);
      
      // Call the API to regenerate just one platform's content
      const regenerationData = {
        content,
        contentSource,
        platform,
        tone,
        outputLength,
        useHashtags,
        useEmojis,
        aiProvider
      };
      
      const data = await apiRequest<any>('/api/repurpose/regenerate', {
        method: 'POST',
        body: JSON.stringify(regenerationData),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // Update just that platform's output - data will be in { outputs: { [platform]: {...} } }
      if (data.outputs && data.outputs[platform]) {
        setOutputs(prev => {
          if (!prev) {
            // If no previous outputs, create a new outputs object
            const newOutputs: TransformationResponse['outputs'] = {};
            newOutputs[platform] = data.outputs[platform];
            return newOutputs;
          }
          
          // Otherwise merge with previous outputs
          return {
            ...prev,
            [platform]: data.outputs[platform]
          };
        });
      } else {
        console.error("Unexpected response format:", data);
        throw new Error("Invalid response format from server");
      }
      
      toast({
        title: "Content regenerated",
        description: `Your ${platform} content has been regenerated`,
      });
      
    } catch (error) {
      console.error("Regeneration failed:", error);
      toast({
        title: "Regeneration failed",
        description: "There was an error regenerating your content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRepurposing(false);
    }
  };
  
  const value = {
    content,
    setContent,
    contentSource,
    setContentSource,
    loadSampleContent,
    showSampleOutput,
    selectedPlatforms,
    togglePlatform,
    isPlatformSelected,
    tone,
    setTone,
    outputLength,
    setOutputLength,
    useHashtags,
    setUseHashtags,
    useEmojis,
    setUseEmojis,
    aiProvider,
    setAIProvider,
    isRepurposing,
    repurposeContent,
    outputs,
    transformationId,
    resetOutputs,
    activeTab,
    setActiveTab,
    getWordCount,
    copyToClipboard,
    regenerateOutput
  };
  
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const context = useContext(ContentContext);
  if (context === undefined) {
    throw new Error("useContent must be used within a ContentProvider");
  }
  return context;
}
