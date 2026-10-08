import { findDishSeed } from "@/lib/catalog";
import type { DishIngredient, IngredientRole } from "@/lib/types";

export interface DraftIngredient {
  name: string;
  quantity: number;
  unit: string;
  role: IngredientRole;
  unusual: boolean;
}

export interface IngredientDraft {
  source: "template" | "none";
  ingredients: DraftIngredient[];
  message: string;
}

export interface IngredientDrafter {
  draft(name: string): IngredientDraft;
}

function fromSeed(name: string): IngredientDraft | null {
  const found = findDishSeed(name);
  if (!found) return null;
  return {
    source: "template",
    ingredients: found.ingredients.map(([ingredientName, quantity, unit, role, unusual]) => ({
      name: ingredientName,
      quantity,
      unit,
      role,
      unusual: unusual ?? false,
    })),
    message: "已按本地常做菜模板填入两个人的大致用量，请核对后再保存。",
  };
}

export const localTemplateDrafter: IngredientDrafter = {
  draft(name: string): IngredientDraft {
    return (
      fromSeed(name) ?? {
        source: "none",
        ingredients: [],
        message: "没有找到这道菜的本地模板。当前也没有连接 AI，不能自动编造用料。请自己补上主要食材。",
      }
    );
  },
};

export function draftToIngredients(draft: IngredientDraft, prefix: string): DishIngredient[] {
  return draft.ingredients.map((ingredient, index) => ({
    id: `${prefix}-i${index}`,
    ...ingredient,
  }));
}
