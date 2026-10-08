"use client";

import { formatFullDate, todayISO, weekDates } from "@/lib/dates";
import { mealActions, useMealApp } from "@/lib/meal-store";
import { MealCard } from "@/components/meal-card";
import { Button } from "@/components/ui";

export function WeekView() {
  const snap = useMealApp();
  if (snap.status !== "ready" || !snap.data) return null;
  const today = todayISO();
  const dates = weekDates(snap.data.weekStart);
  const history = [
    ...snap.data.meals.filter((meal) => meal.status === "cooked").map((meal) => ({ date: meal.date, names: meal.dishes.map((dish) => dish.name) })),
    ...snap.data.history.map((entry) => ({ date: entry.date, names: entry.dishNames })),
  ].filter((entry, index, list) => list.findIndex((item) => item.date === entry.date) === index);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">一周菜单</h1>
        <p className="mt-2 text-muted">这是建议，不是课表。哪天不做、出去吃、改到别的日子，都可以。</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => mealActions.regenerateOpenDays()}>重排还没选定的日子</Button>
        <Button
          onClick={() => mealActions.updateSettings({ ...snap.data!.settings, preferFuzhou: !snap.data!.settings.preferFuzhou })}
        >
          福州口味：{snap.data.settings.preferFuzhou ? "开" : "关"}
        </Button>
        <Button
          onClick={() => mealActions.updateSettings({ ...snap.data!.settings, exploreNew: !snap.data!.settings.exploreNew })}
        >
          每周新菜：{snap.data.settings.exploreNew ? "开" : "关"}
        </Button>
      </div>
      <p className="text-sm text-muted">工作日尽量好做，一周最多一顿费时的。同一把青菜可以分两顿用完。开关要在重排之后才会体现在新菜单里。</p>
      <div className="grid gap-4">
        {dates.map((date) => {
          const meal = snap.data?.meals.find((item) => item.date === date);
          return meal ? <MealCard key={date} meal={meal} data={snap.data!} today={today} /> : <p key={date}>{formatFullDate(date)}还没安排。</p>;
        })}
      </div>
      {history.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">做过的菜</h2>
          <ul className="mt-3 grid gap-2 text-sm text-muted">
            {history.slice(0, 8).map((entry) => (
              <li key={entry.date}>{formatFullDate(entry.date)} · {entry.names.join("、")}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
