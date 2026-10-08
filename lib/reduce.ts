import { daysBetween, formatFullDate, mondayOf, todayISO, weekDates } from "@/lib/dates";
import { recalculateGroceries } from "@/lib/grocery";
import { describeDishes, mealSignature, recommendDay, recommendWeek } from "@/lib/recommend";
import type {
  AppData,
  Dish,
  Effort,
  Familiarity,
  GroceryItem,
  HistoryEntry,
  InventoryItem,
  MealDraft,
  MealRole,
  MealStatus,
  PlannedMeal,
  StorageLocation,
} from "@/lib/types";

function createId(): string {
  return crypto.randomUUID();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bump(dishes: Dish[], ids: string[], delta: number): Dish[] {
  if (delta === 0 || ids.length === 0) return dishes;
  const targets = new Set(ids);
  return dishes.map((dish) =>
    targets.has(dish.id) ? { ...dish, preferenceScore: clamp(dish.preferenceScore + delta, -12, 36) } : dish,
  );
}

function withGroceries(data: AppData): AppData {
  return { ...data, groceries: recalculateGroceries(data) };
}

function addHistory(history: HistoryEntry[], meal: PlannedMeal): HistoryEntry[] {
  if (history.some((entry) => entry.date === meal.date)) return history;
  return [{ id: meal.id, date: meal.date, dishNames: meal.dishes.map((dish) => dish.name) }, ...history];
}

function plannerInput(data: AppData, today: string) {
  const recent = new Set<string>();
  const cookedOnce = new Set<string>();
  const byName = new Map(data.dishes.map((dish) => [dish.name, dish]));
  for (const entry of data.history) {
    const age = Math.abs(daysBetween(entry.date, today));
    for (const name of entry.dishNames) {
      const dish = byName.get(name);
      if (!dish) continue;
      if (age <= 21) recent.add(dish.id);
      if (dish.usage === "once") cookedOnce.add(dish.id);
    }
  }
  for (const meal of data.meals) {
    if (meal.status !== "cooked") continue;
    for (const planned of meal.dishes) {
      recent.add(planned.dishId);
      const dish = data.dishes.find((item) => item.id === planned.dishId);
      if (dish?.usage === "once") cookedOnce.add(dish.id);
    }
  }
  return {
    dishes: data.dishes,
    inventory: data.inventory,
    preferFuzhou: data.settings.preferFuzhou,
    exploreNew: data.settings.exploreNew,
    cookedRecently: [...recent],
    cookedOnceIds: [...cookedOnce],
  };
}

function mealFromDraft(date: string, primary: MealDraft, alternatives: MealDraft[], existingId?: string): PlannedMeal {
  return {
    id: existingId ?? createId(),
    date,
    status: "suggested",
    dishes: primary.dishes,
    reasons: primary.reasons,
    alternatives,
    effort: primary.effort,
    isNew: primary.isNew,
  };
}

export function fillOpenDays(data: AppData, today = todayISO()): AppData {
  const dates = weekDates(data.weekStart);
  const locked = data.meals.filter((meal) => meal.status !== "suggested");
  const planned = recommendWeek(plannerInput(data, today), dates, locked);
  const meals = dates.map((date) => {
    const existing = data.meals.find((meal) => meal.date === date);
    if (existing && existing.status !== "suggested") return existing;
    const draft = planned.get(date);
    if (!draft) return existing ?? mealFromDraft(date, { dishes: [], reasons: ["这一天先空着。"], effort: "easy", isNew: false }, []);
    return mealFromDraft(date, draft.primary, draft.alternatives, existing?.id);
  });
  return withGroceries({ ...data, meals });
}

export function ensureWeek(data: AppData, today = todayISO()): AppData {
  const monday = mondayOf(today);
  let next = data;
  if (data.weekStart !== monday) {
    let history = data.history;
    for (const meal of data.meals) {
      if (meal.status === "cooked") history = addHistory(history, meal);
    }
    next = { ...data, weekStart: monday, meals: [], history };
  }
  const dates = weekDates(monday);
  const complete = dates.every((date) => next.meals.some((meal) => meal.date === date));
  if (complete && data.weekStart === monday) return data;
  if (complete) return withGroceries(next);
  return fillOpenDays(next, today);
}

function requireMeal(data: AppData, date: string): PlannedMeal {
  const meal = data.meals.find((item) => item.date === date);
  if (!meal) throw new Error("找不到这一天。");
  return meal;
}

export function acceptMeal(data: AppData, date: string): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  if (meal.dishes.length === 0) throw new Error("这天还没有菜。");
  if (meal.status === "accepted") return data;
  const dishes = bump(data.dishes, meal.dishes.map((dish) => dish.dishId), 2);
  const meals = data.meals.map((item) => (item.date === date ? { ...item, status: "accepted" as const } : item));
  return withGroceries({ ...data, dishes, meals });
}

