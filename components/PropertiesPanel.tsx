import React from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, HeartShape, LineShape, Unit } from '../types';
import { Layers, Trash2, X } from 'lucide-react';
import { fromMm, toMm } from '../utils';

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updated: Shape) => void;
  onUpdateShapes: (updatedShapes: Shape[]) => void;
  onDelete: (ids: string[]) => void;
  onClose: () => void;
  unit: Unit;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedShapes, onUpdateShape, onUpdateShapes, onDelete, onClose, unit }) => {
  if (selectedShapes.length === 0) {
    return (
      <div className="p-4 flex flex-col h-full relative">
         <button onClick={onClose} className="md:hidden absolute top-0 right-0 p-2 text-slate-400 hover:text-white">
            <X size={20} />
         </button>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 text-center p-8">
            <Layers size={48} className="mb-4 opacity-50" />
            <p className="text-sm">Select a shape to edit properties.</p>
            <p className="text-xs mt-2 text-slate-700">Hold Shift or use "Multi-Select" to select multiple items.</p>
        </div>
      </div>
    );
  }

  // Unit Converters
  const displayVal = (val: number | undefined) => {
    if (val === undefined) return '';
    return parseFloat(fromMm(val, unit).toFixed(3));
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

  // Helper to check if a property value is mixed among selected shapes
  const getCommonValue = (field: string): number | '' => {
    if (selectedShapes.length === 0) return '';
    const firstVal = (selectedShapes[0] as any)[field];
    const allSame = selectedShapes.every(s => (s as any)[field] === firstVal);
    // @ts-ignore
    return allSame ? displayVal(firstVal) : '';
  };

  const getPlaceholder = (field: string) => {
    if (selectedShapes.length === 0) return '';
    const firstVal = (selectedShapes[0] as any)[field];
    const allSame = selectedShapes.every(s => (s as any)[field] === firstVal);
    return allSame ? '' : 'Mixed';
  };

  const isAllRectangles = selectedShapes.every(s => s.type === ShapeType.RECTANGLE);
  const isAllCircles = selectedShapes.every(s => s.type === ShapeType.CIRCLE);
  const isAllText = selectedShapes.every(s => s.type === ShapeType.TEXT);
  const isAllHearts = selectedShapes.every(s => s.type === ShapeType.HEART);
  const isAllLines = selectedShapes.every(s => s.type === ShapeType.LINE);

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
      
      {/* Common Properties */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">X</label>
          <input 
            type="number" 
            value={getCommonValue('x')}
            placeholder={getPlaceholder('x')} 
            onChange={(e) => handleValChange('x', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Y</label>
          <input 
            type="number" 
            value={getCommonValue('y')}
            placeholder={getPlaceholder('y')}
            onChange={(e) => handleValChange('y', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
        </div>
      </div>

      {/* Specific Properties */}
      {isAllRectangles && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Width</label>
            <input 
              type="number" 
              value={getCommonValue('width')}
              placeholder={getPlaceholder('width')}
              onChange={(e) => handleValChange('width', e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Height</label>
            <input 
              type="number" 
              value={getCommonValue('height')}
              placeholder={getPlaceholder('height')}
              onChange={(e) => handleValChange('height', e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
            />
          </div>
        </div>
      )}

      {isAllCircles && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Radius</label>
          <input 
            type="number" 
            value={getCommonValue('radius')} 
            placeholder={getPlaceholder('radius')}
            onChange={(e) => handleValChange('radius', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
        </div>
      )}

      {isAllHearts && (
        <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Width</label>
                <input 
                type="number" 
                value={getCommonValue('width')}
                onChange={(e) => handleValChange('width', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Height</label>
                <input 
                type="number" 
                value={getCommonValue('height')}
                onChange={(e) => handleValChange('height', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
                />
            </div>
        </div>
      )}

      {isAllLines && (
        <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">End X</label>
                <input 
                type="number" 
                value={getCommonValue('x2')}
                onChange={(e) => handleValChange('x2', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">End Y</label>
                <input 
                type="number" 
                value={getCommonValue('y2')}
                onChange={(e) => handleValChange('y2', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
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
              placeholder={selectedShapes.every(s => (s as TextShape).text === (selectedShapes[0] as TextShape).text) ? '' : 'Mixed'}
              onChange={(e) => {
                  const val = e.target.value;
                  const updates = selectedShapes.map(s => ({ ...s, text: val } as TextShape));
                  onUpdateShapes(updates);
              }}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Font Size</label>
                <input 
                type="number" 
                value={getCommonValue('fontSize')}
                placeholder={getPlaceholder('fontSize')}
                onChange={(e) => handleValChange('fontSize', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Char Spacing</label>
                <input 
                type="number" 
                step="0.1"
                value={getCommonValue('letterSpacing')}
                placeholder={getPlaceholder('letterSpacing')}
                onChange={(e) => handleValChange('letterSpacing', e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
                />
            </div>
          </div>
          <div className="flex flex-col gap-1">
             <label className="text-xs text-slate-400">Font Family</label>
             <select 
                value={(selectedShapes[0] as TextShape).fontFamily || 'monospace'}
                onChange={(e) => {
                    const val = e.target.value;
                    const updates = selectedShapes.map(s => ({ ...s, fontFamily: val } as TextShape));
                    onUpdateShapes(updates);
                }}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
             >
                 <option value="monospace">Standard Mono</option>
                 <option value="sans-serif">Sans Serif</option>
                 <option value="'Great Vibes', cursive">Signatara Style (Great Vibes)</option>
                 <option value="'Roboto Mono', monospace">Roboto Mono</option>
             </select>
          </div>
        </>
      )}

      {selectedShapes.length > 1 && !isAllRectangles && !isAllCircles && !isAllText && !isAllHearts && !isAllLines && (
         <div className="text-xs text-slate-500 italic mt-2">
            Selected items are different types. Only position (X, Y) can be edited in bulk.
         </div>
      )}

       <button 
             onClick={() => onDelete(selectedShapes.map(s => s.id))}
             className="mt-4 py-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/30 rounded flex items-center justify-center gap-2 transition-colors"
           >
             <Trash2 size={16} /> 
             {selectedShapes.length > 1 ? `Delete ${selectedShapes.length} Items` : 'Delete Shape'}
       </button>
    </div>
  );
};

export default PropertiesPanel;