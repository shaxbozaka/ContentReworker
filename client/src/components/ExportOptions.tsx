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
  // Direct LinkedIn posting without a share dialog
  const [posting, setPosting] = useState(false);
  const [hasLinkedInCredentials, setHasLinkedInCredentials] = useState<boolean | null>(null);
  const [missingConfigMessage, setMissingConfigMessage] = useState<string | null>(null);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const REPLIT_DEV_URL = 'https://078161fa-ac6d-4f43-9b2a-080cd331a150-00-th11kdzql9ef.janeway.replit.dev';
  const [credentials, setCredentials] = useState<LinkedInCredentials>({
    clientId: '',
    clientSecret: '',
    redirectUri: REPLIT_DEV_URL
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
    }
  };
  
  return (
    <>
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <h3 className="font-medium text-gray-800">Export &amp; Share</h3>
            
            <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
              <Button
                variant="outline"
                onClick={handleCopyAll}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
              >
                <i className="far fa-file-alt mr-1.5"></i> Copy All
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadAll}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors"
              >
                <i className="fas fa-download mr-1.5"></i> Download
              </Button>
            </div>
          </div>
          
          {/* Social Media Publishing Section */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <SiLinkedin className="text-[#0077B5] text-xl" />
              <h4 className="font-medium">LinkedIn Publishing</h4>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                {hasLinkedInCredentials === null ? (
                  <p className="text-sm text-gray-500">Checking LinkedIn configuration...</p>
                ) : !hasLinkedInCredentials ? (
                  <div className="flex items-center">
                    <p className="text-sm text-amber-600 mr-2">
                      {missingConfigMessage || "LinkedIn API credentials needed"}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setIsCredentialsDialogOpen(true)}
                    >
                      <Settings2 className="w-3 h-3 mr-1" /> Configure
                    </Button>
                  </div>
                ) : !linkedInStatus ? (
                  <p className="text-sm text-gray-500">Checking connection status...</p>
                ) : linkedInStatus.connected ? (
                  <p className="text-sm text-emerald-600">
                    Connected as <span className="font-medium">{linkedInStatus.profile?.firstName} {linkedInStatus.profile?.lastName}</span>
                  </p>
                ) : linkedInStatus.expired ? (
                  <p className="text-sm text-amber-600">Your connection has expired</p>
                ) : (
                  <p className="text-sm text-gray-500">Not connected</p>
                )}
              </div>
              
              <div>
                {hasLinkedInCredentials && linkedInStatus?.connected ? (
                  <Button
                    variant="default"
                    onClick={() => {
                      if (outputs && outputs[activeTab]) {
                        postToLinkedIn();
                      } else {
                        toast({
                          title: "No Content",
                          description: "Please generate content before posting to LinkedIn",
                          variant: "destructive"
                        });
                      }
                    }}
                    disabled={posting}
                    className="bg-[#0077B5] hover:bg-[#005885] text-white transition-colors w-full sm:w-auto"
                  >
                    <SiLinkedin className="mr-1.5" /> {posting ? "Posting..." : "Post to LinkedIn"}
                  </Button>
                ) : hasLinkedInCredentials ? (
                  <Button
                    variant="outline"
                    onClick={connectToLinkedIn}
                    disabled={loading}
                    className="bg-white hover:bg-gray-100 text-[#0077B5] border-[#0077B5] transition-colors w-full sm:w-auto"
                  >
                    <SiLinkedin className="mr-1.5" /> {loading ? "Connecting..." : "Connect LinkedIn"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* LinkedIn Credentials Dialog */}
      <Dialog open={isCredentialsDialogOpen} onOpenChange={setIsCredentialsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SiLinkedin className="text-[#0077B5]" /> LinkedIn API Credentials
            </DialogTitle>
            <DialogDescription>
              Configure your LinkedIn API credentials to enable direct posting to your LinkedIn profile.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            {/* LinkedIn Developer Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Set up instructions:</h4>
              <ol className="text-xs text-blue-700 space-y-1 list-decimal pl-4">
                <li>Create a LinkedIn Developer account at <a href="https://developer.linkedin.com/" target="_blank" rel="noopener noreferrer" className="underline">developer.linkedin.com</a></li>
                <li>Create a new app in your LinkedIn Developer Console</li>
                <li>Add the <code className="bg-blue-100 px-1 rounded">w_member_social</code> permission scope to your app</li>
                <li>Add exactly <code className="bg-blue-100 px-1 rounded">{REPLIT_DEV_URL}</code> as the OAuth 2.0 Redirect URL</li>
                <li>Copy your Client ID and Client Secret from the app settings</li>
              </ol>
            </div>
            
            <div>
              <Label htmlFor="client-id" className="flex items-center gap-1">
                Client ID <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="client-id" 
                value={credentials.clientId} 
                onChange={handleCredentialsChange('clientId')}
                placeholder="e.g. 77rs7gdw8hzmw5" 
                className="mt-1 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this in your LinkedIn app's Authentication settings
              </p>
            </div>
            
            <div>
              <Label htmlFor="client-secret" className="flex items-center gap-1">
                Client Secret <span className="text-red-500">*</span>
              </Label>
              <Input 
                id="client-secret" 
                type="password" 
                value={credentials.clientSecret} 
                onChange={handleCredentialsChange('clientSecret')}
                placeholder="e.g. WPL_AP1.WAOevcSYZGwzf48D.Dx/szw==" 
                className="mt-1 font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                This is your app's secret key. Keep this confidential.
              </p>
            </div>
            
            <div>
              <Label htmlFor="redirect-uri" className="flex items-center gap-1">
                Redirect URI <span className="text-red-500">*</span>
              </Label>
              <div className="flex mt-1">
                <Input 
                  id="redirect-uri" 
                  value={credentials.redirectUri} 
                  onChange={handleCredentialsChange('redirectUri')}
                  className="font-mono"
                  readOnly
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-2"
                  onClick={() => {
                    navigator.clipboard.writeText(REPLIT_DEV_URL);
                    toast({
                      title: "Copied!",
                      description: "Redirect URI copied to clipboard",
                    });
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This must <span className="font-semibold">exactly match</span> the redirect URI in your LinkedIn app settings
              </p>
            </div>
          </div>
          
          {authUrl && (
            <div className="mt-2 mb-2 bg-gray-50 p-3 rounded-md border border-gray-200">
              <Label className="text-sm font-medium">Authentication URL</Label>
              <div className="flex mt-1">
                <Input 
                  value={authUrl} 
                  readOnly
                  className="font-mono text-xs flex-1"
                />
                <Button 
                  variant="default" 
                  size="sm" 
                  className="ml-2"
                  onClick={openLinkedInAuthUrl}
                >
                  <i className="fas fa-external-link-alt mr-1.5"></i> Open
                </Button>
              </div>
              <p className="text-xs text-amber-600 mt-2">
                <i className="fas fa-info-circle mr-1"></i> After authorizing, copy the code from the redirect URL's <code className="bg-amber-50 px-1 rounded">code=</code> parameter
              </p>
            </div>
          )}
          
          {authUrl && (
            <div className="mt-4">
              <Label htmlFor="auth-code" className="flex items-center gap-1">
                Authorization Code <span className="text-red-500">*</span>
              </Label>
              <div className="flex mt-1">
                <Input 
                  id="auth-code"
                  placeholder="Paste code from redirect URL here..."
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                  className="flex-1 font-mono"
                />
                <Button 
                  variant="default" 
                  size="sm" 
                  className="ml-2"
                  onClick={exchangeAuthCode}
                  disabled={!authCode || exchangingCode}
                >
                  {exchangingCode ? "Exchanging..." : "Complete Setup"}
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCredentialsDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
              Cancel
            </Button>
            <Button 
              variant="default" 
              onClick={generateLinkedInAuthUrl}
              disabled={!credentials.clientId || !credentials.clientSecret || !credentials.redirectUri || generatingAuthUrl}
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {generatingAuthUrl ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1.5"></i> Generating...
                </>
              ) : (
                <>
                  <i className="fas fa-key mr-1.5"></i> Generate Auth URL
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
