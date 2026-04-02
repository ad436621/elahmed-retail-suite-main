import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, lazy, Suspense } from 'react';
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { executeAutoBackupIfDue } from '@/data/backupData';
import { preloadDashboardData } from '@/hooks/useFastData';
import { migrateLegacyDataToBatches } from '@/domain/batchMigration';
import { migrateUsedMerge } from "@/domain/migrationUsedMerge";
import { syncRepairsToLegacy } from "@/data/repairsData";
import { runAiNotificationsAnalysis } from '@/services/aiNotificationsService';
// NEW: import storage migration
import { runStorageMigrations } from '@/lib/storageMigration';
import { LocalStorageSizeMonitor } from '@/components/LocalStorageSizeMonitor';
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserActivityProvider } from "@/contexts/UserActivityContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { CartProvider } from "@/contexts/CartContext";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import type { Permission } from "@/data/usersData";
import MainLayout from "@/layouts/MainLayout";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";
// UnauthorizedPage is a tiny error screen — direct import so PermGuard
// never triggers a Suspense boundary when redirecting unauthorized users.
import UnauthorizedPage from '@/pages/UnauthorizedPage';
const PartnersPage = lazy(() => import("@/pages/PartnersPage"));

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
const RepairPartsPage = lazy(() => import("@/pages/RepairPartsPage"));
const UsedInventory = lazy(() => import("@/pages/UsedInventory"));
const StocktakePage = lazy(() => import("@/pages/StocktakePage"));

const Installments = lazy(() => import("@/pages/Installments"));
const Expenses = lazy(() => import("@/pages/Expenses"));
const UsersManagement = lazy(() => import("@/pages/UsersManagement"));

const DamagedItemsPage = lazy(() => import("@/pages/DamagedItemsPage"));
const CarsInventory = lazy(() => import("@/pages/CarsInventory"));
const WarehousePage = lazy(() => import("@/pages/WarehousePage"));
const OtherRevenuePage = lazy(() => import("@/pages/OtherRevenuePage"));
const CustomersPage = lazy(() => import("@/pages/CustomersPage"));
const WalletsPage = lazy(() => import("@/pages/WalletsPage"));
const EmployeesPage = lazy(() => import("@/pages/EmployeesPage"));
const HelpPage = lazy(() => import("@/pages/HelpPage"));

