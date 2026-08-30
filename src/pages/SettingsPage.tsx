import { useState } from "react";
import { Pencil, Trash2, FileJson, FileSpreadsheet, Save } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { companiesApi, tasksApi, recognitionsApi } from "@/lib/api";
import type { Company, Task } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsvValue(value: unknown): string {
  const str = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function tasksToCsv(tasks: Task[]): string {
  const headers = [
    "companyName", "ticketId", "title", "taskTypes", "priority", "complexity", "status",
    "startDate", "endDate", "prLinks", "designDocLink", "description", "designDecisions",
    "impact", "techStack", "collaborators", "tags", "riskOrBlockerNotes", "highlight",
  ];
  const rows = tasks.map((t) => headers.map((h) => toCsvValue((t as unknown as Record<string, unknown>)[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export function SettingsPage() {
  const { companies, selectedCompanyId, setSelectedCompanyId, refreshCompanies, toast } = useApp();
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoleTitle, setEditRoleTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const [profileName, setProfileName] = useState(() => localStorage.getItem("impactledger:profileName") ?? "");
  const [profileSaved, setProfileSaved] = useState(false);

  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);

  function openEdit(company: Company) {
    setEditingCompany(company);
    setEditName(company.name);
    setEditRoleTitle(company.roleTitle ?? "");
  }

  async function handleSaveEdit() {
    if (!editingCompany) return;
    if (!editName.trim()) {
      toast("Company name can't be empty", "error");
      return;
    }
    setSaving(true);
    try {
      await companiesApi.update(editingCompany.id, { name: editName.trim(), roleTitle: editRoleTitle.trim() || undefined });
      toast("Company updated", "success");
      setEditingCompany(null);
      await refreshCompanies();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update company", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(company: Company) {
    if (!confirm(`Delete "${company.name}"? Tasks and recognitions logged under it will NOT be deleted, but you won't be able to select this company anymore.`)) return;
    try {
      await companiesApi.delete(company.id);
      toast("Company deleted", "success");
      await refreshCompanies();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete company", "error");
    }
  }

  function handleSaveProfileName() {
    localStorage.setItem("impactledger:profileName", profileName);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  }

  async function handleExport(format: "json" | "csv") {
    setExporting(format);
    try {
      const [allTasks, allRecognitions] = await Promise.all([
        tasksApi.search({}),
        recognitionsApi.list(),
      ]);
      const timestamp = new Date().toISOString().slice(0, 10);

      if (format === "json") {
        const payload = { exportedAt: new Date().toISOString(), companies, tasks: allTasks, recognitions: allRecognitions };
        downloadBlob(JSON.stringify(payload, null, 2), `impactledger-export-${timestamp}.json`, "application/json");
      } else {
        downloadBlob(tasksToCsv(allTasks), `impactledger-tasks-${timestamp}.csv`, "text/csv");
      }
      toast("Export downloaded", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Manage companies, your profile defaults, and back up your data.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold">Companies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {companies.length === 0 && <p className="text-sm text-muted">No companies yet — add one from the switcher in the top bar.</p>}
          {companies.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-[var(--radius-control)] px-3 py-2.5 hover:bg-surface-hover">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                {c.roleTitle && <p className="text-xs text-muted-foreground">{c.roleTitle}</p>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold">Default company</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="settings-default-company">Open the app to this company by default</Label>
          <p className="text-xs text-muted-foreground -mt-1 mb-1.5">
            Applies immediately and the next time you open ImpactLedger. You can still switch companies anytime from the top bar.
          </p>
          <Select
            id="settings-default-company"
            value={selectedCompanyId ?? ""}
            onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
          >
            {companies.length === 0 && <option value="">No companies yet</option>}
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.roleTitle ? ` · ${c.roleTitle}` : ""}
              </option>
            ))}
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold">Profile default</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="settings-profile-name">Your name</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Shown on the cover page of every generated report. Your title comes from each company's role above instead, since that can change per job.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="settings-profile-name" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Vikas" />
              <Button onClick={handleSaveProfileName} variant="secondary" className="w-full sm:w-auto">
                {profileSaved ? "Saved!" : <><Save className="h-4 w-4" /> Save</>}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground text-base font-semibold">Export your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Everything lives on Neon's free tier — cheap insurance against ever losing it. Exports include every company, task, and recognition, not just the currently selected company.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => handleExport("json")} disabled={exporting !== null} className="w-full sm:w-auto">
              {exporting === "json" ? <Spinner /> : <FileJson />}
              Export as JSON
            </Button>
            <Button variant="secondary" onClick={() => handleExport("csv")} disabled={exporting !== null} className="w-full sm:w-auto">
              {exporting === "csv" ? <Spinner /> : <FileSpreadsheet />}
              Export tasks as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingCompany} onOpenChange={(open) => !open && setEditingCompany(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-company-name">Company name</Label>
              <Input id="edit-company-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-company-role">Your position there</Label>
              <Input id="edit-company-role" value={editRoleTitle} onChange={(e) => setEditRoleTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
