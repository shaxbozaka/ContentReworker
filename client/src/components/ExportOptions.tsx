import { Button } from "@/components/ui/button";
import { useContent } from "@/context/ContentContext";
import { Download, Copy } from "lucide-react";

export default function ExportOptions() {
  const { outputs, copyToClipboard } = useContent();

  const handleDownloadAll = () => {
    if (!outputs) return;

    let content = "# Repurposed Content\n\n";

    Object.entries(outputs).forEach(([platform, output]) => {
      content += `## ${platform}\n\n${output.content}\n\n`;
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repurposed-content.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAll = () => {
    if (!outputs) return;

    let content = "";
    Object.entries(outputs).forEach(([platform, output]) => {
      content += `--- ${platform} ---\n\n${output.content}\n\n`;
    });

    copyToClipboard(content);
  };

  return (
    <div className="mt-6 border-t border-slate-200 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-bold text-slate-600">Export all platforms</h3>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
          >
            <Copy className="w-4 h-4 mr-1.5" /> Copy All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950"
          >
            <Download className="w-4 h-4 mr-1.5" /> Download
          </Button>
        </div>
      </div>
    </div>
  );
}
