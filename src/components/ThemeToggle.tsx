import { Sun, Moon } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
    >
      {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