const SuppliersPage = lazy(() => import("@/pages/SuppliersPage"));
const BlacklistPage = lazy(() => import("@/pages/BlacklistPage"));
const RemindersPage = lazy(() => import("@/pages/RemindersPage"));
const ShiftClosingPage = lazy(() => import("@/pages/ShiftClosingPage"));
const PurchaseInvoicesPage = lazy(() => import("@/pages/PurchaseInvoicesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const DiagnosticsPage = lazy(() => import("@/pages/DiagnosticsPage"));
const CarSparePartsPage = lazy(() => import("@/pages/CarSparePartsPage"));
const CarOilsPage = lazy(() => import("@/pages/CarOilsPage"));
const MobileAccessoriesPage = lazy(() => import("@/pages/MobileAccessoriesPage"));
const MobileSparePartsPage = lazy(() => import("@/pages/MobileSparePartsPage"));
const ComputerAccessoriesPage = lazy(() => import("@/pages/ComputerAccessoriesPage"));
const ComputerSparePartsPage = lazy(() => import("@/pages/ComputerSparePartsPage"));
const DeviceAccessoriesPage = lazy(() => import("@/pages/DeviceAccessoriesPage"));
const DeviceSparePartsPage = lazy(() => import("@/pages/DeviceSparePartsPage"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function AuthRedirect({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PermGuard({ perm, children }: { perm: Permission; children: React.ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(perm)) return <UnauthorizedPage />;
  return <>{children}</>;
}

function OwnerGuard({ children }: { children: React.ReactNode }) {
  const { isOwner } = useAuth();
  if (!isOwner()) return <UnauthorizedPage />;
  return <>{children}</>;
}

function AutoBackupRunner(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    preloadDashboardData();
    executeAutoBackupIfDue();
    const interval = setInterval(() => { executeAutoBackupIfDue(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);
  return null;
}

function DataMigrationRunner(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;

    // NEW: run storage key migration first (elahmed_* → gx_*)
    try { runStorageMigrations(); } catch (e) { console.error(e); }

    try { migrateLegacyDataToBatches(); } catch (e) { console.error(e); }
    try { migrateUsedMerge(); } catch (e) { console.error(e); }
    try { syncRepairsToLegacy(); } catch (e) { console.error(e); }
  }, [isAuthenticated]);
  return null;
}

function AiNotificationsRunner(): React.ReactElement | null {
  const { isAuthenticated } = useAuth();
  useEffect(() => {
    if (!isAuthenticated) return;
    const run = () => { runAiNotificationsAnalysis().catch(console.error); };
    run();
    const interval = setInterval(run, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);
  return null;
}

const BarcodePrintPage = lazy(() => import("@/pages/BarcodePrintPage"));
const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
      <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
        <Route path="/" element={<PermGuard perm="dashboard"><Dashboard /></PermGuard>} />
        <Route path="/pos" element={<PermGuard perm="pos"><POS /></PermGuard>} />
        <Route path="/inventory" element={<PermGuard perm="inventory"><Inventory /></PermGuard>} />
        <Route path="/sales" element={<PermGuard perm="sales"><Sales /></PermGuard>} />
        <Route path="/returns" element={<PermGuard perm="returns"><ReturnsPage /></PermGuard>} />
        <Route path="/mobiles" element={<PermGuard perm="mobiles"><MobilesInventory /></PermGuard>} />
        <Route path="/mobiles/accessories" element={<PermGuard perm="mobiles"><MobileAccessoriesPage /></PermGuard>} />
        <Route path="/mobiles/spare-parts" element={<PermGuard perm="mobiles"><MobileSparePartsPage /></PermGuard>} />
        <Route path="/computers" element={<PermGuard perm="computers"><ComputersInventory /></PermGuard>} />
        <Route path="/computers/accessories" element={<PermGuard perm="computers"><ComputerAccessoriesPage /></PermGuard>} />
        <Route path="/computers/spare-parts" element={<PermGuard perm="computers"><ComputerSparePartsPage /></PermGuard>} />
        <Route path="/devices" element={<PermGuard perm="devices"><DevicesInventory /></PermGuard>} />
        <Route path="/devices/accessories" element={<PermGuard perm="devices"><DeviceAccessoriesPage /></PermGuard>} />
        <Route path="/devices/spare-parts" element={<PermGuard perm="devices"><DeviceSparePartsPage /></PermGuard>} />
        <Route path="/cars" element={<PermGuard perm="cars"><CarsInventory /></PermGuard>} />
        <Route path="/cars/spare-parts" element={<PermGuard perm="cars"><CarSparePartsPage /></PermGuard>} />
        <Route path="/cars/oils" element={<PermGuard perm="cars"><CarOilsPage /></PermGuard>} />
        <Route path="/warehouse" element={<PermGuard perm="warehouse"><WarehousePage /></PermGuard>} />
        <Route path="/used-inventory" element={<PermGuard perm="used"><UsedInventory /></PermGuard>} />
        <Route path="/stocktake" element={<PermGuard perm="stocktake"><StocktakePage /></PermGuard>} />

        <Route path="/maintenance" element={<PermGuard perm="maintenance"><Maintenance /></PermGuard>} />
        <Route path="/maintenance/parts" element={<PermGuard perm="maintenance"><RepairPartsPage /></PermGuard>} />

        <Route path="/installments" element={<PermGuard perm="installments"><Installments /></PermGuard>} />
        <Route path="/expenses" element={<PermGuard perm="expenses"><Expenses /></PermGuard>} />
        <Route path="/damaged" element={<PermGuard perm="damaged"><DamagedItemsPage /></PermGuard>} />
        <Route path="/other-revenue" element={<PermGuard perm="otherRevenue"><OtherRevenuePage /></PermGuard>} />
        <Route path="/settings" element={<PermGuard perm="settings"><SettingsPage /></PermGuard>} />
        <Route path="/users" element={<OwnerGuard><UsersManagement /></OwnerGuard>} />
        <Route path="/barcodes" element={<PermGuard perm="inventory"><BarcodePrintPage /></PermGuard>} />
        <Route path="/customers" element={<PermGuard perm="customers"><CustomersPage /></PermGuard>} />
        <Route path="/wallets" element={<PermGuard perm="wallets"><WalletsPage /></PermGuard>} />
        <Route path="/employees" element={<PermGuard perm="employees"><EmployeesPage /></PermGuard>} />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/suppliers" element={<PermGuard perm="suppliers"><SuppliersPage /></PermGuard>} />
        <Route path="/blacklist" element={<PermGuard perm="blacklist"><BlacklistPage /></PermGuard>} />
        <Route path="/reminders" element={<PermGuard perm="reminders"><RemindersPage /></PermGuard>} />
        <Route path="/shift-closing" element={<PermGuard perm="shiftClosing"><ShiftClosingPage /></PermGuard>} />
        <Route path="/purchase-invoices" element={<PermGuard perm="purchaseInvoices"><PurchaseInvoicesPage /></PermGuard>} />
        <Route path="/reports" element={<PermGuard perm="dashboard"><ReportsPage /></PermGuard>} />
        <Route path="/diagnostics" element={<OwnerGuard><DiagnosticsPage /></OwnerGuard>} />
        <Route path="/partners" element={<PermGuard perm="partners"><PartnersPage /></PermGuard>} />

      </Route>
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const AppRouter = typeof window !== 'undefined' && window.location.protocol === 'file:'
  ? HashRouter
  : BrowserRouter;

const App = () => (
  <ErrorBoundary>
    <SettingsProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <UserActivityProvider>
              <CartProvider>
                <ConfirmProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <AppRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                      <AutoBackupRunner />
                      <DataMigrationRunner />
                      <AiNotificationsRunner />
                      <LocalStorageSizeMonitor />
                      <AppRoutes />
                    </AppRouter>
                  </TooltipProvider>
                </ConfirmProvider>
              </CartProvider>
            </UserActivityProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SettingsProvider>
  </ErrorBoundary>
);

export default App;
