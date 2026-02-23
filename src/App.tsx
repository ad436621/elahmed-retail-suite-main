import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from 'react';
import { executeAutoBackupIfDue } from '@/data/backupData';
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import type { Permission } from "@/data/usersData";
import MainLayout from "@/layouts/MainLayout";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Inventory from "@/pages/Inventory";
import Sales from "@/pages/Sales";
import SettingsPage from "@/pages/SettingsPage";
import ReturnsPage from "@/pages/ReturnsPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";
import MobilesInventory from "@/pages/MobilesInventory";
import ComputersInventory from "@/pages/ComputersInventory";
import DevicesInventory from "@/pages/DevicesInventory";
import Maintenance from "@/pages/Maintenance";
import Installments from "@/pages/Installments";
import Expenses from "@/pages/Expenses";
import UsersManagement from "@/pages/UsersManagement";
import BarcodePrintPage from "@/pages/BarcodePrintPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";
import UsedInventory from "@/pages/UsedInventory";

const queryClient = new QueryClient();

// Redirect to login if not authenticated
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

// Redirect to home if already logged in
function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Route guard: checks specific permission
function PermGuard({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) return <UnauthorizedPage />;
  return <>{children}</>;
}

// Owner-only route guard
function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { isOwner } = useAuth();
  if (!isOwner()) return <UnauthorizedPage />;
  return <>{children}</>;
}

// Background task to run auto backups
function AutoBackupRunner() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check immediately on mount
    executeAutoBackupIfDue();

    // Then check every 5 minutes
    const interval = setInterval(() => {
      executeAutoBackupIfDue();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return null;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
    <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
      {/* Main */}
      <Route path="/" element={<PermGuard perm="dashboard"><Dashboard /></PermGuard>} />
      <Route path="/pos" element={<PermGuard perm="pos"><POS /></PermGuard>} />
      <Route path="/inventory" element={<PermGuard perm="inventory"><Inventory /></PermGuard>} />
      <Route path="/sales" element={<PermGuard perm="sales"><Sales /></PermGuard>} />
      <Route path="/returns" element={<PermGuard perm="returns"><ReturnsPage /></PermGuard>} />
      {/* Inventory */}
      <Route path="/mobiles" element={<PermGuard perm="mobiles"><MobilesInventory /></PermGuard>} />
      <Route path="/computers" element={<PermGuard perm="computers"><ComputersInventory /></PermGuard>} />
      <Route path="/devices" element={<PermGuard perm="devices"><DevicesInventory /></PermGuard>} />
      <Route path="/used" element={<UsedInventory />} />
      {/* Services */}
      <Route path="/maintenance" element={<PermGuard perm="maintenance"><Maintenance /></PermGuard>} />
      <Route path="/installments" element={<PermGuard perm="installments"><Installments /></PermGuard>} />
      <Route path="/expenses" element={<PermGuard perm="expenses"><Expenses /></PermGuard>} />
      {/* System */}
      <Route path="/settings" element={<PermGuard perm="settings"><SettingsPage /></PermGuard>} />
      <Route path="/users" element={<OwnerGuard><UsersManagement /></OwnerGuard>} />
      <Route path="/barcodes" element={<PermGuard perm="inventory"><BarcodePrintPage /></PermGuard>} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SettingsProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AutoBackupRunner />
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SettingsProvider>
  </QueryClientProvider>
);

export default App;
