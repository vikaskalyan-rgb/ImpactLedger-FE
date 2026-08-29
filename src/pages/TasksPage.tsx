import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Trash2, Pencil, ExternalLink, FileText } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import type { Task, TaskFilters, Priority, Complexity, TaskStatus } from "@/types";
import { PRIORITIES, COMPLEXITIES, STATUSES, TASK_TYPE_SUGGESTIONS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { TaskFormDialog } from "@/components/TaskFormDialog";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, formatDate } from "@/lib/format";

export function TasksPage() {
  const { selectedCompanyId, toast } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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

  async function handleDelete(task: Task) {
    if (!confirm(`Delete "${task.title}"? This can't be undone.`)) return;
    try {
      await tasksApi.delete(task.id);
      toast("Task deleted", "success");
      loadTasks();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete task", "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted">Everything you've logged, filterable by anything that matters.</p>
        </div>
        <div className="flex items-center gap-2">
          <QuickAddDialog onAdded={loadTasks} />
          <Button
            onClick={() => {
              setEditingTask(null);
              setFormOpen(true);
            }}
          >
            <Plus /> Add task
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
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
            className="w-auto"
          >
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
          <Select
            value={filters.complexity ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, complexity: (e.target.value || undefined) as Complexity | undefined }))}
            className="w-auto"
          >
            <option value="">All complexity</option>
            {COMPLEXITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select
            value={filters.status ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as TaskStatus | undefined }))}
            className="w-auto"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </Select>
          <Select
            value={filters.taskType ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, taskType: e.target.value || undefined }))}
            className="w-auto"
          >
            <option value="">All types</option>
            {TASK_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Input
            type="date"
            value={filters.startDate ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value || undefined }))}
            className="w-auto"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <Input
            type="date"
            value={filters.endDate ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value || undefined }))}
            className="w-auto"
          />
          {(filters.priority || filters.complexity || filters.status || filters.taskType || filters.startDate || filters.endDate || search) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilters({}); setSearch(""); }}>
              Clear filters
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner className="mr-2" /> Loading tasks...
        </div>
      ) : !selectedCompanyId ? (
        <Card className="p-10 text-center text-muted">Add or select a company to get started.</Card>
      ) : tasks.length === 0 ? (
        <Card className="p-10 text-center text-muted">No tasks match these filters yet.</Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
            {tasks.map((task) => (
              <TableRow key={task.id}>
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