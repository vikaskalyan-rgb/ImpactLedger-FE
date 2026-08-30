import { useRef, useState } from "react";
import Papa from "papaparse";
import { Upload, FileWarning, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useApp } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import { PRIORITIES, COMPLEXITIES, STATUSES, type Priority, type Complexity, type TaskStatus, type TaskRequest } from "@/types";

interface ImportResult {
  imported: number;
  skipped: { row: number; reason: string }[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(";").map((v) => v.trim()).filter(Boolean);
}

function parseDate(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return DATE_RE.test(trimmed) ? trimmed : null;
}

function parseEnum<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  const v = (value ?? "").trim().toUpperCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/**
 * Column names match exactly what Settings > "Export tasks as CSV" produces, so a
 * round-tripped export/import works with zero manual edits. Any other CSV with the
 * same header names (companyName, ticketId, title, ...) works too.
 */
export function ImportTasksDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) {
  const { companies, selectedCompanyId, toast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setFileName(null);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resolveCompanyId(companyName: string | undefined): number | null {
    const name = (companyName ?? "").trim();
    if (!name) return selectedCompanyId;
    const match = companies.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return match ? match.id : null;
  }

  function rowToTaskRequest(row: Record<string, string>, rowNumber: number): { request: TaskRequest } | { error: string } {
    const ticketId = (row.ticketId ?? "").trim();
    const title = (row.title ?? "").trim();
    if (!ticketId || !title) {
      return { error: `Row ${rowNumber}: missing ticketId or title` };
    }

    const companyId = resolveCompanyId(row.companyName);
    if (!companyId) {
      const name = (row.companyName ?? "").trim();
      return {
        error: name
          ? `Row ${rowNumber}: no company named "${name}" — add it first or leave the column blank to use the currently selected company`
          : `Row ${rowNumber}: no company selected — pick a company at the top of the app first`,
      };
    }

    const request: TaskRequest = {
      companyId,
      ticketId,
      title,
      taskTypes: splitList(row.taskTypes),
      priority: parseEnum<Priority>(row.priority, PRIORITIES, "P2"),
      complexity: parseEnum<Complexity>(row.complexity, COMPLEXITIES, "MEDIUM"),
      status: parseEnum<TaskStatus>(row.status, STATUSES, "IN_PROGRESS"),
      startDate: parseDate(row.startDate),
      endDate: parseDate(row.endDate),
      prLinks: splitList(row.prLinks),
      designDocLink: row.designDocLink?.trim() || null,
      description: row.description?.trim() || null,
      designDecisions: row.designDecisions?.trim() || null,
      impact: row.impact?.trim() || null,
      techStack: splitList(row.techStack),
      collaborators: splitList(row.collaborators),
      tags: splitList(row.tags),
      riskOrBlockerNotes: row.riskOrBlockerNotes?.trim() || null,
      includeInPdf: true,
      highlight: (row.highlight ?? "").trim().toLowerCase() === "true",
    };
    return { request };
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
  }

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    const text = await file.text();

    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data;

    const requests: TaskRequest[] = [];
    const skipped: { row: number; reason: string }[] = [];

    rows.forEach((row, i) => {
      const outcome = rowToTaskRequest(row, i + 2); // +2: header row is line 1, data is 1-indexed
      if ("error" in outcome) {
        skipped.push({ row: i + 2, reason: outcome.error });
      } else {
        requests.push(outcome.request);
      }
    });

    setProgress({ done: 0, total: requests.length });

    // Sequential, not Promise.all — the backend's Hikari pool is capped at 3
    // connections (Neon free tier), so firing dozens of creates in parallel would
    // just queue up and risk timeouts instead of actually importing faster.
    let imported = 0;
    for (const request of requests) {
      try {
        await tasksApi.create(request);
        imported++;
      } catch (e) {
        skipped.push({ row: 0, reason: `"${request.ticketId}": ${e instanceof Error ? e.message : "failed to create"}` });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setResult({ imported, skipped });
    setImporting(false);
    if (imported > 0) {
      onImported();
      toast(`Imported ${imported} task${imported === 1 ? "" : "s"}`, "success");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!importing) {
          onOpenChange(next);
          if (!next) reset();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import tasks from CSV</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted">
          Uses the same columns as Settings → "Export tasks as CSV", so a file you exported from here imports back with no edits. The file is parsed entirely in your browser — it's never uploaded or stored anywhere; only the individual tasks it describes are created, the same as adding them one by one.
        </p>

        {!result && (
          <div className="mt-4 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={importing}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-[var(--radius-control)] file:border file:border-border file:bg-surface-hover file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground hover:file:bg-border/60"
            />
            {fileName && !importing && (
              <p className="text-xs text-muted-foreground">Selected: {fileName}</p>
            )}
            {importing && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Spinner className="h-4 w-4" /> Importing {progress.done} of {progress.total}...
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-success/30 bg-success/5 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Imported {result.imported} of {result.imported + result.skipped.length} rows.
            </div>
            {result.skipped.length > 0 && (
              <div className="rounded-[var(--radius-control)] border border-warning/30 bg-warning/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-warning">
                  <FileWarning className="h-4 w-4" /> {result.skipped.length} row{result.skipped.length === 1 ? "" : "s"} skipped
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted">
                  {result.skipped.map((s, i) => (
                    <li key={i}>{s.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" disabled={importing}>{result ? "Close" : "Cancel"}</Button>
          </DialogClose>
          {!result && (
            <Button onClick={handleImport} disabled={!fileName || importing}>
              <Upload className="h-4 w-4" /> {importing ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}