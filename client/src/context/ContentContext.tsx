import { createContext, useContext, useState, ReactNode } from "react";
import { 
  ContentSource, 
  PlatformType, 
  ToneType, 
  contentSources, 
  platformTypes, 
  toneTypes,
  TransformationRequest,
  TransformationResponse
} from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ContentContextType {
  // Input state
  content: string;
  setContent: (content: string) => void;
  contentSource: ContentSource;
  setContentSource: (source: ContentSource) => void;
  
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
  
  // Results
  isRepurposing: boolean;
  repurposeContent: () => Promise<void>;
  outputs: TransformationResponse['outputs'] | null;
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
  
  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformType[]>([
    "Twitter", "LinkedIn", "Instagram", "Email", "Summary"
  ]);
  
  // AI settings
  const [tone, setTone] = useState<ToneType>(toneTypes[0]);
  const [outputLength, setOutputLength] = useState<number>(3);
  const [useHashtags, setUseHashtags] = useState<boolean>(true);
  const [useEmojis, setUseEmojis] = useState<boolean>(true);
  
  // Results
  const [isRepurposing, setIsRepurposing] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<TransformationResponse['outputs'] | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformType>("Twitter");
  
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
      useEmojis
    };
    
    try {
      setIsRepurposing(true);
      
      // Call the API to repurpose content
      const response = await apiRequest('POST', '/api/repurpose', transformationRequest);
      const data = await response.json() as TransformationResponse;
      
      setOutputs(data.outputs);
      
      // Set active tab to first available platform
      if (selectedPlatforms.length > 0 && (!activeTab || !selectedPlatforms.includes(activeTab))) {
        setActiveTab(selectedPlatforms[0]);
      }
      
      toast({
        title: "Content repurposed",
        description: "Your content has been successfully repurposed",
      });
      
    } catch (error) {
      console.error("Repurposing failed:", error);
      toast({
        title: "Repurposing failed",
        description: "There was an error repurposing your content. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRepurposing(false);
    }
  };
  
  const resetOutputs = () => {
    setOutputs(null);
  };
  
  const regenerateOutput = async (platform: PlatformType) => {
    if (!isPlatformSelected(platform)) return;
    
    try {
      setIsRepurposing(true);
      
      // Call the API to regenerate just one platform's content
      const response = await apiRequest('POST', '/api/repurpose/regenerate', {
        content,
        contentSource,
        platform,
        tone,
        outputLength,
        useHashtags,
        useEmojis
      });
      
      const data = await response.json();
      
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
    isRepurposing,
    repurposeContent,
    outputs,
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
