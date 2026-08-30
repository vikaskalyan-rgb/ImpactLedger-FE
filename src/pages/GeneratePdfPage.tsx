import { useEffect, useMemo, useState } from "react";
import { FileDown, CheckSquare, Square, Copy, Check, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi, recognitionsApi } from "@/lib/api";
import type { Task, PdfMode, AppraisalType, Recognition } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [narrative, setNarrative] = useState("");
  const [narrativeCopied, setNarrativeCopied] = useState(false);

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

  const selectedTasksForNarrative = candidateTasks.filter((t) => selectedIds.has(t.id));

  function buildNarrativePrompt(): string {
    const impactLines = selectedTasksForNarrative
      .filter((t) => t.impact && t.impact.trim())
      .map((t) => `- ${t.title} (${t.ticketId}): ${t.impact}`)
      .join("\n");

    return `Write a 3-4 sentence executive summary paragraph for my appraisal report, based on the work below. Write in third person, past tense, confident but factual — no fluff, no buzzwords. Lead with the most significant initiative. Mention scope/scale where the numbers support it. Do not invent any details not present below.

My name: ${profileName || "the engineer"}
Period: ${mode === "APPRAISAL" ? `${appraisalType === "MIDYEAR" ? "H1" : "full year"} ${year}` : `${MONTHS[month - 1]} ${year}`}

Completed work with measurable impact:
${impactLines || "(no impact statements recorded yet for the selected tasks — write a general summary from the titles instead)"}

Return ONLY the paragraph, no preamble, no quotes around it.`;
  }

  function handleCopyNarrativePrompt() {
    navigator.clipboard.writeText(buildNarrativePrompt());
    setNarrativeCopied(true);
    setTimeout(() => setNarrativeCopied(false), 2000);
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) {
      toast("Select at least one task first", "error");
      return;
    }
    setGenerating(true);
    try {
      const selectedTasks = candidateTasks.filter((t) => selectedIds.has(t.id));

      // Recognition entries for this same period + company, same filtering the
      // backend used to do — now done client-side since generation is local.
      const allRecognitions = await recognitionsApi.list();
      const recognitions: Recognition[] = allRecognitions.filter(
        (r) => r.companyId === selectedCompanyId && r.date >= rangeStart && r.date <= rangeEnd
      );

      // react-pdf is a heavy dependency (~1.2MB) — load it only when actually
      // generating a PDF, not on every page of the app.
      const [{ pdf }, { ReportDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/lib/pdf/ReportDocument"),
      ]);

      const doc = (
        <ReportDocument
          mode={mode}
          appraisalType={mode === "APPRAISAL" ? appraisalType : undefined}
          year={year}
          month={mode === "MONTHLY" ? month : undefined}
          profileName={profileName || "Your Name"}
          profileTitle={profileTitle || "Software Engineer"}
          tasks={selectedTasks}
          recognitions={recognitions}
          narrative={narrative}
        />
      );

      const blob = await pdf(doc).toBlob();
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
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Generate Report</h1>
        <p className="text-sm text-muted">Build a polished PDF for appraisal review, or a quick monthly update for your manager.</p>
      </div>

      <Card className="p-4 sm:p-5 space-y-5">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

      <Card className="p-4 sm:p-5">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">Select tasks to include</h3>
            <p className="text-xs text-muted-foreground">{candidateTasks.length} tasks found in this period · {selectedIds.size} selected</p>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleAll} className="w-full sm:w-auto">
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

      <Card className="p-4 sm:p-5 space-y-3 border-brand/30 bg-brand/5">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <Sparkles className="h-4 w-4" />
          Optional: AI-assisted executive summary
        </div>
        <p className="text-xs text-muted">
          This prompt already includes the impact statements from the {selectedIds.size || 0} task{selectedIds.size === 1 ? "" : "s"} you selected above, one bullet per task. Copy it into Claude / Cursor / Copilot, then paste the result below — it becomes a short paragraph at the top of the report, the one thing a director skimming a packet is most likely to actually read.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleCopyNarrativePrompt} disabled={selectedIds.size === 0}>
          {narrativeCopied ? <Check className="text-success" /> : <Copy />}
          {narrativeCopied ? "Copied!" : "Copy narrative prompt"}
        </Button>
        <div>
          <Label htmlFor="narrative">Executive summary (editable, shown on cover page)</Label>
          <Textarea
            id="narrative"
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Paste the AI's paragraph here, or write your own..."
            rows={3}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleGenerate} disabled={generating || selectedIds.size === 0} className="w-full sm:w-auto">
          <FileDown /> {generating ? "Generating..." : `Generate PDF (${selectedIds.size} tasks)`}
        </Button>
      </div>
    </div>
  );
}
