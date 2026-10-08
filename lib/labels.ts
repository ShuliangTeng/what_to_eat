import type { Effort, MealStatus, StorageLocation } from "@/lib/types";

export const EFFORT_LABEL: Record<Effort, string> = {
  easy: "轻松",
  medium: "中等",
  labor: "费时",
};

export const STATUS_LABEL: Record<MealStatus, string> = {
  suggested: "建议",
  accepted: "就吃这个",
  cooked: "做过了",
  skipped: "今天不做",
  postponed: "改期",
  eating_out: "出去吃",
};

export const LOCATION_LABEL: Record<StorageLocation, string> = {
  refrigerator: "冷藏",
  freezer: "冷冻",
  pantry: "常温",
};

export const CATEGORIES = ["荤菜", "素菜", "汤", "主食", "蛋豆"] as const;
export const METHODS = ["炒", "烧", "炖", "蒸", "煮", "煎", "拌", "卤", "白灼", "汤煲"] as const;
export const MEAL_ROLES = [
  { value: "complete", label: "一道就够" },
  { value: "main", label: "主菜" },
  { value: "side", label: "配菜" },
  { value: "soup", label: "汤" },
  { value: "staple", label: "主食" },
] as const;

export function effortRank(effort: Effort): number {
  if (effort === "labor") return 3;
  if (effort === "medium") return 2;
  return 1;
}

export function maxEffort(efforts: Effort[]): Effort {
  return efforts.reduce<Effort>((current, effort) => (effortRank(effort) > effortRank(current) ? effort : current), "easy");
}
