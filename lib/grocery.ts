import type { AppData, Dish, GroceryItem, InventoryItem, PlannedMeal } from "@/lib/types";
import { convertQuantity, roundQuantity, unitsCompatible } from "@/lib/units";

interface DemandRow {
  name: string;
  unit: string;
  quantity: number;
  notes: string[];
}

function plannedDemand(meals: PlannedMeal[], dishes: Dish[]): Map<string, DemandRow> {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const demand = new Map<string, DemandRow>();
  for (const meal of meals) {
    if (meal.status !== "suggested" && meal.status !== "accepted") continue;
    for (const planned of meal.dishes) {
      const dish = dishMap.get(planned.dishId);
      if (!dish) continue;
      for (const ingredient of dish.ingredients) {
        const countable = ingredient.role === "main" || ingredient.role === "optional" || ingredient.unusual;
        if (!countable || (ingredient.role === "seasoning" && !ingredient.unusual)) continue;
        const name = ingredient.name.trim();
        const key = `${name}|${ingredient.unit}`;
        const row = demand.get(key) ?? { name, unit: ingredient.unit, quantity: 0, notes: [] };
        row.quantity += ingredient.quantity;
        demand.set(key, row);
      }
    }
  }
  return demand;
}

function subtractStock(row: DemandRow, inventory: InventoryItem[]) {
  const sameName = inventory.filter((item) => item.name.trim() === row.name && item.quantity > 0);
  const compatible = sameName.filter((item) => unitsCompatible(item.unit, row.unit));
  if (compatible.length > 0) {
    const have = compatible.reduce((sum, item) => sum + (convertQuantity(item.quantity, item.unit, row.unit) ?? 0), 0);
    row.quantity = Math.max(0, row.quantity - have);
    return;
  }
  if (sameName.length > 0) {
    const units = [...new Set(sameName.map((item) => item.unit))].join("、");
    row.notes.push(`冰箱里有「${row.name}」，单位是「${units}」，和菜单里的「${row.unit}」对不上，没有自动扣减。`);
  }
}

function createId(): string {
  return crypto.randomUUID();
}

export function recalculateGroceries(data: AppData): GroceryItem[] {
  const demand = plannedDemand(data.meals, data.dishes);
  for (const row of demand.values()) subtractStock(row, data.inventory);

  const purchased = data.groceries.filter((item) => item.status === "purchased");
  const unstockedPurchases = purchased.filter((item) => !item.addedToInventory);
  for (const row of demand.values()) {
    const bought = unstockedPurchases.filter((item) => item.name.trim() === row.name && unitsCompatible(item.unit, row.unit));
    const have = bought.reduce((sum, item) => sum + (convertQuantity(item.quantity, item.unit, row.unit) ?? 0), 0);
    row.quantity = Math.max(0, row.quantity - have);
  }

  const needed: GroceryItem[] = [];
  for (const row of demand.values()) {
    const quantity = roundQuantity(row.quantity);
    if (quantity <= 0) continue;
    const existing = data.groceries.find(
      (item) => item.status === "needed" && item.source === "calculated" && item.name.trim() === row.name && item.unit === row.unit,
    );
    needed.push({
      id: existing?.id ?? createId(),
      name: row.name,
      quantity,
      unit: row.unit,
      status: "needed",
      source: "calculated",
      note: row.notes.join(""),
      addedToInventory: false,
      purchasedAt: null,
    });
  }

  const manualKept: GroceryItem[] = [];
  for (const item of data.groceries.filter((entry) => entry.source === "manual" && entry.status === "needed")) {
    const clash = needed.find((entry) => entry.name.trim() === item.name.trim() && entry.unit === item.unit);
    if (clash) clash.quantity = Math.max(clash.quantity, item.quantity);
    else manualKept.push(item);
  }

  return [...needed, ...manualKept, ...purchased];
}

export interface IngredientOutlook {
  name: string;
  state: "有" | "要买" | "单位不同";
}

export function ingredientOutlook(dishIds: string[], dishes: Dish[], inventory: InventoryItem[]): IngredientOutlook[] {
  const dishMap = new Map(dishes.map((dish) => [dish.id, dish]));
  const rows: IngredientOutlook[] = [];
  const seen = new Set<string>();
  for (const id of dishIds) {
    const dish = dishMap.get(id);
    if (!dish) continue;
    for (const ingredient of dish.ingredients) {
      if (ingredient.role === "seasoning" && !ingredient.unusual) continue;
      const name = ingredient.name.trim();
      const key = `${name}|${ingredient.unit}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const sameName = inventory.filter((item) => item.name.trim() === name && item.quantity > 0);
      const compatible = sameName.filter((item) => unitsCompatible(item.unit, ingredient.unit));
      if (compatible.length > 0) rows.push({ name, state: "有" });
      else if (sameName.length > 0) rows.push({ name, state: "单位不同" });
      else rows.push({ name, state: "要买" });
    }
  }
  return rows;
}
