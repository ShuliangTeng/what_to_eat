import { mondayOf, todayISO, weekDates } from "@/lib/dates";
import { createServerSupabase } from "@/lib/supabase/server";
import type {
  AppData,
  Dish,
  DishIngredient,
  Effort,
  Familiarity,
  GroceryItem,
  IngredientRole,
  InventoryItem,
  MealAlternative,
  MealRole,
  MealStatus,
  MemberRole,
  PlannedDish,
  PlannedMeal,
  StorageLocation,
} from "@/lib/types";

export interface CloudSession {
  email: string | null;
  userId: string;
}

type LoadResult =
  | { kind: "signed-out" }
  | { kind: "needs-household"; session: CloudSession }
  | { kind: "ready"; session: CloudSession; data: AppData };

interface DishRow {
  id: string;
  name: string;
  tags: string[] | null;
  category: string;
  method: string;
  effort: Effort;
  familiarity: Familiarity;
  priority: number;
  status: Dish["status"];
  usage: Dish["usage"];
  is_fuzhou: boolean;
  meal_role: MealRole;
  preference_score: number;
}

interface IngredientRow {
  id: string;
  dish_id: string;
  name: string;
  quantity: number | string;
  unit: string;
  role: IngredientRole;
  unusual: boolean;
  position: number;
}

interface MealDishRow {
  id: string;
  planned_meal_id: string;
  dish_id: string | null;
  dish_name: string;
  position: number;
}

interface MealRow {
  id: string;
  meal_date: string;
  status: string;
  reasons: unknown;
  effort: string;
  is_new: boolean;
  alternatives: unknown;
}

interface MemberRow {
  id: string;
  role: string;
  display_name: string | null;
}

interface InventoryRow {
  id: string;
  name: string;
  quantity: number | string;
  unit: string;
  location: StorageLocation;
  use_soon: boolean;
}

interface GroceryRow {
  id: string;
  name: string;
  quantity: number | string;
  unit: string;
  status: string;
  source: string;
  note: string | null;
  added_to_inventory: boolean;
  purchased_at: string | null;
}

interface CookedRow {
  id: string;
  meal_date: string;
}

interface HistoryDishRow {
  planned_meal_id: string;
  dish_name: string;
}

function asNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

export function explainSupabaseError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (!message) return "没有完成操作。";
  if (/[\u4e00-\u9fff]/.test(message)) return message;
  if (message.includes("does not exist")) return "数据库表还没建好。请先在 Supabase 的 SQL Editor 里运行项目中的迁移文件。";
  if (message.toLowerCase().includes("jwt") || message.toLowerCase().includes("invalid claim")) return "登录过期了，请重新登录。";
  if (message.toLowerCase().includes("fetch")) return "网络连不上 Supabase。";
  if (/anonymous/i.test(message)) return "云端会话还没打开。请在 Supabase 的 Authentication、Sign In / Providers 里启用 Anonymous。";
  return "没有保存成功，请稍后再试。";
}

async function db() {
  return createServerSupabase();
}

async function ensureDevice(supabase: Awaited<ReturnType<typeof db>>) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const missing = Boolean(userError && /session missing/i.test(userError.message));
  if (userError && !missing) throwIfError(userError);
  let user = userData.user;
  if (!user) {
    const signed = await supabase.auth.signInAnonymously();
    if (signed.error) throw new Error(explainSupabaseError(signed.error));
    user = signed.data.user;
  }
  if (!user) throw new Error("这台设备还没有连上。");
  const { data: membership, error: memberError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", user.id)
    .maybeSingle();
  throwIfError(memberError);
  if (!membership?.household_id) {
    const { error } = await supabase.rpc("create_household", { household_name: "我们的小厨房" });
    throwIfError(error);
  }
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(explainSupabaseError(error));
}

function readAlternatives(value: unknown): MealAlternative[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (!Array.isArray(record.dishes)) return [];
    const dishes = record.dishes.flatMap((dish) => {
      if (!dish || typeof dish !== "object") return [];
      const row = dish as Record<string, unknown>;
      if (typeof row.dishId !== "string" || typeof row.name !== "string") return [];
      return [{ dishId: row.dishId, name: row.name }];
    });
    const effort = record.effort === "medium" || record.effort === "labor" ? record.effort : "easy";
    return [{
      dishes,
      reasons: Array.isArray(record.reasons) ? record.reasons.filter((reason): reason is string => typeof reason === "string") : [],
      effort,
      isNew: Boolean(record.isNew),
    }];
  });
}

