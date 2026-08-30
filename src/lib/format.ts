import type { Complexity, Priority, TaskStatus } from "@/types";

export function priorityBadgeVariant(p: Priority) {
  return { P1: "p1", P2: "p2", P3: "p3", MINOR: "minor" }[p] as
    | "p1"
    | "p2"
    | "p3"
    | "minor";
}

export function complexityLabel(c: Complexity) {
  return { MAJOR: "Major", MEDIUM: "Medium", MINOR: "Minor" }[c];
}

export function statusLabel(s: TaskStatus) {
  return {
    NOT_STARTED: "Not started",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    IN_REVIEW: "In review",
    COMPLETED: "Completed",
  }[s];
}

export function statusBadgeVariant(s: TaskStatus) {
  return {
    NOT_STARTED: "secondary",
    IN_PROGRESS: "default",
    BLOCKED: "danger",
    IN_REVIEW: "warning",
    COMPLETED: "success",
  }[s] as "secondary" | "default" | "danger" | "warning" | "success";
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** For full Instant timestamps (e.g. deletedAt) — formatDate() above is for date-only strings. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

export function monthName(ym: string) {
  // ym = "2026-08"
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}