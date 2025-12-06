
import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import ToolPalette from './components/ToolPalette';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import CodeEditor from './components/CodeEditor';
import MachineControl from './components/MachineControl';
import LogsPanel from './components/LogsPanel';
import GrblSettingsPanel from './components/GrblSettingsPanel';
import SimulatorPanel from './components/SimulatorPanel';
import CalibrationHelper from './components/CalibrationHelper';
import Ripple from './components/Ripple';
import { Shape, ShapeType, MachineSettings, Tool, Unit, RectangleShape, CircleShape, TextShape, HeartShape, LineShape, PolylineShape, GroupShape, MirrorMode, MachineStatus } from './types';
import { generateGCode, loadFont } from './services/gcodeService';
// import { explainGCode } from './services/geminiService';
import { parseSvgToShapes, shapesToSvg, calculateGCodeBounds } from './utils';
import { Layers, FileCode, Settings, Terminal, Cpu, Play, GripVertical } from 'lucide-react';
import { serialService } from './services/serialService';

const DEFAULT_SETTINGS: MachineSettings = {
  feedRate: 800,
  safeHeight: 5,
  cutDepth: 2,
  toolDiameter: 3.175
};

const MIN_PANEL_WIDTH = 300;
const MAX_PANEL_WIDTH = 800;

type Tab = 'properties' | 'machine' | 'logs' | 'grbl' | 'simulator';

