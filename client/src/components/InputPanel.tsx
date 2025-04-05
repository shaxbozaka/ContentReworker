import { Card, CardContent } from "@/components/ui/card";
import ContentSourceSelector from "./ContentSourceSelector";
import ContentEditor from "./ContentEditor";
import RepurposeOptions from "./RepurposeOptions";
import AiSettings from "./AiSettings";

export default function InputPanel() {
  return (
    <>
      <Card className="bg-white rounded-lg shadow">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Input Your Content</h2>
          
          <ContentSourceSelector />
          <ContentEditor />
          <RepurposeOptions />
        </CardContent>
      </Card>
      
      <AiSettings />
    </>
  );
}
