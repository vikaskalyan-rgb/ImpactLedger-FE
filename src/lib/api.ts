import type {
  Company,
  CompanyRequest,
  PdfGenerationRequest,
  Recognition,
  RecognitionRequest,
  StatsResponse,
  Task,
  TaskFilters,
  TaskRequest,
  WeeklySummary,
  WeeklySummaryRequest,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;
const API_KEY = import.meta.env.VITE_API_KEY as string;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": API_KEY,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? message;
    } catch {
      // response wasn't JSON — keep statusText
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

function buildQuery(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const companiesApi = {
  list: () => request<Company[]>("/api/companies"),
  create: (data: CompanyRequest) =>
    request<Company>("/api/companies", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: CompanyRequest) =>
    request<Company>(`/api/companies/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/companies/${id}`, { method: "DELETE" }),
};

export const tasksApi = {
  search: (filters: TaskFilters) =>
    request<Task[]>(`/api/tasks${buildQuery(filters as unknown as Record<string, unknown>)}`),
  getById: (id: number) => request<Task>(`/api/tasks/${id}`),
  create: (data: TaskRequest) =>
    request<Task>("/api/tasks", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number, data: TaskRequest) =>
    request<Task>(`/api/tasks/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/tasks/${id}`, { method: "DELETE" }),
};

export const statsApi = {
  get: (params: { companyId?: number; startDate?: string; endDate?: string }) =>
    request<StatsResponse>(`/api/stats${buildQuery(params)}`),
};

export const recognitionsApi = {
  list: () => request<Recognition[]>("/api/recognitions"),
  create: (data: RecognitionRequest) =>
    request<Recognition>("/api/recognitions", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/recognitions/${id}`, { method: "DELETE" }),
};

export const pdfApi = {
  generate: async (data: PdfGenerationRequest): Promise<Blob> => {
    const res = await fetch(`${BASE_URL}/api/pdf/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": API_KEY,
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = await res.json();
        message = body.message ?? message;
      } catch {
        // ignore
      }
      throw new ApiError(res.status, message);
    }
    return res.blob();
  },
};

export const weeklySummariesApi = {
  list: (companyId: number) => request<WeeklySummary[]>(`/api/weekly-summaries${buildQuery({ companyId })}`),
  upsert: (data: WeeklySummaryRequest) =>
    request<WeeklySummary>("/api/weekly-summaries", { method: "POST", body: JSON.stringify(data) }),
  delete: (id: number) => request<void>(`/api/weekly-summaries/${id}`, { method: "DELETE" }),
};

export { ApiError };