export function cookMeal(data: AppData, date: string): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") return data;
  if (meal.status !== "accepted") throw new Error("先点「就吃这个」，再标记做好了。没做的日子不会被记成不爱吃。");
  const cookedIds = meal.dishes.map((dish) => dish.dishId);
  const dishes = bump(data.dishes, cookedIds, 1).map((dish) =>
    dish.usage === "once" && cookedIds.includes(dish.id) ? { ...dish, status: "paused" as const } : dish,
  );
  const meals = data.meals.map((item) => (item.date === date ? { ...item, status: "cooked" as const } : item));
  const history = addHistory(data.history, { ...meal, status: "cooked" });
  return withGroceries({ ...data, dishes, meals, history });
}

export function skipMeal(data: AppData, date: string, status: Extract<MealStatus, "skipped" | "eating_out">): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  const meals = data.meals.map((item) => (item.date === date ? { ...item, status } : item));
  return withGroceries({ ...data, meals });
}

export function postponeMeal(data: AppData, from: string, to: string): AppData {
  if (from === to) throw new Error("请选另一个日子。");
  const source = requireMeal(data, from);
  const target = requireMeal(data, to);
  if (source.status === "cooked") throw new Error("这顿已经做过了。");
  if (source.dishes.length === 0) throw new Error("这天还没有可改期的菜。");
  if (target.status === "cooked" || target.status === "accepted") throw new Error("那天已经定下来了，换一个日子吧。");
  const dishes = bump(data.dishes, source.dishes.map((dish) => dish.dishId), 2);
  const note = `这顿改到${formatFullDate(to)}。`;
  const meals = data.meals.map((meal) => {
    if (meal.date === from) {
      return { ...meal, status: "postponed" as const, reasons: [note, ...meal.reasons.filter((reason) => !reason.startsWith("这顿改到"))].slice(0, 4) };
    }
    if (meal.date === to) {
      return {
        ...meal,
        status: "accepted" as const,
        dishes: source.dishes,
        reasons: source.reasons.filter((reason) => !reason.startsWith("这顿改到")),
        alternatives: source.alternatives,
        effort: source.effort,
        isNew: source.isNew,
      };
    }
    return meal;
  });
  return withGroceries({ ...data, dishes, meals });
}

export function cycleMeal(data: AppData, date: string, today = todayISO()): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  const others = data.meals.filter((item) => item.date !== date);
  const draft = recommendDay(plannerInput(data, today), date, others, {
    signatures: [mealSignature(meal.dishes), ...meal.alternatives.map((item) => mealSignature(item.dishes))],
    dishIds: meal.dishes.map((dish) => dish.dishId),
  });
  const removed = meal.dishes.map((dish) => dish.dishId).filter((id) => !draft.primary.dishes.some((dish) => dish.dishId === id));
  const dishes = bump(data.dishes, removed, -1);
  const meals = data.meals.map((item) =>
    item.date === date
      ? { ...mealFromDraft(date, draft.primary, draft.alternatives, item.id), status: "suggested" as const }
      : item,
  );
  return withGroceries({ ...data, dishes, meals });
}

export function applyAlternative(data: AppData, date: string, index: number): AppData {
  const meal = requireMeal(data, date);
  const alternative = meal.alternatives[index];
  if (!alternative) throw new Error("没有这一个替换。");
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  const removed = meal.dishes.map((dish) => dish.dishId).filter((id) => !alternative.dishes.some((dish) => dish.dishId === id));
  const dishes = bump(data.dishes, removed, -1);
  const alternatives = [toAlternative(meal), ...meal.alternatives.filter((_, itemIndex) => itemIndex !== index)];
  const meals = data.meals.map((item) =>
    item.date === date
      ? {
          ...item,
          status: "suggested" as const,
          dishes: alternative.dishes,
          reasons: alternative.reasons,
          effort: alternative.effort,
          isNew: alternative.isNew,
          alternatives,
        }
      : item,
  );
  return withGroceries({ ...data, dishes, meals });
}

function toAlternative(meal: PlannedMeal) {
  return { dishes: meal.dishes, reasons: meal.reasons, effort: meal.effort, isNew: meal.isNew };
}

