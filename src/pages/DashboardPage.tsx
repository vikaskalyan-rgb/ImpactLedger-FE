import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { CheckCircle2, GitPullRequest, FileText, Flame, Star, AlertCircle, TrendingUp, TrendingDown, Minus, NotebookPen, History } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { statsApi, tasksApi, weeklySummariesApi } from "@/lib/api";
import type { StatsResponse, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, monthName, formatDate } from "@/lib/format";
import { ActivityHeatmap } from "@/components/ActivityHeatMap";
import { lastWeekStart, lastWeekEnd, formatWeekRange } from "@/lib/week";

const CHART_COLORS = ["#3E92CC", "#D4A94A", "#3FB27F", "#E5484D", "#8A93A6", "#6FB8E6", "#E0A82E"];

/** endDate if set, else startDate — matches the convention used for quarter grouping in the PDF. */
function referenceDate(t: Task): string | null {
  return t.endDate ?? t.startDate;
}

interface YearStats {
  totalTasks: number;
  completedTasks: number;
  totalPrs: number;
  majorCount: number;
}

function computeYearStats(tasks: Task[], year: number): YearStats {
  const inYear = tasks.filter((t) => {
    const ref = referenceDate(t);
    return ref ? Number(ref.slice(0, 4)) === year : false;
  });
  return {
    totalTasks: inYear.length,
    completedTasks: inYear.filter((t) => t.status === "COMPLETED").length,
    totalPrs: inYear.reduce((sum, t) => sum + t.prLinks.length, 0),
    majorCount: inYear.filter((t) => t.complexity === "MAJOR").length,
  };
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * Tasks landing close to "this date, one year ago" — an exact-day match would
 * almost always be empty (nobody logs a task on precisely the right day), so this
 * widens to a small window and takes the closest few. Window is centered on
 * (today - 1 year), not on any particular month, so it still works in January.
 */
const ON_THIS_DAY_WINDOW_DAYS = 5;

function findOnThisDayLastYear(tasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastYearToday = new Date(today);
  lastYearToday.setFullYear(lastYearToday.getFullYear() - 1);

  return tasks
    .map((t) => {
      const ref = referenceDate(t);
      if (!ref) return null;
      const refDate = new Date(ref + "T00:00:00");
      const diff = Math.abs(daysBetween(refDate, lastYearToday));
      return diff <= ON_THIS_DAY_WINDOW_DAYS ? { task: t, diff } : null;
    })
    .filter((x): x is { task: Task; diff: number } => x !== null)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 4)
    .map((x) => x.task);
}

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return current > 0 ? <span className="text-xs text-success">new</span> : null;
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" /> even</span>;
  const up = pct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? "text-success" : "text-danger"}`}>
      <Icon className="h-3 w-3" /> {up ? "+" : ""}{pct}%
    </span>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { selectedCompanyId, selectedCompany } = useApp();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [hasLastWeekLog, setHasLastWeekLog] = useState(true); // default true so the nudge never flashes before data loads
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedCompanyId) {
      setStats(null);
      setAllTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      statsApi.get({ companyId: selectedCompanyId }),
      tasksApi.search({ companyId: selectedCompanyId }),
      weeklySummariesApi.list(selectedCompanyId),
    ])
      .then(([s, tasks, weeklyLogs]) => {
        setStats(s);
        setAllTasks(tasks);
        setHasLastWeekLog(weeklyLogs.some((w) => w.weekStartDate === lastWeekStart()));
      })
      .finally(() => setLoading(false));
  }, [selectedCompanyId]);

  const ongoing = useMemo(() => allTasks.filter((t) => t.status === "IN_PROGRESS"), [allTasks]);
  const missingImpact = useMemo(
    () => allTasks.filter((t) => t.status === "COMPLETED" && (!t.impact || !t.impact.trim())),
    [allTasks]
  );

  const priorityData = useMemo(
    () => stats ? Object.entries(stats.byPriority).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })) : [],
    [stats]
  );
  const typeData = useMemo(
    () => stats ? Object.entries(stats.byTaskType).map(([name, value]) => ({ name, value })) : [],
    [stats]
  );
  const monthData = useMemo(
    () => stats ? Object.entries(stats.tasksCompletedByMonth).map(([month, value]) => ({ month: monthName(month), value })) : [],
    [stats]
  );

  const { currentYear, previousYear, currentYearStats, previousYearStats } = useMemo(() => {
    const now = new Date().getFullYear();
    return {
      currentYear: now,
      previousYear: now - 1,
      currentYearStats: computeYearStats(allTasks, now),
      previousYearStats: computeYearStats(allTasks, now - 1),
    };
  }, [allTasks]);
  const hasYoyData = currentYearStats.totalTasks > 0 || previousYearStats.totalTasks > 0;

  const onThisDayLastYear = useMemo(() => findOnThisDayLastYear(allTasks), [allTasks]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="mr-2" /> Loading dashboard...
      </div>
    );
  }

  if (!selectedCompanyId || !stats) {
    return <Card className="p-10 text-center text-muted">Add a company (top right) to start tracking your work.</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
          Welcome back Vikas!
        </h1>
        <p className="text-sm text-muted">Here's the shape of your work at {selectedCompany?.name} as {selectedCompany?.roleTitle ? `${selectedCompany.roleTitle}` : ""}.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0 sm:pb-0">
            <CardTitle>Total Tasks</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-brand" />
          </CardHeader>
          <CardContent><CardValue>{stats.totalTasks}</CardValue></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0 sm:pb-0">
            <CardTitle>Completed</CardTitle>
            <Flame className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><CardValue>{stats.completedTasks}</CardValue></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0 sm:pb-0">
            <CardTitle>PRs Merged</CardTitle>
            <GitPullRequest className="h-4 w-4 text-accent-gold" />
          </CardHeader>
          <CardContent><CardValue>{stats.totalPrs}</CardValue></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0 sm:pb-0">
            <CardTitle>Design Docs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><CardValue>{stats.totalDesignDocs}</CardValue></CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">By Priority</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {priorityData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: 8, color: "#1A1D23" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">By Task Type</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={typeData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {typeData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: 8, color: "#1A1D23" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">Completed by Month</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthData}>
              <XAxis dataKey="month" stroke="#8D97A5" fontSize={12} />
              <YAxis stroke="#8D97A5" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: 8, color: "#1A1D23" }} cursor={{ fill: "#F1F3F5" }} />
              <Bar dataKey="value" fill="#3E92CC" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <ActivityHeatmap heatmap={stats.activityHeatmap} />

      {!hasLastWeekLog && (
        <Card className="border-brand/30 bg-brand/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <NotebookPen className="h-4 w-4 text-brand shrink-0" />
              <span>
                No weekly reflection logged for <strong>{formatWeekRange(lastWeekStart(), lastWeekEnd())}</strong> yet.
              </span>
            </div>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => navigate("/weekly-log")}>
              Log it
            </Button>
          </div>
        </Card>
      )}

      {missingImpact.length > 0 && (
        <Card className="border-warning/30 bg-warning/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              <span>
                <strong>{missingImpact.length}</strong> completed task{missingImpact.length === 1 ? "" : "s"} {missingImpact.length === 1 ? "doesn't" : "don't"} have an impact statement yet — worth filling in once you can measure the result.
              </span>
            </div>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => navigate("/tasks?needsImpact=true")}>
              Review them
            </Button>
          </div>
        </Card>
      )}

      {hasYoyData && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-medium text-muted">{previousYear} vs {currentYear}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Tasks</span>
                <DeltaBadge current={currentYearStats.totalTasks} previous={previousYearStats.totalTasks} />
              </div>
              <p className="text-2xl font-semibold tracking-tight">{currentYearStats.totalTasks}</p>
              <p className="text-xs text-muted-foreground">{previousYear}: {previousYearStats.totalTasks}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Completed</span>
                <DeltaBadge current={currentYearStats.completedTasks} previous={previousYearStats.completedTasks} />
              </div>
              <p className="text-2xl font-semibold tracking-tight">{currentYearStats.completedTasks}</p>
              <p className="text-xs text-muted-foreground">{previousYear}: {previousYearStats.completedTasks}</p>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">PRs merged</span>
                <DeltaBadge current={currentYearStats.totalPrs} previous={previousYearStats.totalPrs} />
              </div>
              <p className="text-2xl font-semibold tracking-tight">{currentYearStats.totalPrs}</p>
              <p className="text-xs text-muted-foreground">{previousYear}: {previousYearStats.totalPrs}</p>
            </div>
          </div>
        </Card>
      )}

      {onThisDayLastYear.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted">
            <History className="h-4 w-4 text-muted-foreground" /> Around this time last year
          </h3>
          <div className="space-y-3">
            {onThisDayLastYear.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.ticketId} · {formatDate(referenceDate(t))}</p>
                  {t.impact && <p className="mt-1 text-xs text-muted line-clamp-2">{t.impact}</p>}
                </div>
                <Badge variant={priorityBadgeVariant(t.priority)} className="shrink-0">{t.priority}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
              <Flame className="h-4 w-4 text-warning" /> Ongoing Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ongoing.length === 0 && <p className="text-sm text-muted">Nothing in progress right now.</p>}
            {ongoing.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-border-subtle pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.ticketId}</p>
                </div>
                <Badge variant={priorityBadgeVariant(t.priority)}>{t.priority}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground text-base font-semibold">
              <Star className="h-4 w-4 text-accent-gold" /> Highlights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.highlightedTasks.length === 0 && (
              <p className="text-sm text-muted">Mark tasks as "highlight" while editing them to feature your best work here.</p>
            )}
            {stats.highlightedTasks.slice(0, 5).map((t) => (
              <div key={t.id} className="border-b border-border-subtle pb-2 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{t.title}</p>
                  <Badge variant={statusBadgeVariant(t.status)}>{statusLabel(t.status)}</Badge>
                </div>
                {t.impact && <p className="mt-1 text-xs text-muted line-clamp-2">{t.impact}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
