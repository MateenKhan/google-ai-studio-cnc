import { Unit } from './types';

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