import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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

// Two full palettes, not one brightened uniformly — dark-mode colors are picked
// separately for contrast against a dark surface, same reasoning as the CSS tokens.
const CATEGORICAL_LIGHT = ["#0E7C66", "#B8862E", "#1F8A54", "#8A93A6", "#8B5CF6", "#D33A3A", "#0EA5E9"];
const CATEGORICAL_DARK = ["#A8A29E", "#D9A64D", "#34A874", "#9AA3AF", "#A78BFA", "#E55D5D", "#38BDF8"];

// Priority colors are semantic, not positional — P1 is always the danger red,
// P2 always warning amber, matching the priority badges used everywhere else in
// the app, rather than whatever color happens to land at that array index.
const PRIORITY_COLORS: Record<string, [string, string]> = {
  P1: ["#D33A3A", "#E55D5D"],
  P2: ["#B7791F", "#E0A840"],
  P3: ["#7C5CBF", "#A78BFA"],
  MINOR: ["#6B7280", "#8B94A3"],
};

function priorityChartColor(name: string, dark: boolean): string {
  const pair = PRIORITY_COLORS[name] ?? (dark ? ["#9AA3AF", "#9AA3AF"] : ["#8A93A6", "#8A93A6"]);
  return dark ? pair[1] : pair[0];
}

