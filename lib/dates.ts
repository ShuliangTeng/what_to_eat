const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"] as const;

export function todayISO(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(iso: string, amount: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + amount);
  return todayISO(date);
}

export function mondayOf(iso: string): string {
  const date = parseISODate(iso);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return todayISO(date);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function isWeekdayDate(iso: string): boolean {
  const day = parseISODate(iso).getDay();
  return day >= 1 && day <= 5;
}

export function weekdayLabel(iso: string): string {
  return WEEKDAY[parseISODate(iso).getDay()];
}

export function formatMonthDay(iso: string): string {
  const date = parseISODate(iso);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatFullDate(iso: string): string {
  return `${formatMonthDay(iso)} ${weekdayLabel(iso)}`;
}

export function relativeDay(iso: string, today: string): string | null {
  if (iso === today) return "今天";
  if (iso === addDays(today, 1)) return "明天";
  if (iso === addDays(today, -1)) return "昨天";
  return null;
}

export function daysBetween(from: string, to: string): number {
  const start = parseISODate(from).getTime();
  const end = parseISODate(to).getTime();
  return Math.round((end - start) / 86400000);
}
