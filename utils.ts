
import { Unit, Shape, ShapeType, RectangleShape, CircleShape, LineShape, PolylineShape, GroupShape } from './types';
import { v4 as uuidv4 } from 'uuid';

export const toMm = (val: number, unit: Unit): number => {
  if (isNaN(val)) return 0;
  if (unit === Unit.INCH) return val * 25.4;
  if (unit === Unit.FEET) return val * 304.8;
  return val;
};

export const fromMm = (val: number, unit: Unit): number => {
  if (isNaN(val)) return 0;
  if (unit === Unit.INCH) return val / 25.4;
  if (unit === Unit.FEET) return val / 304.8;
  return val;
};

export const formatUnit = (val: number, unit: Unit, digits: number = 2): string => {
    return `${fromMm(val, unit).toFixed(digits)}${unit}`;
};

export const flattenShapes = (shapes: Shape[]): Shape[] => {
    return shapes.reduce((acc, s) => {
        if (s.type === ShapeType.GROUP) {
            const g = s as GroupShape;
            // Recursively flatten
            return [...acc, ...flattenShapes(g.children)];
        }
        return [...acc, s];
    }, [] as Shape[]);
};

export const shapesToSvg = (shapes: Shape[], width: number = 3050, height: number = 2150): string => {
  const processShape = (s: Shape): string => {
      switch(s.type) {
        case ShapeType.RECTANGLE:
          const r = s as RectangleShape;
          return `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" rx="${r.cornerRadius || 0}" fill="none" stroke="black" stroke-width="1" />`;
        case ShapeType.CIRCLE:
          const c = s as CircleShape;
          return `<circle cx="${c.x}" cy="${c.y}" r="${c.radius}" fill="none" stroke="black" stroke-width="1" />`;
        case ShapeType.LINE:
          const l = s as LineShape;
          return `<line x1="${l.x}" y1="${l.y}" x2="${l.x2}" y2="${l.y2}" stroke="black" stroke-width="1" />`;
        case ShapeType.POLYLINE:
          const p = s as PolylineShape;
          const pts = p.points.map(pt => `${pt.x},${pt.y}`).join(' ');
          return `<polyline points="${pts}" fill="none" stroke="black" stroke-width="1" />`;
        case ShapeType.GROUP:
          const g = s as GroupShape;
          return `<g>${g.children.map(processShape).join('')}</g>`;
        default:
          return '';
      }
  };

  const elements = shapes.map(processShape).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" units="mm">\n${elements}\n</svg>`;
};

export const parseSvgToShapes = (svgString: string): Shape[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const shapes: Shape[] = [];

  // Helper to parse basic attribs
  const getNum = (el: Element, attr: string, def: number = 0) => {
      const val = el.getAttribute(attr);
      return val ? parseFloat(val) : def;
  };

  // 1. Rects
  const rects = doc.getElementsByTagName('rect');
  for(let i=0; i<rects.length; i++) {
    const r = rects[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.RECTANGLE,
      x: getNum(r, 'x'),
      y: getNum(r, 'y'),
      width: getNum(r, 'width', 10),
      height: getNum(r, 'height', 10),
      cornerRadius: getNum(r, 'rx'),
    } as RectangleShape);
  }

  // 2. Circles
  const circles = doc.getElementsByTagName('circle');
  for(let i=0; i<circles.length; i++) {
    const c = circles[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.CIRCLE,
      x: getNum(c, 'cx'),
      y: getNum(c, 'cy'),
      radius: getNum(c, 'r', 10),
    } as CircleShape);
  }

  // 3. Lines
  const lines = doc.getElementsByTagName('line');
  for(let i=0; i<lines.length; i++) {
    const l = lines[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.LINE,
      x: getNum(l, 'x1'),
      y: getNum(l, 'y1'),
      x2: getNum(l, 'x2'),
      y2: getNum(l, 'y2'),
    } as LineShape);
  }

  // 4. Polylines
  const polylines = doc.getElementsByTagName('polyline');
  for (let i = 0; i < polylines.length; i++) {
      const pl = polylines[i];
      const pointsStr = pl.getAttribute('points');
      if (pointsStr) {
          const points = pointsStr.trim().split(/\s+|,/).reduce((acc, val, idx, arr) => {
              if (idx % 2 === 0 && arr[idx + 1] !== undefined) {
                  acc.push({ x: parseFloat(val), y: parseFloat(arr[idx + 1]) });
              }
              return acc;
          }, [] as {x: number, y: number}[]);
          
          if (points.length > 0) {
              shapes.push({
                  id: uuidv4(),
                  type: ShapeType.POLYLINE,
                  x: 0, y: 0, 
                  points
              } as PolylineShape);
          }
      }
  }

  // 5. Paths (Sampling)
  const paths = doc.getElementsByTagName('path');
  if (paths.length > 0) {
      // We need to attach to DOM to use getPointAtLength
      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.visibility = 'hidden';
      hiddenDiv.style.position = 'absolute';
      hiddenDiv.style.width = '0';
      hiddenDiv.style.height = '0';
      document.body.appendChild(hiddenDiv);

      const svgNs = "http://www.w3.org/2000/svg";
      const tempSvg = document.createElementNS(svgNs, 'svg');
      hiddenDiv.appendChild(tempSvg);

      for(let i=0; i<paths.length; i++) {
          const pathEl = paths[i];
          const d = pathEl.getAttribute('d');
          if (!d) continue;

          const tempPath = document.createElementNS(svgNs, 'path');
          tempPath.setAttribute('d', d);
          tempSvg.appendChild(tempPath);

          try {
              const len = tempPath.getTotalLength();
              // Sample every 1mm or so (approx)
              const points: {x: number, y: number}[] = [];
              const steps = Math.max(10, Math.ceil(len / 1)); 
              
              for(let j=0; j<=steps; j++) {
                  const pt = tempPath.getPointAtLength((j/steps) * len);
                  points.push({ x: pt.x, y: pt.y });
              }

              if (points.length > 1) {
                  shapes.push({
                      id: uuidv4(),
                      type: ShapeType.POLYLINE,
                      x: 0, y: 0,
                      points
                  } as PolylineShape);
              }
          } catch(e) {
              console.warn("Failed to parse path", e);
          }
          tempSvg.removeChild(tempPath);
      }
      document.body.removeChild(hiddenDiv);
  }

  return shapes;
};

export const calculateGCodeBounds = (gcode: string) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasData = false;
    
    const lines = gcode.split('\n');
    lines.forEach(line => {
        const clean = line.trim().toUpperCase();
        if (clean.startsWith('G0') || clean.startsWith('G1') || clean.startsWith('G2') || clean.startsWith('G3')) {
             const xMatch = clean.match(/X([\d\.-]+)/);
             const yMatch = clean.match(/Y([\d\.-]+)/);
             
             if (xMatch) {
                 const x = parseFloat(xMatch[1]);
                 if (!isNaN(x)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); hasData = true; }
             }
             if (yMatch) {
                 const y = parseFloat(yMatch[1]);
                 if (!isNaN(y)) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); hasData = true; }
             }
        }
    });

    if (!hasData) return undefined;
    return { minX, maxX, minY, maxY };
};
