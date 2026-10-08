import { isWeekdayDate } from "@/lib/dates";
import { maxEffort } from "@/lib/labels";
import type { Dish, InventoryItem, MealDraft, PlannedDish, PlannedMeal } from "@/lib/types";
import { convertQuantity, unitsCompatible } from "@/lib/units";

const LEAFY = new Set([
  "青菜",
  "上海青",
  "小白菜",
  "白菜",
  "生菜",
  "菠菜",
  "油麦菜",
  "菜心",
  "空心菜",
  "包菜",
  "西兰花",
]);

interface Availability {
  ratio: number;
  mainCount: number;
  full: boolean;
  useSoon: boolean;
  have: Set<string>;
  soonNames: Set<string>;
}

interface ScoreCtx {
  inv: Map<string, InventoryItem[]>;
  leafyBudget: Map<string, number>;
  used: Set<string>;
  leafyUses: Map<string, number>;
  ingredientUses: Map<string, number>;
  laborCount: number;
  newCount: number;
  fuzhouCount: number;
  meatOnlyStreak: number;
  reserved: Map<string, number>;
  isWeekday: boolean;
  allowNew: boolean;
  preferFuzhou: boolean;
  cookedRecently: Set<string>;
  cookedOnce: Set<string>;
  excludeSignatures: Set<string>;
  excludeDishIds: Set<string>;
}

