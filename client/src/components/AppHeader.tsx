import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";

export default function AppHeader() {
  const { setContent, setContentSource, setOutputs } = useContent();
  
  const handleNewProject = () => {
    // Reset the content and outputs
    setContent("");
    setContentSource("Blog Post");
    setOutputs(null);
  };
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
          </svg>
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
