"use client";

import { formatFullDate, todayISO } from "@/lib/dates";
import { useMealApp } from "@/lib/meal-store";
import { MealCard } from "@/components/meal-card";

export function TodayView() {
  const snap = useMealApp();
  if (snap.status !== "ready" || !snap.data) return null;
  const today = todayISO();
  const meal = snap.data.meals.find((item) => item.date === today);
  const recent = snap.data.meals
    .filter((item) => item.status === "cooked")
    .map((item) => ({ date: item.date, names: item.dishes.map((dish) => dish.name) }));
  const older = snap.data.history
    .filter((entry) => !recent.some((item) => item.date === entry.date))
    .map((entry) => ({ date: entry.date, names: entry.dishNames }));
  const cooked = [...recent, ...older].slice(0, 6);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">今天吃什么</h1>
        <p className="mt-2 text-muted">按两个人的量来建议。先点「就吃这个」，做好了再标记。没做的日子不会被记成不爱吃。</p>
      </div>
      {meal ? <MealCard meal={meal} data={snap.data} today={today} prominent /> : <p>这周的菜单还没排出来。</p>}
      {cooked.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">最近做过</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            {cooked.map((item) => (
              <li key={item.date}>{formatFullDate(item.date)} · {item.names.join("、")}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
