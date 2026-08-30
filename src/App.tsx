import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AppProvider } from "@/context/AppContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage } from "@/pages/TasksPage";
import { WeeklyLogPage } from "@/pages/WeeklyLogPage";
import { GeneratePdfPage } from "@/pages/GeneratePdfPage";
import { RecognitionPage } from "@/pages/RecognitionPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TrashPage } from "./pages/TrashPage";
import { GlobalSearchPage } from "./pages/GlobalSearchPage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="weekly-log" element={<WeeklyLogPage />} />
            <Route path="recognition" element={<RecognitionPage />} />
            <Route path="generate" element={<GeneratePdfPage />} />
            <Route path="search" element={<GlobalSearchPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}