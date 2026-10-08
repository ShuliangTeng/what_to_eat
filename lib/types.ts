export type Effort = "easy" | "medium" | "labor";
export type Familiarity = "familiar" | "supplementary" | "custom";
export type DishStatus = "active" | "paused";
export type DishUsage = "permanent" | "once";
export type IngredientRole = "main" | "seasoning" | "optional";
export type MealRole = "complete" | "main" | "side" | "soup" | "staple";
export type StorageLocation = "refrigerator" | "freezer" | "pantry";
export type MealStatus =
  | "suggested"
  | "accepted"
  | "cooked"
  | "skipped"
  | "postponed"
  | "eating_out";
export type GroceryStatus = "needed" | "purchased";
export type GrocerySource = "calculated" | "manual";
export type MemberRole = "owner" | "member";

export interface DishIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  role: IngredientRole;
  unusual: boolean;
}

export interface Dish {
  id: string;
  name: string;
  tags: string[];
  category: string;
  method: string;
  effort: Effort;
  familiarity: Familiarity;
  priority: number;
  status: DishStatus;
  usage: DishUsage;
  isFuzhou: boolean;
  mealRole: MealRole;
  preferenceScore: number;
  ingredients: DishIngredient[];
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: StorageLocation;
  useSoon: boolean;
}

export interface PlannedDish {
  dishId: string;
  name: string;
}

export interface MealAlternative {
  dishes: PlannedDish[];
  reasons: string[];
  effort: Effort;
  isNew: boolean;
}

export interface PlannedMeal {
  id: string;
  date: string;
  status: MealStatus;
  dishes: PlannedDish[];
  reasons: string[];
  alternatives: MealAlternative[];
  effort: Effort;
  isNew: boolean;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status: GroceryStatus;
  source: GrocerySource;
  note: string;
  addedToInventory: boolean;
  purchasedAt: string | null;
}

export interface HistoryEntry {
  id: string;
  date: string;
  dishNames: string[];
}

export interface HouseholdSettings {
  preferFuzhou: boolean;
  exploreNew: boolean;
}

export interface AppData {
  household: { id: string; name: string; inviteCode: string };
  members: { id: string; name: string; role: MemberRole }[];
  settings: HouseholdSettings;
  dishes: Dish[];
  inventory: InventoryItem[];
  weekStart: string;
  meals: PlannedMeal[];
  groceries: GroceryItem[];
  history: HistoryEntry[];
}

export interface MealDraft {
  dishes: PlannedDish[];
  reasons: string[];
  effort: Effort;
  isNew: boolean;
}
