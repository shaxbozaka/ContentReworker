import { useContent } from "@/context/ContentContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { platformTypes } from "@shared/schema";

export default function RepurposeOptions() {
  const { 
    togglePlatform, 
    isPlatformSelected,
    repurposeContent,
    isRepurposing
  } = useContent();
  
  const handlePlatformChange = (platform: any) => {
    togglePlatform(platform);
  };
  
  return (
    <div>
      <Label className="block text-sm font-medium text-gray-700 mb-2">Repurpose For</Label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {platformTypes.map((platform) => (
          <div key={platform} className="flex items-center">
            <Checkbox
              id={platform.toLowerCase()}
              checked={isPlatformSelected(platform)}
              onCheckedChange={() => handlePlatformChange(platform)}
              className="h-4 w-4 text-primary border-gray-300 rounded"
            />
            <Label 
              htmlFor={platform.toLowerCase()} 
              className="ml-2 text-sm text-gray-700"
            >
              <i className={`${getPlatformIcon(platform)} mr-1`}></i> {platform}
            </Label>
          </div>
        ))}
      </div>
      
      <Button
        onClick={repurposeContent}
        disabled={isRepurposing}
        className="w-full bg-primary hover:bg-blue-600 text-white py-6 font-medium flex items-center justify-center transition-colors"
      >
        {isRepurposing ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Repurposing...
          </>
        ) : (
          <>
            <i className="fas fa-magic mr-2"></i>
            Repurpose Content
          </>
        )}
      </Button>
    </div>
  );
}

function getPlatformIcon(platform: string): string {
  switch (platform) {
    case 'Twitter':
      return 'fab fa-twitter text-[#1DA1F2]';
    case 'LinkedIn':
      return 'fab fa-linkedin text-[#0A66C2]';
    case 'Instagram':
      return 'fab fa-instagram text-[#E4405F]';
    case 'Email':
      return 'fas fa-envelope text-gray-600';
    case 'Summary':
      return 'fas fa-list text-gray-600';
    case 'Calendar':
      return 'fas fa-calendar-alt text-gray-600';
    default:
      return 'fas fa-file-alt text-gray-600';
  }
}
