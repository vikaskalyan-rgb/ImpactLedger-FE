import type { Task, TaskRequest } from "@/types";

/**
 * Builds a full TaskRequest from an existing Task, optionally overriding a few
 * fields. The backend's PUT /api/tasks/{id} always expects the complete request
 * shape (no partial-patch endpoint for single tasks), so both the inline
 * quick-edit (change one badge) and "Clone" (prefill a new task) go through this.
 */
export function taskToRequest(task: Task, overrides: Partial<TaskRequest> = {}): TaskRequest {
  return {
    companyId: task.companyId,
    ticketId: task.ticketId,
    title: task.title,
    taskTypes: task.taskTypes,
    priority: task.priority,
    complexity: task.complexity,
    status: task.status,
    startDate: task.startDate,
    endDate: task.endDate,
    prLinks: task.prLinks,
    designDocLink: task.designDocLink,
    description: task.description,
    designDecisions: task.designDecisions,
    impact: task.impact,
    techStack: task.techStack,
    collaborators: task.collaborators,
    tags: task.tags,
    riskOrBlockerNotes: task.riskOrBlockerNotes,
    includeInPdf: task.includeInPdf,
    highlight: task.highlight,
    ...overrides,
  };
}

/**
 * What carries over when cloning a task vs. what resets, tuned for the
 * recurring-ticket case (e.g. weekly on-call): the shape of the work (title,
 * type, priority, tech stack, docs) repeats, but the instance-specific facts
 * (ticket ID, dates, links, measured impact, status) do not and would be
 * actively misleading if copied silently.
 */
export function cloneOverrides(): Partial<TaskRequest> {
  return {
    ticketId: "",
    status: "NOT_STARTED",
    startDate: null,
    endDate: null,
    prLinks: [],
    impact: "",
    riskOrBlockerNotes: "",
    highlight: false,
  };
}
