import { useContent } from "@/context/ContentContext";
import { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

export default function ContentEditor() {
  const { content, setContent, getWordCount, loadSampleContent } = useContent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [wordCount, setWordCount] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setWordCount(getWordCount());
  }, [content, getWordCount]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label htmlFor="content" className="text-sm font-semibold text-slate-700">
          Paste content
        </label>
        {!content && (
          <button
            onClick={loadSampleContent}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <span>Example</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className={`relative rounded-lg transition-all duration-200 ${isFocused ? 'ring-4 ring-blue-500/10' : ''}`}>
        <textarea
          id="content"
          ref={textareaRef}
          className="input-dark min-h-[170px] resize-none border-0 bg-transparent p-0 text-base leading-7 shadow-none focus:border-0 focus:shadow-none"
          placeholder="Paste a blog post, article, newsletter, or rough idea here..."
          value={content}
          onChange={handleTextChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          rows={8}
        />

        {/* Gradient fade at bottom when content is long */}
        {content && content.length > 500 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-white to-transparent" />
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-400">
          {wordCount > 0 ? `${wordCount} words` : 'Ready when you are'}
        </span>
      </div>
    </div>
  );
}
