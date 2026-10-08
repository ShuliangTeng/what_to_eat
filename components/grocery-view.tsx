"use client";

import { useState } from "react";
import { LOCATION_LABEL } from "@/lib/labels";
import { mealActions, useMealApp } from "@/lib/meal-store";
import type { GroceryItem, StorageLocation } from "@/lib/types";
import { UNITS } from "@/lib/units";
import { Button, Field, inputClass } from "@/components/ui";

export function GroceryView() {
  const snap = useMealApp();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState("个");
  const [locationFor, setLocationFor] = useState<string | null>(null);
  if (snap.status !== "ready" || !snap.data) return null;
  const needed = snap.data.groceries.filter((item) => item.status === "needed");
  const purchased = snap.data.groceries.filter((item) => item.status === "purchased");
  const plannedNames = new Set(
    snap.data.meals
      .filter((meal) => meal.status === "suggested" || meal.status === "accepted")
      .flatMap((meal) => meal.dishes.flatMap((dish) => snap.data?.dishes.find((item) => item.id === dish.dishId)?.ingredients.map((ingredient) => ingredient.name.trim()) ?? [])),
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">购物清单</h1>
        <p className="mt-2 text-muted">按还没做的晚饭来算。家里有、而且单位对得上的会扣掉。已购买的会留下来，改菜单也不会把它删掉。</p>
      </div>
      <section>
        <h2 className="text-lg font-semibold">待购买</h2>
        {needed.length === 0 ? <p className="mt-3 text-muted">现在没有要买的。要么家里够了，要么这几天不做饭。</p> : null}
        <ul className="mt-3 grid gap-3">
          {needed.map((item) => (
            <GroceryRow key={item.id} item={item} />
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold">已购买</h2>
        {purchased.length === 0 ? <p className="mt-3 text-muted">还没有标记买好的东西。</p> : null}
        <ul className="mt-3 grid gap-3">
          {purchased.map((item) => (
            <li key={item.id} className="rounded-3xl border border-line bg-card p-4">
              <p className="font-medium">{item.name} · {item.quantity}{item.unit}</p>
              {!plannedNames.has(item.name.trim()) ? <p className="mt-1 text-sm text-muted">当前菜单没用到，仍留在这里。</p> : null}
              {item.note ? <p className="mt-1 text-sm text-warn">{item.note}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => mealActions.setGroceryPurchased(item.id, false)}>改回待购买</Button>
                {item.addedToInventory ? <Button disabled>已放入冰箱</Button> : <Button variant="primary" onClick={() => setLocationFor(item.id)}>放入冰箱</Button>}
                <Button variant="danger" onClick={() => mealActions.deleteGrocery(item.id)}>删除记录</Button>
              </div>
              {locationFor === item.id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["refrigerator", "freezer", "pantry"] as StorageLocation[]).map((location) => (
                    <Button key={location} onClick={() => { mealActions.moveGrocery(item.id, location); setLocationFor(null); }}>
                      {LOCATION_LABEL[location]}
                    </Button>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <form
        className="grid gap-3 rounded-3xl border border-line bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          mealActions.addGrocery(name, quantity, unit);
          setName("");
          setQuantity(1);
        }}
      >
        <h2 className="text-lg font-semibold">手动加一项</h2>
        <Field label="名称">
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="数量">
            <input className={inputClass} type="number" min="0.1" step="0.1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
          </Field>
          <Field label="单位">
            <select className={inputClass} value={unit} onChange={(event) => setUnit(event.target.value)}>
              {UNITS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </Field>
        </div>
        <Button type="submit" variant="primary">加入待购买</Button>
      </form>
    </div>
  );
}

function GroceryRow({ item }: { item: GroceryItem }) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  return (
    <li className="rounded-3xl border border-line bg-card p-4">
      <p className="font-medium">{item.name}</p>
      {item.note ? <p className="mt-1 text-sm text-warn">{item.note}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-sm text-muted" htmlFor={`qty-${item.id}`}>数量（{item.unit}）</label>
        <input
          id={`qty-${item.id}`}
          className="min-h-11 w-24 rounded-2xl border border-line px-3"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          onBlur={() => mealActions.updateGroceryQuantity(item.id, Number(quantity))}
        />
        <Button variant="primary" onClick={() => mealActions.setGroceryPurchased(item.id, true)}>买好了</Button>
        {item.source === "manual" ? <Button variant="danger" onClick={() => mealActions.deleteGrocery(item.id)}>删除</Button> : null}
      </div>
    </li>
  );
}
