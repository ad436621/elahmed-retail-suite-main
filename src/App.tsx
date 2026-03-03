import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { executeAutoBackupIfDue } from '@/data/backupData';
import { preloadDashboardData } from '@/hooks/useFastData';
import { migrateLegacyDataToBatches } from '@/domain/batchMigration';
import { migrateUsedMerge } from "@/domain/migrationUsedMerge";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CartProvider } from "@/contexts/CartContext";
import type { Permission } from "@/data/usersData";
import MainLayout from "@/layouts/MainLayout";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";

// Lazy load all pages for code splitting
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const POS = lazy(() => import("@/pages/POS"));
const Inventory = lazy(() => import("@/pages/Inventory"));
const Sales = lazy(() => import("@/pages/Sales"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ReturnsPage = lazy(() => import("@/pages/ReturnsPage"));
const MobilesInventory = lazy(() => import("@/pages/MobilesInventory"));
const ComputersInventory = lazy(() => import("@/pages/ComputersInventory"));
const DevicesInventory = lazy(() => import("@/pages/DevicesInventory"));
const Maintenance = lazy(() => import("@/pages/Maintenance"));
const Installments = lazy(() => import("@/pages/Installments"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const UsersManagement = lazy(() => import("@/pages/UsersManagement"));
const BarcodePrintPage = lazy(() => import("@/pages/BarcodePrintPage"));
const UnauthorizedPage = lazy(() => import("@/pages/UnauthorizedPage"));
const DamagedItemsPage = lazy(() => import("@/pages/DamagedItemsPage"));
const CarsInventory = lazy(() => import("@/pages/CarsInventory"));
const WarehousePage = lazy(() => import("@/pages/WarehousePage"));
const OtherRevenuePage = lazy(() => import("@/pages/OtherRevenuePage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const WalletsPage = lazy(() => import("@/pages/WalletsPage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));
const UsedInventory = lazy(() => import("@/pages/UsedInventory"));
const SuppliersPage = lazy(() => import("@/pages/SuppliersPage"));
const BlacklistPage = lazy(() => import("@/pages/BlacklistPage"));
const RemindersPage = lazy(() => import("@/pages/RemindersPage"));
const ShiftClosingPage = lazy(() => import("@/pages/ShiftClosingPage"));
const PurchaseInvoicesPage = lazy(() => import("@/pages/PurchaseInvoicesPage"));

// Loading fallback

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

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

    // Preload dashboard data in background for instant load
    preloadDashboardData();

    // Then check every 5 minutes
    const interval = setInterval(() => {
      executeAutoBackupIfDue();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return null;
}

// Background task to run data migration to batches system
function DataMigrationRunner() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      migrateLegacyDataToBatches();
    } catch (e) { console.error(e) }

    try {
      migrateUsedMerge();
    } catch (e) { console.error(e) }
  }, [isAuthenticated]);

  return null;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
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
        <Route path="/cars" element={<PermGuard perm="cars"><CarsInventory /></PermGuard>} />
        <Route path="/warehouse" element={<PermGuard perm="warehouse"><WarehousePage /></PermGuard>} />
        <Route path="/used-inventory" element={<PermGuard perm="inventory"><UsedInventory /></PermGuard>} />
        {/* Services */}
        <Route path="/maintenance" element={<PermGuard perm="maintenance"><Maintenance /></PermGuard>} />
        <Route path="/installments" element={<PermGuard perm="installments"><Installments /></PermGuard>} />
        <Route path="/expenses" element={<PermGuard perm="expenses"><Expenses /></PermGuard>} />
        <Route path="/damaged" element={<PermGuard perm="damaged"><DamagedItemsPage /></PermGuard>} />
        <Route path="/other-revenue" element={<PermGuard perm="otherRevenue"><OtherRevenuePage /></PermGuard>} />
        {/* System */}
        <Route path="/settings" element={<PermGuard perm="settings"><SettingsPage /></PermGuard>} />
        <Route path="/users" element={<OwnerGuard><UsersManagement /></OwnerGuard>} />
        <Route path="/barcodes" element={<PermGuard perm="inventory"><BarcodePrintPage /></PermGuard>} />
        {/* New features */}
        <Route path="/customers" element={<PermGuard perm="customers"><CustomersPage /></PermGuard>} />
        <Route path="/wallets" element={<PermGuard perm="wallets"><WalletsPage /></PermGuard>} />
        <Route path="/employees" element={<PermGuard perm="employees"><EmployeesPage /></PermGuard>} />
        <Route path="/help" element={<HelpPage />} />
        {/* People */}
        <Route path="/suppliers" element={<PermGuard perm="suppliers"><SuppliersPage /></PermGuard>} />
        {/* Tools */}
        <Route path="/blacklist" element={<PermGuard perm="blacklist"><BlacklistPage /></PermGuard>} />
        <Route path="/reminders" element={<PermGuard perm="reminders"><RemindersPage /></PermGuard>} />
        {/* Finance */}
        <Route path="/shift-closing" element={<PermGuard perm="shiftClosing"><ShiftClosingPage /></PermGuard>} />
        <Route path="/purchase-invoices" element={<PermGuard perm="purchaseInvoices"><PurchaseInvoicesPage /></PermGuard>} />
      </Route>
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      <SettingsProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <CartProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <AutoBackupRunner />
                    <DataMigrationRunner />
                    <AppRoutes />
                  </BrowserRouter>
                </TooltipProvider>
              </CartProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </QueryClientProvider>
);

export default App;
