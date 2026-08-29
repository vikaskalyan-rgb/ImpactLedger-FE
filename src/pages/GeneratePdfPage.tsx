import { useEffect, useMemo, useState } from "react";
import { FileDown, CheckSquare, Square } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi, pdfApi } from "@/lib/api";
import type { Task, PdfMode, AppraisalType, PdfGenerationRequest } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { priorityBadgeVariant, formatDate } from "@/lib/format";

const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 3 + i);
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GeneratePdfPage() {
  const { selectedCompanyId, selectedCompany, toast } = useApp();

  const [mode, setMode] = useState<PdfMode>("APPRAISAL");
  const [appraisalType, setAppraisalType] = useState<AppraisalType>("YEAR_END");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [profileName, setProfileName] = useState(() => localStorage.getItem("impactledger:profileName") ?? "");
  const [profileTitle, setProfileTitle] = useState("");

  const [candidateTasks, setCandidateTasks] = useState<Task[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (selectedCompany?.roleTitle) setProfileTitle(selectedCompany.roleTitle);
  }, [selectedCompany]);

  useEffect(() => {
    localStorage.setItem("impactledger:profileName", profileName);
  }, [profileName]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (mode === "APPRAISAL") {
      const start = `${year}-01-01`;
      const end = appraisalType === "MIDYEAR" ? `${year}-06-30` : `${year}-12-31`;
      return { rangeStart: start, rangeEnd: end };
    }
    const lastDay = new Date(year, month, 0).getDate();
    return { rangeStart: `${year}-${String(month).padStart(2, "0")}-01`, rangeEnd: `${year}-${String(month).padStart(2, "0")}-${lastDay}` };
  }, [mode, appraisalType, year, month]);

  useEffect(() => {
    if (!selectedCompanyId) return;
    setLoadingTasks(true);
    tasksApi
      .search({ companyId: selectedCompanyId, startDate: rangeStart, endDate: rangeEnd })
      .then((tasks) => {
        setCandidateTasks(tasks);
        setSelectedIds(new Set(tasks.filter((t) => t.includeInPdf).map((t) => t.id)));
      })
      .finally(() => setLoadingTasks(false));
  }, [selectedCompanyId, rangeStart, rangeEnd]);

  function toggleTask(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === candidateTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidateTasks.map((t) => t.id)));
    }
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) {
      toast("Select at least one task first", "error");
      return;
    }
    setGenerating(true);
    try {
      const payload: PdfGenerationRequest = {
        mode,
        year,
        taskIds: Array.from(selectedIds),
        companyId: selectedCompanyId ?? undefined,
        profileName: profileName || undefined,
        profileTitle: profileTitle || undefined,
        ...(mode === "APPRAISAL" ? { appraisalType } : { month }),
      };
      const blob = await pdfApi.generate(payload);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `impactledger-${mode.toLowerCase()}-${year}${mode === "MONTHLY" ? "-" + month : ""}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast("PDF downloaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to generate PDF", "error");
    } finally {
      setGenerating(false);
    }
  }

  if (!selectedCompanyId) {
    return <Card className="p-10 text-center text-muted">Select a company first.</Card>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generate Report</h1>
        <p className="text-sm text-muted">Build a polished PDF for appraisal review, or a quick monthly update for your manager.</p>
      </div>

      <Card className="p-5 space-y-5">
        <div>
          <Label>Report type</Label>
          <Tabs value={mode} onValueChange={(v) => setMode(v as PdfMode)}>
            <TabsList>
              <TabsTrigger value="APPRAISAL">Appraisal PDF</TabsTrigger>
              <TabsTrigger value="MONTHLY">Monthly Progress Update</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === "APPRAISAL" ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Cycle</Label>
              <Select value={appraisalType} onChange={(e) => setAppraisalType(e.target.value as AppraisalType)}>
                <option value="MIDYEAR">Mid-year (Jan–Jun)</option>
                <option value="YEAR_END">Year-end (Jan–Dec)</option>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Month</Label>
              <Select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="profileName">Your name (shown on cover page)</Label>
            <Input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Vikas" />
          </div>
          <div>
            <Label htmlFor="profileTitle">Your title (shown on cover page)</Label>
            <Input id="profileTitle" value={profileTitle} onChange={(e) => setProfileTitle(e.target.value)} placeholder="Senior Software Engineer" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">Company name is intentionally left off the PDF — only your name and title appear.</p>
      </Card>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">Select tasks to include</h3>
            <p className="text-xs text-muted-foreground">{candidateTasks.length} tasks found in this period · {selectedIds.size} selected</p>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleAll}>
            {selectedIds.size === candidateTasks.length ? <Square /> : <CheckSquare />}
            {selectedIds.size === candidateTasks.length ? "Deselect all" : "Select all"}
          </Button>
        </div>

        {loadingTasks ? (
          <div className="flex items-center justify-center py-10 text-muted"><Spinner className="mr-2" /> Loading tasks...</div>
        ) : candidateTasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">No tasks found in this date range.</p>
        ) : (
          <div className="max-h-[420px] space-y-1 overflow-y-auto">
            {candidateTasks.map((task) => (
              <label
                key={task.id}
                className="flex items-start gap-3 rounded-[var(--radius-control)] px-3 py-2.5 hover:bg-surface-hover cursor-pointer"
              >
                <Checkbox
                  checked={selectedIds.has(task.id)}
                  onCheckedChange={() => toggleTask(task.id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{task.title}</span>
                    <Badge variant={priorityBadgeVariant(task.priority)} className="shrink-0">{task.priority}</Badge>
                    {task.highlight && <Badge variant="warning" className="shrink-0">Highlight</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {task.ticketId} · {formatDate(task.startDate)} → {formatDate(task.endDate)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleGenerate} disabled={generating || selectedIds.size === 0}>
          <FileDown /> {generating ? "Generating..." : `Generate PDF (${selectedIds.size} tasks)`}
        </Button>
      </div>
    </div>
  );
}
