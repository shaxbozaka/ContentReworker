import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";

export default function AppHeader() {
  const context = useContent();
  
  const handleNewProject = () => {
    // Reset the content and outputs
    context.setContent("");
    context.setContentSource("Blog Post");
    context.resetOutputs();
    context.setActiveTab("Twitter"); // Reset the active tab too
  };
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="/public/images/logo.png" 
            alt="Content Repurposing Logo" 
            className="h-12 w-auto"
          />
          <h1 className="ml-3 text-xl font-semibold text-gray-900">AI Content Repurposing Assistant</h1>
        </div>
        <div>
          <Button onClick={handleNewProject} className="bg-primary hover:bg-blue-600 text-white transition-colors">
            <i className="fas fa-magic mr-2"></i>
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
}