function readStatus(value: string): MealStatus {
  if (value === "accepted" || value === "cooked" || value === "skipped" || value === "postponed" || value === "eating_out") return value;
  return "suggested";
}

export async function loadCloud(today = todayISO()): Promise<LoadResult> {
  const supabase = await db();
  await ensureDevice(supabase);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError && /session missing/i.test(userError.message)) return { kind: "signed-out" };
  throwIfError(userError);
  const user = userData.user;
  if (!user) return { kind: "signed-out" };
  const session = { email: user.email ?? null, userId: user.id };

  const { data: membership, error: memberError } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  throwIfError(memberError);
  if (!membership?.household_id) return { kind: "needs-household", session };

  const householdId = membership.household_id as string;
  const monday = mondayOf(today);
  const weekEnd = weekDates(monday)[6];

  const [household, settings, members, dishes, ingredients, inventory, meals, mealDishes, groceries, cooked] = await Promise.all([
    supabase.from("households").select("id, name").eq("id", householdId).single(),
    supabase.from("household_settings").select("prefer_fuzhou, explore_new").eq("household_id", householdId).maybeSingle(),
    supabase.from("household_members").select("id, role, display_name").eq("household_id", householdId),
    supabase.from("dishes").select("id, name, tags, category, method, effort, familiarity, priority, status, usage, is_fuzhou, meal_role, preference_score").eq("household_id", householdId),
    supabase.from("dish_ingredients").select("id, dish_id, name, quantity, unit, role, unusual, position").eq("household_id", householdId),
    supabase.from("inventory_items").select("id, name, quantity, unit, location, use_soon").eq("household_id", householdId),
    supabase.from("planned_meals").select("id, meal_date, status, reasons, effort, is_new, alternatives").eq("household_id", householdId).gte("meal_date", monday).lte("meal_date", weekEnd),
    supabase.from("planned_meal_dishes").select("id, planned_meal_id, dish_id, dish_name, position").eq("household_id", householdId),
    supabase.from("grocery_items").select("id, name, quantity, unit, status, source, note, added_to_inventory, purchased_at").eq("household_id", householdId),
    supabase.from("planned_meals").select("id, meal_date, status").eq("household_id", householdId).eq("status", "cooked").order("meal_date", { ascending: false }).limit(30),
  ]);
  for (const result of [household, settings, members, dishes, ingredients, inventory, meals, mealDishes, groceries, cooked]) {
    throwIfError(result.error);
  }
  if (!household.data) throw new Error("没有找到这个家庭。");

  const ingredientRows = (ingredients.data ?? []) as IngredientRow[];
  const byDish = new Map<string, DishIngredient[]>();
  for (const row of ingredientRows.sort((a, b) => a.position - b.position)) {
    const list = byDish.get(row.dish_id) ?? [];
    list.push({
      id: row.id,
      name: row.name,
      quantity: asNumber(row.quantity),
      unit: row.unit,
      role: row.role,
      unusual: row.unusual,
    });
    byDish.set(row.dish_id, list);
  }

  const dishRows = (dishes.data ?? []) as DishRow[];
  const dishList: Dish[] = dishRows.map((row) => ({
    id: row.id,
    name: row.name,
    tags: row.tags ?? [],
    category: row.category,
    method: row.method,
    effort: row.effort,
    familiarity: row.familiarity,
    priority: row.priority,
    status: row.status,
    usage: row.usage,
    isFuzhou: row.is_fuzhou,
    mealRole: row.meal_role,
    preferenceScore: row.preference_score,
    ingredients: byDish.get(row.id) ?? [],
  }));

  const plannedRows = (mealDishes.data ?? []) as MealDishRow[];
  const mealRows = (meals.data ?? []) as MealRow[];
  const plannedMeals: PlannedMeal[] = mealRows.map((row) => {
    const dishesForMeal = plannedRows
      .filter((item) => item.planned_meal_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map((item): PlannedDish => ({ dishId: item.dish_id ?? "", name: item.dish_name }));
    const effort = row.effort === "medium" || row.effort === "labor" ? row.effort : "easy";
    return {
      id: row.id,
      date: row.meal_date,
      status: readStatus(row.status),
      dishes: dishesForMeal.filter((dish) => dish.dishId),
      reasons: Array.isArray(row.reasons) ? row.reasons : [],
      alternatives: readAlternatives(row.alternatives),
      effort,
      isNew: Boolean(row.is_new),
    };
  });

  const cookedRows = (cooked.data ?? []) as CookedRow[];
  const cookedIds = new Set(cookedRows.map((row) => row.id));
  const historyNames = new Map<string, string[]>();
  if (cookedIds.size > 0) {
    const { data: cookedDishes, error } = await supabase
      .from("planned_meal_dishes")
      .select("planned_meal_id, dish_name, position")
      .in("planned_meal_id", [...cookedIds]);
    throwIfError(error);
    for (const row of (cookedDishes ?? []) as HistoryDishRow[]) {
      const list = historyNames.get(row.planned_meal_id) ?? [];
      list.push(row.dish_name);
      historyNames.set(row.planned_meal_id, list);
    }
  }

  const data: AppData = {
    household: {
      id: household.data.id,
      name: household.data.name,
      inviteCode: "",
    },
    members: ((members.data ?? []) as MemberRow[]).map((member) => ({
      id: member.id,
      name: member.display_name || "家人",
      role: (member.role === "owner" ? "owner" : "member") as MemberRole,
    })),
    settings: {
      preferFuzhou: settings.data?.prefer_fuzhou ?? true,
      exploreNew: settings.data?.explore_new ?? true,
    },
    dishes: dishList,
    inventory: ((inventory.data ?? []) as InventoryRow[]).map((item): InventoryItem => ({
      id: item.id,
      name: item.name,
      quantity: asNumber(item.quantity),
      unit: item.unit,
      location: item.location,
      useSoon: item.use_soon,
    })),
    weekStart: monday,
    meals: plannedMeals,
    groceries: ((groceries.data ?? []) as GroceryRow[]).map((item): GroceryItem => ({
      id: item.id,
      name: item.name,
      quantity: asNumber(item.quantity),
      unit: item.unit,
      status: item.status === "purchased" ? "purchased" : "needed",
      source: item.source === "manual" ? "manual" : "calculated",
      note: item.note ?? "",
      addedToInventory: item.added_to_inventory,
      purchasedAt: item.purchased_at,
    })),
    history: cookedRows
      .filter((row) => row.meal_date < monday)
      .map((row) => ({ id: row.id, date: row.meal_date, dishNames: historyNames.get(row.id) ?? [] })),
  };

  return { kind: "ready", session, data };
}

