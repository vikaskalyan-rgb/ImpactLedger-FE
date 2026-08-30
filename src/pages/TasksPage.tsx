import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Plus, Search, Trash2, Pencil, ExternalLink, FileText, AlertCircle, Bookmark, X, Upload, Trash, CheckSquare, Square, FileDown as FileDownIcon, Star } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import type { Task, TaskFilters, Priority, Complexity, TaskStatus } from "@/types";
import { PRIORITIES, COMPLEXITIES, STATUSES, TASK_TYPE_SUGGESTIONS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { ImportTasksDialog } from "@/components/ImportTasksDialog";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, formatDate } from "@/lib/format";

interface SavedFilter {
  id: string;
  name: string;
  filters: TaskFilters;
  search: string;
  needsImpact: boolean;
}

const SAVED_FILTERS_KEY = "impactledger:savedFilters";

function loadSavedFilters(): SavedFilter[] {
  try {
    const raw = localStorage.getItem(SAVED_FILTERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSavedFilters(filters: SavedFilter[]) {
  localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(filters));
}

export function TasksPage() {
  const { selectedCompanyId, toast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [search, setSearch] = useState("");
  const [needsImpact, setNeedsImpact] = useState(searchParams.get("needsImpact") === "true");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => loadSavedFilters());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [importOpen, setImportOpen] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Clear the query param once we've consumed it, so it doesn't stick around in the URL
  useEffect(() => {
    if (searchParams.get("needsImpact")) {
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTasks = useCallback(async () => {
    if (!selectedCompanyId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await tasksApi.search({ ...filters, companyId: selectedCompanyId, search: search || undefined });
      setTasks(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId, filters, search]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Selection can only ever contain ids that are currently visible — if filters
  // change underneath a selection, drop anything that's no longer in view.
  useEffect(() => {
    setSelectedIds((prev) => {
      const visibleIds = new Set(tasks.map((t) => t.id));
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [tasks]);

  const visibleTasks = useMemo(
    () => needsImpact ? tasks.filter((t) => t.status === "COMPLETED" && (!t.impact || !t.impact.trim())) : tasks,
    [tasks, needsImpact]
  );

  const missingImpactCount = useMemo(
    () => tasks.filter((t) => t.status === "COMPLETED" && (!t.impact || !t.impact.trim())).length,
    [tasks]
  );

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = visibleTasks.length > 0 && visibleTasks.every((t) => prev.has(t.id));
      return allSelected ? new Set() : new Set(visibleTasks.map((t) => t.id));
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Soft delete + an "Undo" toast — no blocking confirm() needed anymore, since
  // nothing is actually gone until it's purged from the Trash page.
  async function handleDelete(task: Task) {
    try {
      await tasksApi.delete(task.id);
      toast(`"${task.title}" deleted`, "success", {
        label: "Undo",
        onClick: async () => {
          try {
            await tasksApi.restore(task.id);
            toast("Task restored", "success");
            loadTasks();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to restore task", "error");
          }
        },
      });
      loadTasks();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete task", "error");
    }
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await tasksApi.bulkDelete(ids);
      toast(`${ids.length} task${ids.length === 1 ? "" : "s"} deleted`, "success", {
        label: "Undo",
        onClick: async () => {
          try {
            await Promise.all(ids.map((id) => tasksApi.restore(id)));
            toast("Tasks restored", "success");
            loadTasks();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to restore tasks", "error");
          }
        },
      });
      clearSelection();
      loadTasks();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete tasks", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  async function handleBulkToggle(field: "includeInPdf" | "highlight", value: boolean) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      await tasksApi.bulkUpdate({ ids, [field]: value });
      toast(
        `${ids.length} task${ids.length === 1 ? "" : "s"} ${field === "includeInPdf" ? (value ? "included in PDF" : "excluded from PDF") : (value ? "marked as highlight" : "unmarked as highlight")}`,
        "success"
      );
      loadTasks();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Bulk update failed", "error");
    } finally {
      setBulkBusy(false);
    }
  }

  function clearFilters() {
    setFilters({});
    setSearch("");
    setNeedsImpact(false);
  }

  function handleSaveFilter() {
    const name = prompt("Name this filter (e.g. \"P1 this quarter\"):");
    if (!name || !name.trim()) return;
    const next: SavedFilter[] = [
      ...savedFilters,
      { id: crypto.randomUUID(), name: name.trim(), filters, search, needsImpact },
    ];
    setSavedFilters(next);
    persistSavedFilters(next);
    toast("Filter saved", "success");
  }

  function applySavedFilter(saved: SavedFilter) {
    setFilters(saved.filters);
    setSearch(saved.search);
    setNeedsImpact(saved.needsImpact);
  }

  function removeSavedFilter(id: string) {
    const next = savedFilters.filter((f) => f.id !== id);
    setSavedFilters(next);
    persistSavedFilters(next);
  }

  const hasActiveFilters = !!(filters.priority || filters.complexity || filters.status || filters.taskType || filters.startDate || filters.endDate || search || needsImpact);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">Everything you've logged, filterable by anything that matters.</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <Button variant="ghost" size="icon" asChild title="Trash" className="basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none">
            <Link to="/trash"><Trash className="h-4 w-4" /></Link>
          </Button>
          <Button variant="secondary" onClick={() => setImportOpen(true)} className="basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none">
            <Upload /> Import
          </Button>
          <div className="basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none [&>button]:w-full sm:[&>button]:w-auto">
            <QuickAddDialog onAdded={loadTasks} />
          </div>
          <Button
            className="basis-[calc(50%-0.25rem)] sm:basis-auto sm:flex-none"
            onClick={() => {
              setEditingTask(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add task
          </Button>
        </div>
      </div>

      <ImportTasksDialog open={importOpen} onOpenChange={setImportOpen} onImported={loadTasks} />

      {selectedIds.size > 0 && (
        <Card className="border-brand/30 bg-brand/5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-brand">
              <CheckSquare className="h-4 w-4" />
              {selectedIds.size} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => handleBulkToggle("includeInPdf", true)}>
                <FileDownIcon className="h-3.5 w-3.5" /> Include in PDF
              </Button>
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => handleBulkToggle("includeInPdf", false)}>
                Exclude from PDF
              </Button>
              <Button variant="secondary" size="sm" disabled={bulkBusy} onClick={() => handleBulkToggle("highlight", true)}>
                <Star className="h-3.5 w-3.5" /> Highlight
              </Button>
              <Button variant="destructive" size="sm" disabled={bulkBusy} onClick={handleBulkDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        </Card>
      )}

      {missingImpactCount > 0 && !needsImpact && (
        <Card className="border-warning/30 bg-warning/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-warning shrink-0" />
              <span>
                <strong>{missingImpactCount}</strong> completed task{missingImpactCount === 1 ? "" : "s"} {missingImpactCount === 1 ? "doesn't" : "don't"} have an impact statement yet.
              </span>
            </div>
            <Button variant="secondary" size="sm" className="w-full sm:w-auto" onClick={() => setNeedsImpact(true)}>Show them</Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ticket, title, description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.priority ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, priority: (e.target.value || undefined) as Priority | undefined }))}
            className="w-full sm:w-auto"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select
            value={filters.complexity ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, complexity: (e.target.value || undefined) as Complexity | undefined }))}
            className="w-full sm:w-auto"
          >
            <option value="">All complexity</option>
            {COMPLEXITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select
            value={filters.status ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as TaskStatus | undefined }))}
            className="w-full sm:w-auto"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
          <Select
            value={filters.taskType ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, taskType: e.target.value || undefined }))}
            className="w-full sm:w-auto"
          >
            <option value="">All types</option>
            {TASK_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="date"
              value={filters.startDate ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            />
            <span className="text-muted-foreground text-sm shrink-0">to</span>
            <Input
              type="date"
              value={filters.endDate ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:contents">
            <button
              type="button"
              onClick={() => setNeedsImpact((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                needsImpact ? "border-warning bg-warning/15 text-warning" : "border-border text-muted hover:border-warning/50"
              }`}
            >
              Needs impact
            </button>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSaveFilter} className="sm:ml-auto">
              <Bookmark className="h-3.5 w-3.5" /> Save this filter
            </Button>
          </div>
        </div>

        {savedFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">Saved:</span>
            {savedFilters.map((sf) => (
              <span key={sf.id} className="flex items-center gap-1 rounded-full bg-surface-hover px-2.5 py-1 text-xs">
                <button type="button" onClick={() => applySavedFilter(sf)} className="hover:text-brand">
                  {sf.name}
                </button>
                <button type="button" onClick={() => removeSavedFilter(sf.id)}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-danger" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner className="mr-2" /> Loading tasks...
        </div>
      ) : !selectedCompanyId ? (
        <Card className="p-10 text-center text-muted">Add or select a company to get started.</Card>
      ) : visibleTasks.length === 0 ? (
        <Card className="p-10 text-center text-muted">
          {needsImpact ? "No completed tasks are missing an impact statement — nicely kept up." : "No tasks match these filters yet."}
        </Card>
      ) : (
        <>
          {/* Mobile: stacked task cards — a 7-column table has no good way to read on a phone */}
          <div className="space-y-3 sm:hidden">
            {visibleTasks.map((task) => (
              <Card key={task.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(task.id)}
                      onCheckedChange={() => toggleSelect(task.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <p className="font-medium leading-snug">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{task.ticketId}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1 -mr-2 -mt-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingTask(task); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(task)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant={priorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                  <Badge variant={statusBadgeVariant(task.status)}>{statusLabel(task.status)}</Badge>
                  <span className="text-xs text-muted">{task.complexity}</span>
                  {task.taskTypes.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                  ))}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3 text-xs text-muted">
                  <span>{formatDate(task.startDate)} → {formatDate(task.endDate)}</span>
                  <div className="flex items-center gap-3">
                    {task.prLinks.length > 0 && (
                      <span className="flex items-center gap-1"><ExternalLink className="h-3 w-3" /> {task.prLinks.length}</span>
                    )}
                    {task.designDocLink && (
                      <a href={task.designDocLink} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop / tablet: full table */}
          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={visibleTasks.length > 0 && visibleTasks.every((t) => selectedIds.has(t.id))}
                      onCheckedChange={() => toggleSelectAllVisible()}
                    />
                  </TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Complexity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(task.id)} onCheckedChange={() => toggleSelect(task.id)} />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground">{task.ticketId}</div>
                      {task.taskTypes.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {task.taskTypes.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-muted">{task.complexity}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(task.status)}>{statusLabel(task.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted whitespace-nowrap">
                      {formatDate(task.startDate)} → {formatDate(task.endDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {task.prLinks.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted"><ExternalLink className="h-3 w-3" /> {task.prLinks.length}</span>
                        )}
                        {task.designDocLink && (
                          <a href={task.designDocLink} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            <FileText className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setEditingTask(task); setFormOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(task)}>
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        onSaved={loadTasks}
      />
    </div>
  );
}