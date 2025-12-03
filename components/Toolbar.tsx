import React from 'react';
import { Square, Circle, Type, Wand2, MousePointer2, Hand, Ruler } from 'lucide-react';
import { ShapeType, Tool } from '../types';

interface ToolbarProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  onAddShape: (type: ShapeType) => void;
  onOpenAI: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ 
    activeTool, 
    onSelectTool, 
    onAddShape, 
    onOpenAI,
    showDimensions,
    onToggleDimensions
}) => {
  return (
    <div className="bg-slate-800 flex flex-col items-center justify-start py-4 gap-4 h-full w-full">
      <div className="hidden md:block mb-4 shrink-0">
        <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-sky-900/50 text-white">
          C
        </div>
      </div>
      
      <div className="flex flex-col gap-4 flex-1 w-full px-2 overflow-y-auto custom-scrollbar items-center">
        {/* Tools Section */}
        <div className="flex flex-col gap-2 pb-2 border-b border-slate-700/50 w-full items-center">
            <button 
                onClick={() => onSelectTool(Tool.SELECT)}
                className={`p-3 rounded-xl transition-all group relative w-12 h-12 flex items-center justify-center ${
                    activeTool === Tool.SELECT 
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Select Tool"
            >
                <MousePointer2 size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                Select
                </span>
            </button>

            <button 
                onClick={() => onSelectTool(Tool.PAN)}
                className={`p-3 rounded-xl transition-all group relative w-12 h-12 flex items-center justify-center ${
                    activeTool === Tool.PAN 
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Move View (Pan)"
            >
                <Hand size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                Move View
                </span>
            </button>

             <button 
                onClick={onToggleDimensions}
                className={`p-3 rounded-xl transition-all group relative w-12 h-12 flex items-center justify-center ${
                    showDimensions
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/30' 
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
                title="Toggle Dimensions"
            >
                <Ruler size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                  {showDimensions ? 'Hide Dimensions' : 'Show Dimensions'}
                </span>
            </button>
        </div>

        {/* Shapes Section */}
        <div className="flex flex-col gap-2 w-full items-center">
            <button 
                onClick={() => onAddShape(ShapeType.RECTANGLE)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative w-12 h-12 flex items-center justify-center"
                title="Rectangle"
            >
                <Square size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                Rectangle
                </span>
            </button>

            <button 
                onClick={() => onAddShape(ShapeType.CIRCLE)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative w-12 h-12 flex items-center justify-center"
                title="Circle"
            >
                <Circle size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                Circle
                </span>
            </button>

            <button 
                onClick={() => onAddShape(ShapeType.TEXT)}
                className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-slate-200 transition-all hover:scale-105 group relative w-12 h-12 flex items-center justify-center"
                title="Text"
            >
                <Type size={20} />
                <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
                Text
                </span>
            </button>
        </div>
      </div>

      <button 
        onClick={onOpenAI}
        className="p-3 mb-2 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 rounded-xl text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 animate-pulse-slow group relative w-12 h-12 flex items-center justify-center"
        title="AI Assistant"
      >
        <Wand2 size={20} />
        <span className="hidden md:block absolute left-14 bg-slate-900 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-slate-700 pointer-events-none z-50 text-slate-200">
          AI Assistant
        </span>
      </button>
    </div>
  );
};

export default Toolbar;