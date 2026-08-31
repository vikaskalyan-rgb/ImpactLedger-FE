import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Trash, CalendarClock, ListTodo } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { todosApi } from "@/lib/api";
import type { Todo } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { TodoFormDialog } from "@/components/TodoFormDialog";
import { formatDate } from "@/lib/format";

function isOverdue(todo: Todo): boolean {
  if (!todo.dueDate || todo.completed) return false;
  return todo.dueDate < new Date().toISOString().slice(0, 10);
}

export function TodoPage() {
  const { selectedCompanyId, toast } = useApp();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  const loadTodos = useCallback(async () => {
    if (!selectedCompanyId) {
      setTodos([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setTodos((await todosApi.list(selectedCompanyId)) ?? []);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load to-dos", "error");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  async function handleQuickAdd() {
    const title = quickTitle.trim();
    if (!title || !selectedCompanyId) return;
    setAdding(true);
    try {
      await todosApi.create({ companyId: selectedCompanyId, title, notes: "", dueDate: null, completed: false });
      setQuickTitle("");
      loadTodos();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add to-do", "error");
    } finally {
      setAdding(false);
    }
  }

  // Optimistic toggle — flips instantly, only reloads if the save actually fails.
  async function handleToggle(todo: Todo) {
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, completed: !t.completed } : t)));
    try {
      await todosApi.setCompleted(todo.id, !todo.completed);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update to-do", "error");
      loadTodos();
    }
  }

  async function handleDelete(todo: Todo) {
    try {
      await todosApi.delete(todo.id);
      toast(`"${todo.title}" deleted`, "success", {
        label: "Undo",
        onClick: async () => {
          try {
            await todosApi.restore(todo.id);
            toast("To-do restored", "success");
            loadTodos();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to restore to-do", "error");
          }
        },
      });
      loadTodos();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete to-do", "error");
    }
  }

  const visibleTodos = showCompleted ? todos : todos.filter((t) => !t.completed);
  const openCount = todos.filter((t) => !t.completed).length;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">To Do</h1>
          <p className="text-sm text-muted">Quick things to remember — separate from tracked tasks and tickets.</p>
        </div>
        <Button variant="ghost" size="icon" asChild title="Trash">
          <Link to="/trash"><Trash className="h-4 w-4" /></Link>
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex items-center gap-2">
          <Input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleQuickAdd();
            }}
            placeholder="Add a to-do and press Enter..."
            disabled={adding || !selectedCompanyId}
          />
          <Button onClick={handleQuickAdd} disabled={adding || !quickTitle.trim() || !selectedCompanyId}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Spinner className="mr-2" /> Loading...
        </div>
      ) : !selectedCompanyId ? (
        <Card className="p-10 text-center text-muted">Add or select a company to get started.</Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{openCount} open{todos.length > openCount ? ` \u00b7 ${todos.length - openCount} completed` : ""}</span>
            {todos.some((t) => t.completed) && (
              <button type="button" onClick={() => setShowCompleted((v) => !v)} className="hover:text-foreground">
                {showCompleted ? "Hide completed" : "Show completed"}
              </button>
            )}
          </div>

          {visibleTodos.length === 0 ? (
            <Card className="p-10 text-center text-muted flex flex-col items-center gap-2">
              <ListTodo className="h-6 w-6 text-muted-foreground" />
              Nothing here — add something above.
            </Card>
          ) : (
            <div className="space-y-2">
              {visibleTodos.map((todo) => (
                <Card key={todo.id} className={`p-3 ${todo.completed ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={todo.completed} onCheckedChange={() => handleToggle(todo)} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${todo.completed ? "line-through text-muted-foreground" : ""}`}>
                        {todo.title}
                      </p>
                      {todo.notes && <p className="mt-0.5 text-xs text-muted line-clamp-2">{todo.notes}</p>}
                      {todo.dueDate && (
                        <p className={`mt-1 flex items-center gap-1 text-xs ${isOverdue(todo) ? "text-danger font-medium" : "text-muted-foreground"}`}>
                          <CalendarClock className="h-3 w-3" />
                          {isOverdue(todo) ? "Overdue \u00b7 " : "Due "}
                          {formatDate(todo.dueDate)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingTodo(todo); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(todo)}>
                        <Trash2 className="h-4 w-4 text-danger" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <TodoFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingTodo(null);
        }}
        todo={editingTodo}
        onSaved={loadTodos}
      />
    </div>
  );
}
