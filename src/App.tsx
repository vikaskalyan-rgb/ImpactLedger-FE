import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { AppProvider } from "@/context/AppContext";
import { DashboardPage } from "@/pages/DashboardPage";
import { TasksPage } from "@/pages/TasksPage";
import { GeneratePdfPage } from "@/pages/GeneratePdfPage";
import { RecognitionPage } from "@/pages/RecognitionPage";

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="recognition" element={<RecognitionPage />} />
            <Route path="generate" element={<GeneratePdfPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