export function replaceDish(data: AppData, date: string, fromId: string, toId: string, today = todayISO()): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  if (!data.dishes.some((dish) => dish.id === toId && dish.status === "active")) throw new Error("这道菜现在不能用。");
  const nextIds = meal.dishes.map((dish) => (dish.dishId === fromId ? toId : dish.dishId));
  if (new Set(nextIds).size !== nextIds.length) throw new Error("这顿里已经有这道菜了。");
  return setMealDishes(data, date, nextIds, today, fromId);
}

export function setMealDishes(data: AppData, date: string, dishIds: string[], today = todayISO(), replacedId?: string): AppData {
  const meal = requireMeal(data, date);
  if (meal.status === "cooked") throw new Error("这顿已经做过了。");
  const unique = [...new Set(dishIds)];
  if (unique.length === 0) throw new Error("至少留一道菜，或者改成今天不做。");
  const others = data.meals.filter((item) => item.date !== date);
  const input = plannerInput(data, today);
  const described = describeDishes(input, date, others, unique);
  const refreshed = recommendDay(input, date, others, { dishIds: unique, signatures: [mealSignature(described.dishes)] });
  const removed = meal.dishes.map((dish) => dish.dishId).filter((id) => !unique.includes(id));
  const removedIds = replacedId ? [...new Set([...removed, replacedId])] : removed;
  let dishes = bump(data.dishes, removedIds.filter((id) => !unique.includes(id)), -1);
  if (meal.status === "accepted") {
    const added = unique.filter((id) => !meal.dishes.some((dish) => dish.dishId === id));
    dishes = bump(dishes, added, 2);
  }
  const meals = data.meals.map((item) =>
    item.date === date
      ? { ...item, dishes: described.dishes, reasons: described.reasons, effort: described.effort, isNew: described.isNew, alternatives: refreshed.alternatives }
      : item,
  );
  return withGroceries({ ...data, dishes, meals });
}

export function regenerateDay(data: AppData, date: string, today = todayISO()): AppData {
  const meal = data.meals.find((item) => item.date === date);
  if (meal?.status === "cooked") throw new Error("这顿已经做过了。");
  const others = data.meals.filter((item) => item.date !== date);
  const draft = recommendDay(plannerInput(data, today), date, others, meal ? { signatures: [mealSignature(meal.dishes)], dishIds: meal.dishes.map((dish) => dish.dishId) } : undefined);
  const removed = meal?.dishes.map((dish) => dish.dishId).filter((id) => !draft.primary.dishes.some((dish) => dish.dishId === id)) ?? [];
  const dishes = bump(data.dishes, removed, -1);
  const meals = data.meals.map((item) => (item.date === date ? { ...mealFromDraft(date, draft.primary, draft.alternatives, item.id), status: "suggested" as const } : item));
  if (!meals.some((item) => item.date === date)) meals.push(mealFromDraft(date, draft.primary, draft.alternatives));
  return withGroceries({ ...data, dishes, meals });
}

export interface DishDraft {
  id?: string;
  name: string;
  tags: string[];
  category: string;
  method: string;
  effort: Effort;
  familiarity: Familiarity;
  priority: number;
  usage: Dish["usage"];
  isFuzhou: boolean;
  mealRole: MealRole;
  ingredients: { id?: string; name: string; quantity: number; unit: string; role: Dish["ingredients"][number]["role"]; unusual: boolean }[];
}

export function saveDish(data: AppData, draft: DishDraft): AppData {
  const name = draft.name.trim();
  if (!name) throw new Error("请填写菜名。");
  const ingredients = draft.ingredients
    .map((ingredient) => ({
      id: ingredient.id || createId(),
      name: ingredient.name.trim(),
      quantity: ingredient.quantity,
      unit: ingredient.unit.trim(),
      role: ingredient.role,
      unusual: ingredient.unusual,
    }))
    .filter((ingredient) => ingredient.name);
  if (ingredients.length === 0) throw new Error("请至少写一种食材。");
  if (ingredients.some((ingredient) => !ingredient.unit || !Number.isFinite(ingredient.quantity) || ingredient.quantity < 0)) {
    throw new Error("请把食材的数量和单位填完整。");
  }
  const existing = data.dishes.find((dish) => dish.id === draft.id);
  const next: Dish = {
    id: existing?.id ?? draft.id ?? createId(),
    name,
    tags: draft.tags.map((tag) => tag.trim()).filter(Boolean),
    category: draft.category,
    method: draft.method,
    effort: draft.effort,
    familiarity: draft.familiarity,
    priority: draft.priority,
    status: existing?.status ?? "active",
    usage: draft.usage,
    isFuzhou: draft.isFuzhou,
    mealRole: draft.mealRole,
    preferenceScore: existing?.preferenceScore ?? 0,
    ingredients,
  };
  const dishes = existing ? data.dishes.map((dish) => (dish.id === next.id ? next : dish)) : [...data.dishes, next];
  return withGroceries({ ...data, dishes });
}

