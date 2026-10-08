import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const variants = {
  primary: "bg-persimmon text-white hover:bg-persimmon-dark",
  ghost: "border border-line bg-card text-ink hover:bg-white",
  quiet: "bg-transparent text-ink hover:bg-white/80",
  danger: "border border-line bg-white text-persimmon",
};

export function Button({
  variant = "ghost",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variants }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-line bg-white px-3 py-3 text-base text-ink outline-none ring-persimmon/30 focus:ring-2";

export function Badge({ tone = "plain", children }: { tone?: "plain" | "leaf" | "warn" | "new"; children: ReactNode }) {
  const tones = {
    plain: "bg-white text-muted",
    leaf: "bg-leaf-soft text-leaf",
    warn: "bg-warn-soft text-warn",
    new: "bg-[#fde7da] text-persimmon-dark",
  };
  return <span className={cx("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}
