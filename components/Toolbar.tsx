import React from 'react';
import { Square, Circle, Type, Wand2, MousePointer2, Hand } from 'lucide-react';
import { ShapeType, Tool } from '../types';

interface ToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  onAddShape: (type: ShapeType) => void;
  onOpenAI: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ activeTool, onSelectTool, onAddShape, onOpenAI }) => {
  return (
    <div className="bg-slate-800 border-r-0 border-b md:border-b-0 md:border-r border-slate-700 flex flex-row md:flex-col items-center justify-between md:justify-start p-2 md:py-4 gap-2 md:gap-4 z-10 w-full md:w-16 h-16 md:h-full order-last md:order-first shrink-0">
      <div className="hidden md:block mb-4">
        <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-900/50">
          C
        </div>
      </div>
      
      <div className="flex flex-row md:flex-col gap-2 md:gap-4 flex-1 justify-center md:justify-start">
        {/* Tools Section */}
        <div className="flex flex-row md:flex-col gap-2 pb-2 border-r md:border-r-0 md:border-b border-slate-700/50 pr-2 md:pr-0 md:pb-2">
            <button 
                onClick={() => onSelectTool(Tool.SELECT)}
                className={`p-3 rounded-xl transition-all group relative ${
                    activeTool === Tool.SELECT 
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Select Tool"
            >
                <MousePointer2 size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
                Select
                </span>
            </button>

            <button 
                onClick={() => onSelectTool(Tool.PAN)}
                className={`p-3 rounded-xl transition-all group relative ${
                    activeTool === Tool.PAN 
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Move View (Pan)"
            >
                <Hand size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50">
                Move View
                </span>
            </button>
        </div>

        {/* Shapes Section */}
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