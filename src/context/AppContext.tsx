import * as React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { companiesApi } from "@/lib/api";
import type { Company } from "@/types";

interface Toast {
  id: number;
  message: string;
  variant: "success" | "error" | "info";
}

interface AppContextValue {
  companies: Company[];
  selectedCompanyId: number | null;
  setSelectedCompanyId: (id: number | null) => void;
  selectedCompany: Company | null;
  refreshCompanies: () => Promise<void>;
  loadingCompanies: boolean;
  toast: (message: string, variant?: Toast["variant"]) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyIdState] = useState<number | null>(() => {
    const stored = localStorage.getItem("impactledger:selectedCompanyId");
    return stored ? Number(stored) : null;
  });
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refreshCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    try {
      const data = await companiesApi.list();
      setCompanies(data);
      if (data.length > 0 && !data.some((c) => c.id === selectedCompanyId)) {
        setSelectedCompanyIdState(data[0].id);
      }
    } finally {
      setLoadingCompanies(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshCompanies();
  }, [refreshCompanies]);

  const setSelectedCompanyId = useCallback((id: number | null) => {
    setSelectedCompanyIdState(id);
    if (id !== null) localStorage.setItem("impactledger:selectedCompanyId", String(id));
  }, []);

  const toast = useCallback((message: string, variant: Toast["variant"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  return (
    <AppContext.Provider
      value={{
        companies,
        selectedCompanyId,
        setSelectedCompanyId,
        selectedCompany,
        refreshCompanies,
        loadingCompanies,
        toast,
      }}
    >
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "rounded-[var(--radius-control)] border px-4 py-2.5 text-sm shadow-lg card-glow " +
              (t.variant === "success"
                ? "border-success/30 bg-success/10 text-success"
                : t.variant === "error"
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-border bg-surface text-foreground")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
