import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Check, Save, Search, Trash2, NotebookPen } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi, weeklySummariesApi } from "@/lib/api";
import type { Task, WeeklySummary } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function formatWeekRange(start: string, end: string): string {
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

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(monthKeyStr: string): string {
  const [y, m] = monthKeyStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function WeeklyLogPage() {
  const { selectedCompanyId, toast } = useApp();

  const [weekOffset, setWeekOffset] = useState(0);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [allLogs, setAllLogs] = useState<WeeklySummary[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const weekStart = useMemo(() => toISODate(addDays(getMonday(new Date()), weekOffset * 7)), [weekOffset]);
  const weekEnd = useMemo(() => toISODate(addDays(new Date(weekStart + "T00:00:00"), 6)), [weekStart]);

  const loadLogs = () => {
    if (!selectedCompanyId) return;
    setLoadingLogs(true);
    weeklySummariesApi.list(selectedCompanyId)
      .then(setAllLogs)
      .finally(() => setLoadingLogs(false));
  };

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  // Load tasks for the selected week, and pre-fill the editor if a log already exists for it
  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoadingTasks(true);
    tasksApi.search({ companyId: selectedCompanyId, startDate: weekStart, endDate: weekEnd })
      .then(setWeekTasks)
      .finally(() => setLoadingTasks(false));

    const existing = allLogs.find((l) => l.weekStartDate === weekStart);
    setContent(existing?.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, weekStart, weekEnd]);

  function buildWeeklyPrompt(): string {
    const lines = weekTasks.map((t) => {
      const parts = [`- ${t.title} (${t.ticketId}, ${t.status.replace("_", " ").toLowerCase()})`];
      if (t.impact && t.impact.trim()) parts.push(`  Impact: ${t.impact}`);
      else if (t.description && t.description.trim()) parts.push(`  ${t.description}`);
      return parts.join("\n");
    }).join("\n");

    return `Write a short weekly reflection (4-6 sentences) summarizing what I worked on this week, based on the tasks below. Write in first person, plain and direct — this is a private log entry for myself, not a report for anyone else. Note what went well, anything that was tricky or blocked, and what it sets up for next week if that's clear from the data. Do not invent details not present below.

Week: ${formatWeekRange(weekStart, weekEnd)}

Tasks this week:
${lines || "(no tasks logged for this week)"}

Return ONLY the reflection paragraph, no preamble.`;
  }

  function handleCopyPrompt() {
    navigator.clipboard.writeText(buildWeeklyPrompt());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!selectedCompanyId) return;
    if (!content.trim()) {
      toast("Write or paste a summary first", "error");
      return;
    }
    setSaving(true);
    try {
      await weeklySummariesApi.upsert({ companyId: selectedCompanyId, weekStartDate: weekStart, weekEndDate: weekEnd, content: content.trim() });
      toast("Weekly log saved", "success");
      loadLogs();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(log: WeeklySummary) {
    if (!confirm(`Delete the log for ${formatWeekRange(log.weekStartDate, log.weekEndDate)}?`)) return;
    try {
      await weeklySummariesApi.delete(log.id);
      toast("Log deleted", "success");
      loadLogs();
      if (log.weekStartDate === weekStart) setContent("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    }
  }

  function jumpToLog(log: WeeklySummary) {
    const monday = getMonday(new Date());
    const targetMonday = new Date(log.weekStartDate + "T00:00:00");
    const diffWeeks = Math.round((targetMonday.getTime() - monday.getTime()) / (7 * 86400000));
    setWeekOffset(diffWeeks);
  }

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allLogs.forEach((l) => set.add(monthKey(l.weekStartDate)));
    return Array.from(set).sort().reverse();
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    let logs = allLogs;
    if (monthFilter) logs = logs.filter((l) => monthKey(l.weekStartDate) === monthFilter);
    if (search.trim()) logs = logs.filter((l) => l.content.toLowerCase().includes(search.toLowerCase()));
    return logs;
  }, [allLogs, search, monthFilter]);

  const isCurrentWeek = weekOffset === 0;

  if (!selectedCompanyId) {
    return <Card className="p-10 text-center text-muted">Select a company first.</Card>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Weekly Log</h1>
        <p className="text-sm text-muted">A short AI-assisted reflection each week — over months, a searchable diary of your own reasoning.</p>
      </div>

      <Card className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-sm font-medium">{formatWeekRange(weekStart, weekEnd)}</p>
            {isCurrentWeek && <p className="text-xs text-muted-foreground">This week</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="rounded-[var(--radius-control)] border border-border bg-surface-hover/50 px-3 py-2 text-xs text-muted-foreground">
          {loadingTasks ? "Loading tasks for this week..." : `${weekTasks.length} task${weekTasks.length === 1 ? "" : "s"} logged this week`}
        </div>

        <Button type="button" variant="secondary" size="sm" onClick={handleCopyPrompt} disabled={weekTasks.length === 0}>
          {copied ? <Check className="text-success" /> : <Copy />}
          {copied ? "Copied!" : "Copy weekly summary prompt"}
        </Button>

        <div>
          <Label htmlFor="weekly-content">This week's reflection</Label>
          <Textarea
            id="weekly-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste the AI's paragraph here, or write your own..."
            rows={5}
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving || !content.trim()} className="w-full sm:w-auto">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save this week's log"}
          </Button>
        </div>
      </Card>

      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <NotebookPen className="h-4 w-4 text-muted-foreground" /> Past entries
          </h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {availableMonths.length > 1 && (
              <Select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="h-8 w-full text-xs sm:w-40"
              >
                <option value="">All weeks</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>{formatMonthLabel(m)}</option>
                ))}
              </Select>
            )}
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your logs..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        </div>

        {loadingLogs ? (
          <div className="flex items-center justify-center py-10 text-muted"><Spinner className="mr-2" /> Loading...</div>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-8 text-center text-muted text-sm">
            {allLogs.length === 0
              ? "No weekly logs yet — save your first one above."
              : "No logs match that search or filter."}
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="p-4">
                <CardContent className="p-0">
                  <div className="flex items-start justify-between gap-3">
                    <button className="text-left flex-1" onClick={() => jumpToLog(log)}>
                      <p className="text-xs font-medium text-brand hover:underline">{formatWeekRange(log.weekStartDate, log.weekEndDate)}</p>
                      <p className="mt-1 text-sm text-foreground">{log.content}</p>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">Last updated {formatDate(log.updatedAt.slice(0, 10))}</p>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(log)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
