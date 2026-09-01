import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, ListChecks, FileDown, Award, Sparkles, Menu, X, Settings, NotebookPen, ListTodo } from "lucide-react";
import { CompanySwitcher } from "@/components/layout/CompanySwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/todo", label: "To Do", icon: ListTodo },
  { to: "/weekly-log", label: "Weekly Log", icon: NotebookPen },
  { to: "/recognition", label: "Recognition", icon: Award },
  { to: "/generate", label: "Generate Report", icon: FileDown },
  { to: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {navItems.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
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
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15">
        <Sparkles className="h-4 w-4 text-brand" />
      </div>
      <span className="text-lg font-semibold tracking-tight">
        Impact<span className="text-gradient-brand">Ledger</span>
      </span>
    </div>
  );
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  // Close the drawer automatically whenever the route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="px-5 py-5">
          <BrandMark />
        </div>
        <NavLinks />
        <div className="mt-auto px-5 py-4 text-xs text-muted-foreground">
          Every ticket, every decision — evidence for review day.
        </div>
      </aside>

      {/* Mobile drawer + backdrop */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 flex flex-col bg-surface border-r border-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-5">
              <BrandMark />
              <button
                onClick={() => setMobileNavOpen(false)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileNavOpen(false)} />
            <div className="mt-auto px-5 py-4 text-xs text-muted-foreground">
              Every ticket, every decision — evidence for review day.
            </div>
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex flex-col gap-3 border-b border-border bg-surface/60 px-4 md:px-6 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:py-3.5 backdrop-blur">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="font-semibold">ImpactLedger</span>
          </div>
          <div className="hidden md:block" />
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <CompanySwitcher />
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-5 sm:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
