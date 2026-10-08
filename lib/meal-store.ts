"use client";

import { useSyncExternalStore } from "react";
import { cloneSeedDishes, createHousehold, joinHousehold, loadCloud, pushCloud, sendMagicLink, signOutCloud, type DirtyFlags } from "@/lib/cloud";
import { createDemoData } from "@/lib/demo-data";
import { todayISO } from "@/lib/dates";
import {
  acceptMeal,
  addManualGrocery,
  applyAlternative,
  cookMeal,
  cycleMeal,
  deleteDish,
  deleteGrocery,
  deleteInventory,
  ensureWeek,
  favoriteDish,
  fillOpenDays,
  moveGroceryToInventory,
  postponeMeal,
  regenerateDay,
  replaceDish,
  saveDish,
  saveInventory,
  setDishStatus,
  setGroceryPurchased,
  setMealDishes,
  skipMeal,
  updateGroceryQuantity,
  updateSettings,
  type DishDraft,
} from "@/lib/reduce";
import { supabaseConfigured } from "@/lib/supabase/env";
import type { AppData, Dish, InventoryItem, StorageLocation } from "@/lib/types";

const STORAGE_KEY = "meal-planner-demo-v1";

export interface Snapshot {
  status: "loading" | "ready" | "signed-out" | "needs-household" | "offline";
  mode: "demo" | "cloud";
  data: AppData | null;
  error: string | null;
  email: string | null;
}

const serverSnapshot: Snapshot = { status: "loading", mode: "demo", data: null, error: null, email: null };
let snapshot: Snapshot = serverSnapshot;
const listeners = new Set<() => void>();
let starting: Promise<void> | null = null;
let writing = false;

function emit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "没有完成这个操作。";
}

function readDemo(today: string): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createDemoData(today);
  try {
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed?.household || !Array.isArray(parsed.dishes) || !Array.isArray(parsed.meals)) return createDemoData(today);
    return ensureWeek(parsed, today);
  } catch {
    return createDemoData(today);
  }
}

async function start() {
  const today = todayISO();
  if (!supabaseConfigured()) {
    const data = readDemo(today);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    emit({ status: "ready", mode: "demo", data, error: null, email: null });
    return;
  }

  try {
    const loaded = await loadCloud(today);
    if (loaded.kind === "signed-out") {
      emit({ status: "signed-out", mode: "cloud", data: null, error: null, email: null });
      return;
    }
    if (loaded.kind === "needs-household") {
      emit({ status: "needs-household", mode: "cloud", data: null, error: null, email: loaded.session.email });
      return;
    }
    let data = loaded.data;
    const dirty: DirtyFlags = {};
    if (data.dishes.length === 0) {
      data = { ...data, dishes: cloneSeedDishes() };
      dirty.dishes = true;
    }
    const planned = ensureWeek(data, today);
    if (planned !== data) {
      data = planned;
      dirty.meals = true;
      dirty.groceries = true;
      if (dirty.dishes) dirty.dishes = true;
    }
    emit({ status: "ready", mode: "cloud", data, error: null, email: loaded.session.email });
    if (dirty.dishes || dirty.meals || dirty.groceries) await pushCloud(data, dirty, null);
  } catch (error) {
    emit({ status: "offline", mode: "cloud", data: null, error: messageOf(error), email: null });
  }
}

export function ensureStarted() {
  if (!starting) {
    starting = start().catch((error) => {
      starting = null;
      emit({ status: "offline", mode: supabaseConfigured() ? "cloud" : "demo", data: null, error: messageOf(error), email: null });
    });
  }
  return starting;
}

async function reload() {
  starting = null;
  emit({ ...serverSnapshot, mode: supabaseConfigured() ? "cloud" : "demo" });
  await ensureStarted();
}

