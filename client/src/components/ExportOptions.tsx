import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from "@/components/ui/dialog";
import { SiLinkedin } from "react-icons/si";

interface LinkedInStatus {
  connected: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    id?: string;
  };
  expired?: boolean;
}

export default function ExportOptions() {
  const { outputs, copyToClipboard, activeTab } = useContent();
  const { toast } = useToast();
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [hasLinkedInCredentials, setHasLinkedInCredentials] = useState<boolean | null>(null);
  const [missingConfigMessage, setMissingConfigMessage] = useState<string | null>(null);
  
  // Check if LinkedIn credentials are configured
  useEffect(() => {
    async function checkLinkedInCredentials() {
      try {
        const response = await fetch('/api/social/linkedin/config-status');
        const data = await response.json();
        setHasLinkedInCredentials(data.configured);
        if (!data.configured) {
          setMissingConfigMessage(data.message || "LinkedIn API credentials are not configured.");
        }
      } catch (error) {
        console.error('Error checking LinkedIn credentials:', error);
        setHasLinkedInCredentials(false);
        setMissingConfigMessage("Could not verify LinkedIn API configuration.");
      }
    }
    
    checkLinkedInCredentials();
  }, []);
  
  // Fetch LinkedIn connection status
  useEffect(() => {
    async function checkLinkedInStatus() {
      if (!hasLinkedInCredentials) return;
      
      try {
        const response = await fetch('/api/social/linkedin/status');
        if (response.ok) {
          const data = await response.json();
          setLinkedInStatus(data);
        }
      } catch (error) {
        console.error('Error checking LinkedIn status:', error);
      }
    }
    
    if (hasLinkedInCredentials !== null) {
      checkLinkedInStatus();
    }
  }, [hasLinkedInCredentials]);
  
  const handleDownloadAll = () => {
    if (!outputs) return;
    
    // Prepare text content
    let content = "# Repurposed Content\n\n";
    
    Object.entries(outputs).forEach(([platform, output]) => {
      content += `## ${platform}\n\n${output.content}\n\n`;
    });
    
    // Create download link
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repurposed-content.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleCopyAll = () => {
    if (!outputs) return;
    
    // Create a text version of all outputs
    let content = "";
    
    Object.entries(outputs).forEach(([platform, output]) => {
      content += `--- ${platform} ---\n\n${output.content}\n\n`;
    });
    
    copyToClipboard(content);
  };
  
  const connectToLinkedIn = () => {
    setLoading(true);
    fetch('/api/social/linkedin/auth')
      .then(res => res.json())
      .then(data => {
        window.location.href = data.url;
      })
      .catch(err => {
        console.error('Error getting LinkedIn auth URL:', err);
        toast({
          title: "Error",
          description: "Failed to connect to LinkedIn. Please try again.",
          variant: "destructive"
        });
        setLoading(false);
      });
  };
  
  const postToLinkedIn = async () => {
    if (!outputs || !outputs[activeTab]) return;
    
    setPosting(true);
    try {
      const response = await fetch('/api/social/linkedin/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: outputs[activeTab].content
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success!",
          description: "Your content has been posted to LinkedIn.",
          variant: "default"
        });
      } else {
        toast({
          title: "Posting Failed",
          description: result.error || "Failed to post to LinkedIn. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error posting to LinkedIn:', error);
      toast({
        title: "Error",
        description: "Failed to post to LinkedIn. Please try again.",
        variant: "destructive"
      });
    } finally {
      setPosting(false);
      setIsShareDialogOpen(false);
    }
  };
  
  return (
    <>
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
          <h3 className="font-medium text-gray-800">Export Options</h3>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleCopyAll}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
            >
              <i className="far fa-file-alt mr-1.5"></i> Copy All Content
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadAll}
              className="bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
            >
              <i className="fas fa-download mr-1.5"></i> Download All
            </Button>
            <Button
              variant="default"
              onClick={() => setIsShareDialogOpen(true)}
              className="bg-secondary hover:bg-green-600 text-white transition-colors"
            >
              <i className="fas fa-share-alt mr-1.5"></i> Share
            </Button>
          </div>
        </div>
      </div>
      
      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Content</DialogTitle>
            <DialogDescription>
              Share your repurposed content directly to your social media platforms.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex items-center gap-4 p-4 border rounded-lg">
              <SiLinkedin className="text-3xl text-[#0077B5]" />
              <div className="flex-1">
                <h4 className="font-medium">LinkedIn</h4>
                {hasLinkedInCredentials === null ? (
                  <p className="text-sm text-gray-500">Checking LinkedIn configuration...</p>
                ) : !hasLinkedInCredentials ? (
                  <div>
                    <p className="text-sm text-amber-600">
                      {missingConfigMessage || "LinkedIn API credentials are missing"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      LinkedIn integration requires API credentials to be configured.
                    </p>
                  </div>
                ) : !linkedInStatus ? (
                  <p className="text-sm text-gray-500">Checking connection status...</p>
                ) : linkedInStatus.connected ? (
                  <p className="text-sm text-gray-500">
                    Connected as {linkedInStatus.profile?.firstName} {linkedInStatus.profile?.lastName}
                  </p>
                ) : linkedInStatus.expired ? (
                  <p className="text-sm text-amber-600">Your connection has expired</p>
                ) : (
                  <p className="text-sm text-gray-500">Not connected</p>
                )}
              </div>
              
              {hasLinkedInCredentials === false ? (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "LinkedIn API Credentials Required",
                      description: "Please contact your administrator to set up LinkedIn integration.",
                      variant: "default"
                    });
                  }}
                >
                  Setup Required
                </Button>
              ) : linkedInStatus?.connected ? (
                <Button 
                  variant="default" 
                  size="sm"
                  onClick={postToLinkedIn}
                  disabled={posting}
                >
                  {posting ? "Posting..." : "Post"}
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={connectToLinkedIn}
                  disabled={loading || !hasLinkedInCredentials}
                >
                  {loading ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsShareDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