export interface DirtyFlags {
  dishes?: boolean;
  inventory?: boolean;
  meals?: boolean;
  groceries?: boolean;
  settings?: boolean;
}

function preferenceEvents(before: Dish[], after: Dish[]) {
  const previous = new Map(before.map((dish) => [dish.id, dish.preferenceScore]));
  return after.flatMap((dish) => {
    const delta = dish.preferenceScore - (previous.get(dish.id) ?? dish.preferenceScore);
    if (!previous.has(dish.id) || delta === 0) return [];
    const eventType = delta >= 5 ? "favorite" : delta === 1 ? "cooked" : delta > 0 ? "selected" : "replaced";
    return [{ dish_id: dish.id, event_type: eventType, delta }];
  });
}

async function removeMissing(table: "dishes" | "dish_ingredients" | "inventory_items" | "grocery_items" | "planned_meal_dishes", householdId: string, keep: string[], column = "id") {
  const supabase = await db();
  const { data, error } = await supabase.from(table).select(column).eq("household_id", householdId);
  throwIfError(error);
  const keepSet = new Set(keep);
  const stale = ((data ?? []) as unknown as Record<string, string>[]).flatMap((row) => {
    const value = row[column];
    return value && !keepSet.has(value) ? [value] : [];
  });
  if (stale.length === 0) return;
  const { error: deleteError } = await supabase.from(table).delete().in(column, stale);
  throwIfError(deleteError);
}

