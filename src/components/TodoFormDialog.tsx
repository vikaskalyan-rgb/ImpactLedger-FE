import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/context/AppContext";
import { todosApi } from "@/lib/api";
import type { Todo, TodoRequest } from "@/types";

const emptyForm: TodoRequest = {
  companyId: 0,
  title: "",
  notes: "",
  dueDate: null,
  completed: false,
};

export function TodoFormDialog({
  open,
  onOpenChange,
  todo,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todo?: Todo | null;
  onSaved: () => void;
}) {
  const { selectedCompanyId, toast } = useApp();
  const [form, setForm] = useState<TodoRequest>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (todo) {
        setForm({
          companyId: todo.companyId,
          title: todo.title,
          notes: todo.notes ?? "",
          dueDate: todo.dueDate,
          completed: todo.completed,
        });
      } else {
        setForm({ ...emptyForm, companyId: selectedCompanyId ?? 0 });
      }
    }
  }, [open, todo, selectedCompanyId]);

  function update<K extends keyof TodoRequest>(key: K, value: TodoRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    if (!form.companyId) {
      toast("Pick a company first (top right)", "error");
      return;
    }
    if (!form.title.trim()) {
      toast("Give it a title", "error");
      return;
    }
    setSaving(true);
    try {
      if (todo) {
        await todosApi.update(todo.id, form);
        toast("To-do updated", "success");
      } else {
        await todosApi.create(form);
        toast("To-do added", "success");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save to-do", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{todo ? "Edit to-do" : "New to-do"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="todoTitle">Title *</Label>
            <Input
              id="todoTitle"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="e.g. Ping manager about promo doc"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="todoNotes">Notes (optional)</Label>
            <Textarea
              id="todoNotes"
              value={form.notes ?? ""}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="todoDueDate">Due date (optional)</Label>
            <Input
              id="todoDueDate"
              type="date"
              value={form.dueDate ?? ""}
              onChange={(e) => update("dueDate", e.target.value || null)}
            />
          </div>
          {todo && (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.completed} onCheckedChange={(v) => update("completed", v)} />
              Completed
            </label>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : todo ? "Save changes" : "Add to-do"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
