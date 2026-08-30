/** Monday-aligned week helpers shared by WeeklyLogPage and the dashboard's weekly-log nudge. */

export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatWeekRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  // Always format both sides with month + day — some ICU implementations produce
  // a broken fallback string (e.g. "2026 (day: 21)") for a day+year-only pattern
  // with no month, so that combination must never be used here.
  const startStr = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const endStr = e.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const currentYear = new Date().getFullYear();
  const showYear = e.getFullYear() !== currentYear;
  return showYear
    ? `${startStr} \u2013 ${endStr}, ${e.getFullYear()}`
    : `${startStr} \u2013 ${endStr}`;
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

export function formatMonthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** ISO Monday-start date of "last week" relative to today — used for the weekly-log nudge. */
export function lastWeekStart(): string {
  return toISODate(addDays(getMonday(new Date()), -7));
}

export function lastWeekEnd(): string {
  return toISODate(addDays(new Date(lastWeekStart() + "T00:00:00"), 6));
}