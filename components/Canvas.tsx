import React, { useRef, useState } from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape } from '../types';
import { Trash2 } from 'lucide-react';

interface CanvasProps {
  shapes: Shape[];
  onUpdateShape: (shape: Shape) => void;
  onSelectShape: (id: string | null) => void;
  selectedId: string | null;
  onDeleteShape: (id: string) => void;
}

const Canvas: React.FC<CanvasProps> = ({ shapes, onUpdateShape, onSelectShape, selectedId, onDeleteShape }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Coordinate conversion helper to handle screen-to-SVG mapping
  const getSVGPoint = (event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent, shape: Shape) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const point = getSVGPoint(e);
    setDragOffset({
      x: point.x - shape.x,
      y: point.y - shape.y
    });
    setIsDragging(true);
    onSelectShape(shape.id);
  };

  const handlePointerMove = (e: React.PointerEvent, shape: Shape) => {
    if (!isDragging || shape.id !== selectedId) return;
    e.preventDefault(); // Prevent scrolling on touch
    
    const point = getSVGPoint(e);
    onUpdateShape({
      ...shape,
      x: Math.round(point.x - dragOffset.x),
      y: Math.round(point.y - dragOffset.y)
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex-1 bg-slate-900 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
      <div className="absolute top-4 left-4 text-slate-500 text-sm select-none pointer-events-none z-10">
        Canvas (500mm x 500mm)
      </div>

      <svg 
        ref={svgRef}
        className="w-full max-w-[500px] aspect-square bg-slate-800 shadow-xl border border-slate-700 touch-none"
        viewBox="-20 -20 540 540" 
        onClick={() => onSelectShape(null)}
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>
        
        {/* Background Grid */}
        <rect x="0" y="0" width="500" height="500" fill="url(#grid)" />
        
        {/* Origin Indicators (X/Y Reference) */}
        <g className="pointer-events-none select-none">
            {/* X Axis */}
            <line x1="0" y1="0" x2="500" y2="0" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
            <text x="505" y="5" fill="#ef4444" fontSize="12" fontWeight="bold">X</text>
            
            {/* Y Axis */}
            <line x1="0" y1="0" x2="0" y2="500" stroke="#22c55e" strokeWidth="2" opacity="0.6" />
            <text x="-5" y="505" fill="#22c55e" fontSize="12" fontWeight="bold">Y</text>
            
            {/* Origin Dot */}
            <circle cx="0" cy="0" r="4" fill="#3b82f6" />
            <text x="-15" y="-8" fill="#94a3b8" fontSize="10">(0,0)</text>
        </g>
        
        {/* Shapes */}
        {shapes.map(shape => {
           const isSelected = shape.id === selectedId;
           const stroke = isSelected ? "#38bdf8" : "#94a3b8";
           const commonProps = {
               onPointerDown: (e: React.PointerEvent) => handlePointerDown(e, shape),
               onPointerMove: (e: React.PointerEvent) => handlePointerMove(e, shape),
               onPointerUp: handlePointerUp,
               className: "cursor-move hover:opacity-80 transition-opacity outline-none",
               style: { touchAction: 'none' as const }
           };
           
           if (shape.type === ShapeType.RECTANGLE) {
             const s = shape as RectangleShape;
             return (
               <rect
                key={s.id}
                x={s.x} y={s.y} width={s.width} height={s.height}
                fill="rgba(56, 189, 248, 0.1)"
                stroke={stroke}
                strokeWidth={isSelected ? 2 : 1}
                {...commonProps}
               />
             );
           }
           if (shape.type === ShapeType.CIRCLE) {
             const s = shape as CircleShape;
             return (
               <circle
                key={s.id}
                cx={s.x} cy={s.y} r={s.radius}
                fill="rgba(56, 189, 248, 0.1)"
                stroke={stroke}
                strokeWidth={isSelected ? 2 : 1}
                {...commonProps}
               />
             );
           }
           if (shape.type === ShapeType.TEXT) {
             const s = shape as TextShape;
             return (
               <text
                key={s.id}
                x={s.x} y={s.y}
                fill={stroke}
                fontSize={s.fontSize}
                fontFamily="monospace"
                {...commonProps}
                className={`${commonProps.className} select-none`}
               >
                 {s.text}
               </text>
             );
           }
           return null;
        })}
      </svg>
      
      {selectedId && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 p-2 rounded-full shadow-lg border border-slate-700 flex gap-2 z-20">
           <span className="text-xs text-slate-400 px-2 flex items-center whitespace-nowrap">
             {shapes.find(s=>s.id===selectedId)?.type}
             <span className="ml-2 opacity-50 hidden sm:inline">Use touch/mouse to move</span>
           </span>
           <button 
             onClick={() => onDeleteShape(selectedId)}
             className="p-1 hover:bg-red-500/20 text-red-400 rounded-full transition-colors"
             title="Delete Shape"
           >
             <Trash2 size={16} />
           </button>
        </div>
      )}
    </div>
  );
};

export default Canvas;