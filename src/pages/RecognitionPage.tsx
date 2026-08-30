import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Award, Trash2, Trash } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { recognitionsApi } from "@/lib/api";
import type { Recognition } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";

export function RecognitionPage() {
  const { selectedCompanyId, toast } = useApp();
  const [items, setItems] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const all = await recognitionsApi.list();
      setItems(all.filter((r) => r.companyId === selectedCompanyId));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedCompanyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  async function handleAdd() {
    if (!selectedCompanyId || !source.trim() || !message.trim()) return;
    setSaving(true);
    try {
      await recognitionsApi.create({ companyId: selectedCompanyId, date, source: source.trim(), message: message.trim() });
      toast("Recognition added", "success");
      setSource("");
      setMessage("");
      setOpen(false);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add recognition", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await recognitionsApi.delete(id);
      toast("Recognition deleted", "success", {
        label: "Undo",
        onClick: async () => {
          try {
            await recognitionsApi.restore(id);
            toast("Recognition restored", "success");
            load();
          } catch (e) {
            toast(e instanceof Error ? e.message : "Failed to restore", "error");
          }
        },
      });
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete recognition", "error");
    }
  }

  if (!selectedCompanyId) {
    return <Card className="p-10 text-center text-muted">Select a company first.</Card>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Recognition</h1>
          <p className="text-sm text-muted">Shoutouts, kudos, and manager praise — third-party validation that lands well in a review.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="w-full sm:w-auto"><Plus /> Add recognition</Button>
      </div>

      <div className="flex justify-end">
        <Link to="/trash" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Trash className="h-3.5 w-3.5" /> View trash
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted"><Spinner className="mr-2" /> Loading...</div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center text-muted">No recognitions logged yet — add one whenever someone gives you a shoutout.</Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Card key={r.id} className="p-4">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Award className="h-4 w-4 mt-0.5 text-accent-gold shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{r.source}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                      <p className="mt-2 text-sm text-foreground">{r.message}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add recognition</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rec-date">Date</Label>
              <Input id="rec-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="rec-source">Source</Label>
              <Input id="rec-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Director - Jane Doe, Slack #eng-wins" />
            </div>
            <div>
              <Label htmlFor="rec-message">Message</Label>
              <Textarea id="rec-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding..." : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}