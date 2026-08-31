import { ExternalLink, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/types";
import { priorityBadgeVariant, statusBadgeVariant, statusLabel, formatDate } from "@/lib/format";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{children}</p>
    </div>
  );
}

function TagSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary">{item}</Badge>
        ))}
      </div>
    </div>
  );
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onEdit,
  onClone,
  onCopy,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (task: Task) => void;
  onClone: (task: Task) => void;
  onCopy: (task: Task) => void;
}) {
  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <p className="text-xs text-muted-foreground">{task.ticketId}</p>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={priorityBadgeVariant(task.priority)}>{task.priority}</Badge>
          <Badge variant={statusBadgeVariant(task.status)}>{statusLabel(task.status)}</Badge>
          <Badge variant="secondary">{task.complexity}</Badge>
          {task.taskTypes.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
          ))}
        </div>

        <p className="text-xs text-muted">{formatDate(task.startDate)} → {formatDate(task.endDate)}</p>

        <div className="mt-4 space-y-4">
          {task.description && <Section title="Description">{task.description}</Section>}
          {task.designDecisions && <Section title="Design decisions">{task.designDecisions}</Section>}
          {task.impact && <Section title="Impact">{task.impact}</Section>}
          {task.riskOrBlockerNotes && <Section title="Risk / blocker resolved">{task.riskOrBlockerNotes}</Section>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <TagSection title="Tech stack" items={task.techStack} />
            <TagSection title="Collaborators" items={task.collaborators} />
            <TagSection title="Tags" items={task.tags} />
          </div>

          {(task.prLinks.length > 0 || task.designDocLink) && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Links</h4>
              <div className="mt-1.5 space-y-1">
                {task.prLinks.map((link, i) => (
                  <a key={i} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-brand hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> PR {task.prLinks.length > 1 ? i + 1 : ""}
                  </a>
                ))}
                {task.designDocLink && (
                  <a href={task.designDocLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm text-brand hover:underline">
                    <FileText className="h-3.5 w-3.5" /> Design doc
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onCopy(task)}>Copy as text</Button>
          <Button variant="secondary" onClick={() => onClone(task)}>Clone</Button>
          <Button onClick={() => onEdit(task)}>Edit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
