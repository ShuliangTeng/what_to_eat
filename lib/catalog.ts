import type { Dish, DishIngredient, Effort, Familiarity, IngredientRole, MealRole } from "@/lib/types";

type Ing = [string, number, string, IngredientRole, boolean?];

export interface DishSeed {
  slug: string;
  name: string;
  tags: string[];
  category: string;
  method: string;
  effort: Effort;
  familiarity: Familiarity;
  priority: number;
  isFuzhou: boolean;
  mealRole: MealRole;
  ingredients: Ing[];
}

function seed(
  slug: string,
  name: string,
  category: string,
  method: string,
  effort: Effort,
  familiarity: Familiarity,
  priority: number,
  mealRole: MealRole,
  tags: string[],
  ingredients: Ing[],
  isFuzhou = false,
): DishSeed {
  return { slug, name, tags, category, method, effort, familiarity, priority, isFuzhou, mealRole, ingredients };
}

const familiar = (
  slug: string,
  name: string,
  category: string,
  method: string,
  effort: Effort,
  mealRole: MealRole,
  tags: string[],
  ingredients: Ing[],
  isFuzhou = false,
) => seed(slug, name, category, method, effort, "familiar", 82, mealRole, tags, ingredients, isFuzhou);

const extra = (
  slug: string,
  name: string,
  category: string,
  method: string,
  effort: Effort,
  mealRole: MealRole,
  tags: string[],
  ingredients: Ing[],
  isFuzhou = false,
) => seed(slug, name, category, method, effort, "supplementary", 30, mealRole, tags, ingredients, isFuzhou);

