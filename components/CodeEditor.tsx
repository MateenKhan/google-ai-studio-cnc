import React, { useState, useRef, useEffect } from 'react';
import { Download, RefreshCw, Copy, Check, Filter, Upload } from 'lucide-react';
import Ripple from './Ripple';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRegenerate: () => void;
  isManualMode: boolean;
  generateOnlySelected?: boolean;
  onToggleGenerateOnlySelected?: () => void;
  onCursorPositionChange?: (lineNumber: number) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ 
    code, 
    onChange, 
    onRegenerate, 
    isManualMode,
    generateOnlySelected,
    onToggleGenerateOnlySelected,
    onCursorPositionChange
}) => {
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track cursor position
  useEffect(() => {
    const handleCursorChange = () => {
      if (textareaRef.current && onCursorPositionChange) {
        const textarea = textareaRef.current;
        const cursorPosition = textarea.selectionStart;
        const textBeforeCursor = textarea.value.substring(0, cursorPosition);
        const lineNumber = textBeforeCursor.split('\n').length;
        onCursorPositionChange(lineNumber);
      }
    };

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.addEventListener('keyup', handleCursorChange);
      textarea.addEventListener('click', handleCursorChange);
      return () => {
        textarea.removeEventListener('keyup', handleCursorChange);
        textarea.removeEventListener('click', handleCursorChange);
      };
    }
  }, [onCursorPositionChange]);

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toolpath.gcode';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          if (evt.target?.result) {
              onChange(evt.target.result as string);
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border-l border-slate-800 min-w-[300px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
        <h3 className="font-semibold text-slate-200">G-Code</h3>
        <div className="flex gap-2 items-center">
            {onToggleGenerateOnlySelected && (
                <Ripple><button 
                    onClick={onToggleGenerateOnlySelected}
                    className={`p-1.5 rounded transition-colors ${generateOnlySelected ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:bg-slate-800'}`}
                    title="Generate Code for Selected Items Only"
                >
                    <Filter size={16} />
                </button></Ripple>
            )}
            
            <Ripple><button 
                onClick={() => fileInputRef.current?.click()} 
                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                title="Upload G-Code"
            >
                <Upload size={16} />
                <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".gcode,.nc,.txt" className="hidden" />
            </button></Ripple>

            <Ripple><button 
                onClick={handleCopy} 
                className="p-1.5 text-slate-400 hover:text-green-400 hover:bg-slate-800 rounded transition-colors"
                title="Copy to Clipboard"
            >
                {copied ? <Check size={16} /> : <Copy size={16} />}
            </button></Ripple>
            <Ripple><button 
                onClick={handleDownload} 
                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                title="Download .gcode"
            >
                <Download size={16} />
            </button></Ripple>
        </div>
      </div>
      
      {isManualMode && (
         <div className="bg-yellow-900/20 text-yellow-500 text-xs px-4 py-1 flex items-center justify-between border-b border-yellow-900/30">
            <span>Manual Edits / Upload Active</span>
            <Ripple><button onClick={onRegenerate} className="flex items-center gap-1 hover:text-yellow-300">
                <RefreshCw size={10} /> Reset to Design
            </button></Ripple>
         </div>
      )}

      <textarea
        ref={textareaRef}
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-950 text-slate-300 p-4 font-mono text-xs resize-none outline-none leading-relaxed overflow-auto custom-scrollbar"
        spellCheck={false}
      />
    </div>
  );
};

export default CodeEditor;