export async function pushCloud(data: AppData, dirty: DirtyFlags, previous: AppData | null) {
  const supabase = await db();
  const householdId = data.household.id;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  throwIfError(userError);
  const userId = userData.user?.id;
  if (!userId) throw new Error("登录过期了，请重新登录。");

  if (dirty.settings) {
    const { error } = await supabase.from("household_settings").upsert({
      household_id: householdId,
      prefer_fuzhou: data.settings.preferFuzhou,
      explore_new: data.settings.exploreNew,
    });
    throwIfError(error);
    const { error: nameError } = await supabase.from("households").update({ name: data.household.name }).eq("id", householdId);
    if (nameError && !nameError.message.includes("row-level")) throwIfError(nameError);
  }

  if (dirty.dishes) {
    const { error } = await supabase.from("dishes").upsert(data.dishes.map((dish) => ({
      id: dish.id,
      household_id: householdId,
      name: dish.name,
      tags: dish.tags,
      category: dish.category,
      method: dish.method,
      effort: dish.effort,
      familiarity: dish.familiarity,
      priority: dish.priority,
      status: dish.status,
      usage: dish.usage,
      is_fuzhou: dish.isFuzhou,
      meal_role: dish.mealRole,
      preference_score: dish.preferenceScore,
    })));
    throwIfError(error);
    const ingredientRows = data.dishes.flatMap((dish) => dish.ingredients.map((ingredient, position) => ({
      id: ingredient.id,
      dish_id: dish.id,
      household_id: householdId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      role: ingredient.role,
      unusual: ingredient.unusual,
      position,
    })));
    if (ingredientRows.length > 0) {
      const { error: ingredientError } = await supabase.from("dish_ingredients").upsert(ingredientRows);
      throwIfError(ingredientError);
    }
    await removeMissing("dishes", householdId, data.dishes.map((dish) => dish.id));
    await removeMissing("dish_ingredients", householdId, ingredientRows.map((row) => row.id));
    const events = preferenceEvents(previous?.dishes ?? [], data.dishes);
    if (events.length > 0) {
      const { error: eventError } = await supabase.from("preference_events").insert(events.map((event) => ({
        ...event,
        household_id: householdId,
        user_id: userId,
      })));
      throwIfError(eventError);
    }
  }

  if (dirty.inventory) {
    if (data.inventory.length > 0) {
      const { error } = await supabase.from("inventory_items").upsert(data.inventory.map((item) => ({
        id: item.id,
        household_id: householdId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        location: item.location,
        use_soon: item.useSoon,
      })));
      throwIfError(error);
    }
    await removeMissing("inventory_items", householdId, data.inventory.map((item) => item.id));
  }

  if (dirty.meals) {
    const { data: plan, error: planError } = await supabase
      .from("meal_plans")
      .upsert({ household_id: householdId, week_start: data.weekStart }, { onConflict: "household_id,week_start" })
      .select("id")
      .single();
    throwIfError(planError);
    const { error } = await supabase.from("planned_meals").upsert(data.meals.map((meal) => ({
      id: meal.id,
      meal_plan_id: plan?.id,
      household_id: householdId,
      meal_date: meal.date,
      status: meal.status,
      reasons: meal.reasons,
      effort: meal.effort,
      is_new: meal.isNew,
      alternatives: meal.alternatives,
    })));
    throwIfError(error);
    const links = data.meals.flatMap((meal) => meal.dishes.map((dish, position) => ({
      id: crypto.randomUUID(),
      planned_meal_id: meal.id,
      household_id: householdId,
      dish_id: dish.dishId,
      dish_name: dish.name,
      position,
    })));
    if (data.meals.length > 0) {
      const { error: clearError } = await supabase.from("planned_meal_dishes").delete().in("planned_meal_id", data.meals.map((meal) => meal.id));
      throwIfError(clearError);
    }
    if (links.length > 0) {
      const { error: linkError } = await supabase.from("planned_meal_dishes").insert(links);
      throwIfError(linkError);
    }
  }

  if (dirty.groceries) {
    if (data.groceries.length > 0) {
      const { error } = await supabase.from("grocery_items").upsert(data.groceries.map((item) => ({
        id: item.id,
        household_id: householdId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        status: item.status,
        source: item.source,
        note: item.note,
        added_to_inventory: item.addedToInventory,
        purchased_at: item.purchasedAt,
      })));
      throwIfError(error);
    }
    await removeMissing("grocery_items", householdId, data.groceries.map((item) => item.id));
  }
}

export async function createPairingCode() {
  const supabase = await db();
  const { data, error } = await supabase.rpc("create_pairing_code");
  throwIfError(error);
  if (typeof data !== "string" || data.length !== 8) throw new Error("配对码没有生成成功。");
  return data;
}

export async function redeemPairingCode(code: string, confirmSwitch: boolean) {
  const supabase = await db();
  const { error } = await supabase.rpc("redeem_pairing_code", {
    raw_code: code,
    confirm_switch: confirmSwitch,
  });
  throwIfError(error);
}
