import { createSeedDishes } from "@/lib/catalog";
import { mondayOf, todayISO } from "@/lib/dates";
import { ensureWeek } from "@/lib/reduce";
import type { AppData, InventoryItem } from "@/lib/types";

function item(name: string, quantity: number, unit: string, location: InventoryItem["location"], useSoon = false): InventoryItem {
  return { id: `demo-${name}`, name, quantity, unit, location, useSoon };
}

export function sampleInventory(): InventoryItem[] {
  return [
    item("青菜", 500, "克", "refrigerator", true),
    item("番茄", 3, "个", "refrigerator", true),
    item("蘑菇", 250, "克", "refrigerator", true),
    item("鸡蛋", 8, "个", "refrigerator"),
    item("青椒", 4, "个", "refrigerator"),
    item("茄子", 2, "个", "refrigerator"),
    item("鸡翅", 10, "个", "freezer"),
    item("排骨", 500, "克", "freezer"),
    item("牛肉", 250, "克", "freezer"),
    item("五花肉", 300, "克", "freezer"),
    item("可乐", 330, "毫升", "pantry"),
  ];
}

export function createDemoData(today = todayISO()): AppData {
  const blank: AppData = {
    household: { id: "demo-household", name: "演示小厨房", inviteCode: "" },
    members: [{ id: "demo-user", name: "这台设备", role: "owner" }],
    settings: { preferFuzhou: true, exploreNew: true },
    dishes: createSeedDishes(),
    inventory: sampleInventory(),
    weekStart: mondayOf(today),
    meals: [],
    groceries: [],
    history: [],
  };
  return ensureWeek(blank, today);
}
