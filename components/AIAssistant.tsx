import React, { useState } from 'react';
import { X, Sparkles, Send } from 'lucide-react';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (prompt: string) => Promise<void>;
  isLoading: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onSubmit(prompt);
      setPrompt('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-slate-900 to-indigo-950">
          <div className="flex items-center gap-2 text-indigo-400">
            <Sparkles size={20} />
            <h2 className="font-semibold text-white">Gemini Assistant</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-300 text-sm mb-4">
            Describe what you want to cut. I can generate shapes, arrange patterns, or calculate text positions for you.
          </p>
          
          <div className="bg-slate-800/50 p-4 rounded-lg mb-6 border border-slate-700/50">
            <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider font-semibold">Examples</p>
            <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex gap-2 cursor-pointer hover:text-sky-400 transition-colors" onClick={() => setPrompt("Create a 4x4 grid of 5mm circles starting at 10,10")}>• "Create a 4x4 grid of 5mm circles"</li>
              <li className="flex gap-2 cursor-pointer hover:text-sky-400 transition-colors" onClick={() => setPrompt("Make a 100x50mm nameplate with 'GEMINI' in the center")}>• "Make a 100x50mm nameplate with 'GEMINI' in the center"</li>
              <li className="flex gap-2 cursor-pointer hover:text-sky-400 transition-colors" onClick={() => setPrompt("Add mounting holes to the corners of the existing rectangle")}>• "Add mounting holes to corners of existing rect"</li>
            </ul>
          </div>

          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your design..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-4 pr-12 text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
