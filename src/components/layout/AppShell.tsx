import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, ListChecks, FileDown, Award, Sparkles } from "lucide-react";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/recognition", label: "Recognition", icon: Award },
  { to: "/generate", label: "Generate Report", icon: FileDown },
];

export function AppShell() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15">
            <Sparkles className="h-4 w-4 text-brand" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Impact<span className="text-gradient-brand">Ledger</span>
          </span>
        </div>
        <nav className="flex flex-col gap-1 px-3 py-2">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand/15 text-brand"
                    : "text-muted hover:bg-surface-hover hover:text-foreground"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-muted-foreground">
          Every ticket, every decision — evidence for review day.
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-border bg-surface/60 px-6 py-3.5 backdrop-blur">
          <div className="md:hidden font-semibold">ImpactLedger</div>
          <div />
          <CompanySwitcher />
        </header>
        <main className="flex-1 overflow-y-auto px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
