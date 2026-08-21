import type { BaseUnit, MeasurementUnit } from "@/lib/types/api";

const MASS_UNITS: MeasurementUnit[] = ["g", "kg", "oz", "lb", "pinch"];
const VOLUME_UNITS: MeasurementUnit[] = ["ml", "l", "tsp", "tbsp", "cup", "fl_oz"];

export function unitsForBase(baseUnit: BaseUnit): MeasurementUnit[] {
  return baseUnit === "g" ? MASS_UNITS : VOLUME_UNITS;
}

export function formatQty(n: number, unit: string): string {
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
  return `${rounded}${unit}`;
}
