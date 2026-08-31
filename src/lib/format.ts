import type { Complexity, Priority, TaskStatus, Task } from "@/types";

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

// Rank tables for sorting — the natural business ordering (P1 first, MAJOR first,
// NOT_STARTED-through-COMPLETED as a pipeline), not alphabetical.
const PRIORITY_RANK: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, MINOR: 3 };
const COMPLEXITY_RANK: Record<Complexity, number> = { MAJOR: 0, MEDIUM: 1, MINOR: 2 };
const STATUS_RANK: Record<TaskStatus, number> = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  BLOCKED: 2,
  IN_REVIEW: 3,
  COMPLETED: 4,
};

export type TaskSortKey = "title" | "priority" | "complexity" | "status" | "dates";

export function compareTasks(a: Task, b: Task, key: TaskSortKey): number {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "priority":
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    case "complexity":
      return COMPLEXITY_RANK[a.complexity] - COMPLEXITY_RANK[b.complexity];
    case "status":
      return STATUS_RANK[a.status] - STATUS_RANK[b.status];
    case "dates":
      return (a.startDate ?? "").localeCompare(b.startDate ?? "");
  }
}

/** Plain-text summary of a task, meant for pasting into Slack, a standup update, or a 1:1 doc. */
export function formatTaskForClipboard(task: Task): string {
  const lines = [
    `${task.title} (${task.ticketId})`,
    `Priority: ${task.priority} \u00b7 Status: ${statusLabel(task.status)}`,
  ];
  const body = task.impact?.trim() || task.description?.trim();
  if (body) lines.push(body);
  return lines.join("\n");
}
