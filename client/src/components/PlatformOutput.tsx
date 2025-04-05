import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import type { PlatformType } from "@shared/schema";

interface PlatformOutputProps {
  platform: PlatformType;
  content: string;
  characterCount?: number;
}

export default function PlatformOutput({ platform, content, characterCount }: PlatformOutputProps) {
  const { copyToClipboard, regenerateOutput, isRepurposing } = useContent();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  
  const handleCopy = () => {
    copyToClipboard(content);
  };
  
  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(content);
  };
  
  const handleSave = () => {
    // In a real app, you'd send this to the backend to save
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent(content);
  };
  
  const handleRegenerate = () => {
    regenerateOutput(platform);
  };
  
  const platformInfo = getPlatformInfo(platform);
  
  // Function to format content based on platform type
  const formatContent = (content: string) => {
    if (platform === "Twitter") {
      // For Twitter, split into tweet-like blocks
      const tweets = content.split(/\n\n|\([\d/\d]\)/);
      return (
        <div className="space-y-4">
          {tweets.filter(t => t.trim()).map((tweet, index) => (
            <div key={index} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
              <p dangerouslySetInnerHTML={{ __html: tweet.replace(/\n/g, "<br/>") }} />
            </div>
          ))}
          
          {tweets.length > 4 && (
            <div className="text-center text-gray-500 text-xs py-2">
              <i className="fas fa-ellipsis-h"></i> {tweets.length - 3} more tweets in thread
            </div>
          )}
        </div>
      );
    }
    
    // For other platforms
    return (
      <div className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm whitespace-pre-wrap">
        <p dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, "<br/>") }} />
      </div>
    );
  };
  
  const getCharacterLimit = () => {
    switch (platform) {
      case "Twitter":
        return 280;
      case "Instagram":
        return 2200;
      case "LinkedIn":
        return 3000;
      default:
        return undefined;
    }
  };
  
  const limit = getCharacterLimit();
  
  return (
    <div className="platform-output">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm platform-card hover:transform hover:translate-y-[-2px] hover:shadow-md transition-all duration-200">
        {/* Platform Header */}
        <div className={`${platformInfo.bgClass} px-4 py-3 border-b border-gray-200 flex justify-between items-center`}>
          <div className="flex items-center">
            <i className={`${platformInfo.icon} text-lg`}></i>
            <h3 className="ml-2 font-medium text-gray-800">{platformInfo.title}</h3>
          </div>
          {limit && characterCount !== undefined && (
            <div className="text-sm text-gray-500">
              <span className={`font-medium ${characterCount > limit ? 'text-red-500' : ''}`}>
                {characterCount}
              </span>/{limit}
            </div>
          )}
        </div>
        
        {/* Platform Content */}
        <div className="p-4 text-gray-800 text-sm">
          {isEditing ? (
            <textarea
              className="w-full border border-gray-300 rounded-md p-2 min-h-[200px]"
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
            />
          ) : (
            formatContent(content)
          )}
        </div>
        
        {/* Platform Actions */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRepurposing}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
            >
              {isRepurposing ? (
                <i className="fas fa-spinner fa-spin text-xs mr-1"></i>
              ) : (
                <i className="fas fa-redo text-xs mr-1"></i>
              )}
              Regenerate
            </Button>
            
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSave}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                >
                  <i className="fas fa-save text-xs mr-1"></i> Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                >
                  <i className="fas fa-times text-xs mr-1"></i> Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
              >
                <i className="fas fa-pencil-alt text-xs mr-1"></i> Edit
              </Button>
            )}
          </div>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleCopy}
            className="text-xs bg-primary hover:bg-blue-600 text-white transition-colors"
          >
            <i className="far fa-copy text-xs mr-1"></i> Copy All
          </Button>
        </div>
      </div>
    </div>
  );
}

function getPlatformInfo(platform: PlatformType) {
  switch (platform) {
    case 'Twitter':
      return {
        icon: 'fab fa-twitter text-[#1DA1F2]',
        bgClass: 'bg-[#1DA1F2] bg-opacity-10',
        title: 'Twitter Thread'
      };
    case 'LinkedIn':
      return {
        icon: 'fab fa-linkedin text-[#0A66C2]',
        bgClass: 'bg-[#0A66C2] bg-opacity-10',
        title: 'LinkedIn Post'
      };
    case 'Instagram':
      return {
        icon: 'fab fa-instagram text-[#E4405F]',
        bgClass: 'bg-[#E4405F] bg-opacity-10',
        title: 'Instagram Caption'
      };
    case 'Email':
      return {
        icon: 'fas fa-envelope text-gray-600',
        bgClass: 'bg-gray-200 bg-opacity-30',
        title: 'Email Newsletter'
      };
    case 'Summary':
      return {
        icon: 'fas fa-list text-gray-600',
        bgClass: 'bg-gray-200 bg-opacity-30',
        title: 'Bullet-Point Summary'
      };
    case 'Calendar':
      return {
        icon: 'fas fa-calendar-alt text-gray-600',
        bgClass: 'bg-gray-200 bg-opacity-30',
        title: 'Content Calendar'
      };
    default:
      return {
        icon: 'fas fa-file-alt text-gray-600',
        bgClass: 'bg-gray-200 bg-opacity-30',
        title: 'Content'
      };
  }
}
