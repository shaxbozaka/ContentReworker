import { useContent } from "@/context/ContentContext";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function ContentEditor() {
  const { content, setContent, getWordCount } = useContent();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [wordCount, setWordCount] = useState(0);
  
  useEffect(() => {
    // Update word count whenever content changes
    setWordCount(getWordCount());
  }, [content, getWordCount]);
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };
  
  const applyFormatting = (format: string) => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    
    let formattedText = '';
    let newCursorPos = 0;
    
    switch (format) {
      case 'bold':
        formattedText = `**${selectedText}**`;
        newCursorPos = start + 2;
        break;
      case 'italic':
        formattedText = `*${selectedText}*`;
        newCursorPos = start + 1;
        break;
      case 'bulletList':
        formattedText = selectedText
          .split('\n')
          .map(line => line.trim() ? `- ${line}` : line)
          .join('\n');
        newCursorPos = start;
        break;
      case 'numberList':
        formattedText = selectedText
          .split('\n')
          .map((line, i) => line.trim() ? `${i + 1}. ${line}` : line)
          .join('\n');
        newCursorPos = start;
        break;
      case 'clear':
        // Simple regex to remove common markdown
        formattedText = selectedText
          .replace(/(\*\*|__)(.*?)\1/g, '$2') // Bold
          .replace(/(\*|_)(.*?)\1/g, '$2')     // Italic
          .replace(/^- /gm, '')                // Bullet list
          .replace(/^\d+\.\s/gm, '');          // Numbered list
        newCursorPos = start;
        break;
    }
    
    // Apply the change
    if (selectedText) {
      const newContent = content.substring(0, start) + formattedText + content.substring(end);
      setContent(newContent);
      
      // Set cursor position after formatting
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            format === 'clear' ? start : start + formattedText.length,
            format === 'clear' ? start + formattedText.length : start + formattedText.length
          );
        }
      }, 0);
    }
  };
  
  return (
    <div className="mb-4">
      <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Content</label>
      <div className="border border-gray-300 rounded-lg overflow-hidden">
        {/* Editor Toolbar */}
        <div className="bg-gray-50 border-b border-gray-300 p-2 flex items-center space-x-2">
          <button 
            className="p-1.5 rounded hover:bg-gray-200" 
            title="Bold"
            onClick={() => applyFormatting('bold')}
          >
            <i className="fas fa-bold text-gray-700"></i>
          </button>
          <button 
            className="p-1.5 rounded hover:bg-gray-200" 
            title="Italic"
            onClick={() => applyFormatting('italic')}
          >
            <i className="fas fa-italic text-gray-700"></i>
          </button>
          <button 
            className="p-1.5 rounded hover:bg-gray-200" 
            title="Bullet List"
            onClick={() => applyFormatting('bulletList')}
          >
            <i className="fas fa-list-ul text-gray-700"></i>
          </button>
          <button 
            className="p-1.5 rounded hover:bg-gray-200" 
            title="Numbered List"
            onClick={() => applyFormatting('numberList')}
          >
            <i className="fas fa-list-ol text-gray-700"></i>
          </button>
          <span className="border-l border-gray-300 h-5 mx-1"></span>
          <button 
            className="p-1.5 rounded hover:bg-gray-200" 
            title="Clear Formatting"
            onClick={() => applyFormatting('clear')}
          >
            <i className="fas fa-eraser text-gray-700"></i>
          </button>
        </div>
        
        {/* Content Textarea */}
        <Textarea
          id="content"
          ref={textareaRef}
          className="w-full editor p-4 text-gray-700 focus:outline-none resize-none border-0 rounded-none"
          placeholder="Paste or type your content here..."
          value={content}
          onChange={handleTextChange}
          rows={10}
        />
        
        <div className="bg-gray-50 border-t border-gray-300 px-3 py-2 text-sm text-gray-500 flex justify-between items-center">
          <span>Word count: {wordCount}</span>
          <Button variant="ghost" className="text-primary hover:text-primary-dark p-0 h-auto">
            <i className="fas fa-cloud-upload-alt mr-1"></i> 
            Save Draft
          </Button>
        </div>
      </div>
    </div>
  );
}
