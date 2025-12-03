
import { Unit, Shape, ShapeType, RectangleShape, CircleShape, LineShape, PolylineShape } from './types';
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

export const shapesToSvg = (shapes: Shape[], width: number = 3050, height: number = 2150): string => {
  const elements = shapes.map(s => {
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
      default:
        return '';
    }
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" units="mm">\n${elements}\n</svg>`;
};

export const parseSvgToShapes = (svgString: string): Shape[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const shapes: Shape[] = [];

  const rects = doc.getElementsByTagName('rect');
  for(let i=0; i<rects.length; i++) {
    const r = rects[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.RECTANGLE,
      x: parseFloat(r.getAttribute('x') || '0'),
      y: parseFloat(r.getAttribute('y') || '0'),
      width: parseFloat(r.getAttribute('width') || '10'),
      height: parseFloat(r.getAttribute('height') || '10'),
      cornerRadius: parseFloat(r.getAttribute('rx') || '0'),
    } as RectangleShape);
  }

  const circles = doc.getElementsByTagName('circle');
  for(let i=0; i<circles.length; i++) {
    const c = circles[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.CIRCLE,
      x: parseFloat(c.getAttribute('cx') || '0'),
      y: parseFloat(c.getAttribute('cy') || '0'),
      radius: parseFloat(c.getAttribute('r') || '10'),
    } as CircleShape);
  }

  const lines = doc.getElementsByTagName('line');
  for(let i=0; i<lines.length; i++) {
    const l = lines[i];
    shapes.push({
      id: uuidv4(),
      type: ShapeType.LINE,
      x: parseFloat(l.getAttribute('x1') || '0'),
      y: parseFloat(l.getAttribute('y1') || '0'),
      x2: parseFloat(l.getAttribute('x2') || '0'),
      y2: parseFloat(l.getAttribute('y2') || '0'),
    } as LineShape);
  }

  return shapes;
};
