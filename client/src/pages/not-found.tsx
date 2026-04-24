import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useEffect } from "react";

export default function NotFound() {
  // Update the page title for SEO
  useEffect(() => {
    document.title = "404 - Page Not Found | AI Content Repurposing Assistant";
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f0f0f]" role="main" aria-labelledby="error-title">
      <div className="text-center max-w-md mx-4">
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-red-400" aria-hidden="true" />
          </div>
          <h1 id="error-title" className="text-3xl font-bold text-white mb-3">404 Page Not Found</h1>
          <p className="text-white/60 max-w-sm mx-auto">
            The page you are looking for doesn't exist or has been moved.
          </p>
        </div>

        <Link href="/">
          <Button className="bg-white text-black hover:bg-white/90 px-8 py-3 font-semibold">
            Return to Home Page
          </Button>
        </Link>

        <div className="pt-8 mt-8 border-t border-white/10">
          <h2 className="text-lg font-medium text-white mb-4">Looking for one of these?</h2>
          <ul className="space-y-3 text-left">
            <li>
              <Link href="/">
                <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center transition-colors">
                  <span className="mr-2 text-white/40">→</span> AI Content Repurposing Tool
                </span>
              </Link>
            </li>
            <li>
              <Link href="/schedule">
                <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center transition-colors">
                  <span className="mr-2 text-white/40">→</span> Content Pipeline & Scheduling
                </span>
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy">
                <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center transition-colors">
                  <span className="mr-2 text-white/40">→</span> Privacy Policy
                </span>
              </Link>
            </li>
            <li>
              <Link href="/terms-of-service">
                <span className="text-blue-400 hover:text-blue-300 cursor-pointer flex items-center transition-colors">
                  <span className="mr-2 text-white/40">→</span> Terms of Service
                </span>
              </Link>
            </li>
          </ul>
        </div>

        <div className="mt-10 text-white/40 text-sm">
          <p>AI Content Repurposer: Transform your content for every platform</p>
        </div>
      </div>
    </div>
  );
}
