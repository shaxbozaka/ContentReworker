import { Link } from "wouter";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import {
  ArrowRight,
  Check,
  Youtube,
  FileText,
  Clock,
  Search,
  Sparkles,
  Star,
} from "lucide-react";

export default function YouTubeToBlogPage() {
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
      <section className="bg-gradient-to-b from-red-50 to-gray-50 py-16 md:py-24">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <Youtube className="w-4 h-4" />
            YouTube to Social Content
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
            Turn YouTube Videos Into Social Media Content
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Repurpose your YouTube content for Twitter, LinkedIn, Instagram, and email newsletters. Get 30+ days of content from a single video.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleTryNow}
            >
              Convert YouTube Content Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Link href="/pricing">
              <Button size="lg" variant="outline">
                View Pricing
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">Works with any transcript · No credit card required</p>
        </div>
      </section>

      {/* Problem/Solution */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
                Your YouTube Content Deserves More Reach
              </h2>
              <p className="text-gray-600 mb-6">
                You spend hours creating YouTube videos, but only a fraction of your audience sees them. Meanwhile, your competitors are everywhere - Twitter, LinkedIn, Instagram, newsletters.
              </p>
              <p className="text-gray-600 mb-6">
                The problem? Repurposing video content for other platforms takes forever. What if you could do it in seconds?
              </p>
              <div className="space-y-3">
                {[
                  "Convert transcripts to Twitter threads",
                  "Create LinkedIn posts from key insights",
                  "Generate Instagram captions",
                  "Write email newsletter content",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-100 rounded-2xl p-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white rounded-lg shadow-sm">
                  <Youtube className="w-8 h-8 text-red-600" />
                  <div>
                    <div className="font-medium">1 YouTube Video</div>
                    <div className="text-sm text-gray-500">20 minute podcast</div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-lg shadow-sm text-center">
                    <div className="text-2xl font-bold text-blue-600">5</div>
                    <div className="text-xs text-gray-500">Twitter Threads</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm text-center">
                    <div className="text-2xl font-bold text-blue-600">10</div>
                    <div className="text-xs text-gray-500">LinkedIn Posts</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm text-center">
                    <div className="text-2xl font-bold text-pink-600">8</div>
                    <div className="text-xs text-gray-500">Instagram Captions</div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm text-center">
                    <div className="text-2xl font-bold text-green-600">4</div>
                    <div className="text-xs text-gray-500">Email Sections</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Why YouTubers Love Our Tool
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Save 10+ Hours Weekly</h3>
              <p className="text-gray-600">Stop manually reformatting content. Convert entire video transcripts in seconds, not hours.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Boost Discoverability</h3>
              <p className="text-gray-600">Get found on every platform. Each piece of content drives traffic back to your YouTube channel.</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Platform-Optimized</h3>
              <p className="text-gray-600">Each output is tailored for its platform - proper length, tone, and formatting for maximum engagement.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            How to Repurpose YouTube Content
          </h2>
          <div className="space-y-6">
            <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Get Your Transcript</h3>
                <p className="text-gray-600">Copy the transcript from YouTube (click "Show transcript" under any video) or use a transcription tool.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Paste & Select Platforms</h3>
                <p className="text-gray-600">Paste your transcript and choose which platforms you want content for - Twitter, LinkedIn, Instagram, or Email.</p>
              </div>
            </div>
            <div className="flex items-start gap-6 p-6 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Get Platform-Ready Content</h3>
                <p className="text-gray-600">Receive perfectly formatted content for each platform, ready to copy and post.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">
            Perfect For
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { title: "Podcasters", desc: "Turn episodes into social clips" },
              { title: "Educators", desc: "Repurpose tutorials and lessons" },
              { title: "Vloggers", desc: "Extend your content's reach" },
              { title: "Businesses", desc: "Maximize video marketing ROI" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 text-center shadow-sm border border-gray-100">
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-red-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Stop Letting Your YouTube Content Go to Waste
          </h2>
          <p className="text-red-100 text-lg mb-8">
            Get 10x the value from every video you create.
          </p>
          <Button
            size="lg"
            className="bg-white text-red-600 hover:bg-red-50 font-semibold"
            onClick={handleTryNow}
          >
            Start Repurposing Free
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
