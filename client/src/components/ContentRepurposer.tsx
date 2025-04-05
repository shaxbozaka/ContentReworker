import InputPanel from "./InputPanel";
import OutputPanel from "./OutputPanel";

export default function ContentRepurposer() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Input Section */}
      <div className="lg:col-span-5 space-y-6">
        <InputPanel />
      </div>
      
      {/* Output Section */}
      <div className="lg:col-span-7">
        <OutputPanel />
      </div>
    </div>
  );
}
