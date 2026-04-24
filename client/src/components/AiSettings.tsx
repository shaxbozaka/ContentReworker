import { useState } from "react";
import { useContent } from "@/context/ContentContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toneTypes } from "@shared/schema";
import { Slider } from "@/components/ui/slider";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";

export default function AiSettings() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    tone, setTone,
    outputLength, setOutputLength,
    useHashtags, setUseHashtags,
    useEmojis, setUseEmojis
  } = useContent();

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <Settings2 className="h-3.5 w-3.5" />
        <span>Settings</span>
        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div className="mt-2 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div>
            <Label htmlFor="tone" className="mb-1 block text-sm font-bold text-slate-700">Tone</Label>
            <Select value={tone} onValueChange={(value: any) => setTone(value)}>
              <SelectTrigger className="w-full border-slate-200 bg-white text-slate-950">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white">
                {toneTypes.map((toneOption) => (
                  <SelectItem key={toneOption} value={toneOption} className="text-slate-950 focus:bg-slate-100 focus:text-slate-950">
                    {toneOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block text-sm font-bold text-slate-700">Length</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Short</span>
              <Slider
                value={[outputLength]}
                onValueChange={(values) => setOutputLength(values[0])}
                min={1}
                max={5}
                step={1}
                className="flex-1"
              />
              <span className="text-xs font-semibold text-slate-500">Long</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-2">
              <Checkbox
                id="hashtags"
                checked={useHashtags}
                onCheckedChange={(checked) => setUseHashtags(!!checked)}
                className="border-slate-300 data-[state=checked]:border-[rgb(var(--color-linkedin))] data-[state=checked]:bg-[rgb(var(--color-linkedin))]"
              />
              <Label htmlFor="hashtags" className="text-sm font-semibold text-slate-700">Hashtags</Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="emojis"
                checked={useEmojis}
                onCheckedChange={(checked) => setUseEmojis(!!checked)}
                className="border-slate-300 data-[state=checked]:border-[rgb(var(--color-linkedin))] data-[state=checked]:bg-[rgb(var(--color-linkedin))]"
              />
              <Label htmlFor="emojis" className="text-sm font-semibold text-slate-700">Emojis</Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
