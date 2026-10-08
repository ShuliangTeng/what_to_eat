import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-10">
      <h1 className="text-2xl font-semibold">没有这一页</h1>
      <p className="mt-2 text-muted">回到今天的晚饭吧。</p>
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-persimmon px-4 text-sm text-white">
        回今天
      </Link>
    </div>
  );
}
