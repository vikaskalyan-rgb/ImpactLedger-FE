import { useEffect, useState } from "react";
import { Trash2, RotateCcw, ListChecks, Award, Building2, ListTodo } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi, recognitionsApi, companiesApi, todosApi } from "@/lib/api";
import type { Task, Recognition, Company, Todo } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/lib/format";

export function TrashPage() {
  const { selectedCompanyId, toast } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [t, r, c, td] = await Promise.all([
        tasksApi.trash(selectedCompanyId ?? undefined),
        recognitionsApi.trash(),
        companiesApi.trash(),
        todosApi.trash(selectedCompanyId ?? undefined),
      ]);
      setTasks(t ?? []);
      setRecognitions((r ?? []).filter((rec) => !selectedCompanyId || rec.companyId === selectedCompanyId));
      setCompanies(c ?? []);
      setTodos(td ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load trash", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  async function restoreTask(t: Task) {
    setBusyId(`task-${t.id}`);
    try {
      await tasksApi.restore(t.id);
      toast("Task restored", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to restore", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function purgeTask(t: Task) {
    if (!confirm(`Permanently delete "${t.title}"? This cannot be undone.`)) return;
    setBusyId(`task-${t.id}`);
    try {
      await tasksApi.purge(t.id);
      toast("Task permanently deleted", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function restoreRecognition(r: Recognition) {
    setBusyId(`rec-${r.id}`);
    try {
      await recognitionsApi.restore(r.id);
      toast("Recognition restored", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to restore", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function purgeRecognition(r: Recognition) {
    if (!confirm("Permanently delete this recognition? This cannot be undone.")) return;
    setBusyId(`rec-${r.id}`);
    try {
      await recognitionsApi.purge(r.id);
      toast("Recognition permanently deleted", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function restoreCompany(c: Company) {
    setBusyId(`co-${c.id}`);
    try {
      await companiesApi.restore(c.id);
      toast(`${c.name} restored`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to restore", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function purgeCompany(c: Company) {
    if (!confirm(`Permanently delete "${c.name}"? This cannot be undone. Tasks and recognitions logged under it will keep the deleted company's name.`)) return;
    setBusyId(`co-${c.id}`);
    try {
      await companiesApi.purge(c.id);
      toast(`${c.name} permanently deleted`, "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function restoreTodo(t: Todo) {
    setBusyId(`todo-${t.id}`);
    try {
      await todosApi.restore(t.id);
      toast("To-do restored", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to restore", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function purgeTodo(t: Todo) {
    if (!confirm(`Permanently delete "${t.title}"? This cannot be undone.`)) return;
    setBusyId(`todo-${t.id}`);
    try {
      await todosApi.purge(t.id);
      toast("To-do permanently deleted", "success");
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "error");
    } finally {
      setBusyId(null);
    }
  }

  const isEmpty = tasks.length === 0 && recognitions.length === 0 && companies.length === 0 && todos.length === 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Trash</h1>
        <p className="text-sm text-muted">Deleted tasks, to-dos, recognitions, and companies. Restore anything you didn't mean to delete, or clear it for good.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted">
          <Spinner className="mr-2" /> Loading trash...
        </div>
      ) : isEmpty ? (
        <Card className="p-10 text-center text-muted">Nothing in the trash right now.</Card>
      ) : (
        <>
          {tasks.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
                <ListChecks className="h-4 w-4 text-muted-foreground" /> Tasks ({tasks.length})
              </div>
              <div className="divide-y divide-border">
                {tasks.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.ticketId} · deleted {formatDateTime(t.deletedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" disabled={busyId === `task-${t.id}`} onClick={() => restoreTask(t)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busyId === `task-${t.id}`} onClick={() => purgeTask(t)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {recognitions.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
                <Award className="h-4 w-4 text-muted-foreground" /> Recognition ({recognitions.length})
              </div>
              <div className="divide-y divide-border">
                {recognitions.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.source}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">deleted {formatDateTime(r.deletedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" disabled={busyId === `rec-${r.id}`} onClick={() => restoreRecognition(r)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busyId === `rec-${r.id}`} onClick={() => purgeRecognition(r)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {todos.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
                <ListTodo className="h-4 w-4 text-muted-foreground" /> To Do ({todos.length})
              </div>
              <div className="divide-y divide-border">
                {todos.map((t) => (
                  <div key={t.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <p className="text-xs text-muted-foreground">deleted {formatDateTime(t.deletedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" disabled={busyId === `todo-${t.id}`} onClick={() => restoreTodo(t)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busyId === `todo-${t.id}`} onClick={() => purgeTodo(t)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {companies.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-medium">
                <Building2 className="h-4 w-4 text-muted-foreground" /> Companies ({companies.length})
              </div>
              <div className="divide-y divide-border">
                {companies.map((c) => (
                  <div key={c.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">deleted {formatDateTime(c.deletedAt)}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="secondary" size="sm" disabled={busyId === `co-${c.id}`} onClick={() => restoreCompany(c)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="icon" disabled={busyId === `co-${c.id}`} onClick={() => purgeCompany(c)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
