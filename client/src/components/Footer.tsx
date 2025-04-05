import { Link } from "wouter";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-12" role="contentinfo" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center mb-4 md:mb-0">
            <svg className="h-6 w-6 text-primary" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
            </svg>
            <span className="ml-2 text-sm text-gray-600">AI Content Repurposing Assistant</span>
          </div>
          
          <nav aria-label="Footer navigation">
            <ul className="flex space-x-6">
              <li>
                <a href="https://aicontentrepurposer.com/help" className="text-sm text-gray-600 hover:text-gray-900">Help &amp; Documentation</a>
              </li>
              <li>
                <Link href="/privacy-policy">
                  <span className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">Privacy Policy</span>
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service">
                  <span className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">Terms of Service</span>
                </Link>
              </li>
              <li>
                <a href="mailto:contact@aicontentrepurposer.com" className="text-sm text-gray-600 hover:text-gray-900">Contact</a>
              </li>
            </ul>
          </nav>
        </div>
        
        <div className="mt-8 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">About Our AI Content Tools</h2>
              <p className="text-gray-600">AI Content Repurposing Assistant helps creators and marketers transform long-form content into platform-specific formats using advanced AI technology from OpenAI and Anthropic.</p>
            </div>
            
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">Supported Content Types</h2>
              <ul className="space-y-2 text-gray-600">
                <li>Blog Posts &amp; Articles</li>
                <li>YouTube Transcripts</li>
                <li>Podcast Content</li>
                <li>Long-form Social Posts</li>
              </ul>
            </div>
            
            <div>
              <h2 className="font-semibold text-gray-900 mb-4">Platform Optimization</h2>
              <ul className="space-y-2 text-gray-600">
                <li>Twitter/X Threads</li>
                <li>LinkedIn Professional Posts</li>
                <li>Instagram Captions</li>
                <li>Email Newsletters</li>
                <li>Content Calendars</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} AI Content Repurposing Assistant. All rights reserved.</p>
          <p className="mt-2">Powered by OpenAI GPT-4 and Anthropic Claude AI technology.</p>
        </div>
      </div>
    </footer>
  );
}
