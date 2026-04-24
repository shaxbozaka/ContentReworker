import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import {
  ArrowRight,
  Check,
  Linkedin,
  Sparkles,
  Users,
  BarChart3,
  MessageSquare,
  Star,
} from "lucide-react";

export default function LinkedInPostGeneratorPage() {
  const { setContent, resetOutputs } = useContent();

  const handleTryNow = () => {
    setContent("");
    resetOutputs();
    window.location.href = "/#content";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <AppHeader />

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-gray-50 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Linkedin className="w-4 h-4" />
            LinkedIn Post Generator
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
            Create Viral LinkedIn Posts That Get Engagement
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Transform any content into LinkedIn posts that attract connections, build your brand, and drive leads. Includes 3 viral hook variations per post.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={handleTryNow}
            >
              Generate LinkedIn Posts Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">No credit card required · Post directly to LinkedIn</p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">3</div>
              <div className="text-gray-600">Viral hook variations</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">60s</div>
              <div className="text-gray-600">From idea to post</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">1-click</div>
              <div className="text-gray-600">Direct posting</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
            LinkedIn Posts That Actually Perform
          </h2>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            Our AI has analyzed thousands of viral LinkedIn posts to understand what makes content go viral.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">3 Hook Variations</h3>
              <p className="text-gray-600">Get 3 different viral hooks for every post. Test which resonates best with your audience.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Algorithm Optimized</h3>
              <p className="text-gray-600">Formatted to trigger LinkedIn's algorithm - proper line breaks, spacing, and length.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Engagement Hooks</h3>
              <p className="text-gray-600">Every post ends with a conversation starter that encourages comments and shares.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Direct Posting</h3>
              <p className="text-gray-600">Connect your LinkedIn account and post directly without leaving the app.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
                <Star className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Professional Tone</h3>
              <p className="text-gray-600">Maintains a professional yet engaging tone perfect for B2B audiences.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <Linkedin className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Hashtag Strategy</h3>
              <p className="text-gray-600">AI-suggested hashtags that increase discoverability without looking spammy.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How to use */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Generate LinkedIn Posts in 3 Steps
          </h2>
          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-2">Paste Your Content</h3>
                <p className="text-gray-600">Add your blog post, article, podcast transcript, or any long-form content you want to repurpose for LinkedIn.</p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-2">Choose Your Hook</h3>
                <p className="text-gray-600">Review 3 AI-generated hook variations and pick the one that best fits your audience and style.</p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-xl mb-2">Post or Schedule</h3>
                <p className="text-gray-600">Copy your post or use our direct LinkedIn integration to publish immediately.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="flex justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <blockquote className="text-xl text-gray-700 mb-6">
              "The LinkedIn hook optimizer is a game-changer. My engagement went from ~50 likes to consistently hitting 500+. The AI really understands what makes content viral on LinkedIn."
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                MJ
              </div>
              <div className="text-left">
                <div className="font-semibold text-gray-900">Marcus Johnson</div>
                <div className="text-sm text-gray-500">Newsletter Writer · 50K subscribers</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Start Creating Viral LinkedIn Content Today
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            No signup required. Generate 3 viral hook variations in 60 seconds.
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
            onClick={handleTryNow}
          >
            Generate Your First Post Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
