import { useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { companiesApi } from "@/lib/api";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CompanySwitcher() {
  const { companies, selectedCompanyId, setSelectedCompanyId, refreshCompanies, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const created = await companiesApi.create({ name: name.trim(), roleTitle: roleTitle.trim() || undefined });
      await refreshCompanies();
      setSelectedCompanyId(created.id);
      toast(`${created.name} added`, "success");
      setName("");
      setRoleTitle("");
      setOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add company", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select
        value={selectedCompanyId ?? ""}
        onChange={(e) => setSelectedCompanyId(e.target.value ? Number(e.target.value) : null)}
        className="min-w-[180px]"
      >
        {companies.length === 0 && <option value="">No companies yet</option>}
        {companies.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.roleTitle ? ` · ${c.roleTitle}` : ""}
          </option>
        ))}
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <Button variant="outline" size="icon" onClick={() => setOpen(true)} title="Add company">
          <Plus />
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-name">Company name</Label>
              <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hapag-Lloyd" />
            </div>
            <div>
              <Label htmlFor="company-role">Your position there</Label>
              <Input id="company-role" value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} placeholder="e.g. Senior Software Engineer" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleAdd} disabled={!name.trim() || saving}>
              {saving ? "Adding..." : "Add company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
