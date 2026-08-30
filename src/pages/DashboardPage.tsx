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
import { CheckCircle2, GitPullRequest, FileText, Flame, Star, AlertCircle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { statsApi, tasksApi } from "@/lib/api";
import type { StatsResponse, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardValue } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, monthName } from "@/lib/format";
import { ActivityHeatmap } from "@/components/ActivityHeatMap";

const CHART_COLORS = ["#3E92CC", "#D4A94A", "#3FB27F", "#E5484D", "#8A93A6", "#6FB8E6", "#E0A82E"];

export function DashboardPage() {
  const navigate = useNavigate();
  const { selectedCompanyId, selectedCompany } = useApp();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
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
    ])
      .then(([s, tasks]) => {
        setStats(s);
        setAllTasks(tasks);
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
