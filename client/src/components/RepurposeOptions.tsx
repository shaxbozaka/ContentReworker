import { useState } from "react";
import { useContent } from "@/context/ContentContext";
import { PlatformType } from "@shared/schema";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Hash,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
} from "lucide-react";

const otherPlatforms: PlatformType[] = ["Twitter", "Threads", "Instagram", "Email"];

export default function RepurposeOptions() {
  const [showMorePlatforms, setShowMorePlatforms] = useState(false);
  const {
    togglePlatform,
    isPlatformSelected,
    repurposeContent,
    isRepurposing,
  } = useContent();

  const otherPlatformsSelected = otherPlatforms.filter((platform) => isPlatformSelected(platform));
  const ctaLabel = otherPlatformsSelected.length > 0
    ? `Create LinkedIn Post + ${otherPlatformsSelected.length}`
    : "Create LinkedIn Post";

  return (
    <div>
      <button
        data-tour="create-button"
        onClick={repurposeContent}
        disabled={isRepurposing}
        className="btn-primary w-full py-4 text-base"
      >
        {isRepurposing ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Creating post...
          </>
        ) : (
          <>
            <Linkedin className="h-5 w-5" />
            {ctaLabel}
          </>
        )}
      </button>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-slate-500">
          LinkedIn post · 3 hooks
        </p>
        <button
          onClick={() => setShowMorePlatforms(!showMorePlatforms)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        >
          {showMorePlatforms ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Platforms
          {otherPlatformsSelected.length > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
              {otherPlatformsSelected.length}
            </span>
          )}
        </button>
      </div>

      {showMorePlatforms && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {otherPlatforms.map((platform) => {
            const isSelected = isPlatformSelected(platform);
            const Icon = getPlatformIcon(platform);
            return (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all ${
                  isSelected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {platform === "Twitter" ? "X" : platform}
                </span>
                {isSelected && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "Instagram":
      return Instagram;
    case "Email":
      return Mail;
    case "LinkedIn":
      return Linkedin;
    default:
      return Hash;
  }
}
