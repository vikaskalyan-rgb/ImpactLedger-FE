import { useState } from "react";
import { Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApp } from "@/context/AppContext";
import { tasksApi } from "@/lib/api";
import type { TaskRequest } from "@/types";

/**
 * For the 10-seconds-between-meetings case: just a ticket ID and a title.
 * Everything else gets a sensible default and can be filled in properly later
 * via the full edit form — the goal here is removing every reason to skip
 * logging something because you're in a rush.
 */
export function QuickAddDialog({ onAdded }: { onAdded: () => void }) {
  const { selectedCompanyId, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setTicketId("");
    setTitle("");
  }

  async function handleSave() {
    if (!selectedCompanyId) {
      toast("Pick a company first (top right)", "error");
      return;
    }
    if (!ticketId.trim() || !title.trim()) {
      toast("Ticket ID and title are both required", "error");
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const payload: TaskRequest = {
        companyId: selectedCompanyId,
        ticketId: ticketId.trim(),
        title: title.trim(),
        taskTypes: [],
        priority: "P2",
        complexity: "MEDIUM",
        status: "IN_PROGRESS",
        startDate: today,
        endDate: null,
        prLinks: [],
        designDocLink: null,
        description: null,
        designDecisions: null,
        impact: null,
        techStack: [],
        collaborators: [],
        tags: [],
        riskOrBlockerNotes: null,
        includeInPdf: true,
        highlight: false,
      };
      await tasksApi.create(payload);
      toast("Task added — fill in the rest whenever you have a minute", "success");
      reset();
      setOpen(false);
      onAdded();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add task", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Zap /> Quick Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick add</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="qa-ticket">Ticket ID</Label>
            <Input
              id="qa-ticket"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="JIRA-1234"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <div>
            <Label htmlFor="qa-title">Title</Label>
            <Input
              id="qa-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short task name"
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Priority, complexity, and everything else default sensibly — edit the task later to fill in impact, PR links, and the rest.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Adding..." : "Add task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}