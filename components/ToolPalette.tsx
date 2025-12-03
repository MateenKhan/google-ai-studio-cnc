import React, { useState, useRef, useEffect } from 'react';
import { Square, Circle, Type, Wand2, MousePointer2, Hand, Ruler, Heart, Pen, Minus, GripHorizontal, Menu, LayoutTemplate } from 'lucide-react';
import { ShapeType, Tool } from '../types';

interface ToolPaletteProps {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
  onAddShape: (type: ShapeType) => void;
  onOpenAI: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const ToolPalette: React.FC<ToolPaletteProps> = ({ 
    activeTool, 
    onSelectTool, 
    onAddShape, 
    onOpenAI,
    showDimensions,
    onToggleDimensions,
    isSidebarOpen,
    onToggleSidebar
}) => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isMobile, setIsMobile] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
      if (isMobile) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          initialX: position.x,
          initialY: position.y
      };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (dragRef.current && !isMobile) {
          const dx = e.clientX - dragRef.current.startX;
          const dy = e.clientY - dragRef.current.startY;
          setPosition({
              x: dragRef.current.initialX + dx,
              y: dragRef.current.initialY + dy
          });
      }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      dragRef.current = null;
      if (!isMobile) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
  };

  const btnClass = (isActive: boolean) => 
      `p-2 rounded-lg transition-all flex items-center justify-center border border-slate-700 shrink-0 ${
        isActive 
          ? 'bg-sky-600 text-white shadow shadow-sky-900/40' 
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
      }`;

  return (
    <div 
        className={`
            z-50 bg-slate-900/95 backdrop-blur border-slate-700 shadow-2xl flex 
            fixed bottom-0 left-0 right-0 w-full border-t flex-row items-center p-2 gap-2 overflow-x-auto safe-area-bottom
            md:absolute md:top-auto md:bottom-auto md:left-auto md:right-auto md:w-64 md:border md:rounded-xl md:flex-col md:overflow-hidden md:h-auto
        `}
        style={!isMobile ? { left: position.x, top: position.y } : {}}
    >
      {/* Drag Handle (Desktop Only) */}
      <div 
        className="hidden md:flex h-6 bg-slate-800 items-center justify-center cursor-move border-b border-slate-700 shrink-0"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
          <GripHorizontal size={14} className="text-slate-500" />
      </div>

      <div className="flex md:grid md:grid-cols-4 gap-2 md:p-3 overflow-y-auto items-center md:items-stretch">
        
        {/* Row 1: Tools */}
        <button onClick={() => onSelectTool(Tool.SELECT)} className={btnClass(activeTool === Tool.SELECT)} title="Select">
             <MousePointer2 size={18} />
        </button>
        <button onClick={() => onSelectTool(Tool.PAN)} className={btnClass(activeTool === Tool.PAN)} title="Pan">
             <Hand size={18} />
        </button>
        <button onClick={onToggleDimensions} className={btnClass(showDimensions)} title="Dimensions">
             <Ruler size={18} />
        </button>
        
        {/* Mobile Sidebar Toggle */}
        <button 
            onClick={onToggleSidebar} 
            className={`${btnClass(isSidebarOpen)} md:hidden`} 
            title="Menu / Properties"
        >
             <LayoutTemplate size={18} />
        </button>

        <button onClick={onOpenAI} className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow border border-indigo-500/50 flex items-center justify-center shrink-0" title="AI Assistant">
             <Wand2 size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-8 md:h-px md:w-full bg-slate-700 mx-1 md:my-1 md:col-span-4 shrink-0"></div>

        {/* Row 2: Basic Shapes */}
        <button onClick={() => onAddShape(ShapeType.RECTANGLE)} className={btnClass(false)} title="Rectangle">
             <Square size={18} />
        </button>
        <button onClick={() => onAddShape(ShapeType.CIRCLE)} className={btnClass(false)} title="Circle">
             <Circle size={18} />
        </button>
        <button onClick={() => onAddShape(ShapeType.HEART)} className={btnClass(false)} title="Heart">
             <Heart size={18} />
        </button>
        <button onClick={() => onAddShape(ShapeType.LINE)} className={btnClass(false)} title="Straight Line">
             <Minus size={18} className="rotate-45" />
        </button>

        {/* Row 3: Advanced */}
        <button onClick={() => onSelectTool(Tool.PEN)} className={btnClass(activeTool === Tool.PEN)} title="Free Draw (Pen)">
             <Pen size={18} />
        </button>
         <button onClick={() => onAddShape(ShapeType.TEXT)} className={btnClass(false)} title="Text">
             <Type size={18} />
        </button>

        {/* Desktop Sidebar Toggle (Hidden on Mobile) */}
        <button 
            onClick={onToggleSidebar} 
            className={`${btnClass(isSidebarOpen)} hidden md:flex`} 
            title="Toggle Sidebar"
        >
             <LayoutTemplate size={18} />
        </button>

      </div>
    </div>
  );
};

export default ToolPalette;