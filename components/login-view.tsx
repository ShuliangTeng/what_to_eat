"use client";

import { useState, useSyncExternalStore } from "react";
import { mealActions, useMealApp } from "@/lib/meal-store";
import { supabaseConfigured } from "@/lib/supabase/env";
import { Button, Field, inputClass } from "@/components/ui";

export function LoginView() {
  const snap = useMealApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkError = useSyncExternalStore(
    () => () => undefined,
    () => new URLSearchParams(window.location.search).get("error") === "link",
    () => false,
  );

  if (!supabaseConfigured()) {
    return (
      <div className="py-6">
        <h1 className="text-3xl font-semibold">现在是演示模式</h1>
        <p className="mt-3 text-muted">还没有填写 Supabase 配置，所以不用登录。数据只在这台设备上。</p>
      </div>
    );
  }

  return (
    <form
      className="grid max-w-md gap-4 py-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        try {
          await mealActions.sendMagicLink(email);
          setSent(true);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "邮件没有发出去。");
        }
      }}
    >
      <h1 className="text-3xl font-semibold">登录</h1>
      <p className="text-muted">用邮箱收一个登录链接。两位家人登录后加入同一个家庭，菜单就一起用。</p>
      {linkError ? <p className="rounded-2xl bg-warn-soft p-3 text-sm text-warn" role="alert">登录链接无效或过期了，请重新发送。</p> : null}
      {snap.error ? <p className="text-sm text-persimmon" role="alert">{snap.error}</p> : null}
      <Field label="邮箱">
        <input className={inputClass} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </Field>
      <Button type="submit" variant="primary">发送登录邮件</Button>
      {sent ? <p className="text-sm text-leaf">邮件已发送。打开里面的链接就能进来。</p> : null}
      {error ? <p className="text-sm text-persimmon" role="alert">{error}</p> : null}
    </form>
  );
}
