import React, { useRef, useState, useEffect } from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, Tool } from '../types';
import { Trash2 } from 'lucide-react';

interface CanvasProps {
  shapes: Shape[];
  activeTool: Tool;
  onUpdateShape: (shape: Shape) => void;
  onUpdateShapes: (shapes: Shape[]) => void;
  onSelectShape: (id: string | null, isMulti: boolean) => void;
  onMultiSelect: (ids: string[], addToExisting: boolean) => void;
  selectedIds: string[];
  onDeleteShapes: (ids: string[]) => void;
}

const Canvas: React.FC<CanvasProps> = ({ 
    shapes, 
    activeTool,
    onUpdateShape, 
    onUpdateShapes, 
    onSelectShape, 
    onMultiSelect,
    selectedIds, 
    onDeleteShapes 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'SHAPE' | 'PAN' | 'MARQUEE' | null>(null);
  
  // Panning State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number, y: number } | null>(null);
  
  // Marquee State
  const [marquee, setMarquee] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const marqueeStartRef = useRef<{ x: number, y: number } | null>(null);

  // Shape Drag State
  const shapeDragStartRef = useRef<{
    startX: number;
    startY: number;
    initialShapes: Map<string, { x: number; y: number }>;
  } | null>(null);

  // Helper: Get Mouse Position in SVG Coordinates (Account for ViewBox/Pan)
  const getSVGPoint = (event: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    // We do NOT manually adjust for pan here because getScreenCTM takes the viewBox into account automatically
    // if the viewBox is updated in the DOM.
    return pt.matrixTransform(ctm.inverse());
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (activeTool === Tool.PAN) {
        setDragMode('PAN');
        setIsDragging(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
    }

    if (activeTool === Tool.SELECT) {
        // If we clicked background (not a shape)
        // Note: Shape clicks stopPropagation, so this only fires on BG click
        setDragMode('MARQUEE');
        setIsDragging(true);
        
        const point = getSVGPoint(e);
        marqueeStartRef.current = { x: point.x, y: point.y };
        setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
        
        // If shift not held, clear previous selection
        if (!e.shiftKey) {
            onSelectShape(null, false);
        }
        
        e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handleShapePointerDown = (e: React.PointerEvent, shape: Shape) => {
    if (activeTool !== Tool.SELECT) return;
    
    e.stopPropagation(); // Prevent canvas background click
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const isMultiKey = e.shiftKey;
    const isAlreadySelected = selectedIds.includes(shape.id);

    // Selection Logic
    if (isMultiKey) {
        onSelectShape(shape.id, true);
    } else {
        if (!isAlreadySelected) {
            onSelectShape(shape.id, false);
        }
    }

    // Determine ids to drag (wait for state update or use calculated list)
    let idsToDrag = selectedIds;
    if (!isAlreadySelected && !isMultiKey) idsToDrag = [shape.id];
    else if (isMultiKey && !isAlreadySelected) idsToDrag = [...selectedIds, shape.id];
    
    // Prepare Drag
    const point = getSVGPoint(e);
    const initialPosMap = new Map<string, {x: number, y: number}>();
    
    shapes.forEach(s => {
        if (idsToDrag.includes(s.id)) {
            initialPosMap.set(s.id, { x: s.x, y: s.y });
        }
    });

    shapeDragStartRef.current = {
        startX: point.x,
        startY: point.y,
        initialShapes: initialPosMap
    };

    setDragMode('SHAPE');
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault(); 

    if (dragMode === 'PAN' && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        
        // In SVG viewBox, moving viewBox negative X moves view Right.
        // So dragging mouse Right (positive dx) should move view Right (decrease viewBox X).
        setPan(prev => ({
            x: prev.x + dx,
            y: prev.y + dy
        }));
        
        panStartRef.current = { x: e.clientX, y: e.clientY };
    }

    if (dragMode === 'MARQUEE' && marqueeStartRef.current) {
        const point = getSVGPoint(e);
        const start = marqueeStartRef.current;
        
        const x = Math.min(start.x, point.x);
        const y = Math.min(start.y, point.y);
        const width = Math.abs(point.x - start.x);
        const height = Math.abs(point.y - start.y);
        
        setMarquee({ x, y, width, height });
    }

    if (dragMode === 'SHAPE' && shapeDragStartRef.current) {
        const point = getSVGPoint(e);
        const dx = point.x - shapeDragStartRef.current.startX;
        const dy = point.y - shapeDragStartRef.current.startY;

        const updates: Shape[] = [];
        shapeDragStartRef.current.initialShapes.forEach((initialPos, id) => {
            const shape = shapes.find(s => s.id === id);
            if (shape) {
                updates.push({
                    ...shape,
                    x: Math.round(initialPos.x + dx),
                    y: Math.round(initialPos.y + dy)
                });
            }
        });

        if (updates.length > 0) {
            onUpdateShapes(updates);
        }
    }
  };

  const checkIntersection = (rect: {x: number, y: number, width: number, height: number}) => {
     const ids: string[] = [];
     shapes.forEach(shape => {
         // Simple bounding box for shapes
         let shapeRect = { x: 0, y: 0, width: 0, height: 0 };
         if (shape.type === ShapeType.RECTANGLE) {
             const s = shape as RectangleShape;
             shapeRect = { x: s.x, y: s.y, width: s.width, height: s.height };
         } else if (shape.type === ShapeType.CIRCLE) {
             const s = shape as CircleShape;
             shapeRect = { x: s.x - s.radius, y: s.y - s.radius, width: s.radius * 2, height: s.radius * 2 };
         } else if (shape.type === ShapeType.TEXT) {
             const s = shape as TextShape;
             // Approx text size
             const w = s.text.length * (s.fontSize * 0.6);
             shapeRect = { x: s.x, y: s.y - s.fontSize, width: w, height: s.fontSize };
         }

         // Check overlap
         const x_overlap = Math.max(0, Math.min(rect.x + rect.width, shapeRect.x + shapeRect.width) - Math.max(rect.x, shapeRect.x));
         const y_overlap = Math.max(0, Math.min(rect.y + rect.height, shapeRect.y + shapeRect.height) - Math.max(rect.y, shapeRect.y));
         
         // If overlap area > 0 (or strictly inside? usually intersection is enough for drag select)
         if (x_overlap > 0 && y_overlap > 0) {
             ids.push(shape.id);
         }
     });
     return ids;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragMode === 'MARQUEE' && marquee) {
        const ids = checkIntersection(marquee);
        onMultiSelect(ids, e.shiftKey);
        setMarquee(null);
    }

    setIsDragging(false);
    setDragMode(null);
    panStartRef.current = null;
    shapeDragStartRef.current = null;
    marqueeStartRef.current = null;
    
    if (e.currentTarget) {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch (err) {}
    }
  };

  // ViewBox Calculation
  // Base: -20 -20 540 540
  // Pan moves the viewport. So ViewBox X = BaseX - PanX
  const viewBoxStr = `${-20 - pan.x} ${-20 - pan.y} 540 540`;

  return (
    <div className={`flex-1 bg-slate-900 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] ${activeTool === Tool.PAN ? 'cursor-grab active:cursor-grabbing' : ''}`}>
      <div className="absolute top-4 left-4 text-slate-500 text-sm select-none pointer-events-none z-10">
        Canvas (500mm x 500mm)
      </div>

      <svg 
        ref={svgRef}
        className="w-full max-w-[500px] aspect-square bg-slate-800 shadow-xl border border-slate-700 touch-none"
        viewBox={viewBoxStr}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#334155" strokeWidth="0.5" />
          </pattern>
        </defs>
        
        {/* Background Grid */}
        <rect x="0" y="0" width="500" height="500" fill="url(#grid)" />
        
        {/* Origin Indicators */}
        <g className="pointer-events-none select-none">
            <line x1="0" y1="0" x2="500" y2="0" stroke="#ef4444" strokeWidth="2" opacity="0.6" />
            <text x="505" y="5" fill="#ef4444" fontSize="12" fontWeight="bold">X</text>
            <line x1="0" y1="0" x2="0" y2="500" stroke="#22c55e" strokeWidth="2" opacity="0.6" />
            <text x="-5" y="505" fill="#22c55e" fontSize="12" fontWeight="bold">Y</text>
            <circle cx="0" cy="0" r="4" fill="#3b82f6" />
            <text x="-15" y="-8" fill="#94a3b8" fontSize="10">(0,0)</text>
        </g>
        
        {/* Shapes */}
        {shapes.map(shape => {
           const isSelected = selectedIds.includes(shape.id);
           const stroke = isSelected ? "#38bdf8" : "#94a3b8";
           
           const commonProps = {
               onPointerDown: (e: React.PointerEvent) => handleShapePointerDown(e, shape),
               className: `outline-none ${activeTool === Tool.SELECT ? 'cursor-move hover:opacity-80' : ''}`,
               style: { touchAction: 'none' as const }
           };
           
           if (shape.type === ShapeType.RECTANGLE) {
             const s = shape as RectangleShape;
             return (
               <rect
                key={s.id}
                x={s.x} y={s.y} width={s.width} height={s.height}
                fill={isSelected ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.05)"}
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
                fill={isSelected ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.05)"}
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
                fontWeight={isSelected ? "bold" : "normal"}
                {...commonProps}
                className={`${commonProps.className} select-none`}
               >
                 {s.text}
               </text>
             );
           }
           return null;
        })}

        {/* Marquee Selection Box */}
        {marquee && (
            <rect
                x={marquee.x}
                y={marquee.y}
                width={marquee.width}
                height={marquee.height}
                fill="rgba(56, 189, 248, 0.1)"
                stroke="#38bdf8"
                strokeWidth="1"
                strokeDasharray="4 2"
                pointerEvents="none"
            />
        )}
      </svg>
      
      {selectedIds.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 p-2 rounded-full shadow-lg border border-slate-700 flex gap-4 z-20 items-center">
           <span className="text-xs text-slate-400 px-2 flex items-center whitespace-nowrap">
             <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full mr-2">
                 {selectedIds.length}
             </span>
             <span className="hidden sm:inline">Selected</span>
           </span>
           <div className="h-4 w-px bg-slate-700"></div>
           <button 
             onClick={() => onDeleteShapes(selectedIds)}
             className="p-1 hover:bg-red-500/20 text-red-400 rounded-full transition-colors flex items-center gap-1 pr-3"
             title="Delete Selected"
           >
             <Trash2 size={16} />
             <span className="text-xs font-semibold">Delete</span>
           </button>
        </div>
      )}
    </div>
  );
};

export default Canvas;