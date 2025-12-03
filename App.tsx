import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Toolbar from './components/Toolbar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import CodeEditor from './components/CodeEditor';
import AIAssistant from './components/AIAssistant';
import { Shape, ShapeType, MachineSettings, Tool } from './types';
import { generateGCode } from './services/gcodeService';
import { generateShapesFromPrompt, explainGCode } from './services/geminiService';

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
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);

  // Auto-generate G-code when shapes change, unless in manual mode
  useEffect(() => {
    if (!isManualMode) {
      const code = generateGCode(shapes, DEFAULT_SETTINGS);
      setGcode(code);
    }
  }, [shapes, isManualMode]);

  const handleAddShape = (type: ShapeType) => {
    const id = uuidv4();
    let newShape: Shape;

    switch (type) {
      case ShapeType.RECTANGLE:
        newShape = { id, type, x: 50, y: 50, width: 50, height: 50 };
        break;
      case ShapeType.CIRCLE:
        newShape = { id, type, x: 100, y: 100, radius: 25 };
        break;
      case ShapeType.TEXT:
        newShape = { id, type, x: 50, y: 150, text: "CNC", fontSize: 24 };
        break;
      default:
        return;
    }

    setShapes(prev => [...prev, newShape]);
    setSelectedIds([id]);
    setActiveTool(Tool.SELECT); // Switch back to select mode after adding
  };

  const handleUpdateShape = (updatedShape: Shape) => {
    setShapes(prev => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
  };

  const handleUpdateShapes = (updatedShapes: Shape[]) => {
    const updatesMap = new Map(updatedShapes.map(s => [s.id, s]));
    setShapes(prev => prev.map(s => updatesMap.get(s.id) || s));
  };

  const handleDeleteShapes = (idsToDelete: string[]) => {
    setShapes(prev => prev.filter(s => !idsToDelete.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };

  const handleSelectShape = (id: string | null, isMulti: boolean) => {
    if (id === null) {
      if (!isMulti) setSelectedIds([]);
      return;
    }

    if (isMulti) {
        setSelectedIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(existingId => existingId !== id);
            } else {
                return [...prev, id];
            }
        });
    } else {
        setSelectedIds([id]);
    }
  };

  // Callback for marquee selection from canvas
  const handleMultiSelect = (ids: string[], addToExisting: boolean) => {
    if (addToExisting) {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            ids.forEach(id => newSet.add(id));
            return Array.from(newSet);
        });
    } else {
        setSelectedIds(ids);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setGcode(newCode);
    setIsManualMode(true);
  };

  const handleRegenerate = () => {
    setIsManualMode(false);
  };

  const handleAISubmit = async (prompt: string) => {
    setIsAILoading(true);
    try {
      const newShapes = await generateShapesFromPrompt(prompt, shapes);
      setShapes(newShapes);
      setIsAIModalOpen(false);
    } catch (error) {
      alert("Failed to generate shapes. Check console for details.");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleExplainCode = async () => {
    if (!gcode) return;
    setIsAILoading(true);
    try {
        const explanation = await explainGCode(gcode);
        const commentBlock = explanation.split('\n').map(l => `; ${l}`).join('\n');
        setGcode(`${commentBlock}\n\n${gcode}`);
        setIsManualMode(true);
    } catch (e) {
        console.error(e);
    } finally {
        setIsAILoading(false);
    }
  };

  const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-900 text-slate-100 font-sans overflow-hidden">
      <Toolbar 
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onAddShape={handleAddShape} 
        onOpenAI={() => setIsAIModalOpen(true)} 
      />
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-700 relative bg-slate-950 overflow-hidden">
          <Canvas 
            shapes={shapes}
            activeTool={activeTool} 
            onUpdateShape={handleUpdateShape}
            onUpdateShapes={handleUpdateShapes}
            onSelectShape={handleSelectShape}
            onMultiSelect={handleMultiSelect}
            selectedIds={selectedIds}
            onDeleteShapes={handleDeleteShapes}
          />
        </div>

        <div className="h-1/3 md:h-full w-full md:w-[400px] flex flex-col bg-slate-800 shrink-0 shadow-2xl z-20">
          <div className="h-1/2 border-b border-slate-700 overflow-y-auto custom-scrollbar">
            <PropertiesPanel 
                selectedShapes={selectedShapes} 
                onUpdateShape={handleUpdateShape}
                onUpdateShapes={handleUpdateShapes}
                onDelete={handleDeleteShapes}
            />
            <div className="p-4 border-t border-slate-700">
                <h4 className="text-xs font-semibold text-slate-400 mb-2">Machine Settings (Global)</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                    <div>Feed: {DEFAULT_SETTINGS.feedRate} mm/min</div>
                    <div>Safe Z: {DEFAULT_SETTINGS.safeHeight} mm</div>
                    <div>Depth: {DEFAULT_SETTINGS.cutDepth} mm</div>
                    <div>Tool: {DEFAULT_SETTINGS.toolDiameter} mm</div>
                </div>
            </div>
          </div>
          <CodeEditor 
            code={gcode} 
            onChange={handleCodeChange} 
            onRegenerate={handleRegenerate}
            onExplain={handleExplainCode}
            isManualMode={isManualMode}
          />
        </div>
      </main>

      <AIAssistant 
        isOpen={isAIModalOpen} 
        onClose={() => setIsAIModalOpen(false)} 
        onSubmit={handleAISubmit}
        isLoading={isAILoading}
      />
    </div>
  );
};

export default App;