const App: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);

  // History State
  const [historyPast, setHistoryPast] = useState<Shape[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<Shape[][]>([]);

  // G-Code History State
  const [gcodeHistoryPast, setGcodeHistoryPast] = useState<string[]>([]);
  const [gcodeHistoryFuture, setGcodeHistoryFuture] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<Tool>(Tool.SELECT);
  const [gcode, setGcode] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [unit, setUnit] = useState<Unit>(Unit.MM);

  const [canvasSize, setCanvasSize] = useState({ width: 3050, height: 2150 });
  const [gridSize, setGridSize] = useState(10);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [generateOnlySelected, setGenerateOnlySelected] = useState(false);
  const [jogSpeed, setJogSpeed] = useState(1000);

  // Machine State
  const [machineStatus, setMachineStatus] = useState<MachineStatus>({
    state: 'Disconnected',
    pos: { x: '0.000', y: '0.000', z: '0.000' },
    feed: '0',
    spindle: '0'
  });
  const [isMachineConnected, setIsMachineConnected] = useState(false);
  const [machineLogs, setMachineLogs] = useState<string[]>([]);
  const [isLogEnabled, setIsLogEnabled] = useState(true);
  const [grblSettings, setGrblSettings] = useState<Record<string, string>>({});

  // Right Panel State
  const [activeTab, setActiveTab] = useState<Tab>('properties');
  const [rightPanelWidth, setRightPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  // --- Serial Callbacks ---
  useEffect(() => {
    serialService.setCallbacks(
      (status) => {
        setMachineStatus(status);
        setIsMachineConnected(true);
      },
      (log) => {
        if (!isLogEnabled && !log.startsWith('ERROR') && !log.startsWith('ALARM')) return;

        setMachineLogs(prev => {
          const next = [...prev, log];
          if (next.length > 200) return next.slice(-200);
          return next;
        });

        // Parse GRBL Settings
        const settingMatch = log.match(/\$([0-9]+)\s*=\s*([\d\.]+)/);
        if (settingMatch) {
          setGrblSettings(prev => ({
            ...prev,
            [settingMatch[1]]: settingMatch[2]
          }));
        }
      }
    );
  }, [isLogEnabled]);

  const addLog = (msg: string) => {
    setMachineLogs(prev => [...prev.slice(-199), msg]);
  };

  const clearLogs = () => setMachineLogs([]);

  // --- History Management ---
  const saveToHistory = useCallback(() => {
    setHistoryPast(prev => [...prev, shapes]);
    setHistoryFuture([]); // Clear future on new action
  }, [shapes]);

  const saveGCodeToHistory = useCallback(() => {
    setGcodeHistoryPast(prev => [...prev, gcode]);
    setGcodeHistoryFuture([]);
  }, [gcode]);

  const undo = useCallback(() => {
    if (activeTab === 'simulator') {
      if (gcodeHistoryPast.length === 0) return;
      const previous = gcodeHistoryPast[gcodeHistoryPast.length - 1];
      const newPast = gcodeHistoryPast.slice(0, -1);

      setGcodeHistoryFuture(prev => [gcode, ...prev]);
      setGcodeHistoryPast(newPast);
      setGcode(previous);
    } else {
      if (historyPast.length === 0) return;
      const previous = historyPast[historyPast.length - 1];
      const newPast = historyPast.slice(0, -1);

      setHistoryFuture(prev => [shapes, ...prev]);
      setHistoryPast(newPast);
      setShapes(previous);
    }
  }, [activeTab, gcodeHistoryPast, gcode, historyPast, shapes]);

  const redo = useCallback(() => {
    if (activeTab === 'simulator') {
      if (gcodeHistoryFuture.length === 0) return;
      const next = gcodeHistoryFuture[0];
      const newFuture = gcodeHistoryFuture.slice(1);

      setGcodeHistoryPast(prev => [...prev, gcode]);
      setGcodeHistoryFuture(newFuture);
      setGcode(next);
    } else {
      if (historyFuture.length === 0) return;
      const next = historyFuture[0];
      const newFuture = historyFuture.slice(1);

      setHistoryPast(prev => [...prev, shapes]);
      setHistoryFuture(newFuture);
      setShapes(next);
    }
  }, [activeTab, gcodeHistoryFuture, gcode, historyFuture, shapes]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);


  useEffect(() => {
    let isMounted = true;
    if (!isManualMode) {
      let shapesToProcess = shapes;
      if (generateOnlySelected && selectedIds.length > 0) {
        shapesToProcess = shapes.filter(s => selectedIds.includes(s.id));
      }

      generateGCode(shapesToProcess, DEFAULT_SETTINGS).then(code => {
        if (isMounted) setGcode(code);
      });
    }
    return () => { isMounted = false; };
  }, [shapes, isManualMode, generateOnlySelected, selectedIds]);

  // Resize Handler
  const startResizing = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';

    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handleMouseMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth * 0.7;
      const newWidth = Math.min(Math.max(startWidth + deltaX, MIN_PANEL_WIDTH), maxWidth);
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      window.removeEventListener('pointermove', handleMouseMove);
      window.removeEventListener('pointerup', handleMouseUp);
    };

    window.addEventListener('pointermove', handleMouseMove);
    window.addEventListener('pointerup', handleMouseUp);
  }, [rightPanelWidth]);


  const handleAddShape = (type: ShapeType) => {
    saveToHistory(); // Save before adding
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
    setIsRightPanelOpen(true);
    setActiveTab('properties');
  };

  const handleAddShapeFromPen = (shape: Shape) => {
    // Note: saveToHistory is called in Canvas onDragStart/drawStart
    if (selectedIds.length === 1) {
      const selectedId = selectedIds[0];
      const selectedShape = shapes.find(s => s.id === selectedId);
      if (selectedShape && selectedShape.type === ShapeType.GROUP) {
        setShapes(prev => prev.map(s => {
          if (s.id === selectedId) {
            return {
              ...s,
              children: [...(s as GroupShape).children, shape]
            } as GroupShape;
          }
          return s;
        }));
        return;
      }
    }
    setShapes(prev => [...prev, shape]);
  };

  const handleUpdateShape = (updatedShape: Shape) => {
    setShapes(prev => prev.map(s => s.id === updatedShape.id ? updatedShape : s));
  };

  const handleUpdateShapes = (updatedShapes: Shape[]) => {
    const updatesMap = new Map(updatedShapes.map(s => [s.id, s]));
    setShapes(prev => prev.map(s => updatesMap.get(s.id) || s));
  };

  const handleDeleteShapes = (idsToDelete: string[]) => {
    saveToHistory();
    setShapes(prev => prev.filter(s => !idsToDelete.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };

  const handleSelectShape = (id: string | null, isMulti: boolean) => {
    if (id === null) { if (!isMulti) setSelectedIds([]); return; }
    if (isMulti) setSelectedIds(prev => prev.includes(id) ? prev.filter(ex => ex !== id) : [...prev, id]);
    else {
      setSelectedIds([id]);
      setIsRightPanelOpen(true);
      setActiveTab('properties');
    }
  };
  const handleMultiSelect = (ids: string[], addToExisting: boolean) => {
    if (addToExisting) setSelectedIds(prev => Array.from(new Set([...prev, ...ids])));
    else {
      setSelectedIds(ids);
      if (ids.length > 0) {
        setIsRightPanelOpen(true);
        setActiveTab('properties');
      }
    }
  };

  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    saveToHistory();
    const id = uuidv4();
    const shapesToGroup = shapes.filter(s => selectedIds.includes(s.id));
    const remainingShapes = shapes.filter(s => !selectedIds.includes(s.id));

    const newGroup: GroupShape = {
      id,
      type: ShapeType.GROUP,
      x: 0,
      y: 0,
      children: shapesToGroup
    };

    setShapes([...remainingShapes, newGroup]);
    setSelectedIds([id]);
  };

  const handleUngroup = () => {
    if (selectedIds.length !== 1) return;
    const group = shapes.find(s => s.id === selectedIds[0]);
    if (!group || group.type !== ShapeType.GROUP) return;
    saveToHistory();

    const g = group as GroupShape;
    const remainingShapes = shapes.filter(s => s.id !== group.id);

    const children = g.children.map(c => {
      if (c.type === ShapeType.LINE) {
        return {
          ...c,
          x: c.x + g.x,
          y: c.y + g.y,
          ...(c.type === ShapeType.LINE ? { x2: (c as any).x2 + g.x, y2: (c as any).y2 + g.y } : {})
        } as Shape;
      }
      return {
        ...c,
        x: c.x + g.x,
        y: c.y + g.y
      };
    });

    setShapes([...remainingShapes, ...children]);
    setSelectedIds(children.map(c => c.id));
  };

  const handleExplode = async () => {
    if (selectedIds.length === 0) return;
    saveToHistory();

    let newShapes: Shape[] = [];
    const idsToDelete: string[] = [];
    const newSelectedIds: string[] = [];

    // Process shapes sequentially to handle async font loading
    for (const shape of shapes) {
      if (selectedIds.includes(shape.id)) {
        if (shape.type === ShapeType.RECTANGLE) {
          idsToDelete.push(shape.id);
          const rect = shape as any; // Cast to access properties
          const { x, y, width, height } = rect;

          // Create 4 lines
          const lines: Shape[] = [
            { id: uuidv4(), type: ShapeType.LINE, x: x, y: y, x2: x + width, y2: y }, // Top
            { id: uuidv4(), type: ShapeType.LINE, x: x + width, y: y, x2: x + width, y2: y + height }, // Right
            { id: uuidv4(), type: ShapeType.LINE, x: x + width, y: y + height, x2: x, y2: y + height }, // Bottom
            { id: uuidv4(), type: ShapeType.LINE, x: x, y: y + height, x2: x, y2: y } // Left
          ];
          newShapes.push(...lines);
          newSelectedIds.push(...lines.map(l => l.id));

        } else if (shape.type === ShapeType.POLYLINE) {
          idsToDelete.push(shape.id);
          const poly = shape as any;
          const points = poly.points;

          for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const line: Shape = {
              id: uuidv4(),
              type: ShapeType.LINE,
              x: p1.x,
              y: p1.y,
              x2: p2.x,
              y2: p2.y
            };
            newShapes.push(line);
            newSelectedIds.push(line.id);
          }
        } else if (shape.type === ShapeType.GROUP) {
          idsToDelete.push(shape.id);
          const group = shape as GroupShape;
          const children = group.children.map(c => {
            // Adjust coordinates relative to group
            if (c.type === ShapeType.LINE) {
              const l = c as LineShape;
              return {
                ...c,
                x: l.x + group.x,
                y: l.y + group.y,
                x2: l.x2 + group.x,
                y2: l.y2 + group.y
              };
            }
            return {
              ...c,
              x: c.x + group.x,
              y: c.y + group.y
            };
          });
          newShapes.push(...children);
          newSelectedIds.push(...children.map(c => c.id));

        } else if (shape.type === ShapeType.TEXT) {
          idsToDelete.push(shape.id);
          const textShape = shape as TextShape;
          const font = await loadFont(textShape.fontFamily || 'Roboto Mono');

          if (font) {
            const path = font.getPath(textShape.text, textShape.x, textShape.y, textShape.fontSize, { letterSpacing: textShape.letterSpacing });
            let lastX = 0, lastY = 0, startX = 0, startY = 0;

            const mirrorMode = textShape.mirrorMode || (textShape.mirror ? MirrorMode.WHOLE : MirrorMode.NONE);
            const mx = (val: number) => {
              if (mirrorMode === MirrorMode.WHOLE) return textShape.x - (val - textShape.x);
              return val;
            };

            // We need to handle CHAR mirroring if needed, but for now let's stick to simple path conversion
            // If CHAR mirroring is needed, we'd need to iterate chars like in gcodeService.
            // For simplicity in explode, let's assume standard text or WHOLE mirroring which is easier on the path.
            // If CHAR mirroring is active, the path generation in gcodeService is complex.
            // Let's use a simplified approach: if CHAR mirroring, we might skip or warn, OR just implement the loop.
            // Given the complexity, let's replicate the loop if it's CHAR mirror.

            if (mirrorMode === MirrorMode.CHAR) {
              // Complex case: iterate characters
              let cursorX = textShape.x;
              for (const char of textShape.text) {
                const charPath = font.getPath(char, cursorX, textShape.y, textShape.fontSize);
                const bbox = charPath.getBoundingBox();
                const centerX = (bbox.x1 + bbox.x2) / 2;

                for (const cmd of charPath.commands) {
                  const cmx = (val: number) => centerX - (val - centerX);
                  if (cmd.type === 'M') {
                    lastX = cmd.x; lastY = cmd.y; startX = cmd.x; startY = cmd.y;
                  } else if (cmd.type === 'L') {
                    const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: cmx(lastX), y: lastY, x2: cmx(cmd.x), y2: cmd.y };
                    newShapes.push(line); newSelectedIds.push(line.id);
                    lastX = cmd.x; lastY = cmd.y;
                  } else if (cmd.type === 'Z') {
                    const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: cmx(lastX), y: lastY, x2: cmx(startX), y2: startY };
                    newShapes.push(line); newSelectedIds.push(line.id);
                    lastX = startX; lastY = startY;
                  } else if (cmd.type === 'Q' || cmd.type === 'C') {
                    const steps = 5;
                    for (let i = 1; i <= steps; i++) {
                      const t = i / steps;
                      let px, py;
                      if (cmd.type === 'Q') {
                        px = (1 - t) * (1 - t) * lastX + 2 * (1 - t) * t * cmd.x1 + t * t * cmd.x;
                        py = (1 - t) * (1 - t) * lastY + 2 * (1 - t) * t * cmd.y1 + t * t * cmd.y;
                      } else {
                        // @ts-ignore
                        px = Math.pow(1 - t, 3) * lastX + 3 * Math.pow(1 - t, 2) * t * cmd.x1 + 3 * (1 - t) * Math.pow(t, 2) * cmd.x2 + Math.pow(t, 3) * cmd.x;
                        // @ts-ignore
                        py = Math.pow(1 - t, 3) * lastY + 3 * Math.pow(1 - t, 2) * t * cmd.y1 + 3 * (1 - t) * Math.pow(t, 2) * cmd.y2 + Math.pow(t, 3) * cmd.y;
                      }
                      const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: cmx(lastX), y: lastY, x2: cmx(px), y2: py };
                      newShapes.push(line); newSelectedIds.push(line.id);
                      lastX = px; lastY = py;
                    }
                    lastX = cmd.x; lastY = cmd.y;
                  }
                }
                const advance = font.getAdvanceWidth(char, textShape.fontSize);
                cursorX += advance + (textShape.letterSpacing || 0);
              }
            } else {
              // Standard or WHOLE mirror
              for (const cmd of path.commands) {
                if (cmd.type === 'M') {
                  lastX = cmd.x; lastY = cmd.y; startX = cmd.x; startY = cmd.y;
                } else if (cmd.type === 'L') {
                  const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: mx(lastX), y: lastY, x2: mx(cmd.x), y2: cmd.y };
                  newShapes.push(line); newSelectedIds.push(line.id);
                  lastX = cmd.x; lastY = cmd.y;
                } else if (cmd.type === 'Z') {
                  const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: mx(lastX), y: lastY, x2: mx(startX), y2: startY };
                  newShapes.push(line); newSelectedIds.push(line.id);
                  lastX = startX; lastY = startY;
                } else if (cmd.type === 'Q' || cmd.type === 'C') {
                  const steps = 5;
                  for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    let px, py;
                    if (cmd.type === 'Q') {
                      px = (1 - t) * (1 - t) * lastX + 2 * (1 - t) * t * cmd.x1 + t * t * cmd.x;
                      py = (1 - t) * (1 - t) * lastY + 2 * (1 - t) * t * cmd.y1 + t * t * cmd.y;
                    } else {
                      // @ts-ignore
                      px = Math.pow(1 - t, 3) * lastX + 3 * Math.pow(1 - t, 2) * t * cmd.x1 + 3 * (1 - t) * Math.pow(t, 2) * cmd.x2 + Math.pow(t, 3) * cmd.x;
                      // @ts-ignore
                      py = Math.pow(1 - t, 3) * lastY + 3 * Math.pow(1 - t, 2) * t * cmd.y1 + 3 * (1 - t) * Math.pow(t, 2) * cmd.y2 + Math.pow(t, 3) * cmd.y;
                    }
                    const line: Shape = { id: uuidv4(), type: ShapeType.LINE, x: mx(lastX), y: lastY, x2: mx(px), y2: py };
                    newShapes.push(line); newSelectedIds.push(line.id);
                    lastX = px; lastY = py;
                  }
                  lastX = cmd.x; lastY = cmd.y;
                }
              }
            }
          }

        } else {
          // Keep other shapes as is
          newShapes.push(shape);
        }
      } else {
        newShapes.push(shape);
      }
    }

    // Filter out deleted shapes
    newShapes = newShapes.filter(s => !idsToDelete.includes(s.id));

    setShapes(newShapes);
    setSelectedIds(newSelectedIds);
  };

  const handleToggleGroup = (groupId: string) => {
    setShapes(prev => prev.map(s => {
      if (s.id === groupId && s.type === ShapeType.GROUP) {
        return {
          ...s,
          collapsed: !(s as GroupShape).collapsed
        } as GroupShape;
      }
      return s;
    }));
  };

  const handleCodeChange = (newCode: string) => {
    saveGCodeToHistory();
    setGcode(newCode);
    setIsManualMode(true);
  };
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
    saveToHistory();
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const newShapes = parseSvgToShapes(content);
        setShapes(prev => [...prev, ...newShapes]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpdateCanvasSize = (w: number, h: number) => {
    setCanvasSize({ width: w, height: h });
  };

  const selectedShapes = shapes.filter(s => selectedIds.includes(s.id));

  // Calculate bounds for display
  const getBounds = () => {
    if (gcode) {
      const gcodeBounds = calculateGCodeBounds(gcode);
      if (gcodeBounds) return gcodeBounds;
    }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (shapes.length === 0) return undefined;
    shapes.forEach(s => {
      if (s.type === ShapeType.GROUP) return;
      let sx = s.x, sy = s.y, ex = s.x, ey = s.y;
      if (s.type === ShapeType.RECTANGLE) { ex += (s as any).width; ey += (s as any).height; }
      minX = Math.min(minX, sx); maxX = Math.max(maxX, ex);
      minY = Math.min(minY, sy); maxY = Math.max(maxY, ey);
    });
    return { minX, maxX, minY, maxY };
  };

  const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
    <Ripple>
      <button
        onClick={() => setActiveTab(id)}
        className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 text-sm font-medium transition-colors relative min-w-[60px] md:min-w-[80px] ${activeTab === id
          ? 'text-sky-400 bg-slate-800'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        title={label}
      >
        <Icon size={16} />
        <span className="hidden lg:inline whitespace-nowrap">{label}</span>
        {activeTab === id && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-400" />
        )}
      </button>
    </Ripple>
  );

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] bg-slate-900 text-slate-100 font-sans overflow-hidden relative">
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 flex flex-col relative bg-slate-950 overflow-hidden mb-0">
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
            onShapeChangeStart={saveToHistory}
          />
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
            onClosePalette={() => { }}
            onExportSVG={handleExportSVG}
            onImportSVG={handleImportSVG}
            onGroup={handleGroup}
            onUngroup={handleUngroup}
            onExplode={handleExplode}
            onUndo={undo}
            onRedo={redo}
          />
        </div>

        {isRightPanelOpen && (
          <div
            className="fixed inset-y-0 right-0 z-40 bg-slate-800 border-l border-slate-700 shadow-2xl transition-all duration-75 flex flex-col md:relative h-[calc(100%-3.5rem)] md:h-full bottom-14 md:bottom-0 w-full md:w-[var(--panel-width)]"
            style={{ '--panel-width': `${rightPanelWidth}px` } as React.CSSProperties}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-4 -ml-2 cursor-col-resize group z-[100] flex items-center justify-center touch-none"
              onPointerDown={startResizing}
              title="Drag to resize"
            >
              {/* Invisible Hit Area */}
              <div className="absolute inset-y-0 w-4 bg-transparent" />

              {/* Visible Line - Always semi-visible, bright on hover */}
              <div className="w-0.5 h-full bg-slate-600 group-hover:bg-sky-400 transition-colors" />

              {/* Explicit Handle Icon - Always visible, high contrast */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-700 border border-slate-500 rounded-full py-2 px-0.5 shadow-xl group-hover:border-sky-400 group-hover:bg-slate-600 group-hover:text-sky-400 text-slate-300 transition-all">
                <GripVertical size={16} />
              </div>
            </div>

            <div className="flex border-b border-slate-700 bg-slate-900 shrink-0 overflow-x-auto no-scrollbar">
              <TabButton id="properties" label="Design" icon={Layers} />
              <TabButton id="simulator" label="Sim" icon={Play} />
              <TabButton id="machine" label="Control" icon={Settings} />
              <TabButton id="grbl" label="GRBL" icon={Cpu} />
              <TabButton id="logs" label="Logs" icon={Terminal} />
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-800 pb-0 md:pb-0">
              {activeTab === 'properties' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar pb-16">
                  <PropertiesPanel
                    selectedShapes={selectedShapes}
                    onUpdateShape={handleUpdateShape}
                    onUpdateShapes={(s) => {
                      handleUpdateShapes(s);
                    }}
                    allShapes={shapes}
                    onSelectShape={handleSelectShape}
                    onGroup={handleGroup}
                    onUngroup={handleUngroup}
                    onDelete={handleDeleteShapes}
                    onClose={() => setIsRightPanelOpen(false)}
                    unit={unit}
                    canvasWidth={canvasSize.width}
                    canvasHeight={canvasSize.height}
                    onUpdateCanvasSize={handleUpdateCanvasSize}
                    gridSize={gridSize}
                    onUpdateGridSize={setGridSize}
                    onShapeChangeStart={saveToHistory}
                  />
                </div>
              )}

              {activeTab === 'simulator' && (
                <SimulatorPanel
                  gcode={gcode}
                  onUpdateGCode={handleCodeChange}
                  onClose={() => setIsRightPanelOpen(false)}
                  machineStatus={machineStatus}
                  isConnected={isMachineConnected}
                  isManualMode={isManualMode}
                  onRegenerate={() => setIsManualMode(false)}
                  generateOnlySelected={generateOnlySelected}
                  onToggleGenerateOnlySelected={() => setGenerateOnlySelected(!generateOnlySelected)}
                  onUndo={undo}
                  onRedo={redo}
                />
              )}

              {activeTab === 'machine' && (
                <MachineControl
                  onClose={() => setIsRightPanelOpen(false)}
                  gcodeTotalSize={getBounds()}
                  machineStatus={machineStatus}
                  isConnected={isMachineConnected}
                  onAddLog={addLog}
                  onDisconnect={() => setIsMachineConnected(false)}
                  jogSpeed={jogSpeed}
                  onJogSpeedChange={setJogSpeed}
                />
              )}

              {activeTab === 'grbl' && (
                <GrblSettingsPanel
                  settings={grblSettings}
                  onClose={() => setIsRightPanelOpen(false)}
                  onRefresh={() => serialService.send('$$')}
                  onOpenCalibration={() => setShowCalibration(true)}
                />
              )}

              {activeTab === 'logs' && (
                <LogsPanel
                  logs={machineLogs}
                  onClose={() => setIsRightPanelOpen(false)}
                  onClear={clearLogs}
                  isLogEnabled={isLogEnabled}
                  onToggleLog={() => setIsLogEnabled(!isLogEnabled)}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {showCalibration && <CalibrationHelper onClose={() => setShowCalibration(false)} />}
    </div>
  );
};

export default App;
