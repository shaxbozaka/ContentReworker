import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import {
  ArrowRight,
  Check,
  Twitter,
  Zap,
  Clock,
  TrendingUp,
  Star,
} from "lucide-react";

export default function BlogToTwitterPage() {
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
            <Twitter className="w-4 h-4" />
            Blog to Twitter Converter
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
            Turn Your Blog Posts Into Viral Twitter Threads in Seconds
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Stop spending hours reformatting content. Our AI converts any blog post into engaging Twitter threads that get likes, retweets, and followers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={handleTryNow}
            >
              Convert Blog to Twitter Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">No credit card required · Free tier available</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How to Convert Blog Posts to Twitter Threads
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">1</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Paste Your Blog Post</h3>
              <p className="text-gray-600">Copy and paste your entire blog post or article into our converter.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">2</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">AI Transforms It</h3>
              <p className="text-gray-600">Our AI extracts key points and formats them for maximum Twitter engagement.</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-blue-600">3</span>
              </div>
              <h3 className="font-semibold text-lg mb-2">Copy & Post</h3>
              <p className="text-gray-600">Get a perfectly formatted thread ready to post. Copy with one click.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Why Use Our Blog to Twitter Converter?
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Save Hours of Work</h3>
                  <p className="text-gray-600">Converting a blog post to a Twitter thread manually takes 30-60 minutes. Our tool does it in under 10 seconds.</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Optimized for Engagement</h3>
                  <p className="text-gray-600">Our AI writes hooks that stop the scroll and formats threads for maximum retweets and replies.</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Perfect Thread Structure</h3>
                  <p className="text-gray-600">Automatically breaks your content into the optimal number of tweets with proper hooks, body, and CTAs.</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Star className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2">Maintain Your Voice</h3>
                  <p className="text-gray-600">The AI preserves your unique writing style while adapting content for Twitter's format and audience.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features list */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            What You Get
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "Attention-grabbing opening tweet",
              "Properly formatted thread structure",
              "Character count optimization",
              "Hashtag suggestions",
              "Call-to-action in final tweet",
              "One-click copy functionality",
              "Multiple thread variations",
              "Works with any blog length",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Turn Your Blog Into Twitter Gold?
          </h2>
          <p className="text-blue-100 text-lg mb-8">
            Join thousands of creators who repurpose their content with AI.
          </p>
          <Button
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-50 font-semibold"
            onClick={handleTryNow}
          >
            Start Converting Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
