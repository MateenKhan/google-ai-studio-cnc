
export enum ShapeType {
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
  TEXT = 'TEXT',
  HEART = 'HEART',
  LINE = 'LINE',
  POLYLINE = 'POLYLINE',
}

export enum Tool {
  SELECT = 'SELECT',
  PAN = 'PAN',
  PEN = 'PEN',
  LINE_CREATE = 'LINE_CREATE',
}

export enum Unit {
  MM = 'mm',
  INCH = 'in',
  FEET = 'ft',
}

export enum MirrorMode {
    NONE = 'NONE',
    WHOLE = 'WHOLE', // Mirror entire text object
    CHAR = 'CHAR',   // Mirror individual characters in place
}

export interface BaseShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
}

export interface RectangleShape extends BaseShape {
  type: ShapeType.RECTANGLE;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface CircleShape extends BaseShape {
  type: ShapeType.CIRCLE;
  radius: number;
}

export interface TextShape extends BaseShape {
  type: ShapeType.TEXT;
  text: string;
  fontSize: number;
  fontFamily?: string;
  letterSpacing?: number;
  mirrorMode?: MirrorMode;
  // Legacy support
  mirror?: boolean; 
}

export interface HeartShape extends BaseShape {
  type: ShapeType.HEART;
  width: number;
  height: number;
}

export interface LineShape extends BaseShape {
  type: ShapeType.LINE;
  x2: number;
  y2: number;
}

export interface PolylineShape extends BaseShape {
  type: ShapeType.POLYLINE;
  points: {x: number, y: number}[];
}

export type Shape = RectangleShape | CircleShape | TextShape | HeartShape | LineShape | PolylineShape;

export interface MachineSettings {
  feedRate: number;
  safeHeight: number;
  cutDepth: number;
  toolDiameter: number;
}

export interface MachinePosition {
    x: string;
    y: string;
    z: string;
}

export interface MachineStatus {
    state: 'Idle' | 'Run' | 'Hold' | 'Alarm' | 'Door' | 'Check' | 'Home' | 'Sleep' | 'Disconnected' | 'Connecting';
    pos: MachinePosition;
    feed: string;
    spindle: string;
}
