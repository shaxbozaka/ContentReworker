import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Image, X, Loader2, Globe, ChevronDown } from "lucide-react";
import { analytics } from "@/lib/analytics";

interface LinkedInPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent: string;
  profile?: { firstName?: string; lastName?: string };
  userId?: number;
  generatedImageUrl?: string;
  hookIndex?: number;
  hookLabel?: string;
  transformationId?: number | null;
}

export default function LinkedInPostModal({
  isOpen,
  onClose,
  initialContent,
  profile,
  userId,
  generatedImageUrl,
  hookIndex,
  hookLabel,
  transformationId,
}: LinkedInPostModalProps) {
  const { toast } = useToast();
  const [content, setContent] = useState(initialContent);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = content.length;
  const maxCharacters = 3000;

  // Reset content when modal opens with new content
  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 400) + 'px';
    }
  }, [content]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 9) {
      toast({
        title: "Too many images",
        description: "LinkedIn allows up to 9 images per post",
        variant: "destructive",
      });
      return;
    }

    const newImages = [...images, ...files];
    setImages(newImages);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!content.trim()) {
      toast({
        title: "Content required",
        description: "Please add some content to your post",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);

    try {
      const response = await fetch("/api/social/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, userId }),
      });

      const result = await response.json();

      if (result.success) {
        setPostSuccess(true);
        toast({
          title: "Posted to LinkedIn!",
          description: "Your content is now live on LinkedIn.",
        });

        // Mark transformation as posted (fire-and-forget)
        if (transformationId) {
          fetch(`/api/transformations/${transformationId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ status: 'posted', platform: 'LinkedIn' }),
          }).catch(() => {});
        }

        // Track successful post (Umami + internal)
        analytics.contentPosted('LinkedIn');

        // Track successful post analytics
        if (hookIndex !== undefined || hookLabel) {
          fetch('/api/analytics/hook-selection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              hookType: hookLabel?.toLowerCase().replace(' ', '_') || `hook_${hookIndex}`,
              hookIndex: hookIndex ?? 0,
              platform: 'LinkedIn',
              contentLength: content.length,
              action: 'post',
            }),
          }).catch(() => {}); // Silently fail
        }
      } else {
        toast({
          title: "Posting failed",
          description: result.error || "Could not post to LinkedIn",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to post to LinkedIn",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleClose = () => {
    setContent(initialContent);
    setImages([]);
    setImagePreviews([]);
    setPostSuccess(false);
    onClose();
  };

  // Success state
  if (postSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden [&>button]:hidden">
          <DialogTitle className="sr-only">Post published successfully</DialogTitle>
          <div className="text-center py-12 px-6">
            <div className="w-20 h-20 bg-[#0A66C2] rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-check text-white text-3xl"></i>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Your post is live!
            </h3>
            <p className="text-gray-600 mb-8">
              Your content has been posted to LinkedIn
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => window.open("https://www.linkedin.com/feed/", "_blank")}
                className="border-[#0A66C2] text-[#0A66C2] hover:bg-blue-50"
              >
                <i className="fab fa-linkedin mr-2"></i>
                View on LinkedIn
              </Button>
              <Button onClick={handleClose} className="bg-[#0A66C2] hover:bg-[#004182]">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl w-[95vw] max-h-[90vh] p-0 overflow-hidden gap-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Post to LinkedIn</DialogTitle>
        {/* LinkedIn-style header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#0A66C2] rounded-full flex items-center justify-center text-white font-semibold text-lg">
              {profile?.firstName?.[0] || "U"}
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {profile?.firstName} {profile?.lastName}
              </p>
              <button className="flex items-center gap-1 text-sm text-gray-600 hover:bg-gray-100 rounded px-2 py-0.5 -ml-2">
                <Globe className="w-3 h-3" />
                <span>Anyone</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div className="px-3 sm:px-4 py-3 max-h-[40vh] sm:max-h-[50vh] overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What do you want to talk about?"
            className="w-full min-h-[120px] sm:min-h-[150px] resize-none focus:outline-none text-gray-800 text-base leading-relaxed placeholder:text-gray-400"
            maxLength={maxCharacters}
          />

          {/* AI Generated Image */}
          {generatedImageUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-gray-200">
              <div className="relative">
                <img
                  src={generatedImageUrl}
                  alt="AI generated image for your post"
                  className="w-full h-auto max-h-[300px] object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                  </svg>
                  AI Generated
                </div>
              </div>
            </div>
          )}

          {/* User uploaded image previews */}
          {imagePreviews.length > 0 && (
            <div className="mt-4">
              <div className={`grid gap-2 ${imagePreviews.length === 1 ? 'grid-cols-1' : imagePreviews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative aspect-video">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 w-8 h-8 bg-gray-900/70 rounded-full flex items-center justify-center text-white hover:bg-gray-900"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Character count */}
        <div className="px-3 sm:px-4 py-2 border-t border-gray-100">
          <span className={`text-xs sm:text-sm ${characterCount > maxCharacters * 0.9 ? 'text-amber-500' : 'text-gray-400'}`}>
            {characterCount.toLocaleString()}/{maxCharacters.toLocaleString()}
          </span>
        </div>

        {/* Bottom toolbar - LinkedIn style */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={images.length >= 9}
              className="p-2 rounded-full hover:bg-gray-200 text-gray-600 disabled:opacity-50"
              title="Add image"
            >
              <Image className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isPosting}
              className="text-gray-600 px-3 sm:px-4"
            >
              Cancel
            </Button>
            <Button
              onClick={handlePost}
              disabled={isPosting || !content.trim()}
              className="bg-[#0A66C2] hover:bg-[#004182] text-white rounded-full px-4 sm:px-6"
            >
              {isPosting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Posting...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                "Post"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
