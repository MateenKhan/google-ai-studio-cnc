
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Play, X, Rotate3d, Square, ZoomIn, ZoomOut, Move, Trash2, Pause, Maximize2, Minimize2, ChevronDown, ChevronRight, Expand, Shrink, Edit3, Check, Bookmark, ArrowUp, ArrowDown, Undo2, Redo2 } from 'lucide-react';
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
    onUndo?: () => void;
    onRedo?: () => void;
}

const SimulatorPanel: React.FC<SimulatorPanelProps> = ({
    gcode,
    onUpdateGCode,
    onClose,
    machineStatus,
    isConnected,
    isManualMode,
    onRegenerate,
    generateOnlySelected,
    onToggleGenerateOnlySelected,
    onUndo,
    onRedo
}) => {
    const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');
    const [isTopView, setIsTopView] = useState(false);
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

    // Path Points - New state for showing points on selected paths
    const [pathPoints, setPathPoints] = useState<{ x: number, y: number, z: number, segmentIndex: number, pointType: 'start' | 'end' }[]>([]);

    // Shape Editing
    const [isEditingShape, setIsEditingShape] = useState(false);
    const [editablePoints, setEditablePoints] = useState<{ x: number, y: number, z: number, segmentIndex: number, pointIndex: number }[]>([]);
    const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
    const [isDraggingPoint, setIsDraggingPoint] = useState(false);
    const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
    const [dragStartPoint, setDragStartPoint] = useState({ x: 0, y: 0, z: 0 });

    // Point Selection Enhancement
    const [selectedPoints, setSelectedPoints] = useState<number[]>([]); // For multiple point selection
    const [storedPoints, setStoredPoints] = useState<{ x: number, y: number, z: number, segmentIndex: number, pointIndex: number }[]>([]); // Stored points for later use

    // Tool Raise/Lower Points for Deletion
    const [raisePoint, setRaisePoint] = useState<{ x: number, y: number, z: number } | null>(null);
    const [lowerPoint, setLowerPoint] = useState<{ x: number, y: number, z: number } | null>(null);
    const [isSettingRaisePoint, setIsSettingRaisePoint] = useState(false);
    const [isSettingLowerPoint, setIsSettingLowerPoint] = useState(false);

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

    const toggleTopView = () => {
        setIsTopView(!isTopView);
        // When entering top view, set rotation to look directly down
        if (!isTopView) {
            setRotation({ x: 90, z: 0 });
        }
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
        if (isTopView) {
            return { x: cx, y: -cy };
        }

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

    const simPoint = getPointAtProgress(simProgress);
    const simProj = project(simPoint.x, simPoint.y, simPoint.z);

    const scaleRef = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 100;
    // ViewBox: centered 0,0 with dynamic size
    const vbSize = scaleRef * 1.5;
    const viewBox = `${-vbSize / 2} ${-vbSize / 2} ${vbSize} ${vbSize}`;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (isSettingRaisePoint || isSettingLowerPoint) return;

        const isLineElement = e.target instanceof SVGElement && e.target.tagName === 'line';
        if (isFullscreen && isLineElement) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        isDraggingRef.current = true;
        hasDraggedRef.current = false;
        lastMousePosRef.current = { x: e.clientX, y: e.clientY };

        if (e.button === 2 || e.button === 1) {
            dragModeRef.current = 'PAN';
        } else {
            dragModeRef.current = viewMode === '3D' ? 'ROTATE' : 'PAN';
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        e.preventDefault();
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

        // Enter raise point selection mode
        setIsSettingRaisePoint(true);
    };

    // Function to set raise point and proceed to lower point selection
    const setToolRaisePoint = (point: { x: number, y: number, z: number }) => {
        setRaisePoint(point);
        setIsSettingRaisePoint(false);
        setIsSettingLowerPoint(true);
    };

    // Function to set lower point and perform deletion
    const setToolLowerPoint = (point: { x: number, y: number, z: number }) => {
        setLowerPoint(point);
        setIsSettingLowerPoint(false);
        performDeletionWithToolAdjustment();
    };

    // Perform the actual deletion with tool raise/lower adjustments
    const performDeletionWithToolAdjustment = () => {
        if (!raisePoint || !lowerPoint) {
            console.log('DEBUG: Missing raise or lower point');
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

        // Sort lines to delete in descending order to maintain indices
        const sortedIndices = Array.from(linesToDelete).sort((a, b) => b - a);

        // Remove lines in reverse order to maintain indices
        sortedIndices.forEach(idx => {
            if (idx < lines.length) {
                lines.splice(idx, 1);
            }
        });

        // Find the insertion point (first deleted line index)
        const firstDeletedIndex = sortedIndices.length > 0 ? Math.min(...sortedIndices) : lines.length;

        // Insert tool raise/lower commands at the appropriate position
        if (firstDeletedIndex <= lines.length) {
            // Insert G0 Z5 (raise tool)
            lines.splice(firstDeletedIndex, 0, 'G0 Z5');

            // Insert G0 Y{raisePoint.y} (move to raise point)
            lines.splice(firstDeletedIndex + 1, 0, `G0 Y${raisePoint.y.toFixed(3)}`);

            // Insert G0 Y{lowerPoint.y} (move to lower point)
            lines.splice(firstDeletedIndex + 2, 0, `G0 Y${lowerPoint.y.toFixed(3)}`);

            // Insert G1 Z-2 (lower tool)
            lines.splice(firstDeletedIndex + 3, 0, 'G1 Z-2');
        }

        onUpdateGCode(lines.join('\n'));
        setSelectedLineIndex(null);
        setSelectedSegmentIndices([]);

        // Clear raise/lower points
        setRaisePoint(null);
        setLowerPoint(null);
    };

    const handleClearSelection = () => {
        setSelectedLineIndex(null);
        setSelectedSegmentIndices([]);
        setIsEditingShape(false);
        setEditablePoints([]);
        setSelectedPointIndex(null);
        setSelectedPoints([]);
        setStoredPoints([]);
        setPathPoints([]); // Clear path points
    };

    // Toggle point selection (for multiple selection)
    const togglePointSelection = (pointIndex: number) => {
        setSelectedPoints(prev => {
            if (prev.includes(pointIndex)) {
                return prev.filter(idx => idx !== pointIndex);
            } else {
                return [...prev, pointIndex];
            }
        });
    };

    // Store selected points for later use
    const storeSelectedPoints = () => {
        if (selectedPoints.length > 0) {
            const pointsToStore = selectedPoints.map(idx => editablePoints[idx]);
            setStoredPoints(pointsToStore);
        }
    };

    // Clear stored points
    const clearStoredPoints = () => {
        setStoredPoints([]);
    };

    // Insert tool raising at selected points
    const insertToolRaisingAtPoints = () => {
        console.log('Inserting tool raising at points:', storedPoints);
        if (storedPoints.length === 0) return;

        // Convert current G-code to lines
        const lines = gcode.split('\n');
        console.log('Original lines count:', lines.length);

        // Sort stored points by line index to process in order
        const sortedPoints = [...storedPoints].sort((a, b) => {
            const lineA = segments[a.segmentIndex]?.lineIndex || 0;
            const lineB = segments[b.segmentIndex]?.lineIndex || 0;
            return lineA - lineB;
        });

        // Keep track of inserted lines to adjust indices
        let insertedLines = 0;

        // Process each stored point
        sortedPoints.forEach(point => {
            const segment = segments[point.segmentIndex];
            if (!segment) return;

            const lineIndex = segment.lineIndex + insertedLines;
            console.log(`Inserting G0 Z0 at line index: ${lineIndex}`);

            // Insert "G0 Z0" before the line
            if (lineIndex >= 0 && lineIndex <= lines.length) {
                lines.splice(lineIndex, 0, 'G0 Z0');
                insertedLines++; // Adjust for the newly inserted line
                console.log(`Inserted G0 Z0 at line ${lineIndex}`);
            }
        });

        console.log('New lines count:', lines.length);
        console.log('New G-code:', lines.join('\n'));

        // Update the G-code
        onUpdateGCode(lines.join('\n'));

        // Clear stored points after insertion
        setStoredPoints([]);
    };

    // Insert tool lowering at selected points
    const insertToolLoweringAtPoints = () => {
        console.log('Inserting tool lowering at points:', storedPoints);
        if (storedPoints.length === 0) return;

        // Convert current G-code to lines
        const lines = gcode.split('\n');
        console.log('Original lines count:', lines.length);

        // Sort stored points by line index to process in order
        const sortedPoints = [...storedPoints].sort((a, b) => {
            const lineA = segments[a.segmentIndex]?.lineIndex || 0;
            const lineB = segments[b.segmentIndex]?.lineIndex || 0;
            return lineA - lineB;
        });

        // Keep track of inserted lines to adjust indices
        let insertedLines = 0;

        // Process each stored point
        sortedPoints.forEach(point => {
            const segment = segments[point.segmentIndex];
            if (!segment) return;

            const lineIndex = segment.lineIndex + insertedLines;
            console.log(`Inserting G0 Z-5 at line index: ${lineIndex}`);

            // Insert "G0 Z-5" before the line (assuming Z=-5 as a typical cutting depth)
            if (lineIndex >= 0 && lineIndex <= lines.length) {
                lines.splice(lineIndex, 0, 'G0 Z-5');
                insertedLines++; // Adjust for the newly inserted line
                console.log(`Inserted G0 Z-5 at line ${lineIndex}`);
            }
        });

        console.log('New lines count:', lines.length);
        console.log('New G-code:', lines.join('\n'));

        // Update the G-code
        onUpdateGCode(lines.join('\n'));

        // Clear stored points after insertion
        setStoredPoints([]);
    };

    // Convert selected shape to editable points
    const handleConvertToEditableShape = () => {
        if (selectedSegmentIndices.length === 0) return;

        // Get unique line indices from selected segments
        const lineIndices = Array.from(new Set(selectedSegmentIndices.map(idx => segments[idx].lineIndex)));

        // Collect all points from selected segments
        const points: { x: number, y: number, z: number, segmentIndex: number, pointIndex: number }[] = [];

        selectedSegmentIndices.forEach(segmentIndex => {
            const segment = segments[segmentIndex];
            // Add start point (avoiding duplicates)
            if (points.length === 0 ||
                points[points.length - 1].x !== segment.x1 ||
                points[points.length - 1].y !== segment.y1 ||
                points[points.length - 1].z !== segment.z1) {
                points.push({
                    x: segment.x1,
                    y: segment.y1,
                    z: segment.z1,
                    segmentIndex: segmentIndex,
                    pointIndex: 0
                });
            }

            // Add end point
            points.push({
                x: segment.x2,
                y: segment.y2,
                z: segment.z2,
                segmentIndex: segmentIndex,
                pointIndex: 1
            });
        });

        setEditablePoints(points);
        setIsEditingShape(true);
    };

    // Update point position
    const handleUpdatePoint = (pointIndex: number, newX: number, newY: number, newZ: number) => {
        setEditablePoints(prev => {
            const newPoints = [...prev];
            if (newPoints[pointIndex]) {
                newPoints[pointIndex] = {
                    ...newPoints[pointIndex],
                    x: newX,
                    y: newY,
                    z: newZ
                };
            }
            return newPoints;
        });
    };

    // Apply shape edits to G-code
    const handleApplyShapeEdits = () => {
        if (!isEditingShape || editablePoints.length === 0) return;

        // Convert current G-code to lines
        const lines = gcode.split('\n');

        // For each editable point, update the corresponding G-code line
        editablePoints.forEach(point => {
            const segment = segments[point.segmentIndex];
            const lineIndex = segment.lineIndex;

            if (lineIndex < lines.length) {
                const line = lines[lineIndex];
                // Update coordinates in the line
                let updatedLine = line;

                // Replace X coordinate
                if (point.pointIndex === 0) {
                    // This is a start point, we need to update the previous line that leads to this point
                    // For simplicity, we'll update this line's coordinates
                    updatedLine = updatedLine.replace(/X[\d\.-]+/, `X${point.x.toFixed(3)}`);
                } else {
                    // This is an end point, update this line
                    updatedLine = updatedLine.replace(/X[\d\.-]+/, `X${point.x.toFixed(3)}`);
                }

                // Replace Y coordinate
                updatedLine = updatedLine.replace(/Y[\d\.-]+/, `Y${point.y.toFixed(3)}`);

                // Replace Z coordinate
                updatedLine = updatedLine.replace(/Z[\d\.-]+/, `Z${point.z.toFixed(3)}`);

                lines[lineIndex] = updatedLine;
            }
        });

        // Update the G-code
        onUpdateGCode(lines.join('\n'));

        // Exit editing mode
        setIsEditingShape(false);
        setEditablePoints([]);
        setSelectedPointIndex(null);
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

    // Update path points based on selected segments
    const updatePathPoints = (segmentIndices: number[]) => {
        const points: { x: number, y: number, z: number, segmentIndex: number, pointType: 'start' | 'end' }[] = [];

        // Collect all points from selected segments
        segmentIndices.forEach(segmentIndex => {
            if (segmentIndex < segments.length) {
                const segment = segments[segmentIndex];

                // Add start point
                points.push({
                    x: segment.x1,
                    y: segment.y1,
                    z: segment.z1,
                    segmentIndex: segmentIndex,
                    pointType: 'start'
                });

                // Add end point
                points.push({
                    x: segment.x2,
                    y: segment.y2,
                    z: segment.z2,
                    segmentIndex: segmentIndex,
                    pointType: 'end'
                });
            }
        });

        setPathPoints(points);
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
                    {onUndo && <Ripple><button onClick={onUndo} className="text-slate-400 hover:text-white" title="Undo (Ctrl+Z)"><Undo2 size={18} /></button></Ripple>}
                    {onRedo && <Ripple><button onClick={onRedo} className="text-slate-400 hover:text-white" title="Redo (Ctrl+Y)"><Redo2 size={18} /></button></Ripple>}
                    <div className="w-px h-4 bg-slate-700 mx-1 self-center" />
                    <Ripple><button onClick={toggleTopView} className={`p-1 ${isTopView ? 'text-sky-400 bg-sky-900/30' : 'text-slate-400 hover:text-white'}`} title="Toggle Top View">2D</button></Ripple>
                    <Ripple><button onClick={toggleFullscreen} className="text-slate-400 hover:text-white">{isFullscreen ? <Shrink size={18} /> : <Expand size={18} />}</button></Ripple>
                    <Ripple><button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button></Ripple>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden relative">
                {/* Notification Overlay */}
                {(isSettingRaisePoint || isSettingLowerPoint) && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span className="font-medium">
                            {isSettingRaisePoint
                                ? "Select point to RAISE tool"
                                : "Select point to LOWER tool"}
                        </span>
                    </div>
                )}

                {/* SVG Visualization */}
                <svg
                    viewBox={viewBox}
                    className="w-full h-full bg-slate-950"
                    onPointerDown={handlePointerDown}
                    onPointerMove={(e) => {
                        // Handle point dragging
                        if (isDraggingPoint && selectedPointIndex !== null) {
                            const deltaX = (e.clientX - dragStartPos.x) / zoom;
                            const deltaY = (e.clientY - dragStartPos.y) / zoom;

                            // Convert screen delta to world coordinates
                            // This is a simplified approach - in a real implementation you'd need to account for projection
                            const newX = dragStartPoint.x + deltaX;
                            const newY = dragStartPoint.y - deltaY; // Invert Y axis

                            handleUpdatePoint(selectedPointIndex, newX, newY, dragStartPoint.z);
                        }

                        // Handle regular pointer move
                        handlePointerMove(e);
                    }}
                    onPointerUp={(e) => {
                        // End point dragging
                        if (isDraggingPoint) {
                            setIsDraggingPoint(false);
                        }

                        // Handle regular pointer up
                        handlePointerUp(e);
                    }}
                    onWheel={handleWheel}
                    onClick={(e) => {
                        // Only clear selection if clicking on the SVG background (not on a point or segment)
                        if (e.target === e.currentTarget) {
                            if (!hasDraggedRef.current) {
                                handleClearSelection();
                            }
                        }
                    }}
                    style={{ transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)` }}
                >
                    {/* Grid */}
                    <defs>
                        <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                            <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#1e293b" strokeWidth={1 / zoom} />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Bounds Box */}
                    <rect x={bounds.minX} y={bounds.minY} width={bounds.maxX - bounds.minX} height={bounds.maxY - bounds.minY} fill="none" stroke="#64748b" strokeWidth="0.5" strokeDasharray="5,5" />

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

                                            // Update path points for the newly selected segments
                                            updatePathPoints([...selectedSegmentIndices, ...newSelection]);
                                        } else if (e.ctrlKey || e.metaKey) {
                                            // Toggle selection
                                            const newSelection = selectedSegmentIndices.includes(idx)
                                                ? selectedSegmentIndices.filter(i => i !== idx)
                                                : [...selectedSegmentIndices, idx];
                                            setSelectedSegmentIndices(newSelection);

                                            // Update path points based on current selection
                                            updatePathPoints(newSelection);
                                        } else {
                                            // Single selection
                                            setSelectedSegmentIndices([idx]);
                                            setSelectedLineIndex(segment.lineIndex);

                                            // Update path points for the newly selected segment
                                            updatePathPoints([idx]);
                                        }
                                        setLastClickedIndex(idx);
                                    }}
                                />
                            );
                        })}

                        {/* Editable Points */}
                        {isEditingShape && editablePoints.map((point, idx) => {
                            const projected = project(point.x, point.y, point.z);
                            const isSelected = selectedPointIndex === idx;
                            const isMultiSelected = selectedPoints.includes(idx);
                            const isStored = storedPoints.some(storedPoint =>
                                storedPoint.segmentIndex === point.segmentIndex &&
                                storedPoint.pointIndex === point.pointIndex
                            );

                            return (
                                <circle
                                    key={idx}
                                    cx={projected.x}
                                    cy={projected.y}
                                    r={isSelected ? 6 : isMultiSelected ? 5 : isStored ? 4 : 4}
                                    fill={
                                        isSelected ? "#fbbf24" : // Yellow for single selected
                                            isMultiSelected ? "#3b82f6" : // Blue for multi-selected
                                                isStored ? "#10b981" : // Green for stored points
                                                    isSettingRaisePoint ? "#fbbf24" : // Yellow when setting raise point
                                                        isSettingLowerPoint ? "#8b5cf6" : // Purple when setting lower point
                                                            "#ef4444" // Red for regular editable points
                                    }
                                    stroke="#ffffff"
                                    strokeWidth={isSelected || isMultiSelected ? 2 : 1}
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Stop event propagation
                                        e.preventDefault(); // Prevent default behavior

                                        // Handle special modes (setting raise/lower points during deletion)
                                        if (isSettingRaisePoint) {
                                            setToolRaisePoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        if (isSettingLowerPoint) {
                                            setToolLowerPoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        // Handle point selection for editing
                                        if (e.ctrlKey || e.metaKey) {
                                            togglePointSelection(idx);
                                        } else {
                                            // Single selection
                                            setSelectedPointIndex(idx);
                                            setIsDraggingPoint(true);
                                            setDragStartPos({ x: e.clientX, y: e.clientY });
                                            setDragStartPoint({ x: point.x, y: point.y, z: point.z });
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation(); // Stop event propagation
                                        e.preventDefault(); // Prevent default behavior

                                        // Handle special modes (setting raise/lower points during deletion)
                                        if (isSettingRaisePoint) {
                                            setToolRaisePoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        if (isSettingLowerPoint) {
                                            setToolLowerPoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        // Handle Ctrl/Cmd click for multiple selection
                                        if (e.ctrlKey || e.metaKey) {
                                            togglePointSelection(idx);
                                        } else {
                                            // Single selection
                                            setSelectedPointIndex(idx);
                                            setIsDraggingPoint(true);
                                            setDragStartPos({ x: e.clientX, y: e.clientY });
                                            setDragStartPoint({ x: point.x, y: point.y, z: point.z });
                                        }
                                    }}
                                />
                            );
                        })}

                        {/* Path Points - Visible when segments are selected */}
                        {pathPoints.map((point, idx) => {
                            const projected = project(point.x, point.y, point.z);
                            const isSelected = selectedPoints.includes(idx);
                            const isStored = storedPoints.some(storedPoint =>
                                storedPoint.segmentIndex === point.segmentIndex &&
                                storedPoint.pointIndex === 0 // Assuming point index 0 for path points
                            );

                            return (
                                <circle
                                    key={`path-${idx}`}
                                    cx={projected.x}
                                    cy={projected.y}
                                    r={isSelected ? 5 : isStored ? 4 : 3}
                                    fill={
                                        isSelected ? "#3b82f6" : // Blue for selected
                                            isStored ? "#10b981" : // Green for stored points
                                                isSettingRaisePoint ? "#fbbf24" : // Yellow when setting raise point
                                                    isSettingLowerPoint ? "#8b5cf6" : // Purple when setting lower point
                                                        "#60a5fa" // Light blue for regular path points
                                    }
                                    stroke="#ffffff"
                                    strokeWidth={isSelected ? 2 : 1}
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation(); // Stop event propagation
                                        e.preventDefault(); // Prevent default behavior

                                        // Handle special modes (setting raise/lower points during deletion)
                                        if (isSettingRaisePoint) {
                                            setToolRaisePoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        if (isSettingLowerPoint) {
                                            setToolLowerPoint({ x: point.x, y: point.y, z: point.z });
                                            return;
                                        }

                                        // Handle regular point selection
                                        if (e.ctrlKey || e.metaKey) {
                                            // Toggle selection
                                            if (selectedPoints.includes(idx)) {
                                                setSelectedPoints(prev => prev.filter(i => i !== idx));
                                            } else {
                                                setSelectedPoints(prev => [...prev, idx]);
                                            }
                                        } else {
                                            // Single selection
                                            setSelectedPoints([idx]);
                                        }

                                        // Also select the segment this point belongs to
                                        if (!selectedSegmentIndices.includes(point.segmentIndex)) {
                                            setSelectedSegmentIndices(prev => [...prev, point.segmentIndex]);
                                        }
                                    }}
                                    onMouseDown={(e) => {
                                        e.stopPropagation(); // Stop event propagation
                                        e.preventDefault(); // Prevent default behavior
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
                {(selectedLineIndex !== null || selectedSegmentIndices.length > 0 || isEditingShape || isSettingRaisePoint || isSettingLowerPoint) && (
                    <div className="absolute bottom-4 left-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-3 border border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-300 pl-2">
                            {isSettingRaisePoint
                                ? "Click on a point to set the tool raise position"
                                : isSettingLowerPoint
                                    ? "Click on a point to set the tool lower position"
                                    : isEditingShape
                                        ? `${editablePoints.length} Editable Points (${selectedPoints.length} selected, ${storedPoints.length} stored)`
                                        : selectedSegmentIndices.length > 1
                                            ? `${selectedSegmentIndices.length} Segments Selected`
                                            : selectedLineIndex !== null
                                                ? `Line ${selectedLineIndex + 1} Selected`
                                                : '1 Segment Selected'}
                        </span>
                        <div className="flex items-center">
                            {isSettingRaisePoint || isSettingLowerPoint ? (
                                <Ripple><button
                                    onClick={() => {
                                        setIsSettingRaisePoint(false);
                                        setIsSettingLowerPoint(false);
                                        setRaisePoint(null);
                                        setLowerPoint(null);
                                        alert("Deletion cancelled.");
                                    }}
                                    className="p-1 bg-red-600 hover:bg-red-500 rounded-full text-white"
                                    title="Cancel Deletion"
                                >
                                    <X size={14} className="pointer-events-none" />
                                </button></Ripple>
                            ) : !isEditingShape ? (
                                <>
                                    <Ripple><button
                                        onClick={handleConvertToEditableShape}
                                        className="p-1 bg-blue-600 hover:bg-blue-500 rounded-full text-white mr-2"
                                        title="Edit Shape"
                                    >
                                        <Edit3 size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={handleDeleteSegments}
                                        className="p-1 bg-red-600 hover:bg-red-500 rounded-full text-white"
                                        title="Delete Segment"
                                    >
                                        <Trash2 size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                </>
                            ) : (
                                <>
                                    <Ripple><button
                                        onClick={storeSelectedPoints}
                                        disabled={selectedPoints.length === 0}
                                        className={`p-1 rounded-full text-white mr-2 ${selectedPoints.length > 0 ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                        title="Store Selected Points"
                                    >
                                        <Bookmark size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={insertToolRaisingAtPoints}
                                        disabled={storedPoints.length === 0}
                                        className={`p-1 rounded-full text-white mr-2 ${storedPoints.length > 0 ? 'bg-purple-600 hover:bg-purple-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                        title="Insert Tool Raising at Stored Points"
                                    >
                                        <ArrowUp size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={insertToolLoweringAtPoints}
                                        disabled={storedPoints.length === 0}
                                        className={`p-1 rounded-full text-white mr-2 ${storedPoints.length > 0 ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                        title="Insert Tool Lowering at Stored Points"
                                    >
                                        <ArrowDown size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={clearStoredPoints}
                                        disabled={storedPoints.length === 0}
                                        className={`p-1 rounded-full text-white mr-2 ${storedPoints.length > 0 ? 'bg-orange-600 hover:bg-orange-500' : 'bg-slate-600 cursor-not-allowed'}`}
                                        title="Clear Stored Points"
                                    >
                                        <Trash2 size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={handleApplyShapeEdits}
                                        className="p-1 bg-green-600 hover:bg-green-500 rounded-full text-white mr-2"
                                        title="Apply Edits"
                                    >
                                        <Check size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                    <Ripple><button
                                        onClick={handleClearSelection}
                                        className="p-1 bg-slate-600 hover:bg-slate-500 rounded-full text-white"
                                        title="Cancel Editing"
                                    >
                                        <X size={14} className="pointer-events-none" />
                                    </button></Ripple>
                                </>
                            )}
                        </div>
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
