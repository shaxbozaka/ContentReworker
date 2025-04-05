import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";

export default function ExportOptions() {
  const { outputs, copyToClipboard } = useContent();
  
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
  
  return (
    <div className="mt-6 pt-4 border-t border-gray-200">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <h3 className="font-medium text-gray-800">Export Options</h3>
        
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleCopyAll}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
          >
            <i className="far fa-file-alt mr-1.5"></i> Copy All Content
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadAll}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors"
          >
            <i className="fas fa-download mr-1.5"></i> Download All
          </Button>
          <Button
            variant="default"
            className="bg-secondary hover:bg-green-600 text-white transition-colors"
          >
            <i className="fas fa-share-alt mr-1.5"></i> Share
          </Button>
        </div>
      </div>
    </div>
  );
}