export const DISH_SEEDS: DishSeed[] = [
  familiar("cola-wings", "可乐鸡翅", "荤菜", "烧", "medium", "main", ["荤", "家常"], [
    ["鸡翅", 8, "个", "main"],
    ["可乐", 330, "毫升", "main"],
  ]),
  familiar("sweet-ribs", "糖醋排骨", "荤菜", "烧", "labor", "main", ["荤", "家常"], [
    ["排骨", 400, "克", "main"],
    ["醋", 30, "毫升", "seasoning"],
    ["糖", 20, "克", "seasoning"],
  ]),
  familiar("pepper-beef", "青椒炒牛肉", "荤菜", "炒", "medium", "main", ["荤", "快手"], [
    ["牛肉", 200, "克", "main"],
    ["青椒", 3, "个", "main"],
  ]),
  familiar("spicy-feet", "辣炒鸡爪", "荤菜", "炒", "medium", "main", ["荤"], [
    ["鸡爪", 10, "只", "main"],
    ["干辣椒", 6, "个", "seasoning"],
  ]),
  familiar("braised-trotter", "卤猪蹄", "荤菜", "卤", "labor", "main", ["荤"], [
    ["猪蹄", 2, "只", "main"],
    ["酱油", 40, "毫升", "seasoning"],
    ["八角", 2, "个", "seasoning"],
  ]),
  familiar("stir-greens", "清炒青菜", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["青菜", 250, "克", "main"],
    ["蒜", 2, "瓣", "seasoning"],
  ]),
  familiar("blanch-greens", "白灼青菜", "素菜", "白灼", "easy", "side", ["素", "快手"], [
    ["青菜", 250, "克", "main"],
  ]),
  familiar("linyi-chicken", "临沂炒鸡", "荤菜", "炒", "labor", "complete", ["荤"], [
    ["鸡腿", 4, "个", "main"],
    ["青椒", 2, "个", "main"],
  ]),
  familiar("zao-chicken", "糟鸡", "荤菜", "卤", "labor", "main", ["荤", "福州"], [
    ["鸡腿", 2, "个", "main"],
    ["红糟", 40, "克", "seasoning", true],
  ], true),
  familiar("zao-pork", "糟五花肉", "荤菜", "炒", "medium", "main", ["荤", "福州"], [
    ["五花肉", 300, "克", "main"],
    ["红糟", 30, "克", "seasoning", true],
  ], true),
  familiar("lotus-pond", "荷塘月色", "素菜", "炒", "medium", "side", ["素"], [
    ["莲藕", 200, "克", "main"],
    ["荷兰豆", 100, "克", "main"],
    ["木耳", 20, "克", "main"],
    ["胡萝卜", 1, "根", "main"],
  ]),
  familiar("mushroom-chicken", "蘑菇炒鸡", "荤菜", "炒", "medium", "main", ["荤"], [
    ["鸡腿", 2, "个", "main"],
    ["蘑菇", 200, "克", "main"],
  ]),
  familiar("mushroom-beef", "蘑菇炒牛", "荤菜", "炒", "medium", "main", ["荤"], [
    ["牛肉", 200, "克", "main"],
    ["蘑菇", 200, "克", "main"],
  ]),
  familiar("fried-rice-noodles", "炒米粉", "主食", "炒", "medium", "complete", ["荤", "素"], [
    ["米粉", 200, "克", "main"],
    ["鸡蛋", 2, "个", "main"],
    ["青菜", 100, "克", "main"],
  ]),
  familiar("braised-eggplant", "红烧茄子", "素菜", "烧", "medium", "side", ["素"], [
    ["茄子", 2, "个", "main"],
    ["蒜", 3, "瓣", "seasoning"],
  ]),
  familiar("tail-bone-soup", "龙尾骨煲汤", "汤", "汤煲", "labor", "soup", ["荤"], [
    ["龙尾骨", 400, "克", "main", true],
    ["玉米", 1, "根", "main"],
    ["胡萝卜", 1, "根", "main"],
  ]),
  familiar("rib-radish-soup", "玉米萝卜牛肋骨汤", "汤", "汤煲", "labor", "soup", ["荤"], [
    ["牛肋骨", 400, "克", "main", true],
    ["玉米", 1, "根", "main"],
    ["白萝卜", 1, "根", "main"],
  ]),
  familiar("beer-duck", "啤酒鸭", "荤菜", "炖", "labor", "complete", ["荤"], [
    ["鸭腿", 2, "个", "main"],
    ["啤酒", 1, "瓶", "main"],
  ]),
  familiar("steamed-egg-meat", "肉末蒸蛋", "蛋豆", "蒸", "easy", "main", ["荤", "蛋", "快手"], [
    ["鸡蛋", 3, "个", "main"],
    ["肉末", 80, "克", "main"],
  ]),
  familiar("scallop-egg", "干贝蒸蛋", "蛋豆", "蒸", "easy", "main", ["蛋", "福州"], [
    ["鸡蛋", 3, "个", "main"],
    ["干贝", 6, "颗", "main", true],
  ], true),
  familiar("hot-sour-soup", "酸辣汤", "汤", "煮", "easy", "soup", ["素", "快手"], [
    ["豆腐", 1, "块", "main"],
    ["鸡蛋", 1, "个", "main"],
    ["木耳", 10, "克", "main"],
    ["醋", 20, "毫升", "seasoning"],
  ]),
  familiar("tomato-egg", "番茄炒蛋", "蛋豆", "炒", "easy", "main", ["素", "蛋", "快手"], [
    ["番茄", 2, "个", "main"],
    ["鸡蛋", 3, "个", "main"],
  ]),
  familiar("bitter-melon", "清炒苦瓜", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["苦瓜", 1, "根", "main"],
  ]),
  familiar("zucchini", "西葫芦", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["西葫芦", 1, "个", "main"],
    ["蒜", 2, "瓣", "seasoning"],
  ]),
  familiar("chicken-steak", "水嫩鸡排", "荤菜", "煎", "medium", "main", ["荤"], [
    ["鸡胸肉", 2, "片", "main"],
  ]),
  familiar("potato-slices", "土豆片", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["土豆", 2, "个", "main"],
  ]),
  familiar("cilantro-beef", "香菜炒牛肉", "荤菜", "炒", "medium", "main", ["荤"], [
    ["牛肉", 200, "克", "main"],
    ["香菜", 1, "把", "main"],
  ]),
  familiar("steak-pasta", "煎牛排配意大利面", "主食", "煎", "medium", "complete", ["荤"], [
    ["牛排", 2, "块", "main"],
    ["意大利面", 180, "克", "main"],
  ]),
  extra("pepper-pork", "青椒炒肉", "荤菜", "炒", "medium", "main", ["荤", "家常"], [
    ["猪肉", 200, "克", "main"],
    ["青椒", 2, "个", "main"],
  ]),
  extra("garlic-scapes", "蒜苔炒肉", "荤菜", "炒", "medium", "main", ["荤", "家常"], [
    ["蒜苔", 200, "克", "main"],
    ["猪肉", 150, "克", "main"],
  ]),
  extra("onion-pork", "洋葱炒肉", "荤菜", "炒", "medium", "main", ["荤", "家常"], [
    ["洋葱", 1, "个", "main"],
    ["猪肉", 150, "克", "main"],
  ]),
  extra("red-pork", "红烧肉", "荤菜", "烧", "labor", "main", ["荤", "家常"], [
    ["五花肉", 400, "克", "main"],
  ]),
  extra("red-ribs", "红烧排骨", "荤菜", "烧", "labor", "main", ["荤", "家常"], [
    ["排骨", 400, "克", "main"],
  ]),
  extra("beef-potato", "土豆炖牛肉", "荤菜", "炖", "labor", "complete", ["荤", "家常"], [
    ["牛肉", 300, "克", "main"],
    ["土豆", 2, "个", "main"],
  ]),
  extra("tomato-brisket", "番茄炖牛腩", "荤菜", "炖", "labor", "complete", ["荤", "家常"], [
    ["牛腩", 300, "克", "main"],
    ["番茄", 2, "个", "main"],
  ]),
  extra("red-drumstick", "红烧鸡腿", "荤菜", "烧", "medium", "main", ["荤", "家常"], [
    ["鸡腿", 2, "个", "main"],
  ]),
  extra("mushroom-stew-chicken", "香菇炖鸡", "荤菜", "炖", "labor", "complete", ["荤"], [
    ["鸡腿", 2, "个", "main"],
    ["香菇", 6, "朵", "main"],
  ]),
  extra("potato-chicken", "土豆烧鸡", "荤菜", "烧", "medium", "main", ["荤", "家常"], [
    ["鸡腿", 2, "个", "main"],
    ["土豆", 1, "个", "main"],
  ]),
  extra("meat-eggplant", "肉末茄子", "荤菜", "烧", "medium", "main", ["荤", "家常"], [
    ["茄子", 2, "个", "main"],
    ["肉末", 100, "克", "main"],
  ]),
  extra("garlic-broccoli", "蒜蓉西兰花", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["西兰花", 1, "个", "main"],
    ["蒜", 3, "瓣", "seasoning"],
  ]),
  extra("hand-cabbage", "手撕包菜", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["包菜", 300, "克", "main"],
  ]),
  extra("sour-potato", "酸辣土豆丝", "素菜", "炒", "easy", "side", ["素", "快手"], [
    ["土豆", 2, "个", "main"],
  ]),
  extra("mapo-tofu", "麻婆豆腐", "蛋豆", "烧", "medium", "main", ["荤", "家常"], [
    ["豆腐", 1, "盒", "main"],
    ["肉末", 80, "克", "main"],
  ]),
  extra("fuzhou-fishball", "福州鱼丸汤", "汤", "煮", "medium", "soup", ["荤", "福州"], [
    ["鱼丸", 1, "袋", "main", true],
    ["青菜", 100, "克", "main"],
  ], true),
  extra("rou-yan", "肉燕汤", "汤", "煮", "medium", "soup", ["荤", "福州"], [
    ["肉燕皮", 10, "张", "main", true],
    ["紫菜", 5, "克", "optional"],
  ], true),
  extra("seaweed-egg-soup", "紫菜蛋花汤", "汤", "煮", "easy", "soup", ["素", "蛋", "快手"], [
    ["紫菜", 5, "克", "main"],
    ["鸡蛋", 1, "个", "main"],
  ]),
  extra("radish-rib-soup", "萝卜排骨汤", "汤", "汤煲", "labor", "soup", ["荤", "家常"], [
    ["排骨", 300, "克", "main"],
    ["白萝卜", 1, "根", "main"],
  ]),
  extra("steamed-fish", "清蒸鱼", "荤菜", "蒸", "medium", "main", ["荤"], [
    ["鱼", 1, "条", "main"],
    ["姜", 4, "片", "seasoning"],
  ]),
  extra("scallion-chicken", "葱姜蒸鸡", "荤菜", "蒸", "medium", "main", ["荤"], [
    ["鸡腿", 2, "个", "main"],
    ["小葱", 2, "根", "seasoning"],
    ["姜", 4, "片", "seasoning"],
  ]),
  extra("egg-fried-rice", "蛋炒饭", "主食", "炒", "easy", "staple", ["蛋", "快手"], [
    ["米饭", 1, "碗", "main"],
    ["鸡蛋", 2, "个", "main"],
  ]),
  extra("tomato-egg-noodles", "番茄鸡蛋面", "主食", "煮", "easy", "staple", ["素", "蛋", "快手"], [
    ["面条", 200, "克", "main"],
    ["番茄", 1, "个", "main"],
    ["鸡蛋", 2, "个", "main"],
  ]),
  extra("scallion-noodles", "葱油拌面", "主食", "拌", "easy", "staple", ["素", "快手"], [
    ["面条", 200, "克", "main"],
    ["小葱", 2, "根", "main"],
  ]),
  extra("frozen-dumplings", "速冻水饺", "主食", "煮", "easy", "staple", ["荤", "快手"], [
    ["速冻水饺", 1, "包", "main"],
  ]),
  extra("frozen-wontons", "速冻馄饨", "主食", "煮", "easy", "staple", ["荤", "快手"], [
    ["速冻馄饨", 1, "包", "main"],
  ]),
];

function toIngredient(seedSlug: string, ingredient: Ing, index: number): DishIngredient {
  return {
    id: `seed-${seedSlug}-i${index}`,
    name: ingredient[0],
    quantity: ingredient[1],
    unit: ingredient[2],
    role: ingredient[3],
    unusual: ingredient[4] ?? false,
  };
}

export function dishFromSeed(item: DishSeed, id = `seed-${item.slug}`): Dish {
  return {
    id,
    name: item.name,
    tags: item.tags,
    category: item.category,
    method: item.method,
    effort: item.effort,
    familiarity: item.familiarity,
    priority: item.priority,
    status: "active",
    usage: "permanent",
    isFuzhou: item.isFuzhou,
    mealRole: item.mealRole,
    preferenceScore: 0,
    ingredients: item.ingredients.map((ingredient, index) => toIngredient(item.slug, ingredient, index)),
  };
}

export function createSeedDishes(): Dish[] {
  return DISH_SEEDS.map((item) => dishFromSeed(item));
}

export function findDishSeed(name: string): DishSeed | undefined {
  const trimmed = name.trim();
  return DISH_SEEDS.find((item) => item.name === trimmed);
}