function commit(recipe: (data: AppData) => AppData, dirty: DirtyFlags) {
  const current = snapshot.data;
  if (!current || snapshot.status !== "ready" || writing) return;
  let next: AppData;
  try {
    next = recipe(current);
  } catch (error) {
    emit({ ...snapshot, error: messageOf(error) });
    return;
  }
  const mode = snapshot.mode;
  writing = true;
  emit({ ...snapshot, data: next, error: null });
  void (async () => {
    try {
      if (mode === "demo") localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else await pushCloud(next, dirty, current);
    } catch (error) {
      emit({ ...snapshot, data: next, error: messageOf(error) });
    } finally {
      writing = false;
    }
  })();
}

export const mealActions = {
  accept: (date: string) => commit((data) => acceptMeal(data, date), { meals: true, groceries: true, dishes: true }),
  cook: (date: string) => commit((data) => cookMeal(data, date), { meals: true, groceries: true, dishes: true }),
  skip: (date: string, kind: "skipped" | "eating_out") => commit((data) => skipMeal(data, date, kind), { meals: true, groceries: true }),
  postpone: (from: string, to: string) => commit((data) => postponeMeal(data, from, to), { meals: true, groceries: true, dishes: true }),
  cycle: (date: string) => commit((data) => cycleMeal(data, date), { meals: true, groceries: true, dishes: true }),
  alternative: (date: string, index: number) => commit((data) => applyAlternative(data, date, index), { meals: true, groceries: true, dishes: true }),
  replaceDish: (date: string, fromId: string, toId: string) => commit((data) => replaceDish(data, date, fromId, toId), { meals: true, groceries: true, dishes: true }),
  setDishes: (date: string, dishIds: string[]) => commit((data) => setMealDishes(data, date, dishIds), { meals: true, groceries: true, dishes: true }),
  regenerateDay: (date: string) => commit((data) => regenerateDay(data, date), { meals: true, groceries: true, dishes: true }),
  regenerateOpenDays: () => commit((data) => fillOpenDays(data), { meals: true, groceries: true }),
  saveDish: (draft: DishDraft) => commit((data) => saveDish(data, draft), { dishes: true, groceries: true }),
  setDishStatus: (dishId: string, status: Dish["status"]) => commit((data) => setDishStatus(data, dishId, status), { dishes: true }),
  favoriteDish: (dishId: string) => commit((data) => favoriteDish(data, dishId), { dishes: true }),
  deleteDish: (dishId: string) => commit((data) => deleteDish(data, dishId), { dishes: true, meals: true, groceries: true }),
  saveInventory: (item: InventoryItem) => commit((data) => saveInventory(data, item), { inventory: true, groceries: true }),
  deleteInventory: (itemId: string) => commit((data) => deleteInventory(data, itemId), { inventory: true, groceries: true }),
  updateGroceryQuantity: (itemId: string, quantity: number) => commit((data) => updateGroceryQuantity(data, itemId, quantity), { groceries: true }),
  setGroceryPurchased: (itemId: string, purchased: boolean) => commit((data) => setGroceryPurchased(data, itemId, purchased), { groceries: true }),
  addGrocery: (name: string, quantity: number, unit: string) => commit((data) => addManualGrocery(data, name, quantity, unit), { groceries: true }),
  deleteGrocery: (itemId: string) => commit((data) => deleteGrocery(data, itemId), { groceries: true }),
  moveGrocery: (groceryId: string, location: StorageLocation) => commit((data) => moveGroceryToInventory(data, groceryId, location), { groceries: true, inventory: true }),
  updateSettings: (settings: AppData["settings"]) => commit((data) => updateSettings(data, settings), { settings: true }),
  resetDemo: () => {
    if (snapshot.mode !== "demo") return;
    localStorage.removeItem(STORAGE_KEY);
    const data = createDemoData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    emit({ status: "ready", mode: "demo", data, error: null, email: null });
  },
  clearError: () => emit({ ...snapshot, error: null }),
  sendMagicLink,
  createHousehold: async (name: string) => {
    await createHousehold(name);
    await reload();
  },
  joinHousehold: async (code: string) => {
    await joinHousehold(code);
    await reload();
  },
  signOut: async () => {
    await signOutCloud();
    await reload();
  },
};

export function useMealApp() {
  const value = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  return value;
}

export function startMealApp() {
  void ensureStarted();
}
