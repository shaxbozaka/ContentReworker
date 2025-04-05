import { Card, CardContent } from "@/components/ui/card";
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
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50" role="main" aria-labelledby="error-title">
      <div className="text-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 pb-8">
            <div className="flex flex-col items-center mb-4">
              <AlertCircle className="h-16 w-16 text-red-500 mb-4" aria-hidden="true" />
              <h1 id="error-title" className="text-3xl font-bold text-gray-900 mb-2">404 Page Not Found</h1>
              <p className="text-gray-600 max-w-sm mx-auto">
                The page you are looking for doesn't exist or has been moved.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <Link href="/">
                <Button className="w-full" variant="default">
                  Return to Home Page
                </Button>
              </Link>
              
              <div className="pt-4 border-t border-gray-200 mt-4">
                <h2 className="text-lg font-medium text-gray-900 mb-3">Looking for one of these pages?</h2>
                <ul className="space-y-2 text-left">
                  <li>
                    <Link href="/">
                      <span className="text-blue-600 hover:underline cursor-pointer flex items-center">
                        <span className="mr-2">→</span> AI Content Repurposing Tool Home
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/linkedin-api-tester">
                      <span className="text-blue-600 hover:underline cursor-pointer flex items-center">
                        <span className="mr-2">→</span> LinkedIn API Testing Tools
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy-policy">
                      <span className="text-blue-600 hover:underline cursor-pointer flex items-center">
                        <span className="mr-2">→</span> Privacy Policy
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms-of-service">
                      <span className="text-blue-600 hover:underline cursor-pointer flex items-center">
                        <span className="mr-2">→</span> Terms of Service
                      </span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-gray-600">
          <p>AI Content Repurposing Assistant: Transform blog posts, YouTube transcripts, podcasts, and more</p>
          <p className="mt-2">Powered by OpenAI GPT-4 and Anthropic Claude AI technology</p>
        </div>
      </div>
    </div>
  );
}
