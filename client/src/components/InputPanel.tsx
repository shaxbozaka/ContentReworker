import ContentEditor from "./ContentEditor";
import RepurposeOptions from "./RepurposeOptions";
import AiSettings from "./AiSettings";

export default function InputPanel() {
  return (
    <div className="surface-panel animate-fade-in-up rounded-xl p-4 sm:p-5">
      <ContentEditor />
      <RepurposeOptions />
      <AiSettings />
    </div>
  );
}
