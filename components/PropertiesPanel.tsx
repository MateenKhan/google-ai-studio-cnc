import React from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape } from '../types';

interface PropertiesPanelProps {
  shape: Shape | null;
  onChange: (updated: Shape) => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ shape, onChange }) => {
  if (!shape) {
    return (
      <div className="p-4 text-slate-500 text-center text-sm">
        Select a shape to edit properties
      </div>
    );
  }

  const handleChange = (field: string, value: any) => {
    onChange({
      ...shape,
      [field]: value
    });
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <h3 className="text-slate-100 font-semibold border-b border-slate-700 pb-2">Properties</h3>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">X (mm)</label>
          <input 
            type="number" 
            value={shape.x} 
            onChange={(e) => handleChange('x', Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Y (mm)</label>
          <input 
            type="number" 
            value={shape.y} 
            onChange={(e) => handleChange('y', Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
          />
        </div>
      </div>

      {shape.type === ShapeType.RECTANGLE && (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Width</label>
            <input 
              type="number" 
              value={(shape as RectangleShape).width} 
              onChange={(e) => handleChange('width', Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Height</label>
            <input 
              type="number" 
              value={(shape as RectangleShape).height} 
              onChange={(e) => handleChange('height', Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
            />
          </div>
        </div>
      )}

      {shape.type === ShapeType.CIRCLE && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-400">Radius</label>
          <input 
            type="number" 
            value={(shape as CircleShape).radius} 
            onChange={(e) => handleChange('radius', Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
          />
        </div>
      )}

      {shape.type === ShapeType.TEXT && (
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Content</label>
            <input 
              type="text" 
              value={(shape as TextShape).text} 
              onChange={(e) => handleChange('text', e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Font Size</label>
            <input 
              type="number" 
              value={(shape as TextShape).fontSize} 
              onChange={(e) => handleChange('fontSize', Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded p-1 text-sm text-slate-200 focus:border-sky-500 outline-none"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PropertiesPanel;
