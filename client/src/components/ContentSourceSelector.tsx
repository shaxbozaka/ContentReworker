import { useContent } from "@/context/ContentContext";
import { Button } from "@/components/ui/button";
import { contentSources, type ContentSource } from "@shared/schema";

export default function ContentSourceSelector() {
  const { contentSource, setContentSource } = useContent();
  
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">Content Source</label>
      <div className="flex flex-wrap gap-2">
        {contentSources.map((source) => (
          <Button
            key={source}
            variant={contentSource === source ? "default" : "outline"}
            className={contentSource === source 
              ? "bg-primary text-white" 
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
            onClick={() => setContentSource(source as ContentSource)}
          >
            {source}
          </Button>
        ))}
      </div>
    </div>
  );
}
