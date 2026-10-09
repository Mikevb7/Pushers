// Alle datums in Nederlandse tijd, als "YYYY-MM-DD".
export const TZ = "Europe/Amsterdam";

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function dayKey(d: Date | string = new Date()): string {
  return fmt.format(typeof d === "string" ? new Date(d) : d);
}

function toUtc(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: string, n: number): string {
  const d = toUtc(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = maandag ... 6 = zondag */
export function weekday(key: string): number {
  return (toUtc(key).getUTCDay() + 6) % 7;
}

export function weekStart(key: string): string {
  return addDays(key, -weekday(key));
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86400000);
}

export const WEEKDAY_SHORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function formatDay(key: string): string {
  const s = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(toUtc(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function timeAgo(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "net";
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = daysBetween(dayKey(iso), dayKey(now));
  if (days === 1) return "gisteren";
  return `${days} dagen geleden`;
}
