"use client";

import { useState } from "react";
import { mealActions, useMealApp } from "@/lib/meal-store";
import { Button, Field, inputClass } from "@/components/ui";

export function HouseholdView() {
  const snap = useMealApp();
  const [name, setName] = useState("我们的小厨房");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(action: () => Promise<void>) {
    setError(null);
    setPending(true);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "没有完成。");
    } finally {
      setPending(false);
    }
  }

  if (snap.status === "loading") return null;

  if (snap.mode === "demo" && snap.data) {
    return (
      <div className="grid max-w-lg gap-4">
        <h1 className="text-3xl font-semibold">家庭</h1>
        <p className="text-muted">演示模式只有这台设备上的一份数据，没有邀请码，也不能和第二个人同步。</p>
        <p>福州口味：{snap.data.settings.preferFuzhou ? "会适当安排" : "先不特意安排"}。每周新菜：{snap.data.settings.exploreNew ? "会给一两道可选新菜" : "先不尝试新菜"}。到「本周」里可以开关，再重排菜单。</p>
        <Button variant="danger" onClick={() => mealActions.resetDemo()}>清空演示数据</Button>
      </div>
    );
  }

  if (snap.status === "needs-household") {
    return (
      <div className="grid max-w-lg gap-6">
        <div>
          <h1 className="text-3xl font-semibold">加入一个厨房</h1>
          <p className="mt-2 text-muted">一个家庭最多两位成员，菜单、菜库、冰箱和购物清单都共用。</p>
        </div>
        {error ? <p className="text-sm text-persimmon" role="alert">{error}</p> : null}
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void run(() => mealActions.createHousehold(name)); }}>
          <h2 className="text-lg font-semibold">创建家庭</h2>
          <Field label="家庭名称">
            <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
          </Field>
          <Button type="submit" variant="primary" disabled={pending}>创建</Button>
        </form>
        <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void run(() => mealActions.joinHousehold(code)); }}>
          <h2 className="text-lg font-semibold">用邀请码加入</h2>
          <Field label="六位邀请码">
            <input className={inputClass} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={6} required />
          </Field>
          <Button type="submit" disabled={pending}>加入</Button>
        </form>
        <Button variant="quiet" onClick={() => void run(() => mealActions.signOut())}>退出登录</Button>
      </div>
    );
  }

  if (!snap.data) return <p>{snap.error ?? "还没有家庭信息。"}</p>;

  return (
    <div className="grid max-w-lg gap-4">
      <h1 className="text-3xl font-semibold">{snap.data.household.name}</h1>
      <p className="text-muted">把邀请码发给另一位家人。对方先用邮箱登录，再在这里输入邀请码。</p>
      <p className="rounded-3xl bg-card px-4 py-5 text-center text-3xl font-semibold tracking-[0.3em]">{snap.data.household.inviteCode}</p>
      <ul className="grid gap-2 text-sm">
        {snap.data.members.map((member) => (
          <li key={member.id}>{member.name} · {member.role === "owner" ? "创建者" : "成员"}</li>
        ))}
      </ul>
      {error ? <p className="text-sm text-persimmon" role="alert">{error}</p> : null}
      <Button onClick={() => void run(() => mealActions.signOut())}>退出登录</Button>
    </div>
  );
}
