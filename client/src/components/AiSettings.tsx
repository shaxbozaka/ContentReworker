import { Card, CardContent } from "@/components/ui/card";
import { useContent } from "@/context/ContentContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toneTypes } from "@shared/schema";
import { Slider } from "@/components/ui/slider";

export default function AiSettings() {
  const { 
    tone, setTone,
    outputLength, setOutputLength,
    useHashtags, setUseHashtags,
    useEmojis, setUseEmojis
  } = useContent();
  
  return (
    <Card className="bg-white rounded-lg shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">AI Settings</h2>
          <button className="text-sm text-primary hover:text-blue-700 flex items-center">
            <i className="fas fa-sliders-h mr-1"></i> Advanced
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="tone" className="block text-sm font-medium text-gray-700 mb-1">Content Tone</Label>
            <Select value={tone} onValueChange={(value: any) => setTone(value)}>
              <SelectTrigger className="w-full border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary">
                <SelectValue placeholder="Select tone" />
              </SelectTrigger>
              <SelectContent>
                {toneTypes.map((toneOption) => (
                  <SelectItem key={toneOption} value={toneOption}>
                    {toneOption}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1">Output Length</Label>
            <div className="flex items-center">
              <span className="text-xs text-gray-500">Shorter</span>
              <Slider
                value={[outputLength]}
                onValueChange={(values) => setOutputLength(values[0])}
                min={1}
                max={5}
                step={1}
                className="mx-2 w-full"
              />
              <span className="text-xs text-gray-500">Longer</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Checkbox
                id="hashtags"
                checked={useHashtags}
                onCheckedChange={(checked) => setUseHashtags(!!checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded"
              />
              <Label htmlFor="hashtags" className="ml-2 text-sm text-gray-700">
                Add relevant hashtags
              </Label>
            </div>
            
            <div className="flex items-center">
              <Checkbox
                id="emojis"
                checked={useEmojis}
                onCheckedChange={(checked) => setUseEmojis(!!checked)}
                className="h-4 w-4 text-primary border-gray-300 rounded"
              />
              <Label htmlFor="emojis" className="ml-2 text-sm text-gray-700">
                Include emojis
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
