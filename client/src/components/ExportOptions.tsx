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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2 } from "lucide-react";

interface LinkedInStatus {
  connected: boolean;
  profile?: {
    firstName?: string;
    lastName?: string;
    id?: string;
  };
  expired?: boolean;
}

interface LinkedInCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
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
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<LinkedInCredentials>({
    clientId: '',
    clientSecret: '',
    redirectUri: 'https://aicontentrepurposer.com'
  });
  const [generatingAuthUrl, setGeneratingAuthUrl] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [authCode, setAuthCode] = useState<string>('');
  const [exchangingCode, setExchangingCode] = useState(false);
  
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
  
  const handleCredentialsChange = (field: keyof LinkedInCredentials) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };
  
  const generateLinkedInAuthUrl = async () => {
    if (!credentials.clientId || !credentials.redirectUri) {
      toast({
        title: "Missing Required Fields",
        description: "Please provide Client ID and Redirect URI",
        variant: "destructive"
      });
      return;
    }
    
    setGeneratingAuthUrl(true);
    
    try {
      // Generate OAuth URL without storing credentials in the backend
      // Only request scopes that are approved for your app
      // Using only w_member_social which is required for posting content
      // Make sure these match the scopes approved in your LinkedIn Developer Console
      const scopes = ["w_member_social"];
      const state = Math.random().toString(36).substring(2, 15);
      
      const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: credentials.clientId,
        redirect_uri: credentials.redirectUri,
        scope: scopes.join(' '),
        state: state,
      });
      
      // Add privacy policy and terms of service URLs
      const privacyUrl = window.location.origin + '/privacy-policy';
      const termsUrl = window.location.origin + '/terms-of-service';
      
      params.append('privacy_policy_url', privacyUrl);
      params.append('terms_of_service_url', termsUrl);
      
      const authUrl = `${baseUrl}?${params.toString()}`;
      setAuthUrl(authUrl);
      
      toast({
        title: "Auth URL Generated",
        description: "You can now open this URL to authorize with LinkedIn",
        variant: "default"
      });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      toast({
        title: "Error",
        description: "Failed to generate authentication URL",
        variant: "destructive"
      });
    } finally {
      setGeneratingAuthUrl(false);
    }
  };
  
  const openLinkedInAuthUrl = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    }
  };
  
  const exchangeAuthCode = async () => {
    if (!authCode || !credentials.clientId || !credentials.clientSecret || !credentials.redirectUri) {
      toast({
        title: "Missing Required Fields",
        description: "Please provide authorization code and all credential fields",
        variant: "destructive"
      });
      return;
    }
    
    setExchangingCode(true);
    
    try {
      const response = await fetch('/api/social/linkedin/exchange-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: authCode,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          redirectUri: credentials.redirectUri
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Success!",
          description: `Connected to LinkedIn as ${result.profile.firstName} ${result.profile.lastName}`,
          variant: "default"
        });
        
        // Update the LinkedIn status
        setLinkedInStatus({
          connected: true,
          profile: {
            firstName: result.profile.firstName,
            lastName: result.profile.lastName,
            id: result.profile.id
          }
        });
        
        // Close the dialog
        setIsCredentialsDialogOpen(false);
        
        // Set LinkedIn credentials as configured
        setHasLinkedInCredentials(true);
      } else {
        toast({
          title: "Authentication Failed",
          description: result.error || "Failed to authenticate with LinkedIn. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error exchanging auth code:', error);
      toast({
        title: "Error",
        description: "Failed to exchange authorization code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setExchangingCode(false);
    }
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
                  onClick={() => setIsCredentialsDialogOpen(true)}
                >
                  <Settings2 className="w-4 h-4 mr-1" /> Enter Credentials
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

      {/* LinkedIn Credentials Dialog */}
      <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>LinkedIn API Credentials</DialogTitle>
            <DialogDescription>
              Enter your LinkedIn API credentials from your LinkedIn Developer Console.
              The redirect URI must exactly match what you registered in your LinkedIn app settings.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="client-id">Client ID</Label>
              <Input 
                id="client-id" 
                value={credentials.clientId} 
                onChange={handleCredentialsChange('clientId')}
                placeholder="e.g. 77rs7gdw8hzmw5" 
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="client-secret">Client Secret</Label>
              <Input 
                id="client-secret" 
                type="password" 
                value={credentials.clientSecret} 
                onChange={handleCredentialsChange('clientSecret')}
                placeholder="e.g. WPL_AP1.WAOevcSYZGwzf48D.Dx/szw==" 
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="redirect-uri">Redirect URI</Label>
              <Input 
                id="redirect-uri" 
                value={credentials.redirectUri} 
                onChange={handleCredentialsChange('redirectUri')}
                placeholder={window.location.origin} 
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">
                This must <span className="font-semibold">exactly match</span> the redirect URI registered in your LinkedIn Developer Console.
                We've detected you need to use: <span className="font-mono text-blue-600">https://aicontentrepurposer.com</span>
              </p>
            </div>
          </div>
          
          {authUrl && (
            <div className="mt-2 mb-2">
              <Label>Authentication URL</Label>
              <div className="flex mt-1">
                <Input 
                  value={authUrl} 
                  readOnly
                  className="font-mono text-xs flex-1"
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-2"
                  onClick={openLinkedInAuthUrl}
                >
                  Open
                </Button>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Note: Copy the code parameter from the redirect URL after authorization.
                If you see a "redirect_uri doesn't match" error, make sure the URI in the field above
                matches exactly what you registered in LinkedIn Developer Console.
              </p>
            </div>
          )}
          
          {authUrl && (
            <div className="mt-4">
              <Label htmlFor="auth-code">Authorization Code</Label>
              <div className="flex mt-1">
                <Input 
                  id="auth-code"
                  placeholder="Paste code from redirect URL here..."
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="flex-1"
                />
                <Button 
                  variant="default" 
                  size="sm" 
                  className="ml-2"
                  onClick={exchangeAuthCode}
                  disabled={!authCode || exchangingCode}
                >
                  {exchangingCode ? "Exchanging..." : "Exchange Code"}
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCredentialsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={generateLinkedInAuthUrl}
              disabled={!credentials.clientId || !credentials.redirectUri || generatingAuthUrl}
            >
              {generatingAuthUrl ? "Generating..." : "Generate Auth URL"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