export function setDishStatus(data: AppData, dishId: string, status: Dish["status"]): AppData {
  return { ...data, dishes: data.dishes.map((dish) => (dish.id === dishId ? { ...dish, status } : dish)) };
}

export function favoriteDish(data: AppData, dishId: string): AppData {
  const dish = data.dishes.find((item) => item.id === dishId);
  if (!dish || dish.preferenceScore >= 5) return data;
  return { ...data, dishes: bump(data.dishes, [dishId], 5) };
}

export function deleteDish(data: AppData, dishId: string, today = todayISO()): AppData {
  const dishes = data.dishes.filter((dish) => dish.id !== dishId);
  const meals = data.meals.map((meal) => ({
    ...meal,
    dishes: meal.dishes.filter((dish) => dish.dishId !== dishId),
    alternatives: meal.alternatives.map((alternative) => ({
      ...alternative,
      dishes: alternative.dishes.filter((dish) => dish.dishId !== dishId),
    })),
  }));
  let next = withGroceries({ ...data, dishes, meals });
  for (const meal of next.meals) {
    if (meal.status === "suggested" && meal.dishes.length === 0) next = regenerateDay(next, meal.date, today);
  }
  return next;
}

export function saveInventory(data: AppData, item: InventoryItem): AppData {
  const name = item.name.trim();
  if (!name) throw new Error("请填写食材名称。");
  if (!item.unit.trim()) throw new Error("请填写单位。");
  if (!Number.isFinite(item.quantity) || item.quantity < 0) throw new Error("请填写数量。");
  const next = { ...item, name, unit: item.unit.trim() };
  const exists = data.inventory.some((entry) => entry.id === item.id);
  const inventory = exists ? data.inventory.map((entry) => (entry.id === item.id ? next : entry)) : [...data.inventory, next];
  return withGroceries({ ...data, inventory });
}

export function deleteInventory(data: AppData, itemId: string): AppData {
  return withGroceries({ ...data, inventory: data.inventory.filter((item) => item.id !== itemId) });
}

export function updateGroceryQuantity(data: AppData, itemId: string, quantity: number): AppData {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("请填写数量。");
  return { ...data, groceries: data.groceries.map((item) => (item.id === itemId ? { ...item, quantity } : item)) };
}

export function setGroceryPurchased(data: AppData, itemId: string, purchased: boolean): AppData {
  const groceries = data.groceries.map((item) =>
    item.id === itemId
      ? { ...item, status: purchased ? "purchased" as const : "needed" as const, purchasedAt: purchased ? new Date().toISOString() : null }
      : item,
  );
  return withGroceries({ ...data, groceries });
}

export function addManualGrocery(data: AppData, name: string, quantity: number, unit: string): AppData {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("请填写要买的东西。");
  if (!unit.trim()) throw new Error("请填写单位。");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("请填写数量。");
  const item: GroceryItem = {
    id: createId(),
    name: trimmed,
    quantity,
    unit: unit.trim(),
    status: "needed",
    source: "manual",
    note: "",
    addedToInventory: false,
    purchasedAt: null,
  };
  return withGroceries({ ...data, groceries: [...data.groceries, item] });
}

export function deleteGrocery(data: AppData, itemId: string): AppData {
  return withGroceries({ ...data, groceries: data.groceries.filter((item) => item.id !== itemId) });
}

export function moveGroceryToInventory(data: AppData, groceryId: string, location: StorageLocation): AppData {
  const item = data.groceries.find((entry) => entry.id === groceryId);
  if (!item) throw new Error("找不到这项。");
  if (item.status !== "purchased") throw new Error("先标记为已购买，再放入冰箱。");
  if (item.addedToInventory) return data;
  const inventory: InventoryItem[] = [
    ...data.inventory,
    { id: createId(), name: item.name, quantity: item.quantity, unit: item.unit, location, useSoon: false },
  ];
  const groceries = data.groceries.map((entry) => (entry.id === groceryId ? { ...entry, addedToInventory: true } : entry));
  return withGroceries({ ...data, inventory, groceries });
}

export function updateSettings(data: AppData, settings: AppData["settings"]): AppData {
  return { ...data, settings };
}
