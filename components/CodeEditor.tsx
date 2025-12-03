import React from 'react';
import { Download, RefreshCw, MessageSquare } from 'lucide-react';

interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onRegenerate: () => void;
  onExplain: () => void;
  isManualMode: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ code, onChange, onRegenerate, onExplain, isManualMode }) => {
  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toolpath.gcode';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border-l border-slate-800 min-w-[300px]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900">
        <h3 className="font-semibold text-slate-200">G-Code</h3>
        <div className="flex gap-2">
            <button 
                onClick={onExplain} 
                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors"
                title="Explain with AI"
            >
                <MessageSquare size={16} />
            </button>
            <button 
                onClick={handleDownload} 
                className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded transition-colors"
                title="Download .gcode"
            >
                <Download size={16} />
            </button>
        </div>
      </div>
      
      {isManualMode && (
         <div className="bg-yellow-900/20 text-yellow-500 text-xs px-4 py-1 flex items-center justify-between border-b border-yellow-900/30">
            <span>Manual Edits Active</span>
            <button onClick={onRegenerate} className="flex items-center gap-1 hover:text-yellow-300">
                <RefreshCw size={10} /> Reset to Shapes
            </button>
         </div>
      )}

      <textarea
        value={code}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-slate-950 text-slate-300 p-4 font-mono text-xs resize-none outline-none leading-relaxed overflow-auto custom-scrollbar"
        spellCheck={false}
      />
    </div>
  );
};

export default CodeEditor;
