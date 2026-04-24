import { useContent } from "@/context/ContentContext";
import PlatformOutput from "./PlatformOutput";
import ExportOptions from "./ExportOptions";
import { platformTypes } from "@shared/schema";
import { Hash, Instagram, Linkedin, Loader2, Mail } from "lucide-react";
import { useEffect, useRef } from "react";

export default function OutputPanel() {
  const { outputs, activeTab, setActiveTab, isPlatformSelected, transformationId, isRepurposing } = useContent();
  const panelRef = useRef<HTMLDivElement>(null);
  const hadOutputsRef = useRef(!!outputs);

  useEffect(() => {
    if (!hadOutputsRef.current && outputs && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    hadOutputsRef.current = !!outputs;
  }, [outputs]);

  // Filter available platforms to only those selected by the user
  const availablePlatforms = platformTypes.filter(platform => isPlatformSelected(platform));

  // While generating, show a loading state in the output area so the user can see progress
  if (!outputs && isRepurposing) {
    return (
      <div
        ref={panelRef}
        id="output-panel"
        className="animate-fade-in-up stagger-2 flex flex-col items-center gap-3 rounded-xl border border-slate-300 bg-white/70 p-8 text-center"
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
        <p className="text-sm font-medium text-slate-600">Generating your LinkedIn post…</p>
      </div>
    );
  }

  // If no outputs yet, show a simple preview placeholder
  if (!outputs) {
    return (
      <div ref={panelRef} id="output-panel" className="animate-fade-in-up stagger-2 rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center">
        <h3 className="mb-2 text-base font-semibold tracking-tight text-slate-700">
          Output appears here
        </h3>
        <p className="mx-auto max-w-sm text-sm leading-6 text-slate-500">
          Paste content above and click Create LinkedIn Post.
        </p>
      </div>
    );
  }

  return (
    <div ref={panelRef} id="output-panel" className="surface-panel animate-fade-in-up stagger-2 rounded-lg p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-950">Output</h2>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {availablePlatforms.map((platform) => (
          <button
            key={platform}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all duration-200 ${
              activeTab === platform
                ? getPlatformTabStyles(platform)
                : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
            }`}
            onClick={() => setActiveTab(platform)}
          >
            {(() => {
              const Icon = getPlatformIcon(platform);
              return <Icon className="h-4 w-4" />;
            })()}
            {platform}
          </button>
        ))}
      </div>

      {/* Platform Content */}
      <div>
        {availablePlatforms.map((platform) => (
          <div
            key={platform}
            style={{ display: activeTab === platform ? 'block' : 'none' }}
          >
            <PlatformOutput
              platform={platform}
              content={outputs[platform]?.content || ''}
              characterCount={outputs[platform]?.characterCount}
              hooks={outputs[platform]?.hooks}
              body={outputs[platform]?.body}
              cta={outputs[platform]?.cta}
              transformationId={transformationId}
            />
          </div>
        ))}
      </div>

      {/* Export Options */}
      <ExportOptions />
    </div>
  );
}

function getPlatformIcon(platform: string) {
  switch (platform) {
    case "LinkedIn":
      return Linkedin;
    case "Instagram":
      return Instagram;
    case "Email":
      return Mail;
    default:
      return Hash;
  }
}

function getPlatformTabStyles(platform: string): string {
  switch (platform) {
    case 'Twitter':
      return 'border border-slate-950 bg-slate-950 text-white shadow-sm';
    case 'LinkedIn':
      return 'border border-[rgb(var(--color-linkedin))] bg-[rgb(var(--color-linkedin))] text-white shadow-sm';
    case 'Instagram':
      return 'border border-[rgb(var(--color-coral))] bg-[rgb(var(--color-coral))] text-white shadow-sm';
    case 'Email':
      return 'border border-slate-700 bg-slate-700 text-white shadow-sm';
    default:
      return 'border border-slate-950 bg-slate-950 text-white';
  }
}
