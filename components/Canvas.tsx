
import React, { useRef, useState, useEffect } from 'react';
import { Shape, ShapeType, RectangleShape, CircleShape, TextShape, Tool, HeartShape, LineShape, PolylineShape, Unit, MirrorMode, GroupShape } from '../types';
import { Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatUnit } from '../utils';

interface CanvasProps {
    shapes: Shape[];
    activeTool: Tool;
    onUpdateShape: (shape: Shape) => void;
    onUpdateShapes: (shapes: Shape[]) => void;
    onSelectShape: (id: string | null, isMulti: boolean) => void;
    onMultiSelect: (ids: string[], addToExisting: boolean) => void;
    selectedIds: string[];
    onDeleteShapes: (ids: string[]) => void;
    showDimensions: boolean;
    onAddShapeFromPen: (shape: Shape) => void;
    unit: Unit;
    canvasWidth: number;
    canvasHeight: number;
    gridSize: number;
    onShapeChangeStart?: () => void;
    onToggleGroup?: (groupId: string) => void;
}

const Canvas: React.FC<CanvasProps> = ({
    shapes,
    activeTool,
    onUpdateShape,
    onUpdateShapes,
    onSelectShape,
    onMultiSelect,
    selectedIds,
    onDeleteShapes,
    showDimensions,
    onAddShapeFromPen,
    unit,
    canvasWidth,
    canvasHeight,
    gridSize,
    onShapeChangeStart,
    onToggleGroup
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<'SHAPE' | 'PAN' | 'MARQUEE' | 'DRAW' | 'LINE_CREATE' | 'LASSO' | 'POLYGON_SELECT' | 'PATH' | 'FENCE' | null>(null);

    // Panning & Zoom State
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(0.5);
    const panStartRef = useRef<{ x: number, y: number } | null>(null);
    const isCenteredRef = useRef(false);

    // Viewport Size State (instead of window.inner)
    const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setViewportSize({ width, height });
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Center the view on 0,0 on mount
    useEffect(() => {
        if (!isCenteredRef.current && viewportSize.width > 0 && viewportSize.height > 0) {
            const initialZoom = 0.5;
            // Center 0,0 in the screen
            setZoom(initialZoom);
            setPan({
                x: -(viewportSize.width / 2) / initialZoom,
                y: -(viewportSize.height / 2) / initialZoom
            });
            isCenteredRef.current = true;
        }
    }, [viewportSize]);

    // Touch Pinch/Pan State
    const pinchStartDistRef = useRef<number | null>(null);
    const touchStartCenterRef = useRef<{ x: number, y: number } | null>(null);
    const startZoomRef = useRef<number>(1);

    // Marquee State
    const [marquee, setMarquee] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
    const marqueeStartRef = useRef<{ x: number, y: number } | null>(null);

    // Shape Drag State
    const shapeDragStartRef = useRef<{
        startX: number;
        startY: number;
        initialShapes: Map<string, { x: number; y: number }>;
    } | null>(null);

    const [currentPolyline, setCurrentPolyline] = useState<PolylineShape | null>(null);
    const [currentLine, setCurrentLine] = useState<LineShape | null>(null);
    const [snapPoint, setSnapPoint] = useState<{ x: number, y: number } | null>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [lassoPoints, setLassoPoints] = useState<{ x: number, y: number }[]>([]);

    const getSVGPoint = (event: React.PointerEvent | React.TouchEvent | React.WheelEvent | MouseEvent) => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const pt = svg.createSVGPoint();
        if ('touches' in event && event.touches.length > 0) {
            pt.x = event.touches[0].clientX;
            pt.y = event.touches[0].clientY;
        } else if ('clientX' in event) {
            pt.x = (event as React.MouseEvent).clientX;
            pt.y = (event as React.MouseEvent).clientY;
        }
        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    };

    // Refs for event listeners to access current state without re-binding
    const zoomRef = useRef(zoom);
    const panRef = useRef(pan);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        zoomRef.current = zoom;
        panRef.current = pan;
    }, [zoom, pan]);

    useEffect(() => {
        const container = containerRef.current;
        // if (!container) return; // Keep container ref for rect calculation, but don't block listener if null? No, we need it.

        const onWheel = (e: WheelEvent) => {
            console.log('Global wheel event', e.deltaY, e.target);
            // Check if the event target is within the canvas container
            // if (container && container.contains(e.target as Node)) {
            e.preventDefault();
            const currentZoom = zoomRef.current;
            const currentPan = panRef.current;

            const zoomSensitivity = 0.001;
            const zoomFactor = Math.exp(-e.deltaY * zoomSensitivity);
            const newZoom = Math.min(Math.max(currentZoom * zoomFactor, 0.05), 10);

            const rect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const newPanX = currentPan.x + mouseX * (1 / currentZoom - 1 / newZoom);
            const newPanY = currentPan.y + mouseY * (1 / currentZoom - 1 / newZoom);

            setZoom(newZoom);
            setPan({ x: newPanX, y: newPanY });
            // }
        };

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2 && container.contains(e.target as Node)) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                pinchStartDistRef.current = dist;
                touchStartCenterRef.current = {
                    x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                    y: (e.touches[0].clientY + e.touches[1].clientY) / 2
                };
                startZoomRef.current = zoomRef.current;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length === 2 && pinchStartDistRef.current && touchStartCenterRef.current && container.contains(e.target as Node)) {
                e.preventDefault();
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );

                const scale = dist / pinchStartDistRef.current;
                const newZoom = Math.min(Math.max(startZoomRef.current * scale, 0.05), 10);

                const cx = touchStartCenterRef.current.x;
                const cy = touchStartCenterRef.current.y;

                const rect = container.getBoundingClientRect();
                const mouseX = cx - rect.left;
                const mouseY = cy - rect.top;

                const currentZoom = zoomRef.current;
                const currentPan = panRef.current;

                const newPanX = currentPan.x + mouseX * (1 / currentZoom - 1 / newZoom);
                const newPanY = currentPan.y + mouseY * (1 / currentZoom - 1 / newZoom);

                setZoom(newZoom);
                setPan({ x: newPanX, y: newPanY });
            }
        };

        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });

        return () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
        };
    }, []); // Empty dependency array - bind once!

    const findSnapPoint = (x: number, y: number): { x: number, y: number } | null => {
        const SNAP_DIST = 10 / zoom;
        let closest: { x: number, y: number } | null = null;
        let minDst = Infinity;

        const check = (sx: number, sy: number) => {
            const d = Math.hypot(sx - x, sy - y);
            if (d < SNAP_DIST && d < minDst) { minDst = d; closest = { x: sx, y: sy }; }
        };

        const checkShape = (s: Shape) => {
            if (s.type === ShapeType.LINE) {
                const l = s as LineShape;
                check(l.x, l.y); check(l.x2, l.y2);
            } else if (s.type === ShapeType.RECTANGLE) {
                const r = s as RectangleShape;
                check(r.x, r.y); check(r.x + r.width, r.y); check(r.x, r.y + r.height); check(r.x + r.width, r.y + r.height);
            } else if (s.type === ShapeType.GROUP) {
                (s as GroupShape).children.forEach(checkShape);
            }
        };

        shapes.forEach(checkShape);
        return closest;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        console.log('handlePointerDown', e.button, activeTool);
        e.currentTarget.setPointerCapture(e.pointerId);

        // Middle Mouse Button or Pan Tool (Allow Left Click for Pan Tool)
        if (activeTool === Tool.PAN || e.button === 1) {
            setDragMode('PAN');
            setIsDragging(true);
            panStartRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (activeTool === Tool.PEN) {
            onShapeChangeStart?.(); // Save history
            setDragMode('DRAW');
            setIsDragging(true);
            const point = getSVGPoint(e);
            const newShape: PolylineShape = {
                id: uuidv4(),
                type: ShapeType.POLYLINE,
                x: 0, y: 0,
                points: [{ x: point.x, y: point.y }]
            };
            setCurrentPolyline(newShape);
            return;
        }

        if (activeTool === Tool.LINE_CREATE) {
            onShapeChangeStart?.(); // Save history
            setDragMode('LINE_CREATE');
            setIsDragging(true);
            const rawPt = getSVGPoint(e);
            const start = findSnapPoint(rawPt.x, rawPt.y) || rawPt;

            setCurrentLine({
                id: uuidv4(),
                type: ShapeType.LINE,
                x: start.x, y: start.y,
                x2: start.x, y2: start.y
            });
            return;
        }

        if (activeTool === Tool.LASSO) {
            setDragMode('LASSO');
            setIsDragging(true);
            const pt = getSVGPoint(e);
            setLassoPoints([{ x: pt.x, y: pt.y }]);
            return;
        }

        if (activeTool === Tool.POLYGON_SELECT) {
            // If we are already drawing a polygon (dragMode is POLYGON_SELECT), add a point
            // If not, start a new one
            const pt = getSVGPoint(e);

            if (dragMode !== 'POLYGON_SELECT') {
                setDragMode('POLYGON_SELECT');
                setIsDragging(true); // Keep dragging true to capture events? Maybe not needed for click-click
                setLassoPoints([{ x: pt.x, y: pt.y }]); // Start point
            } else {
                // Add point
                setLassoPoints(prev => [...prev, { x: pt.x, y: pt.y }]);
            }
            return;
        }

        if (activeTool === Tool.PATH) {
            const pt = getSVGPoint(e);

            if (dragMode !== 'PATH') {
                onShapeChangeStart?.(); // Save history
                setDragMode('PATH');
                setIsDragging(true);
                const newShape: PolylineShape = {
                    id: uuidv4(),
                    type: ShapeType.POLYLINE,
                    x: 0, y: 0,
                    points: [{ x: pt.x, y: pt.y }]
                };
                setCurrentPolyline(newShape);
            } else {
                setCurrentPolyline(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        points: [...prev.points, { x: pt.x, y: pt.y }]
                    };
                });
            }
            return;
        }

        if (activeTool === Tool.FENCE_SELECT) {
            setDragMode('FENCE');
            setIsDragging(true);
            const pt = getSVGPoint(e);
            setLassoPoints([{ x: pt.x, y: pt.y }]);
            return;
        }

        if (activeTool === Tool.SELECT) {
            setDragMode('MARQUEE');
            setIsDragging(true);
            const point = getSVGPoint(e);
            marqueeStartRef.current = { x: point.x, y: point.y };
            setMarquee({ x: point.x, y: point.y, width: 0, height: 0 });

            if (!e.shiftKey) {
                onSelectShape(null, false);
            }
        }
    };

    const handleShapePointerDown = (e: React.PointerEvent, shape: Shape) => {
        if (activeTool !== Tool.SELECT) return;

        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);

        const isMultiKey = e.shiftKey;
        const isAlreadySelected = selectedIds.includes(shape.id);

        if (isMultiKey) {
            onSelectShape(shape.id, true);
        } else {
            if (!isAlreadySelected) {
                onSelectShape(shape.id, false);
            }
        }

        let idsToDrag = selectedIds;
        if (!isAlreadySelected && !isMultiKey) idsToDrag = [shape.id];
        else if (isMultiKey && !isAlreadySelected) idsToDrag = [...selectedIds, shape.id];

        // START EDIT: Snap history
        onShapeChangeStart?.();

        const point = getSVGPoint(e);
        const initialPosMap = new Map<string, { x: number, y: number }>();

        const recordPos = (s: Shape) => {
            initialPosMap.set(s.id, { x: s.x, y: s.y });
        };

        shapes.forEach(s => {
            if (idsToDrag.includes(s.id)) {
                recordPos(s);
            }
        });

        shapeDragStartRef.current = {
            startX: point.x,
            startY: point.y,
            initialShapes: initialPosMap
        };

        setDragMode('SHAPE');
        setIsDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragMode === 'PAN' && panStartRef.current) {
            const dx = (e.clientX - panStartRef.current.x) / zoom;
            const dy = (e.clientY - panStartRef.current.y) / zoom;
            setPan(prev => ({ x: prev.x - dx, y: prev.y - dy }));
            panStartRef.current = { x: e.clientX, y: e.clientY };
            return;
        }

        if (activeTool === Tool.LINE_CREATE && currentLine) {
            const rawPt = getSVGPoint(e);
            const snap = findSnapPoint(rawPt.x, rawPt.y);
            setSnapPoint(snap);
            const end = snap || rawPt;

            setCurrentLine({
                ...currentLine,
                x2: end.x,
                y2: end.y
            });
            return;
        }

        if (!isDragging) return;
        e.preventDefault();

        if (dragMode === 'MARQUEE' && marqueeStartRef.current) {
            const point = getSVGPoint(e);
            const start = marqueeStartRef.current;
            const x = Math.min(start.x, point.x);
            const y = Math.min(start.y, point.y);
            const width = Math.abs(point.x - start.x);
            const height = Math.abs(point.y - start.y);
            setMarquee({ x, y, width, height });
        }

        if (dragMode === 'LASSO') {
            const pt = getSVGPoint(e);
            setLassoPoints(prev => [...prev, { x: pt.x, y: pt.y }]);
        }

        if (dragMode === 'POLYGON_SELECT') {
            // Optional: Update a "preview" point if we want to show the line being drawn
            // For now, we just rely on clicks, but maybe we want to visualize the next segment?
            // We can use a separate state for "current mouse pos" or just append a temporary point
        }

        if (dragMode === 'PATH' && currentPolyline) {
            // Optional: visual feedback for next segment could go here
        }

        if (dragMode === 'FENCE') {
            const pt = getSVGPoint(e);
            setLassoPoints(prev => [...prev, { x: pt.x, y: pt.y }]);
        }

        if (dragMode === 'SHAPE' && shapeDragStartRef.current) {
            const point = getSVGPoint(e);
            const dx = point.x - shapeDragStartRef.current.startX;
            const dy = point.y - shapeDragStartRef.current.startY;

            const updates: Shape[] = [];
            shapeDragStartRef.current.initialShapes.forEach((initialPos, id) => {
                const shape = shapes.find(s => s.id === id);
                if (shape) {
                    if (shape.type === ShapeType.LINE) {
                        const l = shape as LineShape;
                        const diffX = l.x2 - l.x;
                        const diffY = l.y2 - l.y;
                        const newX = Math.round(initialPos.x + dx);
                        const newY = Math.round(initialPos.y + dy);
                        updates.push({
                            ...shape,
                            x: newX,
                            y: newY,
                            x2: newX + diffX,
                            y2: newY + diffY
                        } as LineShape);
                    } else if (shape.type === ShapeType.POLYLINE) {
                        updates.push({
                            ...shape,
                            x: Math.round(initialPos.x + dx),
                            y: Math.round(initialPos.y + dy)
                        });
                    } else {
                        updates.push({
                            ...shape,
                            x: Math.round(initialPos.x + dx),
                            y: Math.round(initialPos.y + dy)
                        });
                    }
                }
            });

            if (updates.length > 0) {
                onUpdateShapes(updates);
            }
        }

        if (dragMode === 'DRAW' && currentPolyline) {
            const point = getSVGPoint(e);
            setCurrentPolyline(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    points: [...prev.points, { x: point.x, y: point.y }]
                };
            });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (dragMode === 'MARQUEE' && marquee) {
            const ids = checkIntersection(marquee);
            // If Shift is held, add to existing selection, otherwise replace
            onMultiSelect(ids, e.shiftKey);
            setMarquee(null);
        }
        if (dragMode === 'LASSO' && lassoPoints.length > 2) {
            const ids = checkLassoIntersection(lassoPoints);
            onMultiSelect(ids, e.shiftKey);
            setLassoPoints([]);
        } else if (dragMode === 'LASSO') {
            setLassoPoints([]);
        }

        // Polygon is handled by clicks, but we need to detect "finish"
        // For now, let's say double click finishes, or clicking near start
        // We'll handle that in handlePointerDown or a separate handler?
        // Actually, handlePointerUp is for drag end. Polygon is click-click.
        // So we don't clear dragMode here for POLYGON_SELECT unless we are done.
        if (dragMode === 'POLYGON_SELECT') {
            // Do nothing on up, wait for next click
            return;
        }

        if (dragMode === 'FENCE') {
            const ids = checkFenceIntersection(lassoPoints);
            onMultiSelect(ids, e.shiftKey);
            setLassoPoints([]);
            setDragMode(null);
            setIsDragging(false);
            return;
        }

        if (dragMode === 'PATH') {
            return;
        }

        if (dragMode === 'DRAW' && currentPolyline) {
            onAddShapeFromPen(currentPolyline);
            setCurrentPolyline(null);
        }
        if (dragMode === 'LINE_CREATE' && currentLine) {
            if (currentLine.x !== currentLine.x2 || currentLine.y !== currentLine.y2) {
                onAddShapeFromPen(currentLine);
            }
            setCurrentLine(null);
            setSnapPoint(null);
        }
        setIsDragging(false);
        setDragMode(null);
        panStartRef.current = null;
        shapeDragStartRef.current = null;
        marqueeStartRef.current = null;
    };

    const checkLassoIntersection = (points: { x: number, y: number }[]) => {
        const ids: string[] = [];

        // Ray casting algorithm for point in polygon
        const isPointInPolygon = (p: { x: number, y: number }, polygon: { x: number, y: number }[]) => {
            let inside = false;
            for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].x, yi = polygon[i].y;
                const xj = polygon[j].x, yj = polygon[j].y;

                const intersect = ((yi > p.y) !== (yj > p.y))
                    && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        shapes.forEach(shape => {
            // Check if any key point of the shape is inside the lasso
            let isInside = false;

            if (shape.type === ShapeType.RECTANGLE) {
                const s = shape as RectangleShape;
                // Check corners
                const corners = [
                    { x: s.x, y: s.y },
                    { x: s.x + s.width, y: s.y },
                    { x: s.x + s.width, y: s.y + s.height },
                    { x: s.x, y: s.y + s.height }
                ];
                isInside = corners.some(c => isPointInPolygon(c, points));
            } else if (shape.type === ShapeType.CIRCLE) {
                const s = shape as CircleShape;
                // Check center and 4 cardinal points
                const pts = [
                    { x: s.x, y: s.y },
                    { x: s.x + s.radius, y: s.y },
                    { x: s.x - s.radius, y: s.y },
                    { x: s.x, y: s.y + s.radius },
                    { x: s.x, y: s.y - s.radius }
                ];
                isInside = pts.some(p => isPointInPolygon(p, points));
            } else if (shape.type === ShapeType.LINE) {
                const s = shape as LineShape;
                isInside = isPointInPolygon({ x: s.x, y: s.y }, points) || isPointInPolygon({ x: s.x2, y: s.y2 }, points);
            } else if (shape.type === ShapeType.POLYLINE) {
                const s = shape as PolylineShape;
                // For polyline, check each point. Note: Polyline points are relative to s.x, s.y
                isInside = s.points.some(p => isPointInPolygon({ x: p.x + s.x, y: p.y + s.y }, points));
            } else if (shape.type === ShapeType.GROUP) {
                // For groups, check if any child is inside
                const g = shape as GroupShape;
                isInside = g.children.some(child => {
                    // This is a simplified check, ideally we'd check child's specific points
                    // For now, just check its origin
                    return isPointInPolygon({ x: child.x + g.x, y: child.y + g.y }, points);
                });
            }
            else {
                // Default check center
                isInside = isPointInPolygon({ x: shape.x, y: shape.y }, points);
            }

            if (isInside) ids.push(shape.id);
        });

        return ids;
    };



    const checkFenceIntersection = (points: { x: number, y: number }[]) => {
        // Fence selection: Check if "points" polyline intersects with any shape
        // Simplified approach: Check if any point of the fence is close to shape boundary? 
        // OR standard line-line intersection for every segment of fence vs every segment of shape.
        // That's expensive. Let's do a bounding box check first, then detailed check.
        const ids: string[] = [];

        if (points.length < 2) return ids;

        const intersects = (p1: { x: number, y: number }, p2: { x: number, y: number }, s1: { x: number, y: number }, s2: { x: number, y: number }) => {
            const det = (p2.x - p1.x) * (s2.y - s1.y) - (s2.x - s1.x) * (p2.y - p1.y);
            if (det === 0) return false;
            const lambda = ((s2.y - s1.y) * (s2.x - p1.x) + (s1.x - s2.x) * (s2.y - p1.y)) / det;
            const gamma = ((p1.y - p2.y) * (s2.x - p1.x) + (p2.x - p1.x) * (s2.y - p1.y)) / det;
            return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
        };

        // Check intersection with a polyline (fence)
        const doesIntersect = (shape: Shape) => {
            // For each segment of fence
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];

                // Check vs shape bbox first for perf
                // TODO: BBox check

                if (shape.type === ShapeType.LINE) {
                    const l = shape as LineShape;
                    if (intersects(p1, p2, { x: l.x, y: l.y }, { x: l.x2, y: l.y2 })) return true;
                } else if (shape.type === ShapeType.RECTANGLE) {
                    const r = shape as RectangleShape;
                    // 4 lines
                    if (intersects(p1, p2, { x: r.x, y: r.y }, { x: r.x + r.width, y: r.y })) return true;
                    if (intersects(p1, p2, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height })) return true;
                    if (intersects(p1, p2, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height })) return true;
                    if (intersects(p1, p2, { x: r.x, y: r.y + r.height }, { x: r.x, y: r.y })) return true;
                } else if (shape.type === ShapeType.POLYLINE) {
                    const pl = shape as PolylineShape;
                    for (let j = 0; j < pl.points.length - 1; j++) {
                        if (intersects(p1, p2, { x: pl.points[j].x + pl.x, y: pl.points[j].y + pl.y }, { x: pl.points[j + 1].x + pl.x, y: pl.points[j + 1].y + pl.y })) return true;
                    }
                } else if (shape.type === ShapeType.CIRCLE) {
                    // Approx line vs circle
                    const c = shape as CircleShape;
                    // Distance from segment to center < radius
                    const len2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
                    let t = ((c.x - p1.x) * (p2.x - p1.x) + (c.y - p1.y) * (p2.y - p1.y)) / len2;
                    t = Math.max(0, Math.min(1, t));
                    const projX = p1.x + t * (p2.x - p1.x);
                    const projY = p1.y + t * (p2.y - p1.y);
                    const dist = Math.hypot(c.x - projX, c.y - projY);
                    if (dist < c.radius) return true;
                }
                // ... other shapes simplified
            }
            return false;
        };

        shapes.forEach(s => {
            if (doesIntersect(s)) ids.push(s.id);
            else if (s.type === ShapeType.GROUP) {
                const g = s as GroupShape;
                if (g.children.some(doesIntersect)) ids.push(s.id);
            }
        });

        return ids;
    };

    const checkIntersection = (rect: { x: number, y: number, width: number, height: number }) => {
        const ids: string[] = [];

        const checkShape = (shape: Shape) => {
            let shapeRect = { x: 0, y: 0, width: 0, height: 0 };
            if (shape.type === ShapeType.RECTANGLE) {
                const s = shape as RectangleShape;
                shapeRect = { x: s.x, y: s.y, width: s.width, height: s.height };
            } else if (shape.type === ShapeType.CIRCLE) {
                const s = shape as CircleShape;
                shapeRect = { x: s.x - s.radius, y: s.y - s.radius, width: s.radius * 2, height: s.radius * 2 };
            } else if (shape.type === ShapeType.TEXT) {
                const s = shape as TextShape;
                const w = s.text.length * (s.fontSize * 0.6);
                shapeRect = { x: s.x, y: s.y - s.fontSize, width: w, height: s.fontSize };
            } else if (shape.type === ShapeType.HEART) {
                const s = shape as HeartShape;
                shapeRect = { x: s.x - s.width / 2, y: s.y - s.height / 2, width: s.width, height: s.height };
            } else if (shape.type === ShapeType.LINE) {
                const s = shape as LineShape;
                const minX = Math.min(s.x, s.x2);
                const minY = Math.min(s.y, s.y2);
                const maxX = Math.max(s.x, s.x2);
                const maxY = Math.max(s.y, s.y2);
                shapeRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            } else if (shape.type === ShapeType.GROUP) {
                const g = shape as GroupShape;
                g.children.forEach(checkShape);
                return;
            }

            const x_overlap = Math.max(0, Math.min(rect.x + rect.width, shapeRect.x + shapeRect.width) - Math.max(rect.x, shapeRect.x));
            const y_overlap = Math.max(0, Math.min(rect.y + rect.height, shapeRect.y + shapeRect.height) - Math.max(rect.y, shapeRect.y));
            if (x_overlap > 0 && y_overlap > 0) ids.push(shape.id);
        };

        shapes.forEach(checkShape);
        return ids;
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (dragMode === 'POLYGON_SELECT' && lassoPoints.length > 2) {
            const ids = checkLassoIntersection(lassoPoints);
            onMultiSelect(ids, e.shiftKey);
            setLassoPoints([]);
            setDragMode(null);
            setIsDragging(false);
        } else if (dragMode === 'PATH' && currentPolyline) {
            if (currentPolyline.points.length > 1) {
                onAddShapeFromPen(currentPolyline);
            }
            setCurrentPolyline(null);
            setDragMode(null);
            setIsDragging(false);
        }
    };





    const renderHeartPath = (s: HeartShape) => {
        let d = "";
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const t = (i / steps) * 2 * Math.PI;
            const hx = 16 * Math.pow(Math.sin(t), 3);
            const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
            const scaleX = s.width / 32;
            const scaleY = s.height / 30;
            const px = s.x + (hx * scaleX);
            const py = s.y - (hy * scaleY);
            d += (i === 0 ? "M" : "L") + ` ${px} ${py} `;
        }
        d += "Z";
        return d;
    };

    const renderDimensions = (shape: Shape) => {
        const dimColor = "#22d3ee";
        const strokeWidth = 1.5 / zoom;
        const textScale = 1 / zoom;
        const textStyle = { fill: "#e2e8f0", fontSize: 12 * textScale, fontFamily: "sans-serif", fontWeight: "bold" };

        const x = shape.x;
        const y = shape.y;

        if (shape.type === ShapeType.RECTANGLE) {
            const s = shape as RectangleShape;
            const widthLabel = formatUnit(s.width, unit);
            const heightLabel = formatUnit(s.height, unit);
            return (
                <g pointerEvents="none" className="select-none">
                    <line x1={x} y1={y - 15 * textScale} x2={x + s.width} y2={y - 15 * textScale} stroke={dimColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />
                    <text x={x + s.width / 2} y={y - 19 * textScale} textAnchor="middle" {...textStyle}>{widthLabel}</text>
                    <line x1={x - 15 * textScale} y1={y} x2={x - 15 * textScale} y2={y + s.height} stroke={dimColor} strokeWidth={strokeWidth} markerEnd="url(#arrow)" markerStart="url(#arrow-start)" />
                    <text x={x - 40 * textScale} y={y + s.height / 2} textAnchor="middle" {...textStyle}>{heightLabel}</text>
                </g>
            );
        }
        return null;
    };

    const renderShape = (shape: Shape, parentId?: string): React.ReactNode => {
        const isSelected = selectedIds.includes(shape.id) || (parentId && selectedIds.includes(parentId));
        const isHovered = hoveredId === shape.id || (parentId && hoveredId === parentId);
        const stroke = isSelected || isHovered ? "#38bdf8" : "#94a3b8";
        const isPreview = shape.id === currentPolyline?.id || shape.id === currentLine?.id;
        const sw = (isSelected || isHovered || isPreview ? 5 : 3) / zoom;

        const commonProps = {
            onPointerDown: (e: React.PointerEvent) => {
                if (parentId) {
                    const parent = shapes.find(s => s.id === parentId);
                    if (parent) handleShapePointerDown(e, parent);
                } else {
                    handleShapePointerDown(e, shape);
                }
            },
            onPointerEnter: () => setHoveredId(parentId || shape.id),
            onPointerLeave: () => setHoveredId(null),
            className: `outline-none ${activeTool === Tool.SELECT ? 'cursor-move' : ''}`,
            style: { touchAction: 'none' as const }
        };

        if (shape.type === ShapeType.GROUP) {
            const g = shape as GroupShape;
            const isCollapsed = g.collapsed || false;
            const toggleSize = 20 / zoom;
            const iconSize = 14 / zoom;

            // Calculate bounding box for the group
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            g.children.forEach(child => {
                if (child.type === ShapeType.RECTANGLE) {
                    const r = child as RectangleShape;
                    minX = Math.min(minX, child.x);
                    minY = Math.min(minY, child.y);
                    maxX = Math.max(maxX, child.x + r.width);
                    maxY = Math.max(maxY, child.y + r.height);
                } else if (child.type === ShapeType.CIRCLE) {
                    const c = child as CircleShape;
                    minX = Math.min(minX, child.x - c.radius);
                    minY = Math.min(minY, child.y - c.radius);
                    maxX = Math.max(maxX, child.x + c.radius);
                    maxY = Math.max(maxY, child.y + c.radius);
                } else {
                    minX = Math.min(minX, child.x);
                    minY = Math.min(minY, child.y);
                    maxX = Math.max(maxX, child.x + 50);
                    maxY = Math.max(maxY, child.y + 50);
                }
            });

            return (
                <g key={g.id} transform={`translate(${g.x}, ${g.y})`}>
                    {/* Toggle button */}
                    <g
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleGroup?.(g.id);
                        }}
                        style={{ cursor: 'pointer' }}
                        className="hover:opacity-80"
                    >
                        <circle
                            cx={minX - toggleSize / 2}
                            cy={minY - toggleSize / 2}
                            r={toggleSize / 2}
                            fill="#1e293b"
                            stroke={isSelected ? "#38bdf8" : "#64748b"}
                            strokeWidth={1.5 / zoom}
                        />
                        {/* Chevron icon */}
                        {isCollapsed ? (
                            // ChevronRight
                            <path
                                d={`M ${minX - toggleSize / 2 - iconSize / 4} ${minY - toggleSize / 2 - iconSize / 2} L ${minX - toggleSize / 2 + iconSize / 4} ${minY - toggleSize / 2} L ${minX - toggleSize / 2 - iconSize / 4} ${minY - toggleSize / 2 + iconSize / 2}`}
                                fill="none"
                                stroke={isSelected ? "#38bdf8" : "#94a3b8"}
                                strokeWidth={2 / zoom}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        ) : (
                            // ChevronDown
                            <path
                                d={`M ${minX - toggleSize / 2 - iconSize / 2} ${minY - toggleSize / 2 - iconSize / 4} L ${minX - toggleSize / 2} ${minY - toggleSize / 2 + iconSize / 4} L ${minX - toggleSize / 2 + iconSize / 2} ${minY - toggleSize / 2 - iconSize / 4}`}
                                fill="none"
                                stroke={isSelected ? "#38bdf8" : "#94a3b8"}
                                strokeWidth={2 / zoom}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                    </g>

                    {/* Group outline */}
                    {!isCollapsed && (
                        <rect
                            x={minX - 5 / zoom}
                            y={minY - 5 / zoom}
                            width={maxX - minX + 10 / zoom}
                            height={maxY - minY + 10 / zoom}
                            fill="none"
                            stroke={isSelected ? "#38bdf8" : "#64748b"}
                            strokeWidth={1 / zoom}
                            strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                            opacity="0.5"
                            pointerEvents="none"
                        />
                    )}

                    {/* Children - only render if not collapsed */}
                    {!isCollapsed && g.children.map(child => renderShape(child, g.id))}

                    {/* Collapsed placeholder */}
                    {isCollapsed && (
                        <rect
                            x={minX}
                            y={minY}
                            width={Math.max(50, maxX - minX)}
                            height={Math.max(30, maxY - minY)}
                            fill="rgba(100, 116, 139, 0.1)"
                            stroke={isSelected ? "#38bdf8" : "#64748b"}
                            strokeWidth={1.5 / zoom}
                            strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                            {...commonProps}
                        />
                    )}
                </g>
            );
        }

        if (shape.type === ShapeType.RECTANGLE) {
            const s = shape as RectangleShape;
            return (
                <rect
                    key={s.id}
                    x={s.x} y={s.y} width={s.width} height={s.height}
                    rx={s.cornerRadius || 0}
                    fill={isSelected ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.05)"}
                    stroke={stroke}
                    strokeWidth={sw}
                    {...commonProps}
                />
            );
        }
        if (shape.type === ShapeType.CIRCLE) {
            const s = shape as CircleShape;
            return (
                <circle
                    key={s.id}
                    cx={s.x} cy={s.y} r={s.radius}
                    fill={isSelected ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.05)"}
                    stroke={stroke}
                    strokeWidth={sw}
                    {...commonProps}
                />
            );
        }
        if (shape.type === ShapeType.TEXT) {
            const s = shape as TextShape;
            const isMirrored = s.mirrorMode === MirrorMode.WHOLE || s.mirror;

            if (s.mirrorMode === MirrorMode.CHAR) {
                return (
                    <g key={s.id} {...commonProps} className="select-none">
                        {s.text.split('').map((char, i) => (
                            <text
                                key={i}
                                x={s.x + i * (s.fontSize * 0.6 + (s.letterSpacing || 0))}
                                y={s.y}
                                fill={stroke}
                                fontSize={s.fontSize}
                                fontFamily={s.fontFamily || "Roboto Mono"}
                                textAnchor="middle"
                                transform={`translate(${s.x + i * (s.fontSize * 0.6) + (s.fontSize * 0.3)}, ${s.y - s.fontSize / 2}) scale(-1, 1) translate(-${s.x + i * (s.fontSize * 0.6) + (s.fontSize * 0.3)}, -${s.y - s.fontSize / 2})`}
                            >
                                {char}
                            </text>
                        ))}
                    </g>
                );
            }

            const transform = isMirrored
                ? `translate(${s.x}, ${s.y}) scale(-1, 1) translate(${-s.x}, ${-s.y})`
                : undefined;

            return (
                <text
                    key={s.id}
                    x={s.x} y={s.y}
                    fill={stroke}
                    fontSize={s.fontSize}
                    fontFamily={s.fontFamily || "Roboto Mono"}
                    letterSpacing={s.letterSpacing || 0}
                    fontWeight={isSelected ? "bold" : "normal"}
                    transform={transform}
                    {...commonProps}
                    className={`${commonProps.className} select-none`}
                >
                    {s.text}
                </text>
            );
        }
        if (shape.type === ShapeType.HEART) {
            const s = shape as HeartShape;
            return (
                <path
                    key={s.id}
                    d={renderHeartPath(s)}
                    fill={isSelected ? "rgba(244, 114, 182, 0.2)" : "rgba(244, 114, 182, 0.05)"}
                    stroke={isSelected ? "#f472b6" : "#94a3b8"}
                    strokeWidth={sw}
                    {...commonProps}
                />
            );
        }
        if (shape.type === ShapeType.LINE) {
            const s = shape as LineShape;
            return (
                <line
                    key={s.id}
                    x1={s.x} y1={s.y} x2={s.x2} y2={s.y2}
                    stroke={stroke}
                    strokeWidth={sw}
                    {...commonProps}
                />
            );
        }
        if (shape.type === ShapeType.POLYLINE) {
            const s = shape as PolylineShape;
            const pointsStr = s.points.map(p => `${p.x},${p.y}`).join(' ');
            return (
                <polyline
                    key={s.id}
                    points={pointsStr}
                    fill="none"
                    stroke={isPreview ? "#22d3ee" : stroke}
                    strokeWidth={sw}
                    {...commonProps}
                />
            );
        }
        return null;
    };

    const viewBoxW = viewportSize.width / zoom;
    const viewBoxH = viewportSize.height / zoom;
    const viewBoxStr = `${pan.x} ${pan.y} ${viewBoxW} ${viewBoxH}`;

    const rulerStep = zoom > 1 ? 10 : zoom > 0.5 ? 50 : 100;
    const startX = Math.floor(pan.x / rulerStep) * rulerStep;
    const endX = startX + viewBoxW + rulerStep;
    const startY = Math.floor(pan.y / rulerStep) * rulerStep;
    const endY = startY + viewBoxH + rulerStep;

    const rulerTicks = [];
    for (let x = startX; x <= endX; x += rulerStep) {
        if (x % rulerStep === 0) rulerTicks.push({ val: x, type: 'x' });
    }
    for (let y = startY; y <= endY; y += rulerStep) {
        if (y % rulerStep === 0) rulerTicks.push({ val: y, type: 'y' });
    }

    return (
        <div
            ref={containerRef}
            className={`flex-1 bg-slate-900 relative overflow-hidden flex flex-col items-center justify-center min-h-[400px] select-none ${activeTool === Tool.PAN ? 'cursor-grab active:cursor-grabbing' : ''} ${activeTool === Tool.PEN || activeTool === Tool.LINE_CREATE ? 'cursor-crosshair' : ''}`}
        >
            <div className="absolute top-4 left-4 text-slate-500 text-sm select-none pointer-events-none z-10 bg-slate-900/50 backdrop-blur rounded px-2 border border-slate-700">
                Canvas: {formatUnit(canvasWidth, unit, 0)} x {formatUnit(canvasHeight, unit, 0)} | Grid: {gridSize}mm | Zoom: {(zoom * 100).toFixed(0)}%
            </div>

            <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full touch-none"
                style={{ pointerEvents: 'all' }}
                viewBox={viewBoxStr}
                preserveAspectRatio="xMidYMid slice"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onDoubleClick={handleDoubleClick}>
                <defs>
                    <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                        <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#334155" strokeWidth={1 / zoom} />
                    </pattern>
                    <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
                    </marker>
                    <marker id="arrow-start" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto-start-reverse">
                        <path d="M0,0 L0,6 L6,3 z" fill="#22d3ee" />
                    </marker>
                </defs>

                <rect x="-1000" y="-1000" width={canvasWidth + 2000} height={canvasHeight + 2000} fill="#0f172a" />
                {/* Center the workspace rectangle so 0,0 is at center */}
                <rect x={-canvasWidth / 2} y={-canvasHeight / 2} width={canvasWidth} height={canvasHeight} fill="url(#grid)" />

                <line x1="-10000" y1="0" x2="10000" y2="0" stroke="#ef4444" strokeWidth={2 / zoom} opacity="0.8" />
                <line x1="0" y1="-10000" x2="0" y2="10000" stroke="#22c55e" strokeWidth={2 / zoom} opacity="0.8" />

                <g className="select-none pointer-events-none">
                    {rulerTicks.map((tick) => (
                        <g key={`${tick.type}-${tick.val}`}>
                            {tick.type === 'x' ? (
                                <>
                                    <line x1={tick.val} y1={-5 / zoom} x2={tick.val} y2={5 / zoom} stroke="#64748b" strokeWidth={1 / zoom} />
                                    {tick.val !== 0 && (
                                        <text x={tick.val} y={15 / zoom} fill="#64748b" fontSize={10 / zoom} textAnchor="middle" fontFamily="monospace">
                                            {tick.val}
                                        </text>
                                    )}
                                </>
                            ) : (
                                <>
                                    <line x1={-5 / zoom} y1={tick.val} x2={5 / zoom} y2={tick.val} stroke="#64748b" strokeWidth={1 / zoom} />
                                    {tick.val !== 0 && (
                                        <text x={-10 / zoom} y={tick.val + 3 / zoom} fill="#64748b" fontSize={10 / zoom} textAnchor="end" fontFamily="monospace">
                                            {tick.val}
                                        </text>
                                    )}
                                </>
                            )}
                        </g>
                    ))}
                    <text x={5 / zoom} y={-5 / zoom} fill="#ef4444" fontSize={12 / zoom} fontWeight="bold">0,0</text>
                </g>

                {shapes.map(s => renderShape(s))}

                {currentPolyline && renderShape(currentPolyline)}
                {currentLine && renderShape(currentLine)}

                {snapPoint && (
                    <circle cx={snapPoint.x} cy={snapPoint.y} r={5 / zoom} fill="transparent" stroke="#facc15" strokeWidth={2 / zoom} />
                )}

                {showDimensions && shapes.map(shape => {
                    if (!selectedIds.includes(shape.id)) return null;
                    return <React.Fragment key={`dim-${shape.id}`}>{renderDimensions(shape)}</React.Fragment>;
                })}

                {/* Marquee Selection Box */}
                {marquee && (
                    <rect
                        x={marquee.x}
                        y={marquee.y}
                        width={marquee.width}
                        height={marquee.height}
                        fill="rgba(56, 189, 248, 0.1)"
                        stroke="#38bdf8"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                        pointerEvents="none"
                    />
                )}

                {/* Lasso Selection Path */}
                {lassoPoints.length > 0 && dragMode === 'LASSO' && (
                    <polyline
                        points={lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="rgba(250, 204, 21, 0.1)"
                        stroke="#facc15"
                        strokeWidth={1 / zoom}
                        strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                        pointerEvents="none"
                    />
                )}

                {/* Fence Selection Path */}
                {lassoPoints.length > 0 && dragMode === 'FENCE' && (
                    <polyline
                        points={lassoPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#d946ef" // Fuchsia color for fence
                        strokeWidth={2 / zoom}
                        strokeDasharray={`${4 / zoom} ${2 / zoom}`}
                        pointerEvents="none"
                    />
                )}


            </svg>

            {
                selectedIds.length > 0 && (
                    <div className="absolute bottom-24 md:bottom-24 left-1/2 -translate-x-1/2 bg-slate-800 p-2 rounded-full shadow-lg border border-slate-700 flex gap-4 z-20 items-center">
                        <button
                            onClick={() => onDeleteShapes(selectedIds)}
                            className="p-1 hover:bg-red-500/20 text-red-400 rounded-full transition-colors flex items-center gap-1 pr-3"
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    </div>
                )
            }
        </div >
    );
};

export default Canvas;
