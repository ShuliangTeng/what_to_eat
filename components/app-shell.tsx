"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { startMealApp, useMealApp } from "@/lib/meal-store";
import { cx } from "@/components/ui";

const NAV = [
  { href: "/", label: "今天" },
  { href: "/week", label: "本周" },
  { href: "/dishes", label: "菜库" },
  { href: "/fridge", label: "冰箱" },
  { href: "/grocery", label: "采购" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const snap = useMealApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    startMealApp();
  }, []);

  useEffect(() => {
    if (snap.status === "signed-out" && pathname !== "/login") router.replace("/login");
    if (snap.status === "needs-household" && pathname !== "/household" && pathname !== "/login") router.replace("/household");
    if (snap.status === "ready" && pathname === "/login") router.replace("/");
  }, [pathname, router, snap.status]);

  const showNav = snap.status === "ready";
  const bare = snap.status !== "ready" && pathname !== "/household" && pathname !== "/login";

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      {showNav ? (
        <aside className="hidden border-r border-line px-4 py-6 md:block">
          <Brand />
          <nav aria-label="主要" className="mt-8 grid gap-1">
            {NAV.map((item) => (
              <NavLink key={item.href} href={item.href} current={pathname === item.href} label={item.label} />
            ))}
          </nav>
        </aside>
      ) : null}
      <div>
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 pt-5 md:px-8">
          <Brand compact />
          {snap.status === "ready" || snap.status === "needs-household" ? (
            <Link href="/household" className="text-sm text-muted">
              家庭
            </Link>
          ) : null}
        </header>
        {snap.mode === "demo" && snap.status === "ready" ? (
          <p className="mx-auto mt-4 w-full max-w-3xl rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn md:px-8">
            演示模式：还没有连接 Supabase。菜单和库存只保存在这台设备的浏览器里，换手机或清除缓存就会消失，也不会和另一位家人同步。
          </p>
        ) : null}
        {snap.error ? (
          <p className="mx-auto mt-4 w-full max-w-3xl rounded-2xl bg-[#fde7da] px-4 py-3 text-sm text-persimmon-dark md:px-8" role="alert">
            {snap.error}
          </p>
        ) : null}
        <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-36 md:px-8 md:pb-12">
          {snap.status === "loading" ? <p className="text-lg">正在准备今天的饭…</p> : null}
          {snap.status === "offline" ? (
            <div>
              <h1 className="text-2xl font-semibold">暂时连不上</h1>
              <p className="mt-3 text-muted" role="alert">{snap.error ?? "请检查网络和 Supabase 配置。"}</p>
            </div>
          ) : null}
          {snap.status === "loading" || !bare ? children : <p>正在打开页面…</p>}
        </main>
      </div>
      {showNav ? (
        <nav aria-label="主要" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-card/95 px-2 py-2 backdrop-blur md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={cx("rounded-2xl py-2 text-center text-sm", pathname === item.href ? "bg-ink text-white" : "text-muted")}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={compact ? "md:hidden" : "hidden md:block"}>
      <span className="block text-lg font-semibold tracking-tight">今天吃什么</span>
      <span className="mt-1 block text-sm text-muted">两个人的晚饭</span>
    </Link>
  );
}

function NavLink({ href, label, current }: { href: string; label: string; current: boolean }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cx("rounded-2xl px-3 py-3 text-sm", current ? "bg-ink text-white" : "text-ink hover:bg-white")}
    >
      {label}
    </Link>
  );
}
