import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCcw, AlertCircle, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// LinkedIn API Tester
export default function LinkedInApiTester() {
  const { toast } = useToast();
  
  // API credentials state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  
  // Auth flow state
  const [authCode, setAuthCode] = useState("");
  const [redirectUri, setRedirectUri] = useState("https://aicontentrepurposer.com");
  const [accessToken, setAccessToken] = useState("");
  
  // API request state
  const [endpoint, setEndpoint] = useState("/v2/me");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [requestBody, setRequestBody] = useState("");
  const [responseData, setResponseData] = useState("");
  const [loading, setLoading] = useState(false);
  
  // API status
  const [statusMessage, setStatusMessage] = useState<{
    type: "info" | "error" | "success";
    message: string;
  } | null>(null);

  // Generate Auth URL
  const generateAuthUrl = () => {
    if (!clientId || !redirectUri) {
      toast({
        title: "Missing information",
        description: "Please provide Client ID and Redirect URI",
        variant: "destructive"
      });
      return;
    }
    
    const scopes = ["r_liteprofile", "r_emailaddress", "w_member_social"];
    const state = Math.random().toString(36).substring(2, 15);
    
    const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: state,
    });
    
    const authUrl = `${baseUrl}?${params.toString()}`;
    
    // Open in new window
    window.open(authUrl, '_blank');
    
    setStatusMessage({
      type: "info",
      message: "Auth URL generated and opened in new window. Please copy the code parameter from the redirect URL."
    });
  };
  
  // Exchange auth code for token
  const exchangeCodeForToken = async () => {
    if (!clientId || !clientSecret || !authCode || !redirectUri) {
      toast({
        title: "Missing information",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    setStatusMessage({
      type: "info",
      message: "Exchanging code for token..."
    });
    
    try {
      // Direct API call using fetch
      const formData = new URLSearchParams();
      formData.append('grant_type', 'authorization_code');
      formData.append('code', authCode);
      formData.append('client_id', clientId);
      formData.append('client_secret', clientSecret);
      formData.append('redirect_uri', redirectUri);
      
      const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setAccessToken(data.access_token);
        setStatusMessage({
          type: "success",
          message: `Token received! Expires in ${data.expires_in} seconds.`
        });
        
        // Show full response
        setResponseData(JSON.stringify(data, null, 2));
      } else {
        setStatusMessage({
          type: "error",
          message: `Error: ${data.error_description || data.error || 'Unknown error'}`
        });
        setResponseData(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      const error = err as Error;
      console.error("Error exchanging code for token:", error);
      setStatusMessage({
        type: "error",
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Make API request
  const makeApiRequest = async () => {
    if (!accessToken || !endpoint) {
      toast({
        title: "Missing information",
        description: "Please provide an access token and endpoint",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true);
    setStatusMessage({
      type: "info",
      message: `Making ${httpMethod} request to ${endpoint}...`
    });
    
    try {
      const options: RequestInit = {
        method: httpMethod,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      };
      
      // Add body for non-GET requests
      if (httpMethod !== 'GET' && requestBody) {
        try {
          options.body = requestBody;
        } catch (e) {
          toast({
            title: "Invalid JSON",
            description: "Please check your request body format",
            variant: "destructive"
          });
          setLoading(false);
          return;
        }
      }
      
      const url = `https://api.linkedin.com${endpoint}`;
      const response = await fetch(url, options);
      const data = await response.json();
      
      setResponseData(JSON.stringify(data, null, 2));
      
      if (response.ok) {
        setStatusMessage({
          type: "success",
          message: `Request successful! Status: ${response.status}`
        });
      } else {
        setStatusMessage({
          type: "error",
          message: `Error: ${data.message || data.error || 'Unknown error'}`
        });
      }
    } catch (err) {
      const error = err as Error;
      console.error("API request error:", error);
      setStatusMessage({
        type: "error",
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">LinkedIn API Tester</h1>
      
      <Tabs defaultValue="auth">
        <TabsList className="mb-6">
          <TabsTrigger value="auth">1. Authentication</TabsTrigger>
          <TabsTrigger value="api">2. API Requests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="auth">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Credentials</CardTitle>
                <CardDescription>
                  Enter your LinkedIn API credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input 
                      id="client-id" 
                      value={clientId} 
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="77rs7gdw8hzmw5" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret</Label>
                    <Input 
                      id="client-secret" 
                      type="password"
                      value={clientSecret} 
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="WPL_AP1..." 
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>OAuth 2.0 Flow</CardTitle>
                <CardDescription>
                  Generate an authorization URL, get the code, and exchange it for an access token
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="redirect-uri">Redirect URI</Label>
                  <Input 
                    id="redirect-uri" 
                    value={redirectUri} 
                    onChange={(e) => setRedirectUri(e.target.value)}
                    placeholder="https://your-app.replit.app" 
                  />
                  <p className="text-xs text-gray-500">
                    This must <span className="font-semibold">exactly match</span> the redirect URI you registered in the LinkedIn Developer Console.
                    We've detected you need to use: <span className="font-mono text-blue-600">https://aicontentrepurposer.com</span>
                  </p>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    onClick={generateAuthUrl} 
                    disabled={!clientId || !redirectUri}
                  >
                    Generate Auth URL
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="auth-code">Authorization Code</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="auth-code" 
                      value={authCode} 
                      onChange={(e) => setAuthCode(e.target.value)}
                      placeholder="AQTisLyR..." 
                      className="flex-1"
                    />
                    <Button 
                      onClick={exchangeCodeForToken} 
                      disabled={!clientId || !clientSecret || !authCode || !redirectUri || loading}
                    >
                      {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : "Exchange for Token"}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    After authorization, copy the code parameter from the redirect URL.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="access-token">Access Token</Label>
                  <Textarea 
                    id="access-token" 
                    value={accessToken} 
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Generated access token will appear here..." 
                    className="font-mono text-xs h-24"
                  />
                </div>
                
                {statusMessage && (
                  <Alert variant={statusMessage.type === "error" ? "destructive" : "default"}>
                    {statusMessage.type === "error" && <AlertCircle className="h-4 w-4" />}
                    {statusMessage.type === "success" && <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>{statusMessage.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            
            {responseData && (
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    value={responseData} 
                    readOnly 
                    className="font-mono text-xs h-60"
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="api">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>API Request</CardTitle>
                <CardDescription>
                  Make requests to LinkedIn's API using your access token
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="w-28">
                    <Label htmlFor="http-method">Method</Label>
                    <Select value={httpMethod} onValueChange={setHttpMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1">
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input 
                      id="endpoint" 
                      value={endpoint} 
                      onChange={(e) => setEndpoint(e.target.value)}
                      placeholder="/v2/me" 
                    />
                  </div>
                  
                  <Button 
                    onClick={makeApiRequest} 
                    disabled={!accessToken || !endpoint || loading}
                  >
                    {loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : "Send Request"}
                  </Button>
                </div>
                
                {(httpMethod === "POST" || httpMethod === "PUT") && (
                  <div className="space-y-2">
                    <Label htmlFor="request-body">Request Body (JSON)</Label>
                    <Textarea 
                      id="request-body" 
                      value={requestBody} 
                      onChange={(e) => setRequestBody(e.target.value)}
                      placeholder='{"key": "value"}'
                      className="font-mono text-xs h-40"
                    />
                  </div>
                )}
                
                <div className="space-y-2 mt-4">
                  <Label>Common Endpoints</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <Button variant="outline" size="sm" onClick={() => setEndpoint("/v2/me")}>
                      Profile (/v2/me)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      setEndpoint("/v2/shares");
                      setHttpMethod("POST");
                      setRequestBody(JSON.stringify({
                        owner: "urn:li:person:[PROFILE_ID]",
                        text: {
                          text: "Example post content"
                        },
                        distribution: {
                          linkedInDistributionTarget: {
                            visibility: "PUBLIC"
                          }
                        }
                      }, null, 2));
                    }}>
                      Create Post (/v2/shares)
                    </Button>
                  </div>
                </div>
                
                {statusMessage && (
                  <Alert variant={statusMessage.type === "error" ? "destructive" : "default"}>
                    {statusMessage.type === "error" && <AlertCircle className="h-4 w-4" />}
                    {statusMessage.type === "success" && <CheckCircle className="h-4 w-4" />}
                    <AlertDescription>{statusMessage.message}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Response</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea 
                  value={responseData} 
                  readOnly 
                  className="font-mono text-xs h-80"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}