import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import CodeEditor from './components/CodeEditor';
import MachineControl from './components/MachineControl';
import CalibrationHelper from './components/CalibrationHelper';
import { Shape, ShapeType, MachineSettings, Tool, Unit } from './types';
import { generateGCode } from './services/gcodeService';
// import { explainGCode } from './services/geminiService';
import { Wrench } from 'lucide-react';
import { parseSvgToShapes, shapesToSvg } from './utils';

const DEFAULT_SETTINGS: MachineSettings = {
  feedRate: 800,
  safeHeight: 5,
  cutDepth: 2,
  toolDiameter: 3.175
};

const App: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.SELECT);
  const [gcode, setGcode] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [unit, setUnit] = useState<Unit>(Unit.MM);
  
  // Canvas Size State (Default: ~10ft x 7ft in mm)
  const [canvasSize, setCanvasSize] = useState({ width: 3050, height: 2150 });
  const [gridSize, setGridSize] = useState(10); // mm

  // Right Panel Hidden by Default per request
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  
  // New Modals
  const [showMachineControl, setShowMachineControl] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!isManualMode) {
      generateGCode(shapes, DEFAULT_SETTINGS).then(code => {
          if(isMounted) setGcode(code);
      });
    }
    return () => { isMounted = false; };
  }, [shapes, isManualMode]);

  const handleAddShape = (type: ShapeType) => {
    const id = uuidv4();
    let newShape: Shape;
    switch (type) {
      case ShapeType.RECTANGLE: newShape = { id, type, x: 50, y: 50, width: 50, height: 50 }; break;
      case ShapeType.CIRCLE: newShape = { id, type, x: 100, y: 100, radius: 25 }; break;
      case ShapeType.TEXT: newShape = { id, type, x: 50, y: 150, text: "CNC", fontSize: 24, fontFamily: "Roboto Mono" }; break;
      case ShapeType.HEART: newShape = { id, type, x: 150, y: 150, width: 40, height: 40 }; break;
      case ShapeType.LINE: newShape = { id, type, x: 50, y: 50, x2: 150, y2: 150 }; break;
      default: return;
    }
    setShapes(prev => [...prev, newShape]);
    setSelectedIds([id]);
    setActiveTool(Tool.SELECT); 
    // Automatically open properties when adding a shape
    setIsRightPanelOpen(true);
  };

  const handleAddShapeFromPen = (shape: Shape) => setShapes(prev => [...prev, shape]);
  const handleUpdateShape = (updatedShape: Shape) => setShapes(prev => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
  const handleUpdateShapes = (updatedShapes: Shape[]) => {
    const updatesMap = new Map(updatedShapes.map(s => [s.id, s]));
    setShapes(prev => prev.map(s => updatesMap.get(s.id) || s));
  };
  const handleDeleteShapes = (idsToDelete: string[]) => {
    setShapes(prev => prev.filter(s => !idsToDelete.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };
  const handleSelectShape = (id: string | null, isMulti: boolean) => {
    if (id === null) { if (!isMulti) setSelectedIds([]); return; }
    if (isMulti) setSelectedIds(prev => prev.includes(id) ? prev.filter(ex => ex !== id) : [...prev, id]);
    else {
        setSelectedIds([id]);
        setIsRightPanelOpen(true);
    }
  };
  const handleMultiSelect = (ids: string[], addToExisting: boolean) => {
    if (addToExisting) setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
    else {
        setSelectedIds(ids);
        if(ids.length > 0) setIsRightPanelOpen(true);
    }
  };
  const handleCodeChange = (newCode: string) => { setGcode(newCode); setIsManualMode(true); };
  // const handleExplain = async () => { if (gcode) alert(await explainGCode(gcode)); };
  
  const handleExportSVG = () => {
    const svgContent = shapesToSvg(shapes, canvasSize.width, canvasSize.height);
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSVG = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
        const content = evt.target?.result as string;
        if (content) {
            const newShapes = parseSvgToShapes(content);
            setShapes(prev => [...prev, ...newShapes]);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleUpdateCanvasSize = (w: number, h: number) => {
      setCanvasSize({ width: w, height: h });
  };

  const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));

  // Calculate Bounds
  const getBounds = () => {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      if (shapes.length === 0) return undefined;
      shapes.forEach(s => {
          let sx = s.x, sy = s.y, ex = s.x, ey = s.y;
          if (s.type === ShapeType.RECTANGLE) { ex += (s as any).width; ey += (s as any).height; }
          // Simplified bounds logic
          minX = Math.min(minX, sx); maxX = Math.max(maxX, ex);
          minY = Math.min(minY, sy); maxY = Math.max(maxY, ey);
      });
      return { minX, maxX, minY, maxY };
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-900 text-slate-100 font-sans overflow-hidden relative">
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden mb-16 md:mb-0">
            <ToolPalette 
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                onAddShape={handleAddShape} 
                showDimensions={showDimensions}
                onToggleDimensions={() => setShowDimensions(!showDimensions)}
                isSidebarOpen={isRightPanelOpen}
                onToggleSidebar={() => setIsRightPanelOpen(!isRightPanelOpen)}
                unit={unit}
                onUnitChange={setUnit}
                onClosePalette={() => {}}
                onExportSVG={handleExportSVG}
                onImportSVG={handleImportSVG}
            />
            <Canvas 
                shapes={shapes}
                activeTool={activeTool} 
                onUpdateShape={handleUpdateShape}
                onUpdateShapes={handleUpdateShapes}
                onSelectShape={handleSelectShape}
                onMultiSelect={handleMultiSelect}
                selectedIds={selectedIds}
                onDeleteShapes={handleDeleteShapes}
                showDimensions={showDimensions}
                onAddShapeFromPen={handleAddShapeFromPen}
                unit={unit}
                canvasWidth={canvasSize.width}
                canvasHeight={canvasSize.height}
                gridSize={gridSize}
            />
        </div>

        {/* Right Sidebar - Properties & Code */}
        {isRightPanelOpen && (
             <div className="fixed inset-y-0 right-0 z-40 bg-slate-800 border-l border-slate-700 shadow-2xl transition-all duration-300 w-full md:w-[400px] flex flex-col md:static h-[calc(100%-4rem)] md:h-full bottom-16 md:bottom-0">
              {showMachineControl ? (
                 <MachineControl onClose={() => setShowMachineControl(false)} gcodeTotalSize={getBounds()} />
              ) : (
                 <>
                    <div className="flex-1 border-b border-slate-700 overflow-y-auto custom-scrollbar flex flex-col">
                        <PropertiesPanel 
                            selectedShapes={selectedShapes} 
                            onUpdateShape={handleUpdateShape}
                            onUpdateShapes={handleUpdateShapes}
                            onDelete={handleDeleteShapes}
                            onClose={() => setIsRightPanelOpen(false)}
                            unit={unit}
                            onOpenMachineControl={() => setShowMachineControl(true)}
                            onOpenCalibration={() => setShowCalibration(true)}
                            canvasWidth={canvasSize.width}
                            canvasHeight={canvasSize.height}
                            onUpdateCanvasSize={handleUpdateCanvasSize}
                            gridSize={gridSize}
                            onUpdateGridSize={setGridSize}
                        />
                    </div>
                    <div className="h-1/3 min-h-[200px] flex flex-col">
                        <CodeEditor 
                            code={gcode} 
                            onChange={handleCodeChange} 
                            onRegenerate={() => setIsManualMode(false)}

                            isManualMode={isManualMode}
                        />
                    </div>
                 </>
              )}
            </div>
        )}
      </main>
      
      {showCalibration && <CalibrationHelper onClose={() => setShowCalibration(false)} />}
    </div>
  );
};

export default App;