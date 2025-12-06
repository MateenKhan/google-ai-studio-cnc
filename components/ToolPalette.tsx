
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Square, Circle, Type, MousePointer2, Hand, Ruler, Heart, Pen, Minus, LayoutTemplate, ChevronDown, Upload, Download, Group, Ungroup, Split, Undo2, Redo2, LassoSelect, Hexagon, Spline, Highlighter, ZoomIn } from 'lucide-react';
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

  const btnClass = (isActive: boolean, color: "sky" | "rose" | "indigo" | "cyan" | "slate" = "sky") => {
    let activeColorClass = 'bg-sky-600 text-white shadow shadow-sky-900/40';
    let hoverColorClass = 'hover:bg-slate-700 hover:text-slate-200'; // Default text color is handled in base

    switch (color) {
      case 'rose': activeColorClass = 'bg-rose-600 text-white shadow shadow-rose-900/40'; break;
      case 'indigo': activeColorClass = 'bg-indigo-600 text-white shadow shadow-indigo-900/40'; break;
      case 'cyan': activeColorClass = 'bg-cyan-600 text-white shadow shadow-cyan-900/40'; break;
      case 'slate': activeColorClass = 'bg-slate-600 text-white shadow shadow-slate-900/40'; break; // For generic active if needed
      case 'sky': default: activeColorClass = 'bg-sky-600 text-white shadow shadow-sky-900/40'; break;
    }

    if (!isActive) {
      // We can add subtle color hints on hover if we want, but for now specific active color + slate inactive is standard
      // Maybe color text on hover?
      switch (color) {
        case 'rose': hoverColorClass = 'hover:bg-rose-500/20 hover:text-rose-400'; break;
        case 'indigo': hoverColorClass = 'hover:bg-indigo-500/20 hover:text-indigo-400'; break;
        case 'cyan': hoverColorClass = 'hover:bg-cyan-500/20 hover:text-cyan-400'; break;
        case 'sky': hoverColorClass = 'hover:bg-sky-500/20 hover:text-sky-400'; break;
      }
    }

    return `p-2 rounded-lg transition-all flex items-center justify-center border border-slate-700 shrink-0 ${isActive
      ? activeColorClass
      : `bg-slate-800 text-slate-400 ${hoverColorClass}`
      }`;
  };

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [groupCoords, setGroupCoords] = useState<{ left: number, bottom: number } | null>(null);

  // Generic Dropdown Group Component
  const DropdownGroup = <T extends string>({
    items,
    activeId,
    defaultIcon,
    onSelect,
    groupTitle,
    color = "sky"
  }: {
    items: { id: T, icon: React.ReactNode, title: string, onClick?: () => void }[],
    activeId?: T,
    defaultIcon?: React.ReactNode,
    onSelect?: (id: T) => void,
    groupTitle: string,
    color?: "sky" | "emerald" | "amber" | "violet" | "indigo"
  }) => {

    // Determine active item or default to first
    const activeItem = items.find(i => i.id === activeId);
    const mainItem = activeItem || items[0];
    const isOpen = openGroup === groupTitle;

    const baseColorClass = (isActive: boolean) => {
      if (!isActive) return 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200';
      switch (color) {
        case 'emerald': return 'bg-emerald-600 text-white shadow shadow-emerald-900/40';
        case 'amber': return 'bg-amber-600 text-white shadow shadow-amber-900/40';
        case 'violet': return 'bg-violet-600 text-white shadow shadow-violet-900/40';
        case 'indigo': return 'bg-indigo-600 text-white shadow shadow-indigo-900/40';
        case 'sky': default: return 'bg-sky-600 text-white shadow shadow-sky-900/40';
      }
    }

    const dropdownItemClass = (isActive: boolean) => {
      const base = "p-2 rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center";
      if (!isActive) return `${base} text-slate-400`;
      switch (color) {
        case 'emerald': return `${base} bg-emerald-500/20 text-emerald-400`;
        case 'amber': return `${base} bg-amber-500/20 text-amber-400`;
        case 'violet': return `${base} bg-violet-500/20 text-violet-400`;
        case 'indigo': return `${base} bg-indigo-500/20 text-indigo-400`;
        case 'sky': default: return `${base} bg-sky-500/20 text-sky-400`;
      }
    }

    const chevronClass = (isActive: boolean) => {
      const base = "p-0.5 h-9 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 border border-l-0 border-slate-700 rounded-r-md transition-colors";
      if (!isActive) return base;
      switch (color) {
        case 'emerald': return `${base} bg-emerald-600/20 text-emerald-400 border-emerald-500/30`;
        case 'amber': return `${base} bg-amber-600/20 text-amber-400 border-amber-500/30`;
        case 'violet': return `${base} bg-violet-600/20 text-violet-400 border-violet-500/30`;
        case 'indigo': return `${base} bg-indigo-600/20 text-indigo-400 border-indigo-500/30`;
        case 'sky': default: return `${base} bg-sky-600/20 text-sky-400 border-sky-500/30`;
      }
    }

    const handleMainClick = () => {
      if (mainItem.onClick) mainItem.onClick();
      else if (onSelect) onSelect(mainItem.id);
    };

    return (
      <div className="relative flex items-center">
        <Ripple>
          <button
            onClick={handleMainClick}
            className={`p-2 rounded-lg transition-all flex items-center justify-center border border-slate-700 shrink-0 rounded-r-none border-r border-slate-700/50 ${baseColorClass(!!activeItem || (!activeId && items.length > 0))}`}
            title={mainItem.title}
          >
            {mainItem.icon}
          </button>
        </Ripple>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isOpen) {
              setOpenGroup(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setGroupCoords({
                left: rect.left,
                bottom: window.innerHeight - rect.top + 4
              });
              setOpenGroup(groupTitle);
            }
          }}
          className={chevronClass(!!activeItem)}
        >
          <ChevronDown size={12} />
        </button>

        {isOpen && groupCoords && createPortal(
          <div
            className="fixed bg-slate-800 border border-slate-700 rounded-md shadow-xl z-50 flex flex-col p-1 gap-1 min-w-[40px]"
            style={{
              left: groupCoords.left,
              bottom: groupCoords.bottom
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map(t => (
              <button
                key={t.id}
                onClick={() => {
                  if (t.onClick) t.onClick();
                  else if (onSelect) onSelect(t.id);
                  setOpenGroup(null);
                }}
                className={dropdownItemClass(activeId === t.id)}
                title={t.title}
              >
                {t.icon}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    );
  };

  // Close dropdowns when clicking outside
  React.useEffect(() => {
    const close = () => setOpenGroup(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  return (
    <div className="z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700 shadow-2xl flex absolute bottom-0 left-0 right-0 w-full flex-row items-center p-2 gap-2 overflow-x-auto safe-area-bottom justify-between md:justify-center">

      <div className="flex gap-2 items-center">
        {/* Undo/Redo */}
        <Ripple><button onClick={onUndo} className={btnClass(false, 'rose')} title="Undo (Ctrl+Z)">
          <Undo2 size={18} />
        </button></Ripple>
        <Ripple><button onClick={onRedo} className={btnClass(false, 'rose')} title="Redo (Ctrl+Y)">
          <Redo2 size={18} />
        </button></Ripple>
        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Tools */}
        {/* Select Group (Sky) */}
        <DropdownGroup
          groupTitle="Select"
          activeId={activeTool}
          onSelect={onSelectTool}
          color="sky"
          items={[
            { id: Tool.SELECT, icon: <MousePointer2 size={18} />, title: "Rectangle Select" },
            { id: Tool.LASSO, icon: <LassoSelect size={18} />, title: "Lasso Select" },
            { id: Tool.POLYGON_SELECT, icon: <Hexagon size={18} />, title: "Polygon Select (Area Path)" },
            { id: Tool.FENCE_SELECT, icon: <Highlighter size={18} />, title: "Free Path Select (Fence)" }
          ]}
        />

        {/* View Group (Indigo) */}
        <DropdownGroup
          groupTitle="View"
          activeId={activeTool}
          color="indigo"
          items={[
            { id: Tool.PAN, icon: <Hand size={18} />, title: "Pan Tool", onClick: () => onSelectTool(Tool.PAN) },
            { id: Tool.ZOOM, icon: <ZoomIn size={18} />, title: "Zoom Tool", onClick: () => onSelectTool(Tool.ZOOM) },
            { id: 'DIMENSIONS', icon: <Ruler size={18} className={showDimensions ? "text-indigo-400" : ""} />, title: showDimensions ? "Hide Dimensions" : "Show Dimensions", onClick: onToggleDimensions }
          ]}
        />

        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Create Group (Emerald) */}
        <DropdownGroup
          groupTitle="Create"
          color="emerald"
          items={[
            { id: 'RECT', icon: <Square size={18} />, title: "Rectangle", onClick: () => onAddShape(ShapeType.RECTANGLE) },
            { id: 'CIRCLE', icon: <Circle size={18} />, title: "Circle", onClick: () => onAddShape(ShapeType.CIRCLE) },
            { id: 'HEART', icon: <Heart size={18} />, title: "Heart", onClick: () => onAddShape(ShapeType.HEART) },
            { id: 'TEXT', icon: <Type size={18} />, title: "Text", onClick: () => onAddShape(ShapeType.TEXT) }
          ]}
        />

        {/* Drawing Tools (Violet) */}
        <DropdownGroup
          groupTitle="Draw"
          activeId={activeTool}
          onSelect={onSelectTool}
          color="violet"
          items={[
            { id: Tool.PATH, icon: <Spline size={18} />, title: "Path Tool (Draw)" },
            { id: Tool.PEN, icon: <Pen size={18} />, title: "Free Draw (Pen)" },
            { id: Tool.LINE_CREATE, icon: <Minus size={18} className="rotate-45" />, title: "Straight Line" }
          ]}
        />

        <div className="w-px h-8 bg-slate-700 mx-1 shrink-0"></div>

        {/* Arrange Group (Amber) */}
        <DropdownGroup
          groupTitle="Arrange"
          color="amber"
          items={[
            { id: 'EXPLODE', icon: <Split size={18} />, title: "Explode Shape", onClick: onExplode },
            { id: 'GROUP', icon: <Group size={18} />, title: "Group Selected", onClick: onGroup },
            { id: 'UNGROUP', icon: <Ungroup size={18} />, title: "Ungroup", onClick: onUngroup },
          ]}
        />

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

        <Ripple><button onClick={() => fileInputRef.current?.click()} className={btnClass(false, 'cyan')} title="Import SVG">
          <Upload size={18} />
          <input type="file" ref={fileInputRef} onChange={onImportSVG} accept=".svg" className="hidden" />
        </button></Ripple>
        <Ripple><button onClick={onExportSVG} className={btnClass(false, 'cyan')} title="Export SVG">
          <Download size={18} />
        </button></Ripple>
      </div>

      <div className="flex gap-2 items-center">
        <Ripple><button
          onClick={onToggleSidebar}
          className={btnClass(isSidebarOpen, 'indigo')}
          title="Toggle Properties"
        >
          <LayoutTemplate size={18} />
        </button></Ripple>
      </div>

    </div>
  );
};

export default ToolPalette;
