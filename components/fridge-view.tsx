"use client";

import { useState } from "react";
import { LOCATION_LABEL } from "@/lib/labels";
import { mealActions, useMealApp } from "@/lib/meal-store";
import type { InventoryItem, StorageLocation } from "@/lib/types";
import { UNITS } from "@/lib/units";
import { Badge, Button, Field, inputClass } from "@/components/ui";

const locations: StorageLocation[] = ["refrigerator", "freezer", "pantry"];

const blank = (): InventoryItem => ({
  id: crypto.randomUUID(),
  name: "",
  quantity: 1,
  unit: "个",
  location: "refrigerator",
  useSoon: false,
});

export function FridgeView() {
  const snap = useMealApp();
  const [draft, setDraft] = useState<InventoryItem | null>(null);
  if (snap.status !== "ready" || !snap.data) return null;

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">冰箱库存</h1>
        <p className="mt-2 text-muted">自己记家里有什么。做完一顿不会自动扣掉，用完了再改数量。</p>
      </div>
      <Button variant="primary" onClick={() => setDraft(blank())}>添加食材</Button>
      {snap.data.inventory.length === 0 ? <p className="text-muted">冰箱还是空的。推荐仍然可以排，只是没法优先用现有的食材。</p> : null}
      {locations.map((location) => {
        const items = snap.data?.inventory.filter((item) => item.location === location) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={location}>
            <h2 className="text-lg font-semibold">{LOCATION_LABEL[location]}</h2>
            <ul className="mt-3 grid gap-3">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-card p-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted">{item.quantity}{item.unit}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {item.useSoon ? <Badge tone="warn">尽快用</Badge> : null}
                    <Button onClick={() => setDraft(item)}>编辑</Button>
                    <Button variant="danger" onClick={() => mealActions.deleteInventory(item.id)}>移除</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {draft ? (
        <form
          className="fixed inset-0 z-30 overflow-auto bg-paper p-4"
          onSubmit={(event) => {
            event.preventDefault();
            mealActions.saveInventory(draft);
            setDraft(null);
          }}
        >
          <div className="mx-auto grid max-w-lg gap-4 py-4">
            <h2 className="text-2xl font-semibold">{draft.name ? "编辑食材" : "添加食材"}</h2>
            <Field label="名称">
              <input className={inputClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required />
            </Field>
            <p className="text-sm text-muted">名称会按你输入的原样保存，不会自动把番茄和西红柿并成一种。</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="数量">
                <input className={inputClass} type="number" min="0" step="0.1" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: Number(event.target.value) })} />
              </Field>
              <Field label="单位">
                <select className={inputClass} value={draft.unit} onChange={(event) => setDraft({ ...draft, unit: event.target.value })}>
                  {UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                </select>
              </Field>
            </div>
            <Field label="放在哪">
              <select className={inputClass} value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value as StorageLocation })}>
                {locations.map((location) => <option key={location} value={location}>{LOCATION_LABEL[location]}</option>)}
              </select>
            </Field>
            <label className="flex gap-2 text-sm">
              <input type="checkbox" checked={draft.useSoon} onChange={(event) => setDraft({ ...draft, useSoon: event.target.checked })} />
              尽快用掉
            </label>
            <div className="flex gap-2">
              <Button type="submit" variant="primary">保存</Button>
              <Button onClick={() => setDraft(null)}>取消</Button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
