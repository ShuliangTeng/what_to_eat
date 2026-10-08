import { isWeekdayDate, weekdayLabel } from "../lib/dates";
import { createDemoData } from "../lib/demo-data";
import { recalculateGroceries } from "../lib/grocery";
import { acceptMeal, cycleMeal, skipMeal } from "../lib/reduce";
import type { AppData, Dish } from "../lib/types";

const today = "2026-10-08";
const data = createDemoData(today);
const dishMap = new Map(data.dishes.map((dish) => [dish.id, dish]));

function names(ids: string[]) {
  return ids.map((id) => dishMap.get(id)?.name ?? id).join(" + ");
}

const seen = new Set<string>();
let labor = 0;
let exploratory = 0;
let greens = 0;
let vegMeals = 0;
let weekdayLabor = 0;

for (const meal of data.meals) {
  const dishes = meal.dishes.flatMap((item) => {
    const dish = dishMap.get(item.dishId);
    return dish ? [dish] : [];
  });
  console.log(`${meal.date} ${weekdayLabel(meal.date)} ${meal.isNew ? "新" : "常"} ${meal.effort} ${names(meal.dishes.map((item) => item.dishId))}`);
  console.log(`  ${meal.reasons.join(" / ")}`);
  if (meal.reasons.length === 0) throw new Error("missing reasons");
  for (const dish of dishes) {
    if (seen.has(dish.id)) throw new Error(`重复：${dish.name}`);
    seen.add(dish.id);
    if (dish.method === "油炸" || dish.tags.includes("油炸")) throw new Error("油炸");
    if (dish.ingredients.some((ingredient) => ingredient.name.trim() === "青菜")) greens += 1;
  }
  if (dishes.some((dish) => dish.effort === "labor")) {
    labor += 1;
    if (isWeekdayDate(meal.date)) weekdayLabor += 1;
  }
  if (meal.isNew) exploratory += 1;
  if (dishes.some((dish) => dish.category === "素菜" || dish.tags.includes("素"))) vegMeals += 1;
}

if (data.meals.length !== 7) throw new Error(`天数 ${data.meals.length}`);
if (labor > 1) throw new Error(`费时过多 ${labor}`);
if (weekdayLabor > 0) throw new Error("工作日有费时菜");
if (exploratory < 1 || exploratory > 2) throw new Error(`新菜数量 ${exploratory}`);
if (greens < 1 || greens > 2) throw new Error(`青菜出现 ${greens} 次`);
if (vegMeals < 2) throw new Error(`素菜太少 ${vegMeals}`);

const skipped = skipMeal(data, today, "skipped");
for (const dish of data.dishes) {
  const after = skipped.dishes.find((item) => item.id === dish.id);
  if (after?.preferenceScore !== dish.preferenceScore) throw new Error("跳过改变了偏好");
}

const accepted = acceptMeal(data, today);
const todayMeal = data.meals.find((meal) => meal.date === today);
if (!todayMeal) throw new Error("no today");
for (const planned of todayMeal.dishes) {
  const before = data.dishes.find((dish) => dish.id === planned.dishId)?.preferenceScore ?? 0;
  const after = accepted.dishes.find((dish) => dish.id === planned.dishId)?.preferenceScore ?? 0;
  if (after !== before + 2) throw new Error("选定没有加分");
}

const cycled = cycleMeal(data, today, today);
const removed = todayMeal.dishes.filter((dish) => !cycled.meals.find((meal) => meal.date === today)?.dishes.some((item) => item.dishId === dish.dishId));
if (removed.length === 0) throw new Error("换一顿没有换掉菜");
for (const dish of removed) {
  const before = data.dishes.find((item) => item.id === dish.dishId)?.preferenceScore ?? 0;
  const after = cycled.dishes.find((item) => item.id === dish.dishId)?.preferenceScore ?? 0;
  if (after !== before - 1) throw new Error("换掉没有轻微减分");
}

const wings = data.dishes.find((dish) => dish.name === "可乐鸡翅") as Dish;
const groceryData: AppData = {
  ...data,
  meals: data.meals.map((meal) =>
    meal.date === today
      ? { ...meal, status: "accepted", dishes: [{ dishId: wings.id, name: wings.name }], alternatives: [] }
      : { ...meal, status: "skipped", dishes: [] },
  ),
};
const groceries = recalculateGroceries(groceryData);
if (groceries.some((item) => item.name === "鸡翅" || item.name === "可乐")) throw new Error("库存够的食材仍被列入采购");

const mismatch: AppData = {
  ...groceryData,
  inventory: groceryData.inventory.map((item) => (item.name === "鸡翅" ? { ...item, unit: "克", quantity: 500 } : item)),
};
const mismatched = recalculateGroceries(mismatch);
const wingRow = mismatched.find((item) => item.name === "鸡翅");
if (!wingRow || !wingRow.note.includes("对不上")) throw new Error("单位不同时应提示且不扣减");

console.log("检查通过");
console.log(`费时 ${labor}，新菜 ${exploratory}，青菜 ${greens}，含素 ${vegMeals}`);
