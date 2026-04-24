import InputPanel from "./InputPanel";
import OutputPanel from "./OutputPanel";

export default function ContentRepurposer() {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4">
      <div>
        <InputPanel />
      </div>

      <div>
        <OutputPanel />
      </div>
    </div>
  );
}
