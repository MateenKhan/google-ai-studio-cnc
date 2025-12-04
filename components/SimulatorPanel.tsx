
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Play, X, Rotate3d, Square, ZoomIn, ZoomOut, Move, Trash2, Pause } from 'lucide-react';
import { calculateGCodeBounds } from '../utils';
import { MachineStatus } from '../types';
import { serialService } from '../services/serialService';

interface SimulatorPanelProps {
    gcode: string;
    onUpdateGCode: (code: string) => void;
    onClose: () => void;
    machineStatus: MachineStatus;
    isConnected: boolean;
}

const SimulatorPanel: React.FC<SimulatorPanelProps> = ({ gcode, onUpdateGCode, onClose, machineStatus, isConnected }) => {
    const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [rotation, setRotation] = useState({ x: 60, z: 45 }); // Degrees

    // Selection
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);

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
    const isDraggingRef = useRef(false);
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

    const simPoint = getPointAtProgress(simProgress);
    const simProj = project(simPoint.x, simPoint.y, simPoint.z);

    // 3D Projection Helper
    function project(x: number, y: number, z: number) {
        // Center points first
        const cx = x - centerOfBounds.x;
        const cy = y - centerOfBounds.y;
        const cz = z - centerOfBounds.z;

        if (viewMode === '2D') {
            return { x: cx, y: -cy };
        }

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

    const scaleRef = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 100;
    // ViewBox: centered 0,0 with dynamic size
    const vbSize = scaleRef * 1.5;
    const viewBox = `${-vbSize / 2} ${-vbSize / 2} ${vbSize} ${vbSize}`;

    // Interactive Controls
    const handlePointerDown = (e: React.PointerEvent) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };
        if (e.button === 2 || e.button === 1) {
            dragModeRef.current = 'PAN';
        } else {
            dragModeRef.current = viewMode === '3D' ? 'ROTATE' : 'PAN';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        const dx = e.clientX - lastMousePosRef.current.x;
        const dy = e.clientY - lastMousePosRef.current.y;
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
        isDraggingRef.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const handleWheel = (e: React.WheelEvent) => {
        const zoomFactor = 1.1;
        setZoom(z => e.deltaY > 0 ? z / zoomFactor : z * zoomFactor);
    };

    const handleDeleteSegment = () => {
        if (selectedLineIndex !== null) {
            const lines = gcode.split('\n');
            // Remove the line. Note: this might break context if it's modal, but for simple G-code editors it's usually fine.
            lines.splice(selectedLineIndex, 1);
            onUpdateGCode(lines.join('\n'));
            setSelectedLineIndex(null);
        }
    };

    // Keyboard delete support
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedLineIndex !== null) handleDeleteSegment();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedLineIndex, gcode]);

    // Job Handlers
    const handleRunJob = () => {
        if (!gcode) return;
        setIsJobRunning(true);
        serialService.startJob(gcode, (curr, total) => {
            setJobProgress(curr);
            setJobTotal(total);
            if (curr >= total) setIsJobRunning(false);
        });
    };

    const handlePauseJob = () => {
        serialService.pauseJob();
    };

    const handleStopJob = () => {
        serialService.stopJob();
        setIsJobRunning(false);
        setJobProgress(0);
    };

    const mProj = project(parseFloat(machineStatus.pos.x), parseFloat(machineStatus.pos.y), parseFloat(machineStatus.pos.z));

    return (
        <div className="flex flex-col h-full bg-slate-900 w-full relative">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800 shrink-0">
                <h2 className="font-bold text-slate-100 flex items-center gap-2">
                    <Play size={18} /> Simulator & Job
                </h2>
                <div className="flex gap-2">
                    <button onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} className="p-1.5 text-slate-400 hover:text-white bg-slate-700 rounded" title="Reset View">
                        <Move size={16} />
                    </button>
                    <button onClick={() => setViewMode(v => v === '3D' ? '2D' : '3D')} className="p-1.5 text-slate-400 hover:text-sky-400 bg-slate-700 rounded" title="Toggle 3D/2D">
                        {viewMode === '3D' ? <Square size={16} /> : <Rotate3d size={16} />}
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
                </div>
            </div>

            <div
                ref={containerRef}
                className={`flex-1 bg-[#111111] relative overflow-hidden flex items-center justify-center cursor-${viewMode === '3D' ? 'move' : 'grab'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onContextMenu={e => e.preventDefault()}
                onWheel={handleWheel}
            >
                <svg
                    viewBox={viewBox}
                    className="w-full h-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <g transform={`scale(${zoom}) translate(${pan.x}, ${pan.y})`}>

                        {/* Axes Origin */}
                        {(() => {
                            const o = project(0, 0, 0);
                            const x = project(20, 0, 0);
                            const y = project(0, 20, 0);
                            const z = project(0, 0, 20);
                            return (
                                <g opacity="0.4" pointerEvents="none">
                                    <line x1={o.x} y1={o.y} x2={x.x} y2={x.y} stroke="#ef4444" strokeWidth="1" />
                                    <line x1={o.x} y1={o.y} x2={y.x} y2={y.y} stroke="#22c55e" strokeWidth="1" />
                                    {viewMode === '3D' && <line x1={o.x} y1={o.y} x2={z.x} y2={z.y} stroke="#3b82f6" strokeWidth="1" />}
                                </g>
                            )
                        })()}

                        {/* Paths */}
                        {segments.map((seg, i) => {
                            const p1 = project(seg.x1, seg.y1, seg.z1);
                            const p2 = project(seg.x2, seg.y2, seg.z2);
                            const isRapid = seg.type === 'G0';
                            const isSelected = selectedLineIndex === seg.lineIndex;
                            return (
                                <line
                                    key={i}
                                    x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                                    stroke={isSelected ? '#facc15' : (isRapid ? '#ef4444' : '#0ea5e9')}
                                    strokeWidth={isSelected ? 3 : (isRapid ? 0.3 : 1)}
                                    strokeDasharray={isRapid ? '1 1' : 'none'}
                                    opacity={isRapid ? 0.4 : 0.9}
                                    vectorEffect="non-scaling-stroke"
                                    onPointerDown={(e) => {
                                        e.stopPropagation();
                                        setSelectedLineIndex(seg.lineIndex);
                                    }}
                                    className="hover:stroke-white cursor-pointer transition-colors"
                                />
                            )
                        })}

                        {/* Virtual Tool Head (Simulation) */}
                        <g transform={`translate(${simProj.x}, ${simProj.y})`}>
                            <circle r="3" fill="#22d3ee" fillOpacity="0.8" stroke="#fff" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        </g>

                        {/* Actual Machine Head */}
                        <g transform={`translate(${mProj.x}, ${mProj.y})`}>
                            <circle r="2" fill="#eab308" fillOpacity="0.5" stroke="#eab308" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
                        </g>
                    </g>
                </svg>

                <div className="absolute bottom-32 left-4 bg-slate-900/80 p-2 rounded border border-slate-700 text-[10px] pointer-events-none select-none">
                    <div className="text-slate-400 mb-1 font-bold">{viewMode} VIEW</div>
                    <div className="flex items-center gap-2 mb-1"><div className="w-3 h-0.5 bg-sky-500"></div> Feed (G1/2/3)</div>
                    <div className="flex items-center gap-2 mb-1"><div className="w-3 h-0.5 bg-red-500 border-dashed border-t border-red-500"></div> Rapid (G0)</div>
                    <div className="text-slate-500 mt-1 italic">Left Drag: Rotate/Pan • Click Path: Select</div>
                </div>

                {selectedLineIndex !== null && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-800 p-2 rounded-full border border-slate-600 shadow-xl z-10">
                        <span className="text-xs text-slate-300 pl-2">Line {selectedLineIndex + 1} Selected</span>
                        <button
                            onClick={handleDeleteSegment}
                            className="p-1 bg-red-600 hover:bg-red-500 rounded-full text-white"
                            title="Delete Segment"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                )}
            </div>

            {/* Simulation Controls */}
            <div className="bg-slate-800 border-t border-slate-700 p-2 shrink-0 z-20 flex items-center gap-4 px-4">
                <button
                    onClick={handleToggleSimulation}
                    className={`p-2 rounded-full ${isSimulating ? 'bg-yellow-600 text-white' : 'bg-sky-600 text-white'} hover:opacity-90`}
                >
                    {isSimulating ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button onClick={handleSimStop} className="p-2 text-slate-400 hover:text-white">
                    <Square size={16} />
                </button>

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

            {/* Job Control Overlay */}
            <div className="bg-slate-900 border-t border-slate-800 p-4 shrink-0 z-20">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase">Machine Job Control</h3>
                    {jobTotal > 0 && (
                        <span className="text-xs text-sky-400">{Math.round((jobProgress / jobTotal) * 100)}%</span>
                    )}
                </div>
                {jobTotal > 0 && (
                    <div className="w-full bg-slate-800 rounded-full h-2 mb-4 overflow-hidden">
                        <div className="bg-green-500 h-full transition-all duration-300" style={{ width: `${(jobProgress / jobTotal) * 100}%` }}></div>
                    </div>
                )}
                <div className="flex gap-2">
                    <button onClick={handleRunJob} disabled={!gcode || !isConnected || isJobRunning} className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center gap-2 text-white font-medium">
                        <Play size={16} /> Run on Machine
                    </button>
                    <button onClick={handlePauseJob} disabled={!isConnected || !isJobRunning} className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-white">
                        <Pause size={16} />
                    </button>
                    <button onClick={handleStopJob} disabled={!isConnected || (!isJobRunning && jobProgress === 0)} className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center justify-center text-white">
                        <Square size={16} />
                    </button>
                </div>
                {!isConnected && <div className="text-center text-xs text-red-400 mt-2">Machine Disconnected</div>}
            </div>
        </div>
    );
};

export default SimulatorPanel;
