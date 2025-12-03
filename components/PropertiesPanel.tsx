import React from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape } from '../types';
import { Layers, Trash2 } from 'lucide-react';

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updated: Shape) => void;
  onUpdateShapes: (updatedShapes: Shape[]) => void;
  onDelete: (ids: string[]) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ selectedShapes, onUpdateShape, onUpdateShapes, onDelete }) => {
  if (selectedShapes.length === 0) {
    return (
      <div className="p-8 text-slate-600 flex flex-col items-center text-center">
        <Layers size={48} className="mb-4 opacity-50" />
        <p className="text-sm">Select a shape to edit properties.</p>
        <p className="text-xs mt-2 text-slate-700">Hold Shift or use "Multi-Select" to select multiple items.</p>
      </div>
    );
  }

  // Common change handler for single and multi-select
  const handleCommonChange = (field: keyof Shape, value: any) => {
    const updates = selectedShapes.map(shape => ({
      ...shape,
      [field]: value
    }));
    onUpdateShapes(updates);
  };

  // Helper to check if a property value is mixed among selected shapes
  const getCommonValue = (field: keyof Shape) => {
    if (selectedShapes.length === 0) return '';
    const firstVal = selectedShapes[0][field];
    const allSame = selectedShapes.every(s => s[field] === firstVal);
    return allSame ? firstVal : '';
  };

  // Helper to get placeholder for mixed values
  const getPlaceholder = (field: keyof Shape) => {
    if (selectedShapes.length === 0) return '';
    const firstVal = selectedShapes[0][field];
    const allSame = selectedShapes.every(s => s[field] === firstVal);
    return allSame ? '' : 'Mixed';
  };

  const isAllRectangles = selectedShapes.every(s => s.type === ShapeType.RECTANGLE);
  const isAllCircles = selectedShapes.every(s => s.type === ShapeType.CIRCLE);
  const isAllText = selectedShapes.every(s => s.type === ShapeType.TEXT);

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-slate-100 font-semibold border-b border-slate-700 pb-2 flex justify-between items-center">
        <span>Properties</span>
        {selectedShapes.length > 1 && (
             <span className="bg-sky-900 text-sky-200 text-xs px-2 py-0.5 rounded-full">{selectedShapes.length} Items</span>
        )}
      </h3>
      
      {/* Common Properties */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">X (mm)</label>
          <input 
            type="number" 
            value={getCommonValue('x')}
            placeholder={getPlaceholder('x')} 
            onChange={(e) => handleCommonChange('x', Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Y (mm)</label>
          <input 
            type="number" 
            value={getCommonValue('y')}
            placeholder={getPlaceholder('y')}
            onChange={(e) => handleCommonChange('y', Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
        </div>
      </div>

      {/* Specific Properties - Only shown if all selected are same type */}
      {isAllRectangles && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Width</label>
            <input 
              type="number" 
              value={(selectedShapes[0] as RectangleShape).width} // Assuming mixed checks handle rendering or logic
              placeholder={selectedShapes.every(s => (s as RectangleShape).width === (selectedShapes[0] as RectangleShape).width) ? '' : 'Mixed'}
              onChange={(e) => {
                  const val = Number(e.target.value);
                  const updates = selectedShapes.map(s => ({ ...s, width: val } as RectangleShape));
                  onUpdateShapes(updates);
              }}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Height</label>
            <input 
              type="number" 
              value={(selectedShapes[0] as RectangleShape).height} 
              placeholder={selectedShapes.every(s => (s as RectangleShape).height === (selectedShapes[0] as RectangleShape).height) ? '' : 'Mixed'}
               onChange={(e) => {
                  const val = Number(e.target.value);
                  const updates = selectedShapes.map(s => ({ ...s, height: val } as RectangleShape));
                  onUpdateShapes(updates);
              }}
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
            value={(selectedShapes[0] as CircleShape).radius} 
            placeholder={selectedShapes.every(s => (s as CircleShape).radius === (selectedShapes[0] as CircleShape).radius) ? '' : 'Mixed'}
            onChange={(e) => {
                const val = Number(e.target.value);
                const updates = selectedShapes.map(s => ({ ...s, radius: val } as CircleShape));
                onUpdateShapes(updates);
            }}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
          />
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
                value={(selectedShapes[0] as TextShape).fontSize} 
                placeholder={selectedShapes.every(s => (s as TextShape).fontSize === (selectedShapes[0] as TextShape).fontSize) ? '' : 'Mixed'}
                onChange={(e) => {
                    const val = Number(e.target.value);
                    const updates = selectedShapes.map(s => ({ ...s, fontSize: val } as TextShape));
                    onUpdateShapes(updates);
                }}
                className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none placeholder-slate-600 italic"
                />
            </div>
            <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-400">Spacing</label>
                <input 
                type="number" 
                step="0.1"
                value={(selectedShapes[0] as TextShape).letterSpacing || 0} 
                placeholder={selectedShapes.every(s => (s as TextShape).letterSpacing === (selectedShapes[0] as TextShape).letterSpacing) ? '' : 'Mixed'}
                onChange={(e) => {
                    const val = Number(e.target.value);
                    const updates = selectedShapes.map(s => ({ ...s, letterSpacing: val } as TextShape));
                    onUpdateShapes(updates);
                }}
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

      {selectedShapes.length > 1 && !isAllRectangles && !isAllCircles && !isAllText && (
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