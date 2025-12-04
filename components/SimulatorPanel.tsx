
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, X, Rotate3d, Square, ZoomIn, ZoomOut, Move, Trash2, Pause, Maximize2, Minimize2, ChevronDown, ChevronRight, Expand, Shrink } from 'lucide-react';
import { calculateGCodeBounds } from '../utils';
import { MachineStatus } from '../types';
import { serialService } from '../services/serialService';
import CodeEditor from './CodeEditor';
import Ripple from './Ripple';

interface SimulatorPanelProps {
    gcode: string;
    onUpdateGCode: (code: string) => void;
    onClose: () => void;
    machineStatus: MachineStatus;
    isConnected: boolean;
    isManualMode?: boolean;
    onRegenerate?: () => void;
    generateOnlySelected?: boolean;
    onToggleGenerateOnlySelected?: () => void;
}

const SimulatorPanel: React.FC<SimulatorPanelProps> = ({ gcode, onUpdateGCode, onClose, machineStatus, isConnected, isManualMode, onRegenerate, generateOnlySelected, onToggleGenerateOnlySelected }) => {
    const [activeView, setActiveView] = useState<'3D' | 'TOP' | 'FRONT'>('3D');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState({ x: 60, z: 45 }); // Degrees

    // Accordion States
    const [isGCodeExpanded, setIsGCodeExpanded] = useState(false);
    const [isSimulationExpanded, setIsSimulationExpanded] = useState(true);
    const [isJobControlExpanded, setIsJobControlExpanded] = useState(true);

    // Selection
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
    const [selectedSegmentIndices, setSelectedSegmentIndices] = useState<number[]>([]);
    const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
    const [cursorLineIndex, setCursorLineIndex] = useState<number | null>(null);

    // Fullscreen
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);

    // Job State
    const [jobProgress, setJobProgress] = useState(0);
    const [jobTotal, setJobTotal] = useState(0);
    const [isJobRunning, setIsJobRunning] = useState(false);

    // Simulation State
    const [isSimulating, setIsSimulating] = useState(false);
    const [simProgress, setSimProgress] = useState(0); // 0 to 1
    const [simSpeed, setSimSpeed] = useState(1); // Multiplier
    const requestRef = useRef<number>();
    const startTimeRef = useRef<number>();
    const startProgressRef = useRef<number>(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const hasDraggedRef = useRef(false);
    const lastMousePosRef = useRef({ x: 0, y: 0 });
    const dragModeRef = useRef<'PAN' | 'ROTATE'>('PAN');

    const bounds = useMemo(() => calculateGCodeBounds(gcode) || { minX: 0, maxX: 100, minY: 0, maxY: 100 }, [gcode]);
    const centerOfBounds = {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
        z: 0
    };

    // Parse G-code to paths with Z support and Arc subdivision
    const { segments, totalLength } = useMemo(() => {
        const lines = gcode.split('\n');
        const segs: { x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, type: 'G0' | 'G1' | 'ARC', lineIndex: number, length: number, cumulativeLength: number }[] = [];
        let x = 0, y = 0, z = 0;
        let totalLen = 0;

        lines.forEach((line, index) => {
            const l = line.trim().toUpperCase();
            if (!l || l.startsWith(';') || l.startsWith('(')) return;

            const isG0 = l.startsWith('G0');
            const isG1 = l.startsWith('G1');
            const isG2 = l.startsWith('G2');
            const isG3 = l.startsWith('G3');

            const xMatch = l.match(/X([\d\.-]+)/);
            const yMatch = l.match(/Y([\d\.-]+)/);
            const zMatch = l.match(/Z([\d\.-]+)/);

            const newX = xMatch ? parseFloat(xMatch[1]) : x;
            const newY = yMatch ? parseFloat(yMatch[1]) : y;
            const newZ = zMatch ? parseFloat(zMatch[1]) : z;

            if (isG0 || isG1) {
                if (newX !== x || newY !== y || newZ !== z) {
                    const len = Math.hypot(newX - x, newY - y, newZ - z);
                    segs.push({
                        x1: x, y1: y, z1: z,
                        x2: newX, y2: newY, z2: newZ,
                        type: isG0 ? 'G0' : 'G1',
                        lineIndex: index,
                        length: len,
                        cumulativeLength: totalLen + len
                    });
                    totalLen += len;
                }
                x = newX; y = newY; z = newZ;
            } else if (isG2 || isG3) {
                // Arc Parsing
                const iMatch = l.match(/I([\d\.-]+)/);
                const jMatch = l.match(/J([\d\.-]+)/);
                const iVal = iMatch ? parseFloat(iMatch[1]) : 0;
                const jVal = jMatch ? parseFloat(jMatch[1]) : 0;

                const cx = x + iVal;
                const cy = y + jVal;
                const r = Math.hypot(iVal, jVal);

                let startAngle = Math.atan2(y - cy, x - cx);
                let endAngle = Math.atan2(newY - cy, newX - cx);

                // Clockwise (G2) or Counter-Clockwise (G3) adjustment
                if (isG2) {
                    if (endAngle >= startAngle) endAngle -= 2 * Math.PI;
                } else {
                    if (endAngle <= startAngle) endAngle += 2 * Math.PI;
                }

                const totalAngle = Math.abs(endAngle - startAngle);
                // Segments based on arc length and radius, reasonably detailed
                const segCount = Math.max(6, Math.ceil(totalAngle * r / 0.5));

                let lx = x, ly = y, lz = z;
                for (let k = 1; k <= segCount; k++) {
                    const t = k / segCount;
                    const ang = startAngle + (endAngle - startAngle) * t;
                    const px = cx + r * Math.cos(ang);
                    const py = cy + r * Math.sin(ang);
                    const pz = z + (newZ - z) * t; // Helical interpolation

                    const len = Math.hypot(px - lx, py - ly, pz - lz);
                    segs.push({
                        x1: lx, y1: ly, z1: lz,
                        x2: px, y2: py, z2: pz,
                        type: 'ARC',
                        lineIndex: index,
                        length: len,
                        cumulativeLength: totalLen + len
                    });
                    totalLen += len;
                    lx = px; ly = py; lz = pz;
                }
                x = newX; y = newY; z = newZ;
            }
        });
        return { segments: segs, totalLength: totalLen };
    }, [gcode]);

    // Simulation Loop
    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        const elapsed = time - startTimeRef.current;

        // Base speed: 50mm/s (arbitrary visual speed) * multiplier
        const speedMmPerSec = 50 * simSpeed;
        const distanceTraveled = (elapsed / 1000) * speedMmPerSec;
        const progressDelta = distanceTraveled / totalLength;

        let newProgress = startProgressRef.current + progressDelta;

        if (newProgress >= 1) {
            newProgress = 1;
            setIsSimulating(false);
        } else {
            requestRef.current = requestAnimationFrame(animate);
        }
        setSimProgress(newProgress);
    };

    useEffect(() => {
        if (isSimulating) {
            startTimeRef.current = undefined;
            startProgressRef.current = simProgress;
            requestRef.current = requestAnimationFrame(animate);
        } else {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isSimulating, simSpeed]); // Re-start loop if speed changes to pick up new rate calculation (simplified)

    const handleToggleSimulation = () => {
        if (simProgress >= 1) {
            setSimProgress(0);
            startProgressRef.current = 0;
        }
        setIsSimulating(!isSimulating);
    };

    const handleSimStop = () => {
        setIsSimulating(false);
        setSimProgress(0);
    };

    const setView = (view: '3D' | 'TOP' | 'FRONT') => {
        setActiveView(view);
        // Set appropriate rotation for each view
        if (view === 'TOP') {
            setRotation({ x: 90, z: 0 });
        } else if (view === 'FRONT') {
            setRotation({ x: 0, z: 0 });
        }
        // For 3D view, keep existing rotation
    };

    const handleCursorPositionChange = (lineNumber: number) => {
        // Convert from 1-based line number to 0-based index
        const lineIndex = lineNumber - 1;
        setCursorLineIndex(lineIndex);
    };

    const getPointAtProgress = (prog: number) => {
        if (segments.length === 0) return { x: 0, y: 0, z: 0 };
        const targetDist = prog * totalLength;

        // Binary search or simple find could work. Since segments are sorted by cumulativeLength:
        const seg = segments.find(s => s.cumulativeLength >= targetDist);
        if (!seg) return { x: segments[segments.length - 1].x2, y: segments[segments.length - 1].y2, z: segments[segments.length - 1].z2 };

        const segStartDist = seg.cumulativeLength - seg.length;
        const distInSeg = targetDist - segStartDist;
        const t = distInSeg / seg.length;

        return {
            x: seg.x1 + (seg.x2 - seg.x1) * t,
            y: seg.y1 + (seg.y2 - seg.y1) * t,
            z: seg.z1 + (seg.z2 - seg.z1) * t
        };
    };

    // 3D Projection Helper
    function project(x: number, y: number, z: number) {
        // Center points first
        const cx = x - centerOfBounds.x;
        const cy = y - centerOfBounds.y;
        const cz = z - centerOfBounds.z;

        // Top view mode - look directly down from above
        if (activeView === 'TOP') {
            return { x: cx, y: -cy };
        }

        // Front view mode - look from the front (X-Z plane)
        if (activeView === 'FRONT') {
            return { x: cx, y: -cz };
        }

        // 3D view with rotation
        // Rotate around Z axis
        const radZ = (rotation.z * Math.PI) / 180;
        const x1 = cx * Math.cos(radZ) - cy * Math.sin(radZ);
        const y1 = cx * Math.sin(radZ) + cy * Math.cos(radZ);
        const z1 = cz;

        // Rotate around X axis (Tilt)
        const radX = (rotation.x * Math.PI) / 180;
        const y2 = y1 * Math.cos(radX) - z1 * Math.sin(radX);
        const z2 = y1 * Math.sin(radX) + z1 * Math.cos(radX);

        return { x: x1, y: y2 };
    };

    const simPoint = getPointAtProgress(simProgress);
    const simProj = project(simPoint.x, simPoint.y, simPoint.z);

    const scaleRef = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 100;
    // ViewBox: centered 0,0 with dynamic size
    const vbSize = scaleRef * 1.5;
    const viewBox = `${-vbSize / 2} ${-vbSize / 2} ${vbSize} ${vbSize}`;

    // Interactive Controls
    const handlePointerDown = (e: React.PointerEvent) => {
        // Allow clicking on SVG elements even in fullscreen mode
        // Check if the target is a line element (not the SVG container itself)
        const isLineElement = e.target instanceof SVGElement && e.target.tagName === 'line';

        // If clicking on a line element, allow the event to propagate to the line's onClick handler
        if (isFullscreen && isLineElement) {
            return;
        }

        // Allow all interactions in fullscreen mode (pan, rotate, move)
        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Set drag mode based on mouse button:
        // - Right mouse button (2) or Middle mouse button (1): PAN mode
        // - Left mouse button (0): ROTATE mode (in 3D view) or PAN mode (in 2D view)
        if (e.button === 2 || e.button === 1) {
            dragModeRef.current = 'PAN';
        } else {
            dragModeRef.current = activeView === '3D' ? 'ROTATE' : 'PAN';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        // Allow all interactions in fullscreen mode (pan, rotate, move)
        if (!isDraggingRef.current) return;
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasDraggedRef.current = true;
        }

        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        if (dragModeRef.current === 'ROTATE') {
            setRotation(prev => ({
                x: Math.min(Math.max(prev.x + dy, 0), 180), // Clamp tilt
                z: prev.z - dx
            }));
        } else {
            setPan(prev => ({
                x: prev.x + (dx * (vbSize / 500) / zoom),
                y: prev.y + (dy * (vbSize / 500) / zoom)
            }));
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        // Allow all interactions in fullscreen mode (pan, rotate, move)
        isDraggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e: React.WheelEvent) => {
        // Allow zoom in fullscreen mode
        const zoomFactor = 1.1;
        setZoom(z => e.deltaY > 0 ? z / zoomFactor : z * zoomFactor);
    };

    const handleDeleteSegments = () => {
        console.log('DEBUG: handleDeleteSegments called');
        console.log('DEBUG: selectedSegmentIndices:', selectedSegmentIndices);
        console.log('DEBUG: selectedLineIndex:', selectedLineIndex);

        if (selectedSegmentIndices.length === 0 && selectedLineIndex === null) {
            console.log('DEBUG: No selection, returning');
            return;
        }

        const lines = gcode.split('\n');
        console.log('DEBUG: Total lines before delete:', lines.length);

        const linesToDelete = new Set<number>();

        // Collect all line indices to delete
        if (selectedLineIndex !== null) {
            linesToDelete.add(selectedLineIndex);
        }

        selectedSegmentIndices.forEach(segIdx => {
            if (segIdx < segments.length) {
                linesToDelete.add(segments[segIdx].lineIndex);
            }
        });

        console.log('DEBUG: Lines to delete:', Array.from(linesToDelete));

        // Remove lines in reverse order to maintain indices
        const sortedIndices = Array.from(linesToDelete).sort((a, b) => b - a);
        sortedIndices.forEach(idx => {
            if (idx < lines.length) {
                lines.splice(idx, 1);
            }
        });

        onUpdateGCode(lines.join('\n'));
        setSelectedLineIndex(null);
        setSelectedSegmentIndices([]);
    };

    const handleClearSelection = () => {
        setSelectedLineIndex(null);
        setSelectedSegmentIndices([]);
    };

    const toggleFloating = () => {
        // Floating functionality removed
    };

    const wrapperRef = useRef<HTMLDivElement>(null);

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

    // Keyboard delete support
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            console.log('Key pressed:', e.key, 'selectedSegmentIndices:', selectedSegmentIndices.length);
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedLineIndex !== null || selectedSegmentIndices.length > 0) {
                    e.preventDefault();
                    handleDeleteSegments();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedLineIndex, selectedSegmentIndices, handleDeleteSegments]);

    const handleRunJob = async () => {
        if (!gcode || !isConnected) return;
        try {
            setIsJobRunning(true);
            setJobProgress(0);
            const lines = gcode.split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0 && !l.startsWith(';') && !l.startsWith('('));
            setJobTotal(lines.length);

            // Using the startJob method from serialService
            serialService.startJob(gcode, (current, total) => {
                setJobProgress(current);
            });
        } catch (error) {
            console.error('Error running job:', error);
            setIsJobRunning(false);
        }
    };

    const handlePauseJob = () => {
        serialService.pauseJob(); // Toggle pause/resume
    };

    const handleStopJob = () => {
        serialService.stopJob();
        setIsJobRunning(false);
        setJobProgress(0);
    };

    const mProj = project(parseFloat(machineStatus.pos.x), parseFloat(machineStatus.pos.y), parseFloat(machineStatus.pos.z));

    const content = (
        <div ref={wrapperRef} className={`bg-slate-900 border-l border-slate-800 flex flex-col h-full ${isMinimized ? 'hidden' : ''}`}>
            {/* Header */}
            <div ref={headerRef} className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900 cursor-move select-none">
                <h2 className="font-bold text-slate-100 flex items-center gap-2">
                    <Rotate3d size={18} /> Simulator
                </h2>
                <div className="flex gap-2">
                    <Ripple><button onClick={() => setView('3D')} className={`px-2 py-1 text-xs ${activeView === '3D' ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:text-white'}`} title="3D View">3D</button></Ripple>
                    <Ripple><button onClick={() => setView('TOP')} className={`px-2 py-1 text-xs ${activeView === 'TOP' ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:text-white'}`} title="Top View">Top</button></Ripple>
                    <Ripple><button onClick={() => setView('FRONT')} className={`px-2 py-1 text-xs ${activeView === 'FRONT' ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:text-white'}`} title="Front View">Front</button></Ripple>
                    <Ripple><button onClick={toggleFullscreen} className="text-slate-400 hover:text-white">{isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}</button></Ripple>
                    <Ripple><button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button></Ripple>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                {/* SVG Visualization */}
                <svg
                    viewBox={viewBox}
                    className="w-full h-full bg-slate-950"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onWheel={handleWheel}
                    onClick={() => {
                        if (!hasDraggedRef.current) {
                            handleClearSelection();
                        }
                    }}
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                >
                    {/* Grid */}
                    <defs>
                        <pattern id="smallGrid" width="10" height="10" patternUnits="userSpaceOnUse">
                            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                        </pattern>
                        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <rect width="100" height="100" fill="url(#smallGrid)" />
                            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e293b" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Bounds Box */}
                    <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY} fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="5,5" />

                    {/* Origin Axes */}
                    <g>
                        {(() => {
                            const axisLength = scaleRef * 0.15;
                            const origin = project(0, 0, 0);
                            const xEnd = project(axisLength, 0, 0);
                            const yEnd = project(0, axisLength, 0);
                            const zEnd = project(0, 0, axisLength);

                            return (
                                <>
                                    {/* X Axis - Red */}
                                    <line x1={origin.x} y1={origin.y} x2={xEnd.x} y2={xEnd.y} stroke="#ef4444" strokeWidth="2" opacity="0.8" />
                                    {/* Y Axis - Green */}
                                    <line x1={origin.x} y1={origin.y} x2={yEnd.x} y2={yEnd.y} stroke="#22c55e" strokeWidth="2" opacity="0.8" />
                                    {/* Z Axis - Blue */}
                                    <line x1={origin.x} y1={origin.y} x2={zEnd.x} y2={zEnd.y} stroke="#3b82f6" strokeWidth="2" opacity="0.8" />
                                    {/* Origin Point */}
                                    <circle cx={origin.x} cy={origin.y} r="3" fill="#fbbf24" stroke="#fff" strokeWidth="1" />
                                </>
                            );
                        })()}
                    </g>

                    {/* G-Code Path */}
                    <g>
                        {segments.map((segment, idx) => {
                            const isSelected = selectedSegmentIndices.includes(idx);
                            const isHighlighted = cursorLineIndex !== null && segment.lineIndex === cursorLineIndex;
                            const p1 = project(segment.x1, segment.y1, segment.z1);
                            const p2 = project(segment.x2, segment.y2, segment.z2);
                            return (
                                <line
                                    key={idx}
                                    x1={p1.x}
                                    y1={p1.y}
                                    x2={p2.x}
                                    y2={p2.y}
                                    stroke={
                                        isHighlighted
                                            ? "#fbbf24" // Yellow for cursor-highlighted
                                            : isSelected
                                                ? "#fbbf24" // Yellow for selected
                                                : segment.type === 'G0'
                                                    ? "#60a5fa" // Blue for G0 moves
                                                    : "#34d399" // Green for G1+ moves
                                    }
                                    strokeWidth={isHighlighted || isSelected ? 3 : 1}
                                    opacity={isHighlighted || isSelected ? 1 : 0.7}
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (e.shiftKey && lastClickedIndex !== null) {
                                            // Range selection
                                            const start = Math.min(lastClickedIndex, idx);
                                            const end = Math.max(lastClickedIndex, idx);
                                            const newSelection = Array.from({ length: end - start + 1 }, (_, i) => start + i);
                                            setSelectedSegmentIndices(prev => Array.from(new Set([...prev, ...newSelection])));
                                        } else if (e.ctrlKey || e.metaKey) {
                                            // Toggle selection
                                            setSelectedSegmentIndices(prev =>
                                                prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
                                            );
                                        } else {
                                            // Single selection
                                            setSelectedSegmentIndices([idx]);
                                            setSelectedLineIndex(segment.lineIndex);
                                        }
                                        setLastClickedIndex(idx);
                                    }}
                                />
                            );
                        })}
                    </g>

                    {/* Simulation Point */}
                    {isSimulating && (
                        <circle cx={simProj.x} cy={simProj.y} r="3" fill="#fbbf24" />
                    )}
                </svg>

                {/* Selection Info Overlay */}
                {(selectedLineIndex !== null || selectedSegmentIndices.length > 0) && (
                    <div className="absolute bottom-4 left-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-300 pl-2">
                            {selectedSegmentIndices.length > 1
                                ? `${selectedSegmentIndices.length} Segments Selected`
                                : selectedLineIndex !== null
                                    ? `Line ${selectedLineIndex + 1} Selected`
                                    : '1 Segment Selected'}
                        </span>
                        <Ripple><button
                            onClick={handleDeleteSegments}
                            className="p-1 bg-red-600 hover:bg-red-500 rounded-full text-white"
                            title="Delete Segment"
                        >
                            <Trash2 size={14} className="pointer-events-none" />
                        </button></Ripple>
                        <Ripple><button
                            onClick={handleClearSelection}
                            className="p-1 bg-slate-600 hover:bg-slate-500 rounded-full text-white ml-2"
                            title="Clear Selection"
                        >
                            <X size={14} className="pointer-events-none" />
                        </button></Ripple>
                    </div>
                )}
            </div>

            {/* G-Code Accordion Section */}
            <div className="bg-slate-900 border-t border-slate-800 shrink-0">
                <Ripple>
                    <button
                        onClick={() => setIsGCodeExpanded(!isGCodeExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer"
                        aria-expanded={isGCodeExpanded}
                        aria-controls="gcode-accordion-content"
                    >
                        <h3 className="text-sm font-semibold text-slate-300 uppercase flex items-center gap-2">
                            {isGCodeExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            G-Code Editor
                        </h3>
                        {isManualMode && (
                            <span className="text-xs text-yellow-500 bg-yellow-900/20 px-2 py-1 rounded">Manual Mode</span>
                        )}
                    </button>
                </Ripple>
                <div
                    id="gcode-accordion-content"
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                        maxHeight: isGCodeExpanded ? '1000px' : '0px'
                    }}
                >
                    <div className="border-t border-slate-800">
                        <CodeEditor
                            code={gcode}
                            onChange={onUpdateGCode}
                            onRegenerate={onRegenerate || (() => { })}
                            isManualMode={isManualMode || false}
                            generateOnlySelected={generateOnlySelected}
                            onToggleGenerateOnlySelected={onToggleGenerateOnlySelected}
                            onCursorPositionChange={handleCursorPositionChange}
                        />
                    </div>
                </div>
            </div>

            {/* Job Control Accordion */}
            <div className="bg-slate-900 border-t border-slate-800 shrink-0">
                <Ripple>
                    <button
                        onClick={() => setIsJobControlExpanded(!isJobControlExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors cursor-pointer"
                        aria-expanded={isJobControlExpanded}
                        aria-controls="job-control-accordion-content"
                    >
                        <h3 className="text-sm font-semibold text-slate-300 uppercase flex items-center gap-2">
                            {isJobControlExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            Machine Job Control
                        </h3>
                        {jobTotal > 0 && (
                            <span className="text-xs text-sky-400">{Math.round((jobProgress / jobTotal) * 100)}%</span>
                        )}
                    </button>
                </Ripple>
                <div
                    id="job-control-accordion-content"
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                        maxHeight: isJobControlExpanded ? '200px' : '0px'
                    }}
                >
                    <div className="border-t border-slate-800 p-4">
                        {jobTotal > 0 && (
                            <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
                                <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(jobProgress / jobTotal) * 100}%` }}></div>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Ripple disabled={!gcode || !isConnected || isJobRunning}>
                                <button
                                    onClick={handleRunJob}
                                    disabled={!gcode || !isConnected || isJobRunning}
                                    className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2 text-white font-medium"
                                >
                                    <Play size={16} /> Run on Machine
                                </button>
                            </Ripple>
                            <Ripple disabled={!isConnected || !isJobRunning}>
                                <button
                                    onClick={handlePauseJob}
                                    disabled={!isConnected || !isJobRunning}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-white"
                                >
                                    <Pause size={16} />
                                </button>
                            </Ripple>
                            <Ripple disabled={!isConnected || (!isJobRunning && jobProgress === 0)}>
                                <button
                                    onClick={handleStopJob}
                                    disabled={!isConnected || (!isJobRunning && jobProgress === 0)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-white"
                                >
                                    <Square size={16} />
                                </button>
                            </Ripple>
                        </div>
                        {!isConnected && <div className="text-center text-xs text-red-400 mt-2">Machine Disconnected</div>}
                    </div>
                </div>
            </div>

            {/* Simulation Controls Accordion */}
            <div className="bg-slate-800 border-t border-slate-700 shrink-0 z-20">
                <Ripple>
                    <button
                        onClick={() => setIsSimulationExpanded(!isSimulationExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/50 transition-colors cursor-pointer"
                        aria-expanded={isSimulationExpanded}
                        aria-controls="simulation-accordion-content"
                    >
                        <h3 className="text-sm font-semibold text-slate-300 uppercase flex items-center gap-2">
                            {isSimulationExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            Simulation Controls
                        </h3>
                    </button>
                </Ripple>
                <div
                    id="simulation-accordion-content"
                    className="overflow-hidden transition-all duration-300 ease-in-out"
                    style={{
                        maxHeight: isSimulationExpanded ? '200px' : '0px'
                    }}
                >
                    <div className="border-t border-slate-700 p-2 flex items-center gap-4 px-4">
                        <Ripple>
                            <button
                                onClick={handleToggleSimulation}
                                className={`p-2 rounded-full ${isSimulating ? 'bg-yellow-600 text-white' : 'bg-sky-600 text-white'} hover:opacity-90`}
                            >
                                {isSimulating ? <Pause size={16} /> : <Play size={16} />}
                            </button>
                        </Ripple>
                        <Ripple>
                            <button onClick={handleSimStop} className="p-2 text-slate-400 hover:text-white">
                                <Square size={16} />
                            </button>
                        </Ripple>

                        <div className="flex-1 flex flex-col gap-1">
                            <div className="flex justify-between text-xs text-slate-400">
                                <span>Simulation Progress</span>
                                <span>{Math.round(simProgress * 100)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0" max="1" step="0.001"
                                value={simProgress}
                                onChange={(e) => {
                                    setSimProgress(parseFloat(e.target.value));
                                    setIsSimulating(false);
                                }}
                                className="w-full accent-sky-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">Speed:</span>
                            <select
                                value={simSpeed}
                                onChange={(e) => setSimSpeed(parseFloat(e.target.value))}
                                className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded px-1 py-1"
                            >
                                <option value="0.5">0.5x</option>
                                <option value="1">1x</option>
                                <option value="2">2x</option>
                                <option value="5">5x</option>
                                <option value="10">10x</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return content;
};

export default SimulatorPanel;
