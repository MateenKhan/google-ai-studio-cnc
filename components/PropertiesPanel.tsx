import React, { useState, useEffect, useRef } from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, HeartShape, LineShape, Unit, MirrorMode } from '../types';
import { Layers, Trash2, X, Settings, Calculator, LayoutGrid, Type, Maximize2, Minimize2, Square, Circle, Heart, Spline, Minus, Group } from 'lucide-react';
import { fromMm, toMm } from '../utils';
import { AVAILABLE_FONTS } from '../services/gcodeService';

interface PropertiesPanelProps {
  selectedShapes: Shape[];
  onUpdateShape: (updated: Shape) => void;
  onUpdateShapes: (updatedShapes: Shape[]) => void;
  onDelete: (ids: string[]) => void;
  onClose: () => void;
  unit: Unit;
  canvasWidth?: number;
  canvasHeight?: number;
  onUpdateCanvasSize?: (w: number, h: number) => void;
  gridSize?: number;
  onUpdateGridSize?: (size: number) => void;
  onShapeChangeStart?: () => void;
  // New props for Layers
  allShapes?: Shape[];
  onSelectShape?: (id: string | null, isMulti: boolean) => void;
  onGroup?: () => void;
  onUngroup?: () => void;
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedShapes,
  onUpdateShape,
  onUpdateShapes,
  onDelete,
  onClose,
  unit,
  canvasWidth = 3050,
  canvasHeight = 2150,
  onUpdateCanvasSize,
  gridSize = 10,
  onUpdateGridSize,
  onShapeChangeStart,
  allShapes = [],
  onSelectShape,
  onGroup,
  onUngroup
}) => {
  const [activeTab, setActiveTab] = useState<'properties' | 'layers'>('properties');
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingNameVal, setEditingNameVal] = useState("");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If user selects a shape, switch to properties view unless explicitly already in layers
    if (selectedShapes.length > 0 && activeTab === 'layers') {
      // Optional: decide if we want to auto-switch. 
      // For now, let's NOT auto-switch to properties if they are already browsing layers, 
      // as they might be selecting from the layer list.
    } else if (selectedShapes.length > 0 && activeTab === 'properties') {
      // ensure we stay in properties
    }
  }, [selectedShapes.length]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await wrapperRef.current.requestFullscreen();
      } catch (err) {
        console.error("Error attempting to enable fullscreen:", err);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    }
  };


  // RENDER HELPERS for Layers
  const handleNameEditStart = (shape: Shape) => {
    setEditingNameId(shape.id);
    setEditingNameVal(shape.name || shape.type);
  };

  const handleNameSave = () => {
    if (!editingNameId) return;
    const updates = allShapes.map(s => s.id === editingNameId ? { ...s, name: editingNameVal } : s);
    onUpdateShapes(updates);
    setEditingNameId(null);
  };

  const LayersList = () => {
    return (
      <div className="flex flex-col gap-1">
        {allShapes.slice().reverse().map(shape => { // Reverse to show top-most first
          const isSelected = selectedShapes.some(s => s.id === shape.id);
          return (
            <div
              key={shape.id}
              className={`flex items-center justify-between p-2 rounded cursor-pointer border ${isSelected ? 'bg-sky-900/40 border-sky-700' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
              onClick={(e) => onSelectShape?.(shape.id, e.shiftKey || e.ctrlKey)}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="text-slate-500 shrink-0">
                  {shape.type === ShapeType.GROUP ? <Group size={14} /> :
                    shape.type === ShapeType.TEXT ? <Type size={14} /> :
                      shape.type === ShapeType.RECTANGLE ? <Square size={14} /> :
                        shape.type === ShapeType.CIRCLE ? <Circle size={14} /> :
                          shape.type === ShapeType.HEART ? <Heart size={14} /> :
                            shape.type === ShapeType.LINE ? <Minus size={14} className="-rotate-45" /> :
                              shape.type === ShapeType.POLYLINE ? <Spline size={14} /> : <Settings size={14} />}
                </span>
                {editingNameId === shape.id ? (
                  <input
                    className="bg-slate-950 text-white text-xs p-1 rounded border border-sky-500 outline-none w-full min-w-[50px]"
                    value={editingNameVal}
                    onChange={e => setEditingNameVal(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleNameSave(); }}
                    onBlur={handleNameSave}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span
                    className="text-sm text-slate-300 truncate select-none"
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      handleNameEditStart(shape);
                    }}
                  >
                    {shape.name || `${shape.type.charAt(0) + shape.type.slice(1).toLowerCase()} ${shape.id.slice(0, 4)}`}
                  </span>
                )}
              </div>
              <div className="flex opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete([shape.id]); }}
                  className="text-slate-600 hover:text-red-400 p-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
        {allShapes.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-8">No shapes yet</div>
        )}
      </div>
    )
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

  const handleCanvasChange = (dim: 'w' | 'h', valStr: string) => {
    const val = parseFloat(valStr);
    if (isNaN(val) || !onUpdateCanvasSize) return;
    const mmVal = toMm(val, unit);
    if (dim === 'w') onUpdateCanvasSize(mmVal, canvasHeight);
    else onUpdateCanvasSize(canvasWidth, mmVal);
  };

  return (
    <div
      ref={wrapperRef}
      className={`flex flex-col bg-slate-800 ${isFullscreen ? 'fixed inset-0 z-[10000] w-screen h-screen' : 'h-full'}`}
    >
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('properties')}
            className={`font-bold text-sm flex items-center gap-2 pb-1 border-b-2 transition-colors ${activeTab === 'properties' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Settings size={14} /> Properties
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            className={`font-bold text-sm flex items-center gap-2 pb-1 border-b-2 transition-colors ${activeTab === 'layers' ? 'text-sky-400 border-sky-400' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            <Layers size={14} /> Layers
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleFullscreen} className="p-1.5 text-slate-400 hover:text-sky-400 bg-slate-700 rounded" title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

        {activeTab === 'layers' && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-2 mb-2">
              <button onClick={onGroup} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1 rounded border border-slate-600">Group</button>
              <button onClick={onUngroup} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1 rounded border border-slate-600">Ungroup</button>
            </div>
            <LayersList />
          </div>
        )}

        {activeTab === 'properties' && (
          <>
            {selectedShapes.length === 0 ? (
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
              </div>
            ) : (
              <>
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
                      <label className="text-xs text-slate-400 flex items-center gap-1"><Type size={12} /> Font Family</label>
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PropertiesPanel;