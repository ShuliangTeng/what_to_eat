const MASS: Record<string, number> = {
  克: 1,
  千克: 1000,
  斤: 500,
};

const VOLUME: Record<string, number> = {
  毫升: 1,
  升: 1000,
};

export const UNITS = [
  "个",
  "只",
  "根",
  "块",
  "片",
  "包",
  "盒",
  "袋",
  "瓶",
  "把",
  "克",
  "斤",
  "千克",
  "毫升",
  "升",
  "勺",
  "颗",
  "条",
  "碗",
  "朵",
  "张",
  "棵",
] as const;

export function unitsCompatible(left: string, right: string): boolean {
  if (left === right) return true;
  if (left in MASS && right in MASS) return true;
  if (left in VOLUME && right in VOLUME) return true;
  return false;
}

export function convertQuantity(quantity: number, from: string, to: string): number | null {
  if (from === to) return quantity;
  if (from in MASS && to in MASS) return (quantity * MASS[from]) / MASS[to];
  if (from in VOLUME && to in VOLUME) return (quantity * VOLUME[from]) / VOLUME[to];
  return null;
}

export function roundQuantity(value: number): number {
  return Math.round(value * 10) / 10;
}

export function sameIngredientName(left: string, right: string): boolean {
  return left.trim() === right.trim();
}
