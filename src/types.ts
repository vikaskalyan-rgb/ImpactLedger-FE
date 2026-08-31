export type Priority = "P1" | "P2" | "P3" | "MINOR";
export type Complexity = "MAJOR" | "MEDIUM" | "MINOR";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "COMPLETED";
export type PdfMode = "APPRAISAL" | "MONTHLY";
export type AppraisalType = "MIDYEAR" | "YEAR_END";

export const PRIORITIES: Priority[] = ["P1", "P2", "P3", "MINOR"];
export const COMPLEXITIES: Complexity[] = ["MAJOR", "MEDIUM", "MINOR"];
export const STATUSES: TaskStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "COMPLETED"];

export const TASK_TYPE_SUGGESTIONS = [
  "Feature", "Bug", "Design", "Infra", "Migration", "Incident", "Mentoring", "POC",
  "Hackathon", "Expo", "Culture",
];

/**
 * Task types that count as contribution beyond ticket delivery — hackathons,
 * expos, mentoring, culture-building. Tag a task with one of these and it
 * automatically surfaces in the PDF's dedicated section and the dashboard's
 * "around this time last year" card, no separate tracking needed.
 */
export const CULTURE_TASK_TYPES = ["Hackathon", "Expo", "Culture", "Mentoring"];

export interface Company {
  id: number;
  name: string;
  roleTitle?: string | null;
  deletedAt?: string | null;
}

export interface CompanyRequest {
  name: string;
  roleTitle?: string;
}

export interface Task {
  id: number;
  companyId: number;
  companyName: string;
  ticketId: string;
  title: string;
  taskTypes: string[];
  priority: Priority;
  complexity: Complexity;
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  prLinks: string[];
  designDocLink: string | null;
  description: string | null;
  designDecisions: string | null;
  impact: string | null;
  techStack: string[];
  collaborators: string[];
  tags: string[];
  riskOrBlockerNotes: string | null;
  includeInPdf: boolean;
  highlight: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface TaskBulkUpdateRequest {
  ids: number[];
  includeInPdf?: boolean;
  highlight?: boolean;
}

export interface TaskRequest {
  companyId: number;
  ticketId: string;
  title: string;
  taskTypes: string[];
  priority: Priority;
  complexity: Complexity;
  status: TaskStatus;
  startDate: string | null;
  endDate: string | null;
  prLinks: string[];
  designDocLink: string | null;
  description: string | null;
  designDecisions: string | null;
  impact: string | null;
  techStack: string[];
  collaborators: string[];
  tags: string[];
  riskOrBlockerNotes: string | null;
  includeInPdf: boolean;
  highlight: boolean;
}

export interface Recognition {
  id: number;
  companyId: number;
  date: string;
  source: string;
  message: string;
  deletedAt?: string | null;
}

export interface RecognitionRequest {
  companyId: number;
  date: string;
  source: string;
  message: string;
}

export interface StatsResponse {
  totalTasks: number;
  completedTasks: number;
  totalPrs: number;
  totalDesignDocs: number;
  byPriority: Record<string, number>;
  byComplexity: Record<string, number>;
  byStatus: Record<string, number>;
  byTaskType: Record<string, number>;
  byTechStack: Record<string, number>;
  tasksCompletedByMonth: Record<string, number>;
  activityHeatmap: Record<string, number>;
  highlightedTasks: Task[];
}

export interface TaskFilters {
  companyId?: number;
  priority?: Priority;
  complexity?: Complexity;
  status?: TaskStatus;
  taskType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  includeInPdf?: boolean;
  highlight?: boolean;
}

export interface PdfGenerationRequest {
  mode: PdfMode;
  appraisalType?: AppraisalType;
  year: number;
  month?: number;
  customStartDate?: string;
  customEndDate?: string;
  companyId?: number;
  taskIds: number[];
  profileName?: string;
  profileTitle?: string;
}

export interface WeeklySummary {
  id: number;
  companyId: number;
  weekStartDate: string;
  weekEndDate: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklySummaryRequest {
  companyId: number;
  weekStartDate: string;
  weekEndDate: string;
  content: string;
}

export interface Todo {
  id: number;
  companyId: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface TodoRequest {
  companyId: number;
  title: string;
  notes?: string | null;
  dueDate?: string | null;
  completed: boolean;
}
