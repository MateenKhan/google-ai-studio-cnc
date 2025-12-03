export enum ShapeType {
  RECTANGLE = 'RECTANGLE',
  CIRCLE = 'CIRCLE',
  TEXT = 'TEXT',
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
}

export interface CircleShape extends BaseShape {
  type: ShapeType.CIRCLE;
  radius: number;
}

export interface TextShape extends BaseShape {
  type: ShapeType.TEXT;
  text: string;
  fontSize: number;
}

export type Shape = RectangleShape | CircleShape | TextShape;

export interface MachineSettings {
  feedRate: number;
  safeHeight: number;
  cutDepth: number;
  toolDiameter: number;
}
