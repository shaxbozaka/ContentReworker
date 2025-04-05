import { Card, CardContent } from "@/components/ui/card";
import { useContent } from "@/context/ContentContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toneTypes, aiProviders } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export default function AiSettings() {
  const { toast } = useToast();
  const { 
    tone, setTone,
    outputLength, setOutputLength,
    useHashtags, setUseHashtags,
    useEmojis, setUseEmojis,
    aiProvider, setAIProvider
  } = useContent();
  
  const [anthropicConfigured, setAnthropicConfigured] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Check if Anthropic API key is configured when the component loads or when the AI provider changes
  useEffect(() => {
    async function checkAnthropicConfig() {
      if (aiProvider === 'Anthropic') {
        setIsLoading(true);
        try {
          const response = await apiRequest('GET', '/api/ai/anthropic/config-status');
          const data = await response.json();
          setAnthropicConfigured(data.configured);
          
          if (!data.configured) {
            toast({
              title: "Anthropic API Key Not Configured",
              description: data.message,
              variant: "destructive"
            });
            // Switch back to OpenAI if Anthropic is not configured
            setAIProvider('OpenAI');
          }
        } catch (error) {
          console.error("Error checking Anthropic config:", error);
          setAnthropicConfigured(false);
        } finally {
          setIsLoading(false);
        }
      }
    }
    
    checkAnthropicConfig();
  }, [aiProvider, setAIProvider, toast]);
  
  return (
    <Card className="bg-white rounded-lg shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <button className="text-sm text-primary hover:text-blue-700 flex items-center">
            <i className="fas fa-sliders-h mr-1"></i> Advanced
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-1">Content Tone</Label>
            <Select value={tone} onValueChange={(value: any) => setTone(value)}>
              <SelectTrigger className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                {toneTypes.map((toneOption) => (
                  <SelectItem key={toneOption} value={toneOption}>
                    {toneOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">Output Length</Label>
            <div className="flex items-center">
              <span className="text-xs text-gray-500">Shorter</span>
              <Slider
                value={[outputLength]}
                onValueChange={(values) => setOutputLength(values[0])}
                min={1}
                max={5}
                step={1}
                className="mx-2 w-full"
              />
              <span className="text-xs text-gray-500">Longer</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Checkbox
                id="hashtags"
                checked={useHashtags}
                onCheckedChange={(checked) => setUseHashtags(!!checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded"
              />
              <Label htmlFor="hashtags" className="ml-2 text-sm text-gray-700">
                Add relevant hashtags
              </Label>
            </div>
            
            <div className="flex items-center">
              <Checkbox
                id="emojis"
                checked={useEmojis}
                onCheckedChange={(checked) => setUseEmojis(!!checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded"
              />
              <Label htmlFor="emojis" className="ml-2 text-sm text-gray-700">
                Include emojis
              </Label>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Label className="block text-sm font-medium text-gray-700 mb-2">AI Provider</Label>
            <RadioGroup 
              value={aiProvider} 
              onValueChange={(value: any) => setAIProvider(value)}
              className="flex space-x-6"
            >
              {aiProviders.map((provider) => (
                <div key={provider} className="flex items-center space-x-2">
                  <RadioGroupItem 
                    value={provider} 
                    id={`provider-${provider}`} 
                    disabled={provider === 'Anthropic' && anthropicConfigured === false}
                  />
                  <Label htmlFor={`provider-${provider}`} className="text-sm text-gray-700">
                    {provider}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            
            {anthropicConfigured === false && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex flex-col space-y-2">
                  <span>Anthropic API key is not configured.</span>
                  <div className="flex space-x-2">
                    <button 
                      className="text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded text-sm font-medium"
                      onClick={() => {
                        window.open('https://console.anthropic.com/account/keys', '_blank');
                        toast({
                          title: "Get an API Key from Anthropic",
                          description: "Get your API key from the Anthropic console, then add it to the application.",
                        });
                      }}
                    >
                      Get API Key
                    </button>
                    <button 
                      className="bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded text-sm font-medium"
                      onClick={async () => {
                        // This will trigger the secrets dialog from Replit
                        try {
                          const response = await fetch('/api/secrets/request', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              secrets: ['ANTHROPIC_API_KEY']
                            }),
                          });
                          
                          if (response.ok) {
                            toast({
                              title: "API Key Request Sent",
                              description: "Once the Anthropic API key is added, you can select Anthropic as your AI provider.",
                            });
                          } else {
                            toast({
                              title: "Failed to Request API Key",
                              description: "Please contact your administrator to add the ANTHROPIC_API_KEY to the application's environment variables.",
                              variant: "destructive"
                            });
                          }
                        } catch (error) {
                          console.error("Error requesting API key:", error);
                          toast({
                            title: "Error",
                            description: "Failed to request the API key. Please try again or contact the administrator.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      Add API Key
                    </button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {isLoading && aiProvider === 'Anthropic' && (
              <div className="text-sm text-gray-500 mt-2">
                Checking Anthropic API configuration...
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
