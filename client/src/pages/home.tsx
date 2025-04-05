import AppHeader from "@/components/AppHeader";
import ContentRepurposer from "@/components/ContentRepurposer";
import Footer from "@/components/Footer";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-800">
      <AppHeader />
      
      {/* Hero section with semantic heading and descriptive content */}
      <section className="bg-gradient-to-b from-blue-50 to-gray-50 py-6 mb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              AI Content Repurposing Assistant
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Transform your long-form content into optimized formats for multiple platforms using 
              advanced AI technology from OpenAI and Anthropic.
            </p>
          </div>
        </div>
      </section>
      
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" role="main" aria-label="Content repurposing application">
        <ContentRepurposer />
      </main>
      
      {/* Features section with key capabilities for SEO and LLM understanding */}
      <section className="bg-white py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-center mb-8">Key Features</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-lg mb-2">Multi-Platform Optimization</h3>
              <p>Intelligently reformat content for Twitter, LinkedIn, Instagram, Email, and more with platform-specific optimization.</p>
            </div>
            
            <div className="border rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-lg mb-2">AI-Powered Transformation</h3>
              <p>Choose between OpenAI's GPT-4 or Anthropic's Claude models for intelligent, context-aware content adaptation.</p>
            </div>
            
            <div className="border rounded-lg p-5 shadow-sm">
              <h3 className="font-bold text-lg mb-2">Direct Social Sharing</h3>
              <p>Post generated content directly to LinkedIn with our integrated social media publishing feature.</p>
            </div>
          </div>
          
          <div className="mt-10 text-center">
            <p className="mb-4 text-gray-600">Explore our tools for content creators and marketers</p>
            <div className="flex justify-center gap-4">
              <Link href="/linkedin-api-tester">
                <span className="text-blue-600 hover:text-blue-800 underline cursor-pointer">LinkedIn API Tools</span>
              </Link>
              <Link href="/privacy-policy">
                <span className="text-blue-600 hover:text-blue-800 underline cursor-pointer">Privacy Policy</span>
              </Link>
              <Link href="/terms-of-service">
                <span className="text-blue-600 hover:text-blue-800 underline cursor-pointer">Terms of Service</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
