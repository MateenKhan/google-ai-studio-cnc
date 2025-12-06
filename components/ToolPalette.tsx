
import React, { useRef } from 'react';
import { Square, Circle, Type, MousePointer2, Hand, Ruler, Heart, Pen, Minus, LayoutTemplate, ChevronDown, Upload, Download, Group, Ungroup, Split, Undo2, Redo2 } from 'lucide-react';
import { ShapeType, Tool, Unit } from '../types';
import Ripple from './Ripple';

interface ToolPaletteProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  onAddShape: (type: ShapeType) => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  unit: Unit;
  onUnitChange: (unit: Unit) => void;
  onClosePalette: () => void;
  onExportSVG: () => void;
  onImportSVG: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGroup: () => void;
  onUngroup: () => void;
  onExplode: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const ToolPalette: React.FC<ToolPaletteProps> = ({
  activeTool,
  onSelectTool,
  onAddShape,
  showDimensions,
  onToggleDimensions,
  isSidebarOpen,
  onToggleSidebar,
  unit,
  onUnitChange,
  onExportSVG,
  onImportSVG,
  onGroup,
  onUngroup,
  onExplode,
  onUndo,
  onRedo
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const btnClass = (isActive: boolean) =>
    `p-2 rounded-lg transition-all flex items-center justify-center border border-slate-700 shrink-0 ${isActive
      ? 'bg-sky-600 text-white shadow shadow-sky-900/40'
      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
    }`;

  return (
    <div className="z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-2xl flex absolute bottom-0 left-0 right-0 w-full flex-row items-center p-2 gap-2 overflow-x-auto safe-area-bottom justify-between md:justify-center">

      <div className="flex gap-2 items-center">
        {/* Undo/Redo */}
        <Ripple><button onClick={onUndo} className={btnClass(false)} title="Undo (Ctrl+Z)">
          <Undo2 size={18} />
        </button></Ripple>
        <Ripple><button onClick={onRedo} className={btnClass(false)} title="Redo (Ctrl+Y)">
          <Redo2 size={18} />
        </button></Ripple>
        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Tools */}
        <Ripple><button onClick={() => onSelectTool(Tool.SELECT)} className={btnClass(activeTool === Tool.SELECT)} title="Select">
          <MousePointer2 size={18} />
        </button></Ripple>
        <Ripple><button onClick={() => onSelectTool(Tool.PAN)} className={btnClass(activeTool === Tool.PAN)} title="Pan">
          <Hand size={18} />
        </button></Ripple>
        <Ripple><button onClick={onToggleDimensions} className={btnClass(showDimensions)} title="Dimensions">
          <Ruler size={18} />
        </button></Ripple>
        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Shapes */}
        <Ripple><button onClick={() => onAddShape(ShapeType.RECTANGLE)} className={btnClass(false)} title="Rectangle">
          <Square size={18} />
        </button></Ripple>
        <Ripple><button onClick={() => onAddShape(ShapeType.CIRCLE)} className={btnClass(false)} title="Circle">
          <Circle size={18} />
        </button></Ripple>
        <Ripple><button onClick={() => onAddShape(ShapeType.HEART)} className={btnClass(false)} title="Heart">
          <Heart size={18} />
        </button></Ripple>
        <Ripple><button onClick={() => onSelectTool(Tool.LINE_CREATE)} className={btnClass(activeTool === Tool.LINE_CREATE)} title="Draw Straight Line">
          <Minus size={18} className="rotate-45" />
        </button></Ripple>
        <Ripple><button onClick={() => onSelectTool(Tool.PEN)} className={btnClass(activeTool === Tool.PEN)} title="Free Draw (Pen)">
          <Pen size={18} />
        </button></Ripple>
        <Ripple><button onClick={() => onAddShape(ShapeType.TEXT)} className={btnClass(false)} title="Text">
          <Type size={18} />
        </button></Ripple>

        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Groups */}
        <Ripple><button onClick={onGroup} className={btnClass(false)} title="Group Selected">
          <Group size={18} />
        </button></Ripple>
        <Ripple><button onClick={onUngroup} className={btnClass(false)} title="Ungroup">
          <Ungroup size={18} />
        </button></Ripple>
        <Ripple><button onClick={onExplode} className={btnClass(false)} title="Explode Shape">
          <Split size={18} />
        </button></Ripple>

        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Unit & Actions */}
        <div className="relative group flex items-center">
          <div className="relative">
            <select
              value={unit}
              onChange={(e) => onUnitChange(e.target.value as Unit)}
              className="appearance-none bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-1 pr-5 rounded hover:bg-slate-600 outline-none border border-slate-600 h-8 uppercase cursor-pointer"
            >
              {Object.values(Unit).map(u => (
                <option key={u} value={u} className="bg-slate-800 text-slate-300">
                  {u.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
        </div>

        <Ripple><button onClick={() => fileInputRef.current?.click()} className={btnClass(false)} title="Import SVG">
          <Upload size={18} />
          <input type="file" ref={fileInputRef} onChange={onImportSVG} accept=".svg" className="hidden" />
        </button></Ripple>
        <Ripple><button onClick={onExportSVG} className={btnClass(false)} title="Export SVG">
          <Download size={18} />
        </button></Ripple>
      </div>

      <div className="flex gap-2 items-center">
        <Ripple><button
          onClick={onToggleSidebar}
          className={btnClass(isSidebarOpen)}
          title="Toggle Properties"
        >
          <LayoutTemplate size={18} />
        </button></Ripple>
      </div>

    </div>
  );
};

export default ToolPalette;