/** Lightens a hex color by a fraction (0-1) — used to build the gradient's top-left stop from a base color. */
function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * amount));
  const g = Math.min(255, ((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (num & 0xff) + Math.round(255 * amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Hand-built SVG donut instead of Recharts' <Pie> — gives a gradient fill per
 * segment and a thin inset separator ring for a glossier, layered look, neither
 * of which Recharts' default flat-fill pie supports.
 */
function GlossyDonut({
  title,
  data,
  colors,
  unitLabel,
  surfaceColor,
  footer,
}: {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
  unitLabel: string;
  surfaceColor: string;
  footer?: ReactNode;
}) {
  const gradId = useId();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const size = 176;
  const thickness = 24;
  const center = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-medium text-muted">{title}</h3>
      <div className="relative mx-auto" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            {data.map((d, i) => (
              <linearGradient key={d.name} id={`${gradId}-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={lightenHex(colors[i], 0.18)} />
                <stop offset="100%" stopColor={colors[i]} />
              </linearGradient>
            ))}
          </defs>
          {data.map((d, i) => {
            const frac = total > 0 ? d.value / total : 0;
            const arcLen = frac * circumference;
            const dashOffset = -cumulative;
            cumulative += arcLen;
            return (
              <circle
                key={d.name}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={`url(#${gradId}-${i})`}
                strokeWidth={thickness}
                strokeDasharray={`${arcLen} ${circumference - arcLen}`}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${center} ${center})`}
              />
            );
          })}
          {/* Inset separator ring — the glossy "layered" look from the reference design */}
          <circle cx={center} cy={center} r={r - thickness / 2 + 2} fill="none" stroke={surfaceColor} strokeWidth={3} />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{total}</span>
          <span className="text-xs text-muted-foreground">{unitLabel}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: colors[i] }} />
            {d.name} &middot; {d.value}
          </span>
        ))}
      </div>
      {footer}
    </Card>
  );
}

/** Semicircular gauge for a single percentage — a distinct shape from the donuts so the row reads as varied, not repetitive. */
function RadialGauge({
  title,
  percent,
  subtitle,
  color,
  trackColor,
}: {
  title: string;
  percent: number;
  subtitle: string;
  color: string;
  trackColor: string;
}) {
  const gradId = useId();
  const width = 176;
  const height = 108;
  const r = 68;
  const cx = width / 2;
  const cy = 92;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const circumference = Math.PI * r;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * circumference;

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-medium text-muted">{title}</h3>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto block">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={lightenHex(color, 0.2)} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <path d={arc} fill="none" stroke={trackColor} strokeWidth={16} strokeLinecap="round" />
        <path
          d={arc}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
        <text x={cx} y={cy - 10} textAnchor="middle" fontSize={26} fontWeight={600} className="fill-foreground">
          {percent}%
        </text>
      </svg>
      <p className="-mt-1 text-center text-xs text-muted-foreground">{subtitle}</p>
    </Card>
  );
}

/** Small trend line with a soft fill underneath — for the two stat cards where a trend is meaningful. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const gradId = useId();
  const w = 200;
  const h = 40;
  if (data.length < 2) return <div style={{ height: h }} />;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = w / (data.length - 1);
  const points = data.map((v, i) => `${i * stepX},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${gradId})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const { selectedCompanyId, selectedCompany, theme } = useApp();
  const dark = theme === "dark";
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

  const totalTasksTrend = useMemo(() => {
    if (previousYearStats.totalTasks === 0) return null;
    return Math.round(((currentYearStats.totalTasks - previousYearStats.totalTasks) / previousYearStats.totalTasks) * 100);
  }, [currentYearStats, previousYearStats]);

  const tooltipStyle: React.CSSProperties = useMemo(
    () => ({
      background: dark ? "#171A1F" : "#FFFFFF",
      border: `1px solid ${dark ? "#2A2F38" : "#E2E5EA"}`,
      borderRadius: 8,
      color: dark ? "#E6E8EB" : "#1A1D23",
      fontSize: 13,
    }),
    [dark]
  );
  const axisStroke = dark ? "#6B7280" : "#8D97A5";
  const barCursorFill = dark ? "#1D2129" : "#F1F3F5";
  const barFill = dark ? "#A8A29E" : "#0E7C66";
  const surfaceColor = dark ? "#171A1F" : "#FFFFFF";
  const trackColor = dark ? "#2A2F38" : "#E2E5EA";
  const successColor = dark ? "#34A874" : "#1F8A54";

  const completionPercent = stats && stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;

  // Trend series for the sparkline stat cards — total tasks by the month they were
  // logged (endDate, or startDate if not yet finished), and completed-by-month
  // reusing the same monthly buckets already computed for the bar chart.
  const totalTasksTrendSeries = useMemo(() => {
    const counts: Record<string, number> = {};
    allTasks.forEach((t) => {
      const ref = referenceDate(t);
      if (!ref) return;
      const key = ref.slice(0, 7);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.keys(counts).sort().slice(-6).map((k) => counts[k]);
  }, [allTasks]);
  const completedTrendSeries = useMemo(() => monthData.map((d) => d.value), [monthData]);

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
          <CardContent>
            <CardValue>{stats.totalTasks}</CardValue>
            <div className="mt-2 -mx-1">
              <Sparkline data={totalTasksTrendSeries} color={barFill} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-0 sm:pb-0">
            <CardTitle>Completed</CardTitle>
            <Flame className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <CardValue>{stats.completedTasks}</CardValue>
            <div className="mt-2 -mx-1">
              <Sparkline data={completedTrendSeries} color={successColor} />
            </div>
          </CardContent>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlossyDonut
          title="By Priority"
          data={priorityData}
          colors={priorityData.map((d) => priorityChartColor(d.name, dark))}
          unitLabel="tasks"
          surfaceColor={surfaceColor}
          footer={
            hasYoyData && totalTasksTrend !== null && (
              <p className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-foreground">
                {totalTasksTrend >= 0 ? "Up" : "Down"} {Math.abs(totalTasksTrend)}% vs last year
                {totalTasksTrend >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-danger" />
                )}
              </p>
            )
          }
        />
        <RadialGauge
          title="Completion"
          percent={completionPercent}
          subtitle={`${stats.completedTasks} of ${stats.totalTasks} done`}
          color={successColor}
          trackColor={trackColor}
        />
        <GlossyDonut
          title="By Task Type"
          data={typeData}
          colors={typeData.map((_, i) => (dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT)[i % CATEGORICAL_LIGHT.length])}
          unitLabel="tasks"
          surfaceColor={surfaceColor}
        />
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">Completed by Month</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthData}>
              <defs>
                <linearGradient id="dashBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lightenHex(barFill, 0.25)} />
                  <stop offset="100%" stopColor={barFill} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke={axisStroke} fontSize={12} />
              <YAxis stroke={axisStroke} fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: barCursorFill }} />
              <Bar dataKey="value" fill="url(#dashBarGradient)" radius={[6, 6, 0, 0]} />
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
