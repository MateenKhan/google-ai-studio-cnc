import React, { useRef, useState } from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, Tool, HeartShape, LineShape, PolylineShape, Unit } from '../types';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatUnit } from '../utils';

interface CanvasProps {
  shapes: Shape[];
  activeTool: Tool;
  onUpdateShape: (shape: Shape) => void;
  onUpdateShapes: (shapes: Shape[]) => void;
  onSelectShape: (id: string | null, isMulti: boolean) => void;
  onMultiSelect: (ids: string[], addToExisting: boolean) => void;
  selectedIds: string[];
  onDeleteShapes: (ids: string[]) => void;
  showDimensions: boolean;
  onAddShapeFromPen: (shape: Shape) => void;
  unit: Unit;
}

const Canvas: React.FC<CanvasProps> = ({ 
    shapes, 
    activeTool,
    onUpdateShape, 
    onUpdateShapes, 
    onSelectShape, 
    onMultiSelect,
    selectedIds, 
    onDeleteShapes,
    showDimensions,
    onAddShapeFromPen,
    unit
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'SHAPE' | 'PAN' | 'MARQUEE' | 'DRAW' | null>(null);
  
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

  // Drawing State (Pen)
  const [currentPolyline, setCurrentPolyline] = useState<PolylineShape | null>(null);

  // Helper: Get Mouse Position in SVG Coordinates (Account for ViewBox/Pan)
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

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activeTool === Tool.PAN) {
        setDragMode('PAN');
        setIsDragging(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        return;
    }

    if (activeTool === Tool.PEN) {
        setDragMode('DRAW');
        setIsDragging(true);
        const point = getSVGPoint(e);
        const newShape: PolylineShape = {
            id: uuidv4(),
            type: ShapeType.POLYLINE,
            x: 0, y: 0, 
            points: [{ x: point.x, y: point.y }]
        };
        setCurrentPolyline(newShape);
        return;
    }

    if (activeTool === Tool.SELECT) {
        setDragMode('MARQUEE');
        setIsDragging(true);
        
        const point = getSVGPoint(e);
        marqueeStartRef.current = { x: point.x, y: point.y };
        setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });
        
        if (!e.shiftKey) {
            onSelectShape(null, false);
        }
    }
  };

  const handleShapePointerDown = (e: React.PointerEvent, shape: Shape) => {
    if (activeTool !== Tool.SELECT) return;
    
    e.stopPropagation(); 
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const isMultiKey = e.shiftKey;
    const isAlreadySelected = selectedIds.includes(shape.id);

    if (isMultiKey) {
        onSelectShape(shape.id, true);
    } else {
        if (!isAlreadySelected) {
            onSelectShape(shape.id, false);
        }
    }

    let idsToDrag = selectedIds;
    if (!isAlreadySelected && !isMultiKey) idsToDrag = [shape.id];
    else if (isMultiKey && !isAlreadySelected) idsToDrag = [...selectedIds, shape.id];
    
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
        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
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
                if (shape.type === ShapeType.LINE) {
                    const l = shape as LineShape;
                    const diffX = l.x2 - l.x;
                    const diffY = l.y2 - l.y;
                    const newX = Math.round(initialPos.x + dx);
                    const newY = Math.round(initialPos.y + dy);
                    updates.push({
                        ...shape,
                        x: newX,
                        y: newY,
                        x2: newX + diffX,
                        y2: newY + diffY
                    } as LineShape);
                } else if (shape.type === ShapeType.POLYLINE) {
                     // Skipping polyline point drags for simplicity
                } else {
                    updates.push({
                        ...shape,
                        x: Math.round(initialPos.x + dx),
                        y: Math.round(initialPos.y + dy)
                    });
                }
            }
        });

        if (updates.length > 0) {
            onUpdateShapes(updates);
        }
    }

    if (dragMode === 'DRAW' && currentPolyline) {
        const point = getSVGPoint(e);
        setCurrentPolyline(prev => {
            if (!prev) return null;
            return {
                ...prev,
                points: [...prev.points, { x: point.x, y: point.y }]
            };
        });
    }
  };

  const checkIntersection = (rect: {x: number, y: number, width: number, height: number}) => {
     const ids: string[] = [];
     shapes.forEach(shape => {
         let shapeRect = { x: 0, y: 0, width: 0, height: 0 };
         if (shape.type === ShapeType.RECTANGLE) {
             const s = shape as RectangleShape;
             shapeRect = { x: s.x, y: s.y, width: s.width, height: s.height };
         } else if (shape.type === ShapeType.CIRCLE) {
             const s = shape as CircleShape;
             shapeRect = { x: s.x - s.radius, y: s.y - s.radius, width: s.radius * 2, height: s.radius * 2 };
         } else if (shape.type === ShapeType.TEXT) {
             const s = shape as TextShape;
             const w = s.text.length * (s.fontSize * 0.6);
             shapeRect = { x: s.x, y: s.y - s.fontSize, width: w, height: s.fontSize };
         } else if (shape.type === ShapeType.HEART) {
             const s = shape as HeartShape;
             shapeRect = { x: s.x - s.width/2, y: s.y - s.height/2, width: s.width, height: s.height };
         } else if (shape.type === ShapeType.LINE) {
             const s = shape as LineShape;
             const minX = Math.min(s.x, s.x2);
             const minY = Math.min(s.y, s.y2);
             const maxX = Math.max(s.x, s.x2);
             const maxY = Math.max(s.y, s.y2);
             shapeRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
         }
         
         const x_overlap = Math.max(0, Math.min(rect.x + rect.width, shapeRect.x + shapeRect.width) - Math.max(rect.x, shapeRect.x));
         const y_overlap = Math.max(0, Math.min(rect.y + rect.height, shapeRect.y + shapeRect.height) - Math.max(rect.y, shapeRect.y));
         
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

    if (dragMode === 'DRAW' && currentPolyline) {
        onAddShapeFromPen(currentPolyline);
        setCurrentPolyline(null);
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

  const renderHeartPath = (s: HeartShape) => {
      let d = "";
      const steps = 30;
      for(let i=0; i<=steps; i++) {
          const t = (i/steps) * 2 * Math.PI;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
          
          const scaleX = s.width / 32;
          const scaleY = s.height / 30;
          
          const px = s.x + (hx * scaleX);
          const py = s.y - (hy * scaleY); 
          
          d += (i===0 ? "M" : "L") + ` ${px} ${py} `;
      }
      d += "Z";
      return d;
  };

  const renderDimensions = (shape: Shape) => {
      const dimColor = "#22d3ee"; 
      const strokeWidth = 1.5 / (unit === Unit.MM ? 1 : (unit === Unit.INCH ? 0.04 : 0.003)); // Scale stroke visually? No, just fixed.
      const textStyle = { fill: "#e2e8f0", fontSize: 12, fontFamily: "sans-serif", fontWeight: "bold" };
      const bgStyle = { fill: "rgba(15, 23, 42, 0.7)" };

      if (shape.type === ShapeType.RECTANGLE) {
          const s = shape as RectangleShape;
          const widthLabel = formatUnit(s.width, unit);
          const heightLabel = formatUnit(s.height, unit);

          return (
              <g pointerEvents="none" className="select-none">
                  <line x1={s.x} y1={s.y - 15} x2={s.x + s.width} y2={s.y - 15} stroke={dimColor} strokeWidth={1.5} markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />
                  <line x1={s.x} y1={s.y} x2={s.x} y2={s.y - 20} stroke={dimColor} strokeWidth="0.5" strokeDasharray="2 2"/>
                  <line x1={s.x + s.width} y1={s.y} x2={s.x + s.width} y2={s.y - 20} stroke={dimColor} strokeWidth="0.5" strokeDasharray="2 2"/>
                  
                  <rect x={s.x + s.width / 2 - 25} y={s.y - 28} width="50" height="14" rx="2" {...bgStyle} />
                  <text x={s.x + s.width / 2} y={s.y - 19} textAnchor="middle" {...textStyle}>{widthLabel}</text>
                  
                  <line x1={s.x - 15} y1={s.y} x2={s.x - 15} y2={s.y + s.height} stroke={dimColor} strokeWidth={1.5} markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />
                  <line x1={s.x} y1={s.y} x2={s.x - 20} y2={s.y} stroke={dimColor} strokeWidth="0.5" strokeDasharray="2 2"/>
                  <line x1={s.x} y1={s.y + s.height} x2={s.x - 20} y2={s.y + s.height} stroke={dimColor} strokeWidth="0.5" strokeDasharray="2 2"/>

                  <rect x={s.x - 65} y={s.y + s.height / 2 - 7} width="50" height="14" rx="2" {...bgStyle} />
                  <text x={s.x - 40} y={s.y + s.height / 2 + 4} textAnchor="middle" {...textStyle}>{heightLabel}</text>
              </g>
          );
      }
      if (shape.type === ShapeType.CIRCLE) {
          const s = shape as CircleShape;
          const radiusLabel = `R${formatUnit(s.radius, unit)}`;
           return (
              <g pointerEvents="none" className="select-none">
                  <line x1={s.x} y1={s.y} x2={s.x + s.radius} y2={s.y} stroke={dimColor} strokeWidth={1.5} markerEnd="url(#arrow)" />
                  <rect x={s.x + s.radius / 2 - 20} y={s.y - 18} width="40" height="14" rx="2" {...bgStyle} />
                  <text x={s.x + s.radius / 2} y={s.y - 7} textAnchor="middle" {...textStyle}>{radiusLabel}</text>
              </g>
          );
      }
      return null;
  };

  const viewBoxStr = `${-20 - pan.x} ${-20 - pan.y} 540 540`;

  return (
    <div className={`flex-1 bg-slate-900 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] ${activeTool === Tool.PAN ? 'cursor-grab active:cursor-grabbing' : ''} ${activeTool === Tool.PEN ? 'cursor-crosshair' : ''}`}>
      <div className="absolute top-4 left-4 text-slate-500 text-sm select-none pointer-events-none z-10 bg-slate-900/50 backdrop-blur rounded px-2">
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
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
          </marker>
          <marker id="arrow-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
             <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
          </marker>
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
        {[...shapes, ...(currentPolyline ? [currentPolyline] : [])].map(shape => {
           const isSelected = selectedIds.includes(shape.id);
           const stroke = isSelected ? "#38bdf8" : "#94a3b8";
           const isPreview = shape.id === currentPolyline?.id;
           
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
                fontFamily={s.fontFamily || "monospace"}
                letterSpacing={s.letterSpacing || 0}
                fontWeight={isSelected ? "bold" : "normal"}
                {...commonProps}
                className={`${commonProps.className} select-none`}
               >
                 {s.text}
               </text>
             );
           }
           if (shape.type === ShapeType.HEART) {
               const s = shape as HeartShape;
               return (
                   <path
                    key={s.id}
                    d={renderHeartPath(s)}
                    fill={isSelected ? "rgba(244, 114, 182, 0.2)" : "rgba(244, 114, 182, 0.05)"}
                    stroke={isSelected ? "#f472b6" : "#94a3b8"}
                    strokeWidth={isSelected ? 2 : 1}
                    {...commonProps}
                   />
               );
           }
           if (shape.type === ShapeType.LINE) {
               const s = shape as LineShape;
               return (
                   <line
                    key={s.id}
                    x1={s.x} y1={s.y} x2={s.x2} y2={s.y2}
                    stroke={stroke}
                    strokeWidth={isSelected ? 2 : 1}
                    {...commonProps}
                   />
               );
           }
           if (shape.type === ShapeType.POLYLINE) {
               const s = shape as PolylineShape;
               const pointsStr = s.points.map(p => `${p.x},${p.y}`).join(' ');
               return (
                   <polyline
                    key={s.id}
                    points={pointsStr}
                    fill="none"
                    stroke={isPreview ? "#22d3ee" : stroke}
                    strokeWidth={isSelected || isPreview ? 2 : 1}
                    {...commonProps}
                   />
               );
           }
           return null;
        })}

        {/* Dimensions Layer */}
        {showDimensions && shapes.map(shape => {
            if (!selectedIds.includes(shape.id)) return null;
            return (
             <React.Fragment key={`dim-${shape.id}`}>
                 {renderDimensions(shape)}
             </React.Fragment>
            );
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