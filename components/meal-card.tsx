"use client";

import { useId, useMemo, useState } from "react";
import { formatFullDate, relativeDay, weekDates } from "@/lib/dates";
import { ingredientOutlook } from "@/lib/grocery";
import { EFFORT_LABEL, STATUS_LABEL } from "@/lib/labels";
import { mealActions } from "@/lib/meal-store";
import { unusualIngredientNames } from "@/lib/recommend";
import type { AppData, Dish, PlannedMeal } from "@/lib/types";
import { Badge, Button, inputClass } from "@/components/ui";

export function MealCard({
  meal,
  data,
  today,
  prominent = false,
}: {
  meal: PlannedMeal;
  data: AppData;
  today: string;
  prominent?: boolean;
}) {
  const [replacing, setReplacing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const dishes = meal.dishes.map((item) => data.dishes.find((dish) => dish.id === item.dishId) ?? null);
  const live = dishes.filter((dish): dish is Dish => Boolean(dish));
  const unusual = unusualIngredientNames(data.dishes, live.map((dish) => dish.id));
  const outlook = ingredientOutlook(live.map((dish) => dish.id), data.dishes, data.inventory);
  const needsRice = live.length > 0 && live.every((dish) => dish.mealRole !== "staple" && dish.mealRole !== "complete");
  const relative = relativeDay(meal.date, today);
  const locked = meal.status === "cooked";

  const choices = useMemo(() => {
    const q = query.trim();
    return data.dishes
      .filter((dish) => dish.status === "active" && !meal.dishes.some((item) => item.dishId === dish.id))
      .filter((dish) => (q ? dish.name.includes(q) : true))
      .slice(0, 8);
  }, [data.dishes, meal.dishes, query]);

  return (
    <article className={prominent ? "rounded-[28px] bg-card p-5 shadow-[0_16px_40px_rgba(80,52,28,0.06)]" : "rounded-3xl border border-line bg-card p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className={prominent ? "text-2xl font-semibold" : "text-lg font-semibold"}>
          {relative ?? formatFullDate(meal.date)}
        </h2>
        {relative ? <span className="text-sm text-muted">{formatFullDate(meal.date)}</span> : null}
        <Badge>{STATUS_LABEL[meal.status]}</Badge>
        <Badge tone={meal.effort === "labor" ? "warn" : "leaf"}>{EFFORT_LABEL[meal.effort]}</Badge>
        {meal.isNew ? <Badge tone="new">新尝试</Badge> : null}
      </div>

      {meal.status === "skipped" ? <p className="mt-4 text-muted">这天不做饭。这不会记成不爱吃这些菜。</p> : null}
      {meal.status === "eating_out" ? <p className="mt-4 text-muted">今天出去吃。</p> : null}
      {meal.status === "postponed" ? <p className="mt-4 text-muted">{meal.reasons.find((reason) => reason.startsWith("这顿改到")) ?? "这顿改到别的日子了。"}</p> : null}
      {meal.status === "cooked" ? <p className="mt-4 text-leaf">这顿已经记进做过的菜。</p> : null}

      {live.length > 0 && meal.status !== "skipped" && meal.status !== "eating_out" ? (
        <ul className="mt-4 grid gap-2">
          {meal.dishes.map((item) => {
            const dish = data.dishes.find((entry) => entry.id === item.dishId);
            return (
              <li key={item.dishId} className="flex items-center justify-between gap-3 rounded-2xl bg-paper px-3 py-3">
                <span className="font-medium">{dish?.name ?? item.name}</span>
                {dish ? <span className="text-xs text-muted">{EFFORT_LABEL[dish.effort]}</span> : <span className="text-xs text-muted">菜已删除</span>}
              </li>
            );
          })}
        </ul>
      ) : null}

      {needsRice && meal.status !== "skipped" && meal.status !== "eating_out" ? <p className="mt-3 text-sm text-muted">默认配米饭。</p> : null}

      {outlook.length > 0 && meal.status !== "skipped" && meal.status !== "eating_out" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {outlook.map((item) => (
            <Badge key={`${item.name}-${item.state}`} tone={item.state === "有" ? "leaf" : item.state === "单位不同" ? "warn" : "plain"}>
              {item.name} · {item.state}
            </Badge>
          ))}
        </div>
      ) : null}
      {unusual.length > 0 ? <p className="mt-3 text-sm text-warn">不好买：{unusual.join("、")}</p> : null}

      {meal.reasons.length > 0 && meal.status !== "skipped" && meal.status !== "eating_out" ? (
        <ul className="mt-4 grid gap-1 text-sm leading-6 text-muted">
          {meal.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {!locked ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {meal.status !== "accepted" && meal.dishes.length > 0 && meal.status !== "skipped" && meal.status !== "eating_out" ? (
            <Button variant="primary" onClick={() => mealActions.accept(meal.date)}>就吃这个</Button>
          ) : null}
          {meal.status === "accepted" ? <Button variant="primary" onClick={() => mealActions.cook(meal.date)}>标记做好了</Button> : null}
          <Button onClick={() => mealActions.cycle(meal.date)}>换一顿</Button>
          <Button onClick={() => { setReplacing(meal.dishes[0]?.dishId ?? null); setAdding(false); }}>换其中一道</Button>
          <Button onClick={() => setAdding((value) => !value)}>加一道</Button>
          <Button onClick={() => mealActions.skip(meal.date, "skipped")}>{meal.date === today ? "今天不做饭" : "这天不做饭"}</Button>
          <Button onClick={() => mealActions.skip(meal.date, "eating_out")}>出去吃</Button>
          <Button onClick={() => mealActions.regenerateDay(meal.date)}>换一天</Button>
        </div>
      ) : null}

      {!locked && meal.dishes.length > 0 ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (moveTo) mealActions.postpone(meal.date, moveTo);
          }}
        >
          <label className="text-sm text-muted" htmlFor={`move-${meal.date}`}>改天再做</label>
          <select id={`move-${meal.date}`} className="min-h-11 rounded-full border border-line bg-white px-3 text-sm" value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
            <option value="">选择日子</option>
            {weekDates(data.weekStart).filter((date) => date !== meal.date).map((date) => (
              <option key={date} value={date}>{formatFullDate(date)}</option>
            ))}
          </select>
          <Button type="submit" disabled={!moveTo}>改期</Button>
        </form>
      ) : null}

      {meal.alternatives.length > 0 && !locked ? (
        <div className="mt-4 grid gap-2">
          <p className="text-sm text-muted">也可以换成</p>
          {meal.alternatives.map((alternative, index) => (
            <button
              key={alternative.dishes.map((dish) => dish.dishId).join("-")}
              type="button"
              className="rounded-2xl border border-line px-3 py-3 text-left text-sm hover:bg-paper"
              onClick={() => mealActions.alternative(meal.date, index)}
            >
              {alternative.dishes.map((dish) => data.dishes.find((item) => item.id === dish.dishId)?.name ?? dish.name).join("、")}
            </button>
          ))}
        </div>
      ) : null}

      {replacing && !locked ? (
        <div className="mt-4 rounded-2xl bg-paper p-3">
          <p className="text-sm">要换掉哪一道</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {meal.dishes.map((item) => (
              <Button key={item.dishId} variant={replacing === item.dishId ? "primary" : "ghost"} onClick={() => setReplacing(item.dishId)}>
                {data.dishes.find((dish) => dish.id === item.dishId)?.name ?? item.name}
              </Button>
            ))}
          </div>
          <SearchList
            query={query}
            onQuery={setQuery}
            choices={choices}
            onPick={(dishId) => {
              mealActions.replaceDish(meal.date, replacing, dishId);
              setReplacing(null);
              setQuery("");
            }}
          />
          {meal.dishes.length > 1 ? (
            <Button className="mt-2" variant="quiet" onClick={() => mealActions.setDishes(meal.date, meal.dishes.filter((item) => item.dishId !== replacing).map((item) => item.dishId))}>
              去掉这道
            </Button>
          ) : null}
        </div>
      ) : null}

      {adding && !locked ? (
        <div className="mt-4 rounded-2xl bg-paper p-3">
          <p className="text-sm">再加一道，不规定必须几道菜。</p>
          <SearchList
            query={query}
            onQuery={setQuery}
            choices={choices}
            onPick={(dishId) => {
              mealActions.setDishes(meal.date, [...meal.dishes.map((item) => item.dishId), dishId]);
              setAdding(false);
              setQuery("");
            }}
          />
        </div>
      ) : null}
    </article>
  );
}

function SearchList({
  query,
  onQuery,
  choices,
  onPick,
}: {
  query: string;
  onQuery: (value: string) => void;
  choices: Dish[];
  onPick: (dishId: string) => void;
}) {
  const fieldId = useId();
  return (
    <div className="mt-3">
      <label className="text-sm text-muted" htmlFor={fieldId}>搜索菜名</label>
      <input id={fieldId} className={`${inputClass} mt-1`} value={query} onChange={(event) => onQuery(event.target.value)} placeholder="例如 青菜" />
      <div className="mt-2 grid gap-2">
        {choices.length === 0 ? <p className="text-sm text-muted">没有找到能换上的菜。</p> : null}
        {choices.map((dish) => (
          <button key={dish.id} type="button" className="rounded-2xl bg-white px-3 py-3 text-left text-sm" onClick={() => onPick(dish.id)}>
            {dish.name}
          </button>
        ))}
      </div>
    </div>
  );
}
