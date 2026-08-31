import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { AiAssistBox } from "@/components/AiAssistBox";
import { useApp } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import {
  COMPLEXITIES,
  PRIORITIES,
  STATUSES,
  TASK_TYPE_SUGGESTIONS,
  type Task,
  type TaskRequest,
} from "@/types";

const emptyForm: TaskRequest = {
  companyId: 0,
  ticketId: "",
  title: "",
  taskTypes: [],
  priority: "P2",
  complexity: "MEDIUM",
  status: "IN_PROGRESS",
  startDate: null,
  endDate: null,
  prLinks: [],
  designDocLink: "",
  description: "",
  designDecisions: "",
  impact: "",
  techStack: [],
  collaborators: [],
  tags: [],
  riskOrBlockerNotes: "",
  includeInPdf: true,
  highlight: false,
};

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  initialValues,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  /** Prefills a new (non-edit) task — used by "Clone" to seed the form from an existing task. */
  initialValues?: TaskRequest | null;
  onSaved: () => void;
}) {
  const { selectedCompanyId, toast } = useApp();
  const [form, setForm] = useState<TaskRequest>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          companyId: task.companyId,
          ticketId: task.ticketId,
          title: task.title,
          taskTypes: task.taskTypes,
          priority: task.priority,
          complexity: task.complexity,
          status: task.status,
          startDate: task.startDate,
          endDate: task.endDate,
          prLinks: task.prLinks,
          designDocLink: task.designDocLink ?? "",
          description: task.description ?? "",
          designDecisions: task.designDecisions ?? "",
          impact: task.impact ?? "",
          techStack: task.techStack,
          collaborators: task.collaborators,
          tags: task.tags,
          riskOrBlockerNotes: task.riskOrBlockerNotes ?? "",
          includeInPdf: task.includeInPdf,
          highlight: task.highlight,
        });
      } else if (initialValues) {
        setForm({ ...initialValues, companyId: selectedCompanyId ?? initialValues.companyId });
      } else {
        setForm({ ...emptyForm, companyId: selectedCompanyId ?? 0 });
      }
    }
  }, [open, task, initialValues, selectedCompanyId]);

  function update<K extends keyof TaskRequest>(key: K, value: TaskRequest[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTaskType(type: string) {
    setForm((prev) => ({
      ...prev,
      taskTypes: prev.taskTypes.includes(type)
        ? prev.taskTypes.filter((t) => t !== type)
        : [...prev.taskTypes, type],
    }));
  }

  async function handleSave() {
    if (!form.companyId) {
      toast("Pick a company first (top right)", "error");
      return;
    }
    if (!form.ticketId.trim() || !form.title.trim()) {
      toast("Ticket ID and title are required", "error");
      return;
    }
    setSaving(true);
    try {
      if (task) {
        await tasksApi.update(task.id, form);
        toast("Task updated", "success");
      } else {
        await tasksApi.create(form);
        toast("Task added", "success");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save task", "error");
    } finally {
      setSaving(false);
    }
  }

  const isCloning = !task && !!initialValues;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : isCloning ? "New task (cloned)" : "Add a task"}</DialogTitle>
        </DialogHeader>

        {isCloning && (
          <p className="-mt-3 mb-1 text-xs text-muted-foreground">
            Pre-filled from an existing task. Ticket ID, dates, and impact were left blank on purpose — fill those in for this instance.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ticketId">Ticket ID *</Label>
            <Input id="ticketId" value={form.ticketId} onChange={(e) => update("ticketId", e.target.value)} placeholder="JIRA-1234" />
          </div>
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input id="title" value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Short task name" />
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onChange={(e) => update("priority", e.target.value as TaskRequest["priority"])}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Complexity</Label>
            <Select value={form.complexity} onChange={(e) => update("complexity", e.target.value as TaskRequest["complexity"])}>
              {COMPLEXITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => update("status", e.target.value as TaskRequest["status"])}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace("_", " ")}</option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" value={form.startDate ?? ""} onChange={(e) => update("startDate", e.target.value || null)} />
            </div>
            <div>
              <Label htmlFor="endDate">End date</Label>
              <Input id="endDate" type="date" value={form.endDate ?? ""} onChange={(e) => update("endDate", e.target.value || null)} />
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Task type(s) — a ticket can be more than one</Label>
            <div className="flex flex-wrap gap-2">
              {TASK_TYPE_SUGGESTIONS.map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => toggleTaskType(type)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (form.taskTypes.includes(type)
                      ? "border-brand bg-brand/15 text-brand"
                      : "border-border text-muted hover:border-brand/50")
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="designDocLink">Design doc link (Confluence, etc.)</Label>
            <Input id="designDocLink" value={form.designDocLink ?? ""} onChange={(e) => update("designDocLink", e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>PR link(s)</Label>
            <TagInput value={form.prLinks} onChange={(v) => update("prLinks", v)} placeholder="Paste a PR URL, press Enter" />
          </div>
        </div>

        <div className="my-5">
          <AiAssistBox
            onApply={(data) => {
              setForm((prev) => ({
                ...prev,
                description: data.description ?? prev.description,
                designDecisions: data.designDecisions ?? prev.designDecisions,
                techStack: data.techStack?.length ? data.techStack : prev.techStack,
                collaborators: data.collaborators?.length ? data.collaborators : prev.collaborators,
                tags: data.tags?.length ? data.tags : prev.tags,
                riskOrBlockerNotes: data.riskOrBlockerNotes ?? prev.riskOrBlockerNotes,
              }));
              toast("AI response applied to the form below", "success");
            }}
          />
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={form.description ?? ""} onChange={(e) => update("description", e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="designDecisions">Design decisions</Label>
            <Textarea id="designDecisions" value={form.designDecisions ?? ""} onChange={(e) => update("designDecisions", e.target.value)} rows={3} />
          </div>
          <div>
            <Label htmlFor="impact">
              Impact <span className="text-muted-foreground normal-case">(fill this in once you can measure it — this is what your appraisal PDF leads with)</span>
            </Label>
            <Textarea id="impact" value={form.impact ?? ""} onChange={(e) => update("impact", e.target.value)} rows={2} placeholder="e.g. Reduced checkout API p99 latency by 40%..." />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Tech stack</Label>
              <TagInput value={form.techStack} onChange={(v) => update("techStack", v)} placeholder="Add a technology" />
            </div>
            <div>
              <Label>Collaborators</Label>
              <TagInput value={form.collaborators} onChange={(v) => update("collaborators", v)} placeholder="Add a name/team" />
            </div>
            <div>
              <Label>Tags</Label>
              <TagInput value={form.tags} onChange={(v) => update("tags", v)} placeholder="Add a keyword" />
            </div>
          </div>
          <div>
            <Label htmlFor="risk">Risk / blocker resolved (optional)</Label>
            <Textarea id="risk" value={form.riskOrBlockerNotes ?? ""} onChange={(e) => update("riskOrBlockerNotes", e.target.value)} rows={2} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-6 rounded-[var(--radius-control)] border border-border bg-background/50 px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.includeInPdf} onCheckedChange={(v) => update("includeInPdf", v)} />
            Include in PDF by default
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={form.highlight} onCheckedChange={(v) => update("highlight", v)} />
            Mark as a highlight
          </label>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : task ? "Save changes" : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
