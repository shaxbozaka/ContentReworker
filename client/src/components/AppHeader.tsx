import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import { Link } from "wouter";

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
    <header className="bg-white shadow-sm" role="banner" aria-label="Application header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/">
            <span className="flex items-center cursor-pointer">
              <img 
                src="/public/images/logo.png" 
                alt="Content Repurposing Assistant Logo" 
                className="h-12 w-auto"
              />
              <h1 className="ml-3 text-xl font-semibold text-gray-900">
                <span className="sr-only">Home - </span>
                AI Content Repurposing Assistant
              </h1>
            </span>
          </Link>
          <nav className="ml-6 hidden md:block" aria-label="Main navigation">
            <ul className="flex space-x-6">
              <li>
                <Link href="/">
                  <span className="text-gray-700 hover:text-blue-600 cursor-pointer">Home</span>
                </Link>
              </li>
              <li>
                <Link href="/linkedin-api-tester">
                  <span className="text-gray-700 hover:text-blue-600 cursor-pointer">LinkedIn Tools</span>
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="flex items-center space-x-3">
          <span className="hidden md:inline text-sm text-gray-600">
            AI-powered content transformation for Twitter, LinkedIn, Instagram &amp; more
          </span>
          <Button 
            onClick={handleNewProject} 
            className="bg-primary hover:bg-blue-600 text-white transition-colors"
            aria-label="Create new content repurposing project"
          >
            <i className="fas fa-magic mr-2" aria-hidden="true"></i>
            New Project
          </Button>
        </div>
      </div>
    </header>
  );
}
