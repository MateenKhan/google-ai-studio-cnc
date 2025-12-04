import React from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, HeartShape, LineShape, Unit, MirrorMode } from '../types';
import { Layers, Trash2, X, Settings, Calculator, LayoutGrid, Type } from 'lucide-react';
import { fromMm, toMm } from '../utils';
import { AVAILABLE_FONTS } from '../services/gcodeService';

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updated: Shape) => void;
  onUpdateShapes: (updatedShapes: Shape[]) => void;
  onDelete: (ids: string[]) => void;
  onClose: () => void;
  unit: Unit;
  onOpenCalibration?: () => void;
  canvasWidth?: number;
  canvasHeight?: number;
  onUpdateCanvasSize?: (w: number, h: number) => void;
  gridSize?: number;
  onUpdateGridSize?: (size: number) => void;
  onShapeChangeStart?: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
    selectedShapes, 
    onUpdateShape, 
    onUpdateShapes, 
    onDelete, 
    onClose, 
    unit,
    onOpenCalibration,
    canvasWidth = 3050,
    canvasHeight = 2150,
    onUpdateCanvasSize,
    gridSize = 10,
    onUpdateGridSize,
    onShapeChangeStart
}) => {
  if (selectedShapes.length === 0) {
    const handleCanvasChange = (dim: 'w' | 'h', valStr: string) => {
        const val = parseFloat(valStr);
        if (isNaN(val) || !onUpdateCanvasSize) return;
        const mmVal = toMm(val, unit);
        if (dim === 'w') onUpdateCanvasSize(mmVal, canvasHeight);
        else onUpdateCanvasSize(canvasWidth, mmVal);
    };

    return (
      <div className="p-4 flex flex-col h-full relative">
         <button onClick={onClose} className="md:hidden absolute top-0 right-0 p-2 text-slate-400 hover:text-white">
            <X size={20} />
         </button>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-center p-8 space-y-6">
            <div className="flex flex-col items-center">
                <Layers size={48} className="mb-4 opacity-50" />
                <p className="text-sm">Select a shape to edit properties.</p>
            </div>
            
            {/* Canvas Settings */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 w-full max-w-[240px]">
                <div className="flex items-center gap-2 mb-3 text-slate-300 font-semibold border-b border-slate-700 pb-2">
                    <LayoutGrid size={16} /> Canvas Size ({unit})
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1 text-left">
                        <label className="text-xs text-slate-500">Width</label>
                        <input 
                            type="number" 
                            value={parseFloat(fromMm(canvasWidth, unit).toFixed(2))}
                            onChange={(e) => handleCanvasChange('w', e.target.value)}
                            className="bg-slate-950 border border-slate-600 rounded p-1.5 text-sm text-slate-200 focus:border-sky-500 outline-none w-full"
                        />
                    </div>
                    <div className="flex flex-col gap-1 text-left">
                        <label className="text-xs text-slate-500">Height</label>
                        <input 
                            type="number" 
                            value={parseFloat(fromMm(canvasHeight, unit).toFixed(2))}
                            onChange={(e) => handleCanvasChange('h', e.target.value)}
                            className="bg-slate-950 border border-slate-600 rounded p-1.5 text-sm text-slate-200 focus:border-sky-500 outline-none w-full"
                        />
                    </div>
                </div>
                {onUpdateGridSize && (
                     <div className="mt-2 flex flex-col gap-1 text-left">
                        <label className="text-xs text-slate-500">Grid Size (mm)</label>
                        <input 
                            type="number" 
                            value={gridSize}
                            onChange={(e) => onUpdateGridSize(parseFloat(e.target.value) || 10)}
                            className="bg-slate-950 border border-slate-600 rounded p-1.5 text-sm text-slate-200 focus:border-sky-500 outline-none w-full"
                        />
                    </div>
                )}
            </div>

            <div className="mt-4 flex flex-col gap-2 w-full max-w-[240px]">
                {onOpenCalibration && (
                    <button onClick={onOpenCalibration} className="btn-secondary py-2 px-4 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-2 border border-slate-700 transition-colors">
                        <Calculator size={16} /> Steps Calibrator
                    </button>
                )}
            </div>
        </div>
      </div>
    );
  }

  // Helper to safely get value formatted in current unit
  const getValue = (shape: Shape, key: string) => {
      // @ts-ignore
      const val = shape[key];
      if (typeof val === 'number') {
          return parseFloat(fromMm(val, unit).toFixed(3));
      }
      return val;
  };

  const handleValChange = (field: string, valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return;
    const mmVal = toMm(val, unit);
    
    const updates = selectedShapes.map(shape => ({
      ...shape,
      [field]: mmVal
    })) as Shape[];
    onUpdateShapes(updates);
  };

  const getCommonValue = (field: string): number | string | '' => {
    if (selectedShapes.length === 0) return '';
    const firstVal = getValue(selectedShapes[0], field);
    const allSame = selectedShapes.every(s => getValue(s, field) === firstVal);
    return allSame ? firstVal : '';
  };

  const hasType = (t: ShapeType) => selectedShapes.some(s => s.type === t);
  const isAllText = selectedShapes.every(s => s.type === ShapeType.TEXT);

  const inputProps = {
      onFocus: () => onShapeChangeStart?.(),
      className: "bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
  };

  return (
    <div className="p-4 flex flex-col gap-4 relative">
       <button onClick={onClose} className="md:hidden absolute top-2 right-2 text-slate-400 hover:text-white">
            <X size={20} />
       </button>
      <h3 className="text-slate-100 font-semibold border-b border-slate-700 pb-2 flex justify-between items-center pr-8">
        <span>Properties <span className="text-xs text-slate-500 font-normal">({unit})</span></span>
        {selectedShapes.length > 1 && (
             <span className="bg-sky-900 text-sky-200 text-xs px-2 py-0.5 rounded-full">{selectedShapes.length} Items</span>
        )}
      </h3>
      
      {/* Position */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">X</label>
          <input 
            type="number" 
            value={getCommonValue('x')}
            onChange={(e) => handleValChange('x', e.target.value)}
            {...inputProps}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Y</label>
          <input 
            type="number" 
            value={getCommonValue('y')}
            onChange={(e) => handleValChange('y', e.target.value)}
            {...inputProps}
          />
        </div>
      </div>

      {/* Dimensions for Rect/Heart/Text(Width) */}
      {(hasType(ShapeType.RECTANGLE) || hasType(ShapeType.HEART)) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Width</label>
              <input 
                type="number" 
                value={getCommonValue('width')}
                onChange={(e) => handleValChange('width', e.target.value)}
                {...inputProps}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Height</label>
              <input 
                type="number" 
                value={getCommonValue('height')}
                onChange={(e) => handleValChange('height', e.target.value)}
                {...inputProps}
              />
            </div>
          </div>
      )}

      {/* Rectangle Specific */}
      {hasType(ShapeType.RECTANGLE) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Corner Radius</label>
            <input 
                type="number" 
                value={getCommonValue('cornerRadius')}
                onChange={(e) => handleValChange('cornerRadius', e.target.value)}
                {...inputProps}
            />
          </div>
      )}

      {/* Circle Specific */}
      {hasType(ShapeType.CIRCLE) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Radius</label>
            <input 
                type="number" 
                value={getCommonValue('radius')}
                onChange={(e) => handleValChange('radius', e.target.value)}
                {...inputProps}
            />
          </div>
      )}

      {/* Line Specific */}
      {hasType(ShapeType.LINE) && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">End X (X2)</label>
              <input 
                type="number" 
                value={getCommonValue('x2')}
                onChange={(e) => handleValChange('x2', e.target.value)}
                {...inputProps}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">End Y (Y2)</label>
              <input 
                type="number" 
                value={getCommonValue('y2')}
                onChange={(e) => handleValChange('y2', e.target.value)}
                {...inputProps}
              />
            </div>
          </div>
      )}

      {isAllText && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Content</label>
            <input 
              type="text" 
              value={(selectedShapes[0] as TextShape).text} 
              onChange={(e) => {
                  const updates = selectedShapes.map(s => ({ ...s, text: e.target.value } as TextShape));
                  onUpdateShapes(updates);
              }}
              {...inputProps}
            />
          </div>
          
           <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400 flex items-center gap-1"><Type size={12}/> Font Family</label>
             <select 
                value={(selectedShapes[0] as TextShape).fontFamily || 'Roboto Mono'}
                onChange={(e) => {
                    const updates = selectedShapes.map(s => ({ ...s, fontFamily: e.target.value } as TextShape));
                    onUpdateShapes(updates);
                }}
                onFocus={() => onShapeChangeStart?.()}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
             >
                 {AVAILABLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
             </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Font Size</label>
                <input 
                type="number" 
                value={getCommonValue('fontSize')}
                onChange={(e) => handleValChange('fontSize', e.target.value)}
                {...inputProps}
                />
            </div>
             <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400">Mirror Mode</label>
             <select 
                value={(selectedShapes[0] as TextShape).mirrorMode || MirrorMode.NONE}
                onChange={(e) => {
                    const val = e.target.value as MirrorMode;
                    const updates = selectedShapes.map(s => ({ ...s, mirrorMode: val } as TextShape));
                    onUpdateShapes(updates);
                }}
                onFocus={() => onShapeChangeStart?.()}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
             >
                 <option value={MirrorMode.NONE}>None</option>
                 <option value={MirrorMode.WHOLE}>Whole Text</option>
                 <option value={MirrorMode.CHAR}>Char Level</option>
             </select>
          </div>
          </div>
        </>
      )}

       <button 
             onClick={() => {
                onShapeChangeStart?.();
                onDelete(selectedShapes.map(s => s.id));
             }}
             className="mt-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded flex items-center justify-center gap-2 transition-colors"
           >
             <Trash2 size={16} /> Delete
       </button>
    </div>
  );
};

export default PropertiesPanel;