export interface PlannerInput {
  dishes: Dish[];
  inventory: InventoryItem[];
  preferFuzhou: boolean;
  exploreNew: boolean;
  cookedRecently: string[];
  cookedOnceIds: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function indexInventory(items: InventoryItem[]): Map<string, InventoryItem[]> {
  const map = new Map<string, InventoryItem[]>();
  for (const item of items) {
    const key = item.name.trim();
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function leafyBudget(inv: Map<string, InventoryItem[]>): Map<string, number> {
  const budget = new Map<string, number>();
  for (const name of LEAFY) {
    const grams = (inv.get(name) ?? []).reduce((sum, item) => {
      if (item.quantity <= 0) return sum;
      return sum + (convertQuantity(item.quantity, item.unit, "克") ?? 0);
    }, 0);
    budget.set(name, grams >= 700 ? 3 : 2);
  }
  return budget;
}

function availability(dish: Dish, inv: Map<string, InventoryItem[]>, reserved: Map<string, number>): Availability {
  const mains = dish.ingredients.filter((ingredient) => ingredient.role === "main" || ingredient.role === "optional");
  const have = new Set<string>();
  const soonNames = new Set<string>();
  let covered = 0;
  for (const ingredient of mains) {
    const name = ingredient.name.trim();
    const matched = (inv.get(name) ?? []).filter((item) => item.quantity > 0 && unitsCompatible(item.unit, ingredient.unit));
    const haveQty = matched.reduce((sum, item) => sum + (convertQuantity(item.quantity, item.unit, ingredient.unit) ?? 0), 0);
    const remaining = haveQty - (reserved.get(`${name}|${ingredient.unit}`) ?? 0);
    if (remaining >= ingredient.quantity - 0.001) {
      have.add(name);
      covered += 1;
      if (matched.some((item) => item.useSoon)) soonNames.add(name);
    } else if (remaining > 0) {
      covered += 0.45;
    }
  }
  const mainCount = mains.length;
  return {
    ratio: mainCount === 0 ? 0 : covered / mainCount,
    mainCount,
    full: mainCount > 0 && have.size === mainCount,
    useSoon: soonNames.size > 0,
    have,
    soonNames,
  };
}

function leafyNames(dish: Dish): string[] {
  const names: string[] = [];
  for (const ingredient of dish.ingredients) {
    const name = ingredient.name.trim();
    if (LEAFY.has(name) && ingredient.role !== "seasoning") names.push(name);
  }
  return names;
}

export function isExploratory(dish: Dish): boolean {
  return dish.familiarity === "supplementary" || (dish.familiarity === "custom" && dish.priority < 50);
}

function isProtein(dish: Dish): boolean {
  return dish.category === "荤菜" || dish.category === "蛋豆" || dish.tags.includes("荤") || dish.tags.includes("蛋");
}

function isVeg(dish: Dish): boolean {
  return dish.category === "素菜" || dish.tags.includes("素");
}

function blocked(dish: Dish): boolean {
  return dish.method === "油炸" || dish.tags.includes("油炸");
}

function signature(group: { id: string }[]): string {
  return group.map((dish) => dish.id).sort().join("|");
}

export function mealSignature(dishes: PlannedDish[]): string {
  return dishes.map((dish) => dish.dishId).sort().join("|");
}

function scoreDish(dish: Dish, ctx: ScoreCtx): number {
  if (dish.status !== "active" || blocked(dish)) return Number.NEGATIVE_INFINITY;
  if (ctx.used.has(dish.id) || ctx.excludeDishIds.has(dish.id)) return Number.NEGATIVE_INFINITY;
  if (dish.usage === "once" && ctx.cookedOnce.has(dish.id)) return Number.NEGATIVE_INFINITY;

  const stock = availability(dish, ctx.inv, ctx.reserved);
  let score = dish.priority + clamp(dish.preferenceScore, -12, 36);
  score += stock.ratio * 40;
  if (stock.full) score += 6;
  if (stock.useSoon) score += 18;

  if (ctx.isWeekday) {
    if (dish.effort === "easy") score += 14;
    else if (dish.effort === "medium") score += 4;
    else score -= 36;
  } else if (dish.effort === "labor" && ctx.laborCount === 0) score += 10;
  else if (dish.effort === "medium") score += 4;

  if (dish.effort === "labor" && ctx.laborCount >= 1) score -= 100;
  if (ctx.cookedRecently.has(dish.id)) score -= 6;

  if (isExploratory(dish)) score += ctx.allowNew && ctx.newCount < 2 ? 24 : -30;
  else score += 4;

  if (ctx.preferFuzhou && dish.isFuzhou && ctx.fuzhouCount < 2) score += 6;

  const unusualMissing = dish.ingredients.filter(
    (ingredient) => ingredient.unusual && !stock.have.has(ingredient.name.trim()),
  );
  score -= unusualMissing.length * 12;

  if (dish.mealRole === "side" && stock.ratio < 1) {
    const leafy = leafyNames(dish);
    const canShare = leafy.some((name) => (ctx.leafyUses.get(name) ?? 0) < (ctx.leafyBudget.get(name) ?? 2));
    score -= canShare ? 6 : 48;
  }

  return score;
}

function leafyAllowed(group: Dish[], ctx: ScoreCtx): boolean {
  const names = new Set<string>();
  for (const dish of group) {
    for (const name of leafyNames(dish)) names.add(name);
  }
  let introducing = false;
  for (const name of names) {
    const used = ctx.leafyUses.get(name) ?? 0;
    if (used >= (ctx.leafyBudget.get(name) ?? 2)) return false;
    if (used === 0) introducing = true;
  }
  if (!introducing) return true;
  for (const [name, used] of ctx.leafyUses) {
    if (names.has(name) || used <= 0) continue;
    if (used < (ctx.leafyBudget.get(name) ?? 2)) return false;
  }
  return true;
}

function shapeScore(group: Dish[], ctx: ScoreCtx): number {
  let score = 0;
  const protein = group.some(isProtein);
  const veg = group.some(isVeg);
  if (protein && veg) score += 16;
  else if (protein && !veg) score -= ctx.meatOnlyStreak >= 1 ? 8 : 3;
  else if (!protein && veg) score -= 3;

  if (group.length === 1 && (group[0]?.mealRole === "complete" || group[0]?.mealRole === "staple")) score += 6;
  if (group.length === 1 && group[0]?.mealRole === "main") score -= 2;
  if (group.length >= 3) score -= 8;
  if (group.some((dish) => dish.effort === "labor") && group.length > 2) score -= 10;

  const leafy = new Set<string>();
  for (const dish of group) {
    for (const name of leafyNames(dish)) leafy.add(name);
  }
  for (const name of leafy) {
    const used = ctx.leafyUses.get(name) ?? 0;
    if (used === 1) score += 18;
    else if (used === 0) score += 3;
  }

  const seen = new Set<string>();
  for (const dish of group) {
    for (const ingredient of dish.ingredients) {
      if (ingredient.role !== "main") continue;
      const key = ingredient.name.trim();
      if (LEAFY.has(key) || seen.has(key)) continue;
      seen.add(key);
      const count = ctx.ingredientUses.get(key) ?? 0;
      if (count === 1) score += 8;
      else if (count >= 2) score -= 8;
    }
  }
  return score;
}

function mealScore(group: Dish[], ctx: ScoreCtx): number {
  const parts = group.map((dish) => scoreDish(dish, ctx));
  if (parts.some((score) => !Number.isFinite(score))) return Number.NEGATIVE_INFINITY;
  const average = parts.reduce((sum, score) => sum + score, 0) / parts.length;
  return average + shapeScore(group, ctx);
}

function candidates(pool: Dish[], ctx: ScoreCtx): Dish[][] {
  const groups: Dish[][] = [];
  const completes = pool.filter((dish) => dish.mealRole === "complete");
  const staples = pool.filter((dish) => dish.mealRole === "staple");
  const mains = pool.filter((dish) => dish.mealRole === "main");
  const sides = pool.filter((dish) => dish.mealRole === "side");
  const soups = pool.filter((dish) => dish.mealRole === "soup");
  const easySoups = soups.filter((dish) => dish.effort === "easy");

  for (const dish of completes) groups.push([dish]);
  for (const dish of staples) groups.push([dish]);
  for (const soup of soups) {
    if (soup.effort === "labor") groups.push([soup]);
  }

  for (const main of mains) {
    groups.push([main]);
    for (const side of sides) {
      const group = [main, side];
      if (leafyAllowed(group, ctx)) groups.push(group);
    }
    for (const soup of soups) {
      if (main.effort === "labor" && soup.effort === "labor") continue;
      groups.push([main, soup]);
    }
  }

  for (const staple of staples) {
    for (const side of sides) {
      const group = [staple, side];
      if (leafyAllowed(group, ctx)) groups.push(group);
    }
  }

  for (const main of mains) {
    if (main.effort === "labor") continue;
    for (const side of sides) {
      for (const soup of easySoups) {
        const group = [main, side, soup];
        if (leafyAllowed(group, ctx)) groups.push(group);
      }
    }
  }
  return groups;
}

interface PickOptions {
  requireNew?: boolean;
  forbidNew?: boolean;
}

function pickBest(pool: Dish[], ctx: ScoreCtx, options: PickOptions): { group: Dish[]; score: number } | null {
  let best: { group: Dish[]; score: number; sig: string } | null = null;
  for (const group of candidates(pool, ctx)) {
    if (!leafyAllowed(group, ctx)) continue;
    const exploratory = group.filter(isExploratory);
    if (exploratory.length > 1) continue;
    if (options.requireNew && exploratory.length !== 1) continue;
    if (options.forbidNew && exploratory.length > 0) continue;
    if (ctx.isWeekday && exploratory.length > 0 && group.some((dish) => dish.effort === "labor")) continue;
    const sig = signature(group);
    if (ctx.excludeSignatures.has(sig)) continue;
    const score = mealScore(group, ctx);
    if (!Number.isFinite(score)) continue;
    if (!best || score > best.score + 0.001 || (Math.abs(score - best.score) <= 0.001 && sig < best.sig)) {
      best = { group, score, sig };
    }
  }
  return best;
}

function explain(group: Dish[], ctx: ScoreCtx, isNew: boolean): string[] {
  const reasons: string[] = [];
  const have = new Set<string>();
  const soon = new Set<string>();
  const unusual = new Set<string>();
  for (const dish of group) {
    const stock = availability(dish, ctx.inv, ctx.reserved);
    for (const name of stock.have) have.add(name);
    for (const name of stock.soonNames) soon.add(name);
    for (const ingredient of dish.ingredients) {
      if (ingredient.unusual && !stock.have.has(ingredient.name.trim())) unusual.add(ingredient.name.trim());
    }
  }
  if (soon.size > 0) reasons.push(`${[...soon].join("、")}快放不住了，适合先做。`);
  for (const name of new Set(group.flatMap(leafyNames))) {
    if ((ctx.leafyUses.get(name) ?? 0) === 1) {
      reasons.push(`「${name}」这周已经用过，这顿继续用完，不用再换一种叶子菜。`);
      break;
    }
  }
  if (have.size > 0) reasons.push(`家里有${[...have].slice(0, 4).join("、")}，可以少买一点。`);
  if (unusual.size > 0) reasons.push(`不好买：${[...unusual].join("、")}。`);
  if (ctx.isWeekday && group.every((dish) => dish.effort !== "labor")) reasons.push("工作日选了好做的。");
  if (group.some((dish) => dish.effort === "labor")) reasons.push("这周只安排这一顿费时的，其余从简。");
  if (isNew && group.some((dish) => !isExploratory(dish))) reasons.push("主菜是你们会做的，搭配这周想试试的菜。");
  else if (isNew) reasons.push("这是本周的可选新菜，不喜欢就换掉。");
  else if (group.some((dish) => dish.familiarity === "familiar")) reasons.push("优先用你们平时会做的菜。");
  if (ctx.preferFuzhou && group.some((dish) => dish.isFuzhou)) reasons.push("带一点福州家常的味道。");
  if (group.length === 1) reasons.push("一道就够吃，没有硬凑第二道。");
  if (reasons.length === 0) reasons.push("按家里现有的菜、好不好做和这周有没有重复来排的。");
  return reasons.slice(0, 5);
}

function toDraft(group: Dish[], ctx: ScoreCtx): MealDraft {
  const isNew = group.some(isExploratory);
  return {
    dishes: group.map((dish) => ({ dishId: dish.id, name: dish.name })),
    reasons: explain(group, ctx, isNew),
    effort: maxEffort(group.map((dish) => dish.effort)),
    isNew,
  };
}

interface Placed {
  date: string;
  dishes: Dish[];
  isNew: boolean;
}

function emptyUsage() {
  return {
    used: new Set<string>(),
    leafyUses: new Map<string, number>(),
    ingredientUses: new Map<string, number>(),
    laborCount: 0,
    newCount: 0,
    fuzhouCount: 0,
    meatOnlyStreak: 0,
    reserved: new Map<string, number>(),
  };
}

function applyPlaced(usage: ReturnType<typeof emptyUsage>, dishIdsFrom: Dish[]) {
  for (const dish of dishIdsFrom) usage.used.add(dish.id);
  const leafy = new Set<string>();
  let labor = false;
  let exploratory = false;
  let fuzhou = false;
  for (const dish of dishIdsFrom) {
    if (dish.effort === "labor") labor = true;
    if (isExploratory(dish)) exploratory = true;
    if (dish.isFuzhou) fuzhou = true;
    for (const name of leafyNames(dish)) leafy.add(name);
    for (const ingredient of dish.ingredients) {
      if (ingredient.role === "seasoning") continue;
      const name = ingredient.name.trim();
      const key = `${name}|${ingredient.unit}`;
      usage.reserved.set(key, (usage.reserved.get(key) ?? 0) + ingredient.quantity);
      if (ingredient.role === "main" && !LEAFY.has(name)) {
        usage.ingredientUses.set(name, (usage.ingredientUses.get(name) ?? 0) + 1);
      }
    }
  }
  for (const name of leafy) usage.leafyUses.set(name, (usage.leafyUses.get(name) ?? 0) + 1);
  if (labor) usage.laborCount += 1;
  if (exploratory) usage.newCount += 1;
  if (fuzhou) usage.fuzhouCount += 1;
  const protein = dishIdsFrom.some(isProtein);
  const veg = dishIdsFrom.some(isVeg);
  usage.meatOnlyStreak = protein && !veg ? usage.meatOnlyStreak + 1 : 0;
}

function usageFrom(placed: Placed[], options: { previousOnly?: boolean; before?: string } = {}) {
  const usage = emptyUsage();
  const ordered = [...placed].sort((a, b) => a.date.localeCompare(b.date));
  for (const meal of ordered) {
    if (options.before && meal.date >= options.before) continue;
    applyPlaced(usage, meal.dishes);
  }
  if (!options.previousOnly) {
    const full = emptyUsage();
    for (const meal of ordered) applyPlaced(full, meal.dishes);
    full.meatOnlyStreak = usage.meatOnlyStreak;
    return full;
  }
  return usage;
}

function baseCtx(input: PlannerInput, placed: Placed[], date: string): ScoreCtx {
  const inv = indexInventory(input.inventory);
  const usage = usageFrom(placed);
  const streak = usageFrom(placed, { previousOnly: true, before: date }).meatOnlyStreak;
  return {
    inv,
    leafyBudget: leafyBudget(inv),
    used: usage.used,
    leafyUses: usage.leafyUses,
    ingredientUses: usage.ingredientUses,
    laborCount: usage.laborCount,
    newCount: usage.newCount,
    fuzhouCount: usage.fuzhouCount,
    meatOnlyStreak: streak,
    reserved: usage.reserved,
    isWeekday: isWeekdayDate(date),
    allowNew: false,
    preferFuzhou: input.preferFuzhou,
    cookedRecently: new Set(input.cookedRecently),
    cookedOnce: new Set(input.cookedOnceIds),
    excludeSignatures: new Set(),
    excludeDishIds: new Set(),
  };
}

function activePool(dishes: Dish[], used: Set<string>): Dish[] {
  return dishes.filter((dish) => dish.status === "active" && !blocked(dish) && !used.has(dish.id));
}

function chooseDay(input: PlannerInput, placed: Placed[], date: string, options: PickOptions, exclusions?: { signatures?: string[]; dishIds?: string[] }): MealDraft | null {
  const ctx = baseCtx(input, placed, date);
  ctx.allowNew = Boolean(options.requireNew);
  if (exclusions?.signatures) ctx.excludeSignatures = new Set(exclusions.signatures);
  if (exclusions?.dishIds) ctx.excludeDishIds = new Set(exclusions.dishIds);
  const pool = activePool(input.dishes, ctx.used);
  const picked = pickBest(pool, ctx, options) ?? (options.forbidNew ? pickBest(pool, ctx, {}) : null);
  if (!picked) return null;
  return toDraft(picked.group, ctx);
}

function withAlternatives(input: PlannerInput, placed: Placed[], date: string, primary: MealDraft): { primary: MealDraft; alternatives: MealDraft[] } {
  const alternatives: MealDraft[] = [];
  const excludedIds = new Set(primary.dishes.map((dish) => dish.dishId));
  const excludedSigs = new Set([mealSignature(primary.dishes)]);
  for (let index = 0; index < 3; index += 1) {
    const next = chooseDay(input, placed, date, { forbidNew: !input.exploreNew }, {
      signatures: [...excludedSigs],
      dishIds: [...excludedIds],
    });
    if (!next || next.dishes.length === 0) break;
    alternatives.push(next);
    excludedSigs.add(mealSignature(next.dishes));
    for (const dish of next.dishes) excludedIds.add(dish.dishId);
  }
  return { primary, alternatives };
}

function countsForUsage(meal: PlannedMeal): boolean {
  return meal.status === "suggested" || meal.status === "accepted" || meal.status === "cooked";
}

function resolveDishes(meal: PlannedMeal, dishMap: Map<string, Dish>): Dish[] {
  return meal.dishes.flatMap((dish) => {
    const found = dishMap.get(dish.dishId);
    return found ? [found] : [];
  });
}

function usesSoon(dishes: Dish[], inv: Map<string, InventoryItem[]>): boolean {
  return dishes.some((dish) => availability(dish, inv, new Map()).useSoon);
}

export function recommendDay(
  input: PlannerInput,
  date: string,
  otherMeals: PlannedMeal[],
  exclusions?: { signatures?: string[]; dishIds?: string[] },
): { primary: MealDraft; alternatives: MealDraft[] } {
  const dishMap = new Map(input.dishes.map((dish) => [dish.id, dish]));
  const placed: Placed[] = otherMeals.filter(countsForUsage).map((meal) => ({
    date: meal.date,
    dishes: resolveDishes(meal, dishMap),
    isNew: meal.isNew,
  }));
  const primary = chooseDay(input, placed, date, { forbidNew: true }, exclusions)
    ?? chooseDay(input, placed, date, {}, exclusions);
  if (!primary) {
    const fallback = input.dishes.find((dish) => dish.status === "active" && !blocked(dish));
    const empty: MealDraft = {
      dishes: fallback ? [{ dishId: fallback.id, name: fallback.name }] : [],
      reasons: ["菜库里能用的菜不多，先从这一道开始。"],
      effort: fallback?.effort ?? "easy",
      isNew: fallback ? isExploratory(fallback) : false,
    };
    return { primary: empty, alternatives: [] };
  }
  return withAlternatives(input, placed, date, primary);
}

export function recommendWeek(input: PlannerInput, dates: string[], locked: PlannedMeal[]): Map<string, { primary: MealDraft; alternatives: MealDraft[] }> {
  const dishMap = new Map(input.dishes.map((dish) => [dish.id, dish]));
  const lockedDates = new Set(locked.map((meal) => meal.date));
  const placed: Placed[] = locked.filter(countsForUsage).map((meal) => ({
    date: meal.date,
    dishes: resolveDishes(meal, dishMap),
    isNew: meal.isNew,
  }));
  const result = new Map<string, { primary: MealDraft; alternatives: MealDraft[] }>();

  for (const date of dates) {
    if (lockedDates.has(date)) continue;
    const primary = chooseDay(input, placed, date, { forbidNew: true });
    if (!primary) continue;
    const group = primary.dishes.flatMap((dish) => {
      const found = dishMap.get(dish.dishId);
      return found ? [found] : [];
    });
    placed.push({ date, dishes: group, isNew: primary.isNew });
    result.set(date, withAlternatives(input, placed.filter((meal) => meal.date !== date), date, primary));
  }

  if (input.exploreNew) {
    const inv = indexInventory(input.inventory);
    const order = [5, 6, 3, 4, 2, 1, 0];
    let added = placed.filter((meal) => meal.isNew).length;
    for (const index of order) {
      if (added >= 2) break;
      const date = dates[index];
      if (!date || lockedDates.has(date)) continue;
      const current = placed.find((meal) => meal.date === date);
      if (!current || current.isNew || usesSoon(current.dishes, inv)) continue;
      const others = placed.filter((meal) => meal.date !== date);
      const primary = chooseDay(input, others, date, { requireNew: true });
      if (!primary) continue;
      const group = primary.dishes.flatMap((dish) => {
        const found = dishMap.get(dish.dishId);
        return found ? [found] : [];
      });
      const nextPlaced = others.concat({ date, dishes: group, isNew: true });
      const replacement = placed.findIndex((meal) => meal.date === date);
      if (replacement >= 0) placed.splice(replacement, 1, { date, dishes: group, isNew: true });
      result.set(date, withAlternatives(input, nextPlaced.filter((meal) => meal.date !== date), date, primary));
      added += 1;
    }
  }

  return result;
}

export function describeDishes(input: PlannerInput, date: string, otherMeals: PlannedMeal[], dishIds: string[]): MealDraft {
  const dishMap = new Map(input.dishes.map((dish) => [dish.id, dish]));
  const group = dishIds.flatMap((id) => {
    const dish = dishMap.get(id);
    return dish ? [dish] : [];
  });
  const placed = otherMeals.filter(countsForUsage).map((meal) => ({
    date: meal.date,
    dishes: resolveDishes(meal, dishMap),
    isNew: meal.isNew,
  }));
  const ctx = baseCtx(input, placed, date);
  if (group.length === 0) {
    return { dishes: [], reasons: ["这顿还没有菜。"], effort: "easy", isNew: false };
  }
  return toDraft(group, ctx);
}

export function unusualIngredientNames(dishes: Dish[], dishIds: string[]): string[] {
  const names = new Set<string>();
  for (const id of dishIds) {
    const dish = dishes.find((item) => item.id === id);
    if (!dish) continue;
    for (const ingredient of dish.ingredients) {
      if (ingredient.unusual) names.add(ingredient.name.trim());
    }
  }
  return [...names];
}
