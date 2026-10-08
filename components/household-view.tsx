"use client";

import { useState } from "react";
import { mealActions, useMealApp } from "@/lib/meal-store";
import { Button, Field, inputClass } from "@/components/ui";

function formatCode(code: string) {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

export function HouseholdView() {
  const snap = useMealApp();
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [pending, setPending] = useState(false);

  if (snap.status === "loading") return null;

  if (snap.mode === "demo" && snap.data) {
    return (
      <div className="grid max-w-lg gap-4">
        <h1 className="text-3xl font-semibold">另一台设备</h1>
        <p className="text-muted">演示模式的菜单只在这台设备上，不能和第二个人共用。连上 Supabase 之后，才能生成一次性配对码。</p>
        <Button variant="danger" onClick={() => mealActions.resetDemo()}>清空演示数据</Button>
      </div>
    );
  }

  if (!snap.data) return <p>{snap.error ?? "还没有菜单。"}</p>;

  const shared = snap.data.members.length >= 2;

  async function issue() {
    setError(null);
    setPending(true);
    try {
      setIssued(await mealActions.issuePairingCode());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "配对码没有生成。");
    } finally {
      setPending(false);
    }
  }

  async function redeem(confirmSwitch: boolean) {
    setError(null);
    setPending(true);
    try {
      await mealActions.acceptPairingCode(code, confirmSwitch);
      setNeedsConfirm(false);
      setIssued(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "没有加入。";
      setNeedsConfirm(message.includes("已经有改过的菜单"));
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid max-w-lg gap-6">
      <div>
        <h1 className="text-3xl font-semibold">另一台设备</h1>
        <p className="mt-2 text-muted">打开网站就能看自己的菜单。要和另一个人共用，请在这台设备上生成配对码，让对方在自己的手机上输入。配对码 10 分钟内有效，用过就作废，不要发到公开的地方。</p>
      </div>
      <p className="text-sm text-muted">现在有 {snap.data.members.length} 台设备连着「{snap.data.household.name}」。</p>
      {error ? <p className="text-sm text-persimmon" role="alert">{error}</p> : null}
      {shared ? (
        <p>已经有两台设备在共用这份菜单。</p>
      ) : (
        <div className="grid gap-3">
          <Button variant="primary" disabled={pending} onClick={() => void issue()}>生成配对码</Button>
          {issued ? (
            <p className="rounded-3xl bg-card px-4 py-5 text-center text-3xl font-semibold tracking-[0.2em]">{formatCode(issued)}</p>
          ) : null}
        </div>
      )}
      <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void redeem(false); }}>
        <h2 className="text-lg font-semibold">我有配对码</h2>
        <Field label="一次性配对码">
          <input
            className={inputClass}
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setNeedsConfirm(false); }}
            autoComplete="off"
            inputMode="text"
            maxLength={11}
            required
          />
        </Field>
        <Button type="submit" disabled={pending}>加入对方的菜单</Button>
        {needsConfirm ? (
          <Button type="button" variant="danger" disabled={pending} onClick={() => void redeem(true)}>确认改用对方的菜单</Button>
        ) : null}
      </form>
      <Button variant="quiet" disabled={pending} onClick={() => void mealActions.refresh()}>刷新设备数量</Button>
    </div>
  );
}
