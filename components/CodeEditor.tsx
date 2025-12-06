import React, { useState, useRef, useEffect } from 'react';
import { Download, RefreshCw, Copy, Check, Filter, Upload, Search, Replace, ChevronUp, ChevronDown, X, Zap, ArrowDownToLine, ArrowUpToLine, Move } from 'lucide-react';
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

  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchIndex, setMatchIndex] = useState(-1);
  const [matches, setMatches] = useState<number[]>([]);

  useEffect(() => {
    if (!searchText) {
      setMatches([]);
      setMatchIndex(-1);
      return;
    }

    const indices: number[] = [];
    let pos = code.indexOf(searchText);
    while (pos !== -1) {
      indices.push(pos);
      pos = code.indexOf(searchText, pos + 1);
    }
    setMatches(indices);
    if (indices.length > 0) {
      setMatchIndex(0);
    } else {
      setMatchIndex(-1);
    }
  }, [searchText, code]);

  const scrollToMatch = (index: number) => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + searchText.length);
      // Optional: calculate scroll position to center the match
      const lineHeight = 16; // Approx line height
      const textBefore = code.substring(0, index);
      const lineCount = textBefore.split('\n').length;
      textareaRef.current.scrollTop = lineCount * lineHeight - textareaRef.current.clientHeight / 2;
    }
  };

  const handleNextMatch = () => {
    if (matches.length === 0) return;
    const nextIndex = (matchIndex + 1) % matches.length;
    setMatchIndex(nextIndex);
    scrollToMatch(matches[nextIndex]);
  };

  const handlePrevMatch = () => {
    if (matches.length === 0) return;
    const prevIndex = (matchIndex - 1 + matches.length) % matches.length;
    setMatchIndex(prevIndex);
    scrollToMatch(matches[prevIndex]);
  };

  const handleReplace = () => {
    if (matchIndex === -1 || matches.length === 0) return;
    const currentPos = matches[matchIndex];
    const newCode = code.substring(0, currentPos) + replaceText + code.substring(currentPos + searchText.length);
    onChange(newCode);
    // Current match index stays same (pointing to next match essentially, or re-calculated)
  };

  const handleReplaceAll = () => {
    if (!searchText) return;
    onChange(code.split(searchText).join(replaceText));
  };

  const insertAtCursor = (text: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newCode = code.substring(0, start) + text + code.substring(end);
      onChange(newCode);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(start + text.length, start + text.length);
      }, 0);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-950 border-l border-slate-800 min-w-[300px] h-full">
      <div className="flex flex-col border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="font-semibold text-slate-200">G-Code</h3>
          <div className="flex gap-2 items-center">
            <Ripple><button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-1.5 rounded transition-colors ${showSearch ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:bg-slate-800'}`}
              title="Find & Replace"
            >
              <Search size={16} />
            </button></Ripple>

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

        {/* Common Actions Toolbar */}
        <div className="px-4 py-1 flex items-center justify-start gap-2 overflow-x-auto custom-scrollbar pb-2">
          <button onClick={() => insertAtCursor('G0 X0 Y0 Z0\n')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 whitespace-nowrap flex items-center gap-1">
            <Move size={12} /> Go Zero
          </button>
          <button onClick={() => insertAtCursor('G0 Z5\n')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 whitespace-nowrap flex items-center gap-1">
            <ArrowUpToLine size={12} /> Raise Tool
          </button>
          <button onClick={() => insertAtCursor('G0 Z0\n')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 whitespace-nowrap flex items-center gap-1">
            <ArrowDownToLine size={12} /> Lower Tool
          </button>
          <button onClick={() => insertAtCursor('F1000\n')} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 whitespace-nowrap flex items-center gap-1">
            <Zap size={12} /> Speed 1000
          </button>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="px-4 py-2 bg-slate-800/50 border-t border-slate-800 flex flex-col gap-2 animate-in slide-in-from-top-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Find..."
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
                />
                {matches.length > 0 && (
                  <span className="absolute right-2 top-1.5 text-[10px] text-slate-500">
                    {matchIndex + 1}/{matches.length}
                  </span>
                )}
              </div>
              <Ripple><button onClick={handlePrevMatch} disabled={matches.length === 0} className="p-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"><ChevronUp size={14} /></button></Ripple>
              <Ripple><button onClick={handleNextMatch} disabled={matches.length === 0} className="p-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50"><ChevronDown size={14} /></button></Ripple>
              <Ripple><button onClick={() => setShowSearch(false)} className="p-1 text-slate-500 hover:text-slate-300"><X size={14} /></button></Ripple>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Replace..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
              />
              <button onClick={handleReplace} disabled={matches.length === 0} className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 disabled:opacity-50">Replace</button>
              <button onClick={handleReplaceAll} disabled={matches.length === 0} className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded hover:bg-slate-600 disabled:opacity-50">All</button>
            </div>
          </div>
        )}
      </div>

      {isManualMode && (
        <div className="bg-yellow-900/20 text-yellow-500 text-xs px-4 py-1 flex items-center justify-between border-b border-yellow-900/30 shrink-0">
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
        className="flex-1 bg-slate-950 text-slate-300 p-4 font-mono text-xs resize-none outline-none leading-relaxed overflow-auto custom-scrollbar w-full h-full"
        spellCheck={false}
      />
    </div>
  );
};

export default CodeEditor;