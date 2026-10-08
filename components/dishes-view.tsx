"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { localTemplateDrafter, type IngredientDraft } from "@/lib/draft";
import { CATEGORIES, EFFORT_LABEL, MEAL_ROLES, METHODS } from "@/lib/labels";
import { mealActions, useMealApp } from "@/lib/meal-store";
import type { Dish, Effort, IngredientRole, MealRole } from "@/lib/types";
import { UNITS } from "@/lib/units";
import { Badge, Button, Field, inputClass } from "@/components/ui";

type Filter = "all" | "familiar" | "new" | "paused";

const emptyIngredient = () => ({
  id: crypto.randomUUID(),
  name: "",
  quantity: 1,
  unit: "个",
  role: "main" as IngredientRole,
  unusual: false,
});

export function DishesView() {
  const snap = useMealApp();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Dish | "new" | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (snap.status !== "ready" || !snap.data) return null;

  const dishes = snap.data.dishes.filter((dish) => {
    if (query && !dish.name.includes(query.trim())) return false;
    if (filter === "paused") return dish.status === "paused";
    if (dish.status === "paused") return false;
    if (filter === "familiar") return dish.familiarity === "familiar" || (dish.familiarity === "custom" && dish.priority >= 50);
    if (filter === "new") return dish.familiarity === "supplementary" || (dish.familiarity === "custom" && dish.priority < 50);
    return true;
  });

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">我的菜库</h1>
        <p className="mt-2 text-muted">常做的菜会优先推荐。补充菜只是备选，不是默认最爱。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant={filter === "all" ? "primary" : "ghost"} onClick={() => setFilter("all")}>全部</Button>
        <Button variant={filter === "familiar" ? "primary" : "ghost"} onClick={() => setFilter("familiar")}>常做</Button>
        <Button variant={filter === "new" ? "primary" : "ghost"} onClick={() => setFilter("new")}>想试试</Button>
        <Button variant={filter === "paused" ? "primary" : "ghost"} onClick={() => setFilter("paused")}>暂停</Button>
        <Button variant="primary" onClick={() => setEditing("new")}>添加菜</Button>
      </div>
      <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索菜名" aria-label="搜索菜名" />
      {dishes.length === 0 ? <p className="text-muted">这里还没有菜。先加一道你们会做的。</p> : null}
      <ul className="grid gap-3">
        {dishes.map((dish) => (
          <li key={dish.id} className="rounded-3xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-medium">{dish.name}</h2>
              <Badge tone={dish.familiarity === "familiar" || dish.priority >= 50 ? "leaf" : "new"}>
                {dish.familiarity === "supplementary" || dish.priority < 50 ? "想试试" : "常做"}
              </Badge>
              <Badge>{EFFORT_LABEL[dish.effort]}</Badge>
              {dish.status === "paused" ? <Badge tone="warn">暂停</Badge> : null}
              {dish.preferenceScore >= 5 ? <Badge tone="leaf">常吃</Badge> : null}
              {dish.isFuzhou ? <Badge>福州</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted">
              {dish.ingredients.filter((item) => item.role !== "seasoning").map((item) => `${item.name} ${item.quantity}${item.unit}`).join("、")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => setEditing(dish)}>编辑</Button>
              <Button onClick={() => mealActions.favoriteDish(dish.id)}>{dish.preferenceScore >= 5 ? "已记为常吃" : "记为常吃"}</Button>
              <Button onClick={() => mealActions.setDishStatus(dish.id, dish.status === "paused" ? "active" : "paused")}>
                {dish.status === "paused" ? "恢复" : "暂停"}
              </Button>
              {confirmId === dish.id ? (
                <Button variant="danger" onClick={() => { mealActions.deleteDish(dish.id); setConfirmId(null); }}>确认删除</Button>
              ) : (
                <Button variant="danger" onClick={() => setConfirmId(dish.id)}>删除</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editing ? (
        <DishForm
          dish={editing === "new" ? null : editing}
          existing={snap.data.dishes}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function DishForm({ dish, existing, onClose }: { dish: Dish | null; existing: Dish[]; onClose: () => void }) {
  const [name, setName] = useState(dish?.name ?? "");
  const [kind, setKind] = useState<"familiar" | "new">(dish && (dish.familiarity === "supplementary" || dish.priority < 50) ? "new" : "familiar");
  const [usage, setUsage] = useState<Dish["usage"]>(dish?.usage ?? "permanent");
  const [category, setCategory] = useState(dish?.category ?? "荤菜");
  const [method, setMethod] = useState(dish?.method ?? "炒");
  const [effort, setEffort] = useState<Effort>(dish?.effort ?? "easy");
  const [mealRole, setMealRole] = useState<MealRole>(dish?.mealRole ?? "main");
  const [isFuzhou, setIsFuzhou] = useState(dish?.isFuzhou ?? false);
  const [tags, setTags] = useState(dish?.tags.join("、") ?? "");
  const [ingredients, setIngredients] = useState(dish?.ingredients.map((item) => ({ ...item })) ?? []);
  const [draftNote, setDraftNote] = useState<IngredientDraft | null>(null);
  const [warn, setWarn] = useState(false);

  function fillDraft() {
    if (ingredients.some((item) => item.name.trim())) return;
    const draft = localTemplateDrafter.draft(name);
    setDraftNote(draft);
    if (draft.ingredients.length > 0) {
      setIngredients(draft.ingredients.map((item) => ({ ...item, id: crypto.randomUUID() })));
    }
  }

  function save(force = false) {
    const duplicate = existing.some((item) => item.name.trim() === name.trim() && item.id !== dish?.id);
    if (duplicate && !force) {
      setWarn(true);
      return;
    }
    mealActions.saveDish({
      id: dish?.id,
      name,
      tags: tags.split(/[、,，]/).map((item) => item.trim()).filter(Boolean),
      category,
      method,
      effort,
      familiarity: kind === "familiar" ? (dish?.familiarity === "custom" ? "custom" : "familiar") : "supplementary",
      priority: kind === "familiar" ? 82 : 30,
      usage,
      isFuzhou,
      mealRole,
      ingredients,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 overflow-auto bg-paper p-4">
      <form
        className="mx-auto grid max-w-lg gap-4 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          save(warn);
        }}
      >
        <h2 className="text-2xl font-semibold">{dish ? "编辑菜" : "添加菜"}</h2>
        <Field label="菜名">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} onBlur={fillDraft} required />
        </Field>
        {draftNote ? <p className="text-sm text-muted">{draftNote.message}</p> : null}
        <fieldset className="grid gap-2">
          <legend className="text-sm text-muted">熟悉程度</legend>
          <label className="flex gap-2"><input type="radio" name="kind" checked={kind === "familiar"} onChange={() => setKind("familiar")} />常做的菜</label>
          <label className="flex gap-2"><input type="radio" name="kind" checked={kind === "new"} onChange={() => setKind("new")} />想试试，先别当成最爱</label>
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="text-sm text-muted">用完之后</legend>
          <label className="flex gap-2"><input type="radio" name="usage" checked={usage === "permanent"} onChange={() => setUsage("permanent")} />一直留在菜库</label>
          <label className="flex gap-2"><input type="radio" name="usage" checked={usage === "once"} onChange={() => setUsage("once")} />只做这一次</label>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="分类">
            <select className={inputClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="做法">
            <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
              {METHODS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="费时">
            <select className={inputClass} value={effort} onChange={(event) => setEffort(event.target.value as Effort)}>
              <option value="easy">轻松</option>
              <option value="medium">中等</option>
              <option value="labor">费时</option>
            </select>
          </Field>
          <Field label="在一顿饭里">
            <select className={inputClass} value={mealRole} onChange={(event) => setMealRole(event.target.value as MealRole)}>
              {MEAL_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={isFuzhou} onChange={(event) => setIsFuzhou(event.target.checked)} />福州家常</label>
        <Field label="标签，用顿号分开">
          <input className={inputClass} value={tags} onChange={(event) => setTags(event.target.value)} placeholder="荤、快手" />
        </Field>
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">用料（两个人）</h3>
            <Button onClick={() => setIngredients((items) => [...items, emptyIngredient()])}>加一行</Button>
          </div>
          {ingredients.length === 0 ? <p className="text-sm text-muted">请自己补上主要食材。名称会按你输入的原样保存。</p> : null}
          {ingredients.map((ingredient, index) => (
            <div key={ingredient.id} className="grid grid-cols-2 gap-2 rounded-2xl bg-card p-3">
              <input className={inputClass} aria-label="食材名称" value={ingredient.name} onChange={(event) => updateIngredient(setIngredients, index, { name: event.target.value })} placeholder="食材" />
              <input className={inputClass} aria-label="数量" type="number" min="0" step="0.1" value={ingredient.quantity} onChange={(event) => updateIngredient(setIngredients, index, { quantity: Number(event.target.value) })} />
              <select className={inputClass} aria-label="单位" value={ingredient.unit} onChange={(event) => updateIngredient(setIngredients, index, { unit: event.target.value })}>
                {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
              </select>
              <select className={inputClass} aria-label="角色" value={ingredient.role} onChange={(event) => updateIngredient(setIngredients, index, { role: event.target.value as IngredientRole })}>
                <option value="main">主要</option>
                <option value="optional">可有可无</option>
                <option value="seasoning">调料</option>
              </select>
              <label className="col-span-2 flex gap-2 text-sm">
                <input type="checkbox" checked={ingredient.unusual} onChange={(event) => updateIngredient(setIngredients, index, { unusual: event.target.checked })} />
                不好买
              </label>
              <Button variant="quiet" onClick={() => setIngredients((items) => items.filter((item) => item.id !== ingredient.id))}>删除这行</Button>
            </div>
          ))}
        </div>
        {warn ? <p className="rounded-2xl bg-warn-soft p-3 text-sm text-warn">菜库里已经有同名的菜。可以再存一个版本。</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary">{warn ? "仍然保存" : "保存"}</Button>
          <Button onClick={onClose}>取消</Button>
        </div>
      </form>
    </div>
  );
}

function updateIngredient(
  setIngredients: Dispatch<SetStateAction<Dish["ingredients"]>>,
  index: number,
  patch: Partial<Dish["ingredients"][number]>,
) {
  setIngredients((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
}
