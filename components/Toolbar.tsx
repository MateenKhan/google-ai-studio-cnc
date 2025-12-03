import React from 'react';
import { Square, Circle, Type, Wand2 } from 'lucide-react';
import { ShapeType } from '../types';

interface ToolbarProps {
  onAddShape: (type: ShapeType) => void;
  onOpenAI: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onAddShape, onOpenAI }) => {
  return (
    <div className="bg-slate-800 border-r-0 border-b md:border-b-0 md:border-r border-slate-700 flex flex-row md:flex-col items-center justify-between md:justify-start p-2 md:py-4 gap-2 md:gap-4 z-10 w-full md:w-16 h-16 md:h-full order-last md:order-first shrink-0">
      <div className="hidden md:block mb-4">
        <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-900/50">
          C
        </div>
      </div>
      
      <div className="flex flex-row md:flex-col gap-2 md:gap-4 flex-1 justify-center md:justify-start">
        <button 
            onClick={() => onAddShape(ShapeType.RECTANGLE)}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative"
            title="Rectangle"
        >
            <Square size={20} />
            <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
            Rectangle
            </span>
        </button>

        <button 
            onClick={() => onAddShape(ShapeType.CIRCLE)}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative"
            title="Circle"
        >
            <Circle size={20} />
            <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
            Circle
            </span>
        </button>

        <button 
            onClick={() => onAddShape(ShapeType.TEXT)}
            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative"
            title="Text"
        >
            <Type size={20} />
            <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
            Text
            </span>
        </button>
      </div>

      <button 
        onClick={onOpenAI}
        className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-xl text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 animate-pulse-slow group relative ml-auto md:ml-0 md:mt-auto"
        title="AI Assistant"
      >
        <Wand2 size={20} />
        <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
          AI Assistant
        </span>
      </button>
    </div>
  );
};

export default Toolbar;