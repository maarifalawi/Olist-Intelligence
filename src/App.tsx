import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DataProvider } from "./context/DataContext";
import { AlertProvider } from "./context/AlertContext";
import { MainLayout } from "./components/layout/MainLayout";
import UploadPage from "./pages/UploadPage";
import QualityPage from "./pages/QualityPage";
import OpsPage from "./pages/OpsPage";
import CXPage from "./pages/CXPage";
import BizPage from "./pages/BizPage";
import ExportPage from "./pages/ExportPage";
import PredictionPage from "./pages/PredictionPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DataProvider>
        <AlertProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/upload" replace />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/quality" element={<QualityPage />} />
                <Route path="/ops" element={<OpsPage />} />
                <Route path="/cx" element={<CXPage />} />
                <Route path="/biz" element={<BizPage />} />
                <Route path="/prediction" element={<PredictionPage />} />
                <Route path="/export" element={<ExportPage />} />
              </Routes>
            </MainLayout>
          </BrowserRouter>
        </AlertProvider>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
