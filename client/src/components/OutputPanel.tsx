import { Card, CardContent } from "@/components/ui/card";
import { useContent } from "@/context/ContentContext";
import PlatformOutput from "./PlatformOutput";
import ExportOptions from "./ExportOptions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { platformTypes } from "@shared/schema";

export default function OutputPanel() {
  const { outputs, activeTab, setActiveTab, isPlatformSelected } = useContent();
  
  // Filter available platforms to only those selected by the user
  const availablePlatforms = platformTypes.filter(platform => isPlatformSelected(platform));
  
  return (
    <Card className="bg-white rounded-lg shadow">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4">Repurposed Content</h2>

        {outputs && (
          <div className="mb-4">
            <Alert className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm">
              <Info className="h-4 w-4 text-primary mr-2" />
              <AlertDescription className="text-gray-600">
                Your content has been repurposed for the selected platforms. Preview each version below.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        {/* Platform Tabs */}
        {outputs && (
          <div className="border-b border-gray-200 mb-4">
            <nav className="-mb-px flex space-x-4" aria-label="Platforms">
              {availablePlatforms.map((platform) => (
                <button 
                  key={platform}
                  className={`py-2 px-1 text-sm font-medium border-b-2 ${
                    activeTab === platform
                      ? "border-primary text-primary"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                  onClick={() => setActiveTab(platform)}
                >
                  <i className={`${getPlatformIcon(platform)} mr-1`}></i> {platform}
                </button>
              ))}
            </nav>
          </div>
        )}
        
        {/* Platform Content */}
        <div className="space-y-4">
          {outputs && availablePlatforms.map((platform) => (
            <div 
              key={platform}
              style={{ display: activeTab === platform ? 'block' : 'none' }}
            >
              <PlatformOutput 
                platform={platform} 
                content={outputs[platform]?.content || ''} 
                characterCount={outputs[platform]?.characterCount}
              />
            </div>
          ))}
          
          {!outputs && (
            <div className="text-center py-12 text-gray-500">
              <i className="fas fa-magic text-4xl mb-3"></i>
              <p>Enter your content and click "Repurpose Content" to get started.</p>
            </div>
          )}
        </div>
        
        {/* Export Options */}
        {outputs && <ExportOptions />}
      </CardContent>
    </Card>
  );
}

function getPlatformIcon(platform: string): string {
  switch (platform) {
    case 'Twitter':
      return 'fab fa-twitter';
    case 'LinkedIn':
      return 'fab fa-linkedin';
    case 'Instagram':
      return 'fab fa-instagram';
    case 'Email':
      return 'fas fa-envelope';
    case 'Summary':
      return 'fas fa-list';
    case 'Calendar':
      return 'fas fa-calendar-alt';
    default:
      return 'fas fa-file-alt';
  }
}
