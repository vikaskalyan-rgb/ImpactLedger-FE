import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ListChecks, NotebookPen, Award, ListTodo } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { tasksApi, weeklySummariesApi, recognitionsApi, todosApi } from "@/lib/api";
import type { Task, WeeklySummary, Recognition, Todo } from "@/types";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, formatDate } from "@/lib/format";
import { formatWeekRange } from "@/lib/week";

export function GlobalSearchPage() {
  const { selectedCompanyId } = useApp();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [ranQuery, setRanQuery] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<WeeklySummary[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);

  // Debounced: search-as-you-type, but don't hit the backend on every keystroke.
  useEffect(() => {
    if (!query.trim() || !selectedCompanyId) {
      setTasks([]);
      setTodos([]);
      setWeeklyLogs([]);
      setRecognitions([]);
      setRanQuery("");
      return;
    }
    const q = query.trim().toLowerCase();
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const [taskResults, allTodos, allWeekly, allRecognitions] = await Promise.all([
          tasksApi.search({ companyId: selectedCompanyId, search: q }),
          todosApi.list(selectedCompanyId),
          weeklySummariesApi.list(selectedCompanyId),
          recognitionsApi.list(),
        ]);
        setTasks(taskResults ?? []);
        setTodos((allTodos ?? []).filter((t) => t.title.toLowerCase().includes(q) || t.notes?.toLowerCase().includes(q)));
        setWeeklyLogs((allWeekly ?? []).filter((w) => w.content.toLowerCase().includes(q)));
        setRecognitions(
          (allRecognitions ?? []).filter(
            (r) => r.companyId === selectedCompanyId && (r.message.toLowerCase().includes(q) || r.source.toLowerCase().includes(q))
          )
        );
        setRanQuery(query.trim());
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query, selectedCompanyId]);

  const hasAnyResults = tasks.length > 0 || todos.length > 0 || weeklyLogs.length > 0 || recognitions.length > 0;

  if (!selectedCompanyId) {
    return <Card className="p-10 text-center text-muted">Select a company first.</Card>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Search</h1>
        <p className="text-sm text-muted">One box, everything you've logged — tasks, to-dos, weekly reflections, and recognition.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search for a ticket, a keyword, an incident..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {!query.trim() ? (
        <p className="py-10 text-center text-sm text-muted">Start typing to search across everything you've logged for this company.</p>
      ) : searching && ranQuery !== query.trim() ? (
        <div className="flex items-center justify-center py-10 text-muted"><Spinner className="mr-2" /> Searching...</div>
      ) : !hasAnyResults ? (
        <p className="py-10 text-center text-sm text-muted">No results for "{ranQuery}".</p>
      ) : (
        <div className="space-y-6">
          {tasks.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ListChecks className="h-4 w-4 text-muted-foreground" /> Tasks
                <Badge variant="secondary" className="text-[10px]">{tasks.length}</Badge>
                <Link to="/tasks" className="ml-auto text-xs text-brand hover:underline">Open Tasks →</Link>
              </div>
              <div className="space-y-2">
                {tasks.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{t.title}</p>
                      <Badge variant={priorityBadgeVariant(t.priority)}>{t.priority}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.ticketId} · {formatDate(t.startDate)} → {formatDate(t.endDate)}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge variant={statusBadgeVariant(t.status)}>{statusLabel(t.status)}</Badge>
                    </div>
                    {t.impact && <p className="mt-1.5 text-xs text-muted line-clamp-2">{t.impact}</p>}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {todos.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ListTodo className="h-4 w-4 text-muted-foreground" /> To Do
                <Badge variant="secondary" className="text-[10px]">{todos.length}</Badge>
                <Link to="/todo" className="ml-auto text-xs text-brand hover:underline">Open To Do →</Link>
              </div>
              <div className="space-y-2">
                {todos.map((t) => (
                  <Card key={t.id} className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${t.completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                      {t.completed && <Badge variant="secondary" className="text-[10px]">Done</Badge>}
                    </div>
                    {t.notes && <p className="mt-1 text-xs text-muted line-clamp-2">{t.notes}</p>}
                    {t.dueDate && <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(t.dueDate)}</p>}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {weeklyLogs.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <NotebookPen className="h-4 w-4 text-muted-foreground" /> Weekly Log
                <Badge variant="secondary" className="text-[10px]">{weeklyLogs.length}</Badge>
                <Link to="/weekly-log" className="ml-auto text-xs text-brand hover:underline">Open Weekly Log →</Link>
              </div>
              <div className="space-y-2">
                {weeklyLogs.map((w) => (
                  <Card key={w.id} className="p-3">
                    <p className="text-xs font-medium text-brand">{formatWeekRange(w.weekStartDate, w.weekEndDate)}</p>
                    <p className="mt-1 text-sm text-foreground">{w.content}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {recognitions.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Award className="h-4 w-4 text-muted-foreground" /> Recognition
                <Badge variant="secondary" className="text-[10px]">{recognitions.length}</Badge>
                <Link to="/recognition" className="ml-auto text-xs text-brand hover:underline">Open Recognition →</Link>
              </div>
              <div className="space-y-2">
                {recognitions.map((r) => (
                  <Card key={r.id} className="p-3">
                    <p className="text-sm font-medium">{r.source}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                    <p className="mt-1 text-sm text-foreground">{r.message}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
