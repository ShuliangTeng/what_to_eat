import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "今天吃什么",
  description: "两个人的晚饭决定助手：今天吃什么、这周怎么安排、要买什么。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN">
      <body>
        <Suspense fallback={<p className="px-5 py-16 text-lg text-ink">正在打开厨房…</p>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
