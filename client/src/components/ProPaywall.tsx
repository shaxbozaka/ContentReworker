import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, Zap, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Feature {
  text: string;
}

interface ProPaywallProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features?: Feature[];
  ctaText?: string;
}

export default function ProPaywall({
  icon: Icon,
  title,
  description,
  features = [],
  ctaText = "Upgrade to Pro",
}: ProPaywallProps) {
  return (
    <div className="flex-1 flex items-center justify-center p-4 py-16">
      <div className="relative max-w-lg w-full">
        {/* Background glow effects */}
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-[#0077b5]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl" />

        {/* Main card */}
        <div className="relative bg-gradient-to-b from-[#1a1a1a] to-[#111111] rounded-3xl border border-white/10 overflow-hidden">
          {/* Top accent line */}
          <div className="h-1 bg-gradient-to-r from-[#0077b5] via-amber-500 to-[#0077b5]" />

          <div className="p-8 md:p-10">
            {/* Icon */}
            <div className="relative mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0077b5] to-[#005885] flex items-center justify-center shadow-lg shadow-[#0077b5]/20">
                <Icon className="w-8 h-8 text-white" />
              </div>
              {/* Pro badge */}
              <div className="absolute -top-2 -right-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-[10px] font-bold text-[#1a1a1a] uppercase tracking-wider shadow-lg">
                Pro
              </div>
            </div>

            {/* Content */}
            <h2 className="text-2xl md:text-3xl font-bold text-[#faf7f2] mb-3 tracking-tight">
              {title}
            </h2>
            <p className="text-[#faf7f2]/60 text-base leading-relaxed mb-8">
              {description}
            </p>

            {/* Features list */}
            {features.length > 0 && (
              <div className="space-y-3 mb-8">
                {features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-[#0077b5]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-[#0077b5]" />
                    </div>
                    <span className="text-[#faf7f2]/80 text-sm">{feature.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="space-y-4">
              <Link href="/pricing">
                <Button className="w-full h-12 bg-gradient-to-r from-[#0077b5] to-[#005885] hover:from-[#0088cc] hover:to-[#006699] text-white text-base font-semibold rounded-xl shadow-lg shadow-[#0077b5]/20 transition-all hover:shadow-[#0077b5]/30">
                  <Zap className="w-4 h-4 mr-2" />
                  {ctaText}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              {/* Price hint */}
              <p className="text-center text-sm text-[#faf7f2]/40">
                <span className="text-[#faf7f2]/60 font-medium">$15/month</span> billed annually
                <span className="text-green-400/70 ml-1">(Save 20%)</span>
              </p>
            </div>
          </div>

          {/* Bottom decoration */}
          <div className="px-8 pb-8">
            <div className="flex items-center justify-center gap-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-[#faf7f2]/40">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Cancel anytime
              </div>
              <div className="flex items-center gap-2 text-xs text-[#faf7f2]/40">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Instant access
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
