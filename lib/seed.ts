import { createSeedDishes } from "@/lib/catalog";
import type { Dish } from "@/lib/types";

export function cloneSeedDishes(): Dish[] {
  return createSeedDishes().map((dish) => ({
    ...dish,
    id: crypto.randomUUID(),
    ingredients: dish.ingredients.map((ingredient) => ({ ...ingredient, id: crypto.randomUUID() })),
  }));
}
