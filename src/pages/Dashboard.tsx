import { useMemo, useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone, Monitor, Tv, Wrench, CreditCard, TrendingUp, TrendingDown,
  DollarSign, RotateCcw, ShoppingCart, Activity, Users, CheckCircle2,
  Clock, AlertCircle, Car, ChevronLeft, Package, Star, Target,
  Receipt, Percent, BarChart3, Zap, AlertTriangle, Award,
} from 'lucide-react';

import { getMobiles, getMobileAccessories } from '@/data/mobilesData';
import { getDevices, getDeviceAccessories } from '@/data/devicesData';
import { getComputers, getComputerAccessories } from '@/data/computersData';
import { getMaintenanceOrders } from '@/data/maintenanceData';
import { getContracts } from '@/data/installmentsData';
import { getExpenses } from '@/data/expensesData';
import { getAllSales } from '@/repositories/saleRepository';
import { getMonthlyResetSettings, shouldAutoReset, archiveCurrentPeriod } from '@/data/monthlyResetData';
import { downloadManualBackup } from '@/data/backupData';
import { getCars } from '@/data/carsData';
import { getDamagedItems } from '@/data/damagedData';
import { getWeightedAvgCost } from '@/data/batchesData';
import { getOtherRevenues } from '@/data/otherRevenueData';
// #17 FIX: New module imports for Dashboard stats
import { getTotalBalance } from '@/data/walletsData';
import { getTotalOwedToSuppliers } from '@/data/suppliersData';
import { getPendingRemindersCount } from '@/data/remindersData';
import { getTotalUnpaid as getTotalUnpaidPurchases } from '@/data/purchaseInvoicesData';

import {
  GlobalSearch, HeroKPI, MetricPill, InventoryRow,
  BarRow, SectionLabel, fmt, fmtFull, pct,
} from '@/components/dashboard/DashboardWidgets';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { BestSellers } from '@/components/dashboard/BestSellers';
import { WeeklyBarChart, MonthlyTrendChart } from '@/components/dashboard/SalesCharts';

/* ══════════════════ HELPERS ══════════════════ */
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/* ══════════════════════════════════════════════
   INLINE STAT CHIP — small badge-style stat 
   ══════════════════════════════════════════════ */
function StatChip({
  label, value, icon: Icon, accent,
}: { label: string; value: string; icon: React.ElementType; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_3px_10px_rgba(0,0,0,0.08)] transition-all">
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-muted/60 ${accent}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MINI WEEKLY BAR — shows 7-day sales bars 
   ══════════════════════════════════════════════ */
const DAY_SHORT: Record<number, string> = {
  0: 'الأحد', 1: 'الاثنين', 2: 'الثلاثاء', 3: 'الأربعاء', 4: 'الخميس', 5: 'الجمعة', 6: 'السبت',
};

function WeeklyBarChart({ data }: { data: { day: string; rev: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.rev), 1);
  const todayIdx = new Date().getDay();
  // Rebuild with corrected short names using index
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1.5 h-36 w-full">
        {data.map((d, i) => {
          const barH = Math.max(4, (d.rev / max) * 120);
          const isToday = i === 6; // last item = today
          const hasData = d.rev > 0;
          return (
            <div key={i} className="flex flex-col items-center gap-1 flex-1 group relative min-w-0">
              {/* hover tooltip */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 hidden group-hover:flex
                bg-foreground text-background text-[10px] font-bold px-2.5 py-1.5 rounded-lg
                whitespace-nowrap shadow-xl z-20 flex-col items-center leading-snug pointer-events-none">
                <span>{fmt(d.rev)} ج.م</span>
                <span className="text-background/60 text-[9px]">{d.count} فاتورة</span>
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
              </div>
              {/* bar */}
              <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                <div
                  className={`w-full rounded-t-lg transition-all duration-700 relative overflow-hidden
                    ${isToday
                      ? 'bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb,99,102,241),0.4)]'
                      : hasData
                        ? 'bg-primary/25 group-hover:bg-primary/50'
                        : 'bg-muted/40 border border-dashed border-border/60'
                    }`}
                  style={{ height: `${barH}px` }}
                >
                  {isToday && hasData && (
                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                  )}
                </div>
              </div>
              {/* day label - rotated for full name */}
              <div className="h-14 flex items-start justify-center mt-1">
                <span
                  className={`text-[10px] font-semibold whitespace-nowrap origin-top-right
                    ${isToday ? 'text-primary' : 'text-muted-foreground'}`}
                  style={{ transform: 'rotate(-45deg)', display: 'inline-block', marginTop: '4px' }}
                >
                  {d.day}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* underline summary */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2">
        <span>📊 آخر 7 أيام</span>
        <span className="font-bold text-foreground">{fmt(data.reduce((s, d) => s + d.rev, 0))} ج.م</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   BEST SELLER ROW 
   ══════════════════════════════════════════════ */
function BestSellerRow({
  rank, name, count, revenue, category,
}: { rank: number; name: string; count: number; revenue: number; category: string }) {
  const medals: Record<number, string> = { 1: 'text-yellow-500', 2: 'text-slate-400', 3: 'text-amber-600' };
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
      <span className={`text-lg font-black tabular-nums w-5 text-center shrink-0 ${medals[rank] ?? 'text-muted-foreground/40'}`}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground font-medium">{category} • {count} وحدة</p>
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums">{fmt(revenue)} ج.م</span>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN DASHBOARD 
   ══════════════════════════════════════════════ */
export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const h = (e: StorageEvent | CustomEvent) => {
      const key = 'key' in e ? e.key : (e as CustomEvent).detail?.key;
      if (key && key.startsWith('gx_')) setRefreshKey(k => k + 1);
    };
    window.addEventListener('storage', h as EventListener);
    window.addEventListener('local-storage', h as EventListener);
    return () => {
      window.removeEventListener('storage', h as EventListener);
      window.removeEventListener('local-storage', h as EventListener);
    };
  }, []);

  // ── Raw Data ───────────────────────────────────────────────
  const mobiles = useMemo(() => getMobiles(), [refreshKey]);
  const mobileAcc = useMemo(() => getMobileAccessories(), [refreshKey]);
  const devices = useMemo(() => getDevices(), [refreshKey]);
  const deviceAcc = useMemo(() => getDeviceAccessories(), [refreshKey]);
  const computers = useMemo(() => getComputers(), [refreshKey]);
  const computerAcc = useMemo(() => getComputerAccessories(), [refreshKey]);
  const maintenance = useMemo(() => getMaintenanceOrders(), [refreshKey]);
  const contracts = useMemo(() => getContracts(), [refreshKey]);
  const expenses = useMemo(() => getExpenses(), [refreshKey]);
  const allSales = useMemo(() => getAllSales(), [refreshKey]);
  const cars = useMemo(() => getCars(), [refreshKey]);
  const damagedItems = useMemo(() => getDamagedItems(), [refreshKey]);
  const otherRevenues = useMemo(() => getOtherRevenues(), [refreshKey]);

  // ── Monthly Reset ─────────────────────────────────────────
  const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());
  useEffect(() => {
    if (shouldAutoReset()) {
      archiveCurrentPeriod({ autoArchived: true, note: 'تصفير تلقائي' });
      setResetSettings(getMonthlyResetSettings());
      downloadManualBackup();
    }
  }, []);
  const lrd = resetSettings.resetDay > 0 ? resetSettings.lastResetDate : '';

  // ── Filtered by reset period ───────────────────────────────
  const sales = useMemo(() => lrd ? allSales.filter(s => (s.date || '') >= lrd) : allSales, [allSales, lrd]);
  const currentExpenses = useMemo(() => lrd ? expenses.filter(e => (e.date || '') >= lrd) : expenses, [expenses, lrd]);
  const currentMaint = useMemo(() => lrd ? maintenance.filter(m => (m.createdAt || m.date || '') >= lrd) : maintenance, [maintenance, lrd]);
  const currentContracts = useMemo(() => lrd ? contracts.filter(c => (c.createdAt || '') >= lrd) : contracts, [contracts, lrd]);
  const currentDamaged = useMemo(() => lrd ? damagedItems.filter(d => (d.date || '') >= lrd) : damagedItems, [damagedItems, lrd]);
  const currentOtherRev = useMemo(() => lrd ? otherRevenues.filter(o => (o.date || '') >= lrd) : otherRevenues, [otherRevenues, lrd]);

  // ── Financial KPIs ────────────────────────────────────────
  // BUG FIX: exclude voided sales from ALL financial calculations
  const validSales = useMemo(() => sales.filter(s => !s.voidedAt), [sales]);
  const totalRevenue = useMemo(() => validSales.reduce((s, x) => s + (x.total ?? 0), 0), [validSales]);
  // Guard against corrupted grossProfit values (NaN, undefined, or impossible negatives per item)
  const totalProfit = useMemo(() => validSales.reduce((s, x) => {
    const gp = x.grossProfit ?? 0;
    return s + (isFinite(gp) ? gp : 0);
  }, 0), [validSales]);
  const totalExpenses = useMemo(() => currentExpenses.reduce((s, e) => s + e.amount, 0), [currentExpenses]);
  const totalDamaged = useMemo(() => currentDamaged.reduce((s, d) => s + d.totalLoss, 0), [currentDamaged]);
  const maintRevenue = useMemo(() => currentMaint.reduce((s, m) => s + m.totalSale, 0), [currentMaint]);
  const maintProfit = useMemo(() => currentMaint.reduce((s, m) => s + (isFinite(m.netProfit) ? m.netProfit : 0), 0), [currentMaint]);
  const totalOtherRev = useMemo(() => currentOtherRev.reduce((s, o) => s + o.amount, 0), [currentOtherRev]);
  const netProfit = totalProfit + maintProfit + totalOtherRev - totalExpenses - totalDamaged;

  // ── Averages & Ratios ─────────────────────────────────────
  const avgInvoice = validSales.length > 0 ? totalRevenue / validSales.length : 0;
  const profitMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const returnRate = totalRevenue > 0 ? (totalDamaged / totalRevenue) * 100 : 0;

  // ── Today ─────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = useMemo(() => validSales.filter(s => s.date?.startsWith(todayStr)), [validSales, todayStr]);
  const todayRev = useMemo(() => todaySales.reduce((s, x) => s + (x.total ?? 0), 0), [todaySales]);

  // ── Yesterday comparison ──────────────────────────────────
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const yesterdayRev = useMemo(() => validSales.filter(s => s.date?.startsWith(yStr)).reduce((s, x) => s + (x.total ?? 0), 0), [validSales, yStr]);
  const todayVsYesterdayPct = yesterdayRev > 0 ? ((todayRev - yesterdayRev) / yesterdayRev) * 100 : null;

  // ── Weekly Sales (last 7 days) ────────────────────────────
  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const ds = d.toISOString().slice(0, 10);
      const daySales = validSales.filter(s => s.date?.startsWith(ds));
      return {
        day: DAY_SHORT[d.getDay()],
        rev: daySales.reduce((s, x) => s + (x.total ?? 0), 0),
        count: daySales.length,
      };
    });
  }, [validSales]);

  const weeklyRevTotal = weeklyData.reduce((s, d) => s + d.rev, 0);
  const bestDay = weeklyData.reduce((best, d) => d.rev > best.rev ? d : best, weeklyData[0] ?? { day: '-', rev: 0, count: 0 });

  // ── Installments ──────────────────────────────────────────
  const overdueContracts = currentContracts.filter(c => c.status === 'overdue').length;
  const totalInstallments = useMemo(() => currentContracts.reduce((s, c) => s + c.installmentPrice, 0), [currentContracts]);
  const totalCollected = useMemo(() => currentContracts.reduce((s, c) => s + c.paidTotal, 0), [currentContracts]);
  const totalRemainingDebt = useMemo(() => currentContracts.reduce((s, c) => s + c.remaining, 0), [currentContracts]);
  const activeMaintCount = currentMaint.filter(m => m.status === 'pending' || m.status === 'in_progress').length;

  // ── Inventory ─────────────────────────────────────────────
  const totalMobiles = useMemo(() => mobiles.reduce((s, m) => s + (m.quantity || 1), 0), [mobiles]);
  const totalComputers = useMemo(() => computers.reduce((s, c) => s + (c.quantity || 1), 0), [computers]);
  const totalDevices = useMemo(() => devices.reduce((s, d) => s + (d.quantity || 1), 0), [devices]);

  const mobileInvValue = useMemo(() => mobiles.reduce((s, m) => s + (getWeightedAvgCost(m.id) || m.newCostPrice) * (m.quantity || 1), 0), [mobiles]);
  const computerInvValue = useMemo(() => computers.reduce((s, c) => s + (getWeightedAvgCost(c.id) || c.newCostPrice) * (c.quantity || 1), 0), [computers]);
  const deviceInvValue = useMemo(() => devices.reduce((s, d) => s + (getWeightedAvgCost(d.id) || d.newCostPrice) * (d.quantity || 1), 0), [devices]);
  const carsInvValue = useMemo(() => cars.reduce((s, c) => s + c.purchasePrice, 0), [cars]);
  const totalInvValue = mobileInvValue + computerInvValue + deviceInvValue + carsInvValue;

  // ── Low Stock Alert (qty <= 2) ────────────────────────────
  const lowStockItems = useMemo(() => [
    ...mobiles.filter(m => (m.quantity || 1) <= 2).map(m => ({ name: m.name, qty: m.quantity || 1, cat: 'موبايل' })),
    ...computers.filter(c => (c.quantity || 1) <= 2).map(c => ({ name: c.name, qty: c.quantity || 1, cat: 'كمبيوتر' })),
    ...devices.filter(d => (d.quantity || 1) <= 2).map(d => ({ name: d.name, qty: d.quantity || 1, cat: 'جهاز' })),
  ].slice(0, 5), [mobiles, computers, devices]);

  // ── Best Selling Products ─────────────────────────────────
  const bestSellers = useMemo(() => {
    const map: Record<string, { name: string; count: number; revenue: number; category: string }> = {};
    sales.forEach(sale => {
      (sale.items ?? []).forEach((item: any) => {
        const key = item.productId ?? item.name;
        if (!map[key]) map[key] = { name: item.name ?? item.productId, count: 0, revenue: 0, category: item.category ?? '' };
        map[key].count += item.quantity ?? 1;
        map[key].revenue += (item.total ?? 0);
      });
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [sales]);

  // ── Expenses by category ──────────────────────────────────
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentExpenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [currentExpenses]);
  const catLabels: Record<string, string> = {
    rent: 'إيجار', utilities: 'مرافق', salaries: 'رواتب',
    supplies: 'مستلزمات', maintenance: 'صيانة', transport: 'مواصلات', other: 'أخرى',
  };

  // ── Recent Sales & Maintenance ────────────────────────────
  const recentSales = useMemo(() =>
    [...sales].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 6), [sales]);
  const recentMaint = useMemo(() =>
    [...currentMaint].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')).slice(0, 4), [currentMaint]);

  // ── Maintenance stats ─────────────────────────────────────
  const avgMaintProfit = currentMaint.length > 0 ? maintProfit / currentMaint.length : 0;
  const maintCompletionRate = currentMaint.length > 0
    ? (currentMaint.filter(m => m.status === 'done' || m.status === 'delivered').length / currentMaint.length) * 100 : 0;

  // ── Monthly Revenue Trend (last 6 months) ─────────────────
  const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const yy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0');
      const prefix = `${yy}-${mm}`;
      const mSales = allSales.filter(s => !s.voidedAt && s.date?.startsWith(prefix));
      const mMaint = maintenance.filter(m => (m.createdAt ?? '').startsWith(prefix));
      const rev = mSales.reduce((s, x) => s + (x.total ?? 0), 0)
        + mMaint.reduce((s, m) => s + m.totalSale, 0);
      const profit = mSales.reduce((s, x) => s + (x.grossProfit ?? 0), 0)
        + mMaint.reduce((s, m) => s + m.netProfit, 0);
      return { label: MONTHS_AR[d.getMonth()], rev, profit, count: mSales.length };
    });
  }, [allSales, maintenance]);

  // ── Revenue by Category (from sales items source field) ───
  const categoryRevenue = useMemo(() => {
    const map: Record<string, number> = {
      'موبيلات': 0, 'كمبيوترات': 0, 'أجهزة': 0, 'سيارات': 0, 'صيانة': 0,
    };
    allSales.filter(s => !s.voidedAt).forEach(sale => {
      (sale.items ?? []).forEach((item: any) => {
        const src: string = item.source ?? item.category ?? '';
        const rev = (item.qty ?? item.quantity ?? 1) * (item.price ?? 0);
        if (src.includes('mobile') || src.includes('mob')) map['موبيلات'] += rev;
        else if (src.includes('computer') || src.includes('comp')) map['كمبيوترات'] += rev;
        else if (src.includes('device') || src.includes('dev')) map['أجهزة'] += rev;
        else if (src.includes('car')) map['سيارات'] += rev;
        else map['موبيلات'] += rev; // default
      });
    });
    map['صيانة'] = maintRevenue;
    return Object.entries(map).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [allSales, maintRevenue]);

  // ── Payment Methods breakdown ─────────────────────────────
  const paymentStats = useMemo(() => {
    const cash = sales.filter(s => s.paymentMethod === 'cash').length;
    const card = sales.filter(s => s.paymentMethod === 'card').length;
    const split = sales.filter(s => s.paymentMethod === 'split').length;
    const total = sales.length || 1;
    return [
      { label: 'كاش', count: cash, pct: Math.round((cash / total) * 100), color: 'bg-emerald-500' },
      { label: 'كارت', count: card, pct: Math.round((card / total) * 100), color: 'bg-blue-500' },
      { label: 'مختلط', count: split, pct: Math.round((split / total) * 100), color: 'bg-violet-500' },
    ];
  }, [sales]);

  // ── Cars breakdown ────────────────────────────────────────
  const newCars = cars.filter(c => c.condition === 'new');
  const usedCars = cars.filter(c => c.condition === 'used');
  const avgCarPrice = cars.length > 0 ? carsInvValue / cars.length : 0;
  const mostExpensiveCar = cars.reduce((best, c) => c.purchasePrice > (best?.purchasePrice ?? 0) ? c : best, cars[0] ?? null);

  // ── Inventory health (items with qty > 0) ─────────────────
  const invHealth = useMemo(() => [
    { label: 'موبيلات', inStock: mobiles.filter(m => (m.quantity || 0) > 0).length, total: mobiles.length, color: 'bg-cyan-500' },
    { label: 'كمبيوترات', inStock: computers.filter(c => (c.quantity || 0) > 0).length, total: computers.length, color: 'bg-indigo-500' },
    { label: 'أجهزة', inStock: devices.filter(d => (d.quantity || 0) > 0).length, total: devices.length, color: 'bg-amber-500' },
  ], [mobiles, computers, devices]);

  // ── This month vs last month ──────────────────────────────
  const thisMonthStr = new Date().toISOString().slice(0, 7);
  const lastMonthDate = new Date(); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);
  const thisMonthRev = useMemo(() => allSales.filter(s => !s.voidedAt && s.date?.startsWith(thisMonthStr)).reduce((s, x) => s + x.total, 0), [allSales, thisMonthStr]);
  const lastMonthRev = useMemo(() => allSales.filter(s => !s.voidedAt && s.date?.startsWith(lastMonthStr)).reduce((s, x) => s + x.total, 0), [allSales, lastMonthStr]);
  const monthGrowthPct = lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev) * 100 : null;
  const thisMonthProfit = useMemo(() => allSales.filter(s => !s.voidedAt && s.date?.startsWith(thisMonthStr)).reduce((s, x) => s + (x.grossProfit ?? 0), 0), [allSales, thisMonthStr]);
  const thisMonthCount = useMemo(() => allSales.filter(s => !s.voidedAt && s.date?.startsWith(thisMonthStr)).length, [allSales, thisMonthStr]);

  // #17 FIX: New module stats — connected to real data sources
  const walletTotalBalance = useMemo(() => getTotalBalance(), []);
  const suppliersOwed = useMemo(() => getTotalOwedToSuppliers(), []);
  const overdueReminders = useMemo(() => getPendingRemindersCount(), []);
  const unpaidPurchases = useMemo(() => getTotalUnpaidPurchases(), []);

  // ── Date display ──────────────────────────────────────────
  const dateLabel = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const navigate = useNavigate();
  const [openCard, setOpenCard] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Close dropdown when clicking outside
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const isInsideAny = Object.values(cardRefs.current).some(
        el => el && el.contains(e.target as Node)
      );
      if (!isInsideAny) setOpenCard(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="space-y-6 pb-10 animate-fade-in" dir="rtl">

      {/* ═══════ ZONE A — Title + Search ═══════ */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">لوحة التحكم</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{dateLabel}</p>
        </div>
        <GlobalSearch
          mobiles={mobiles} mobileAcc={mobileAcc}
          devices={devices} deviceAcc={deviceAcc}
          computers={computers} computerAcc={computerAcc}
          maintenance={maintenance} contracts={contracts} sales={sales}
        />
      </div>

      {/* ═══════ ZONE B — Big Icon Category Cards with Dropdown ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {([
          {
            key: 'mobiles', Icon: Smartphone, label: 'الموبيلات', count: totalMobiles, value: mobileInvValue,
            from: 'from-cyan-500/20', border: 'border-cyan-500/30', iconBg: 'bg-cyan-500/15', ic: 'text-cyan-500', badge: 'bg-cyan-500',
            options: [
              { label: 'الكل', sub: 'كل الموبيلات', go: () => navigate('/mobiles', { state: { filter: 'all' } }) },
              { label: 'الإكسسوارات', sub: 'إكسسوارات الموبايل', go: () => navigate('/mobiles', { state: { filter: 'accessory' } }) },
              { label: 'مستعمل', sub: 'الموبيلات المستعملة', go: () => navigate('/mobiles', { state: { filter: 'used' } }) },
            ],
          },
          {
            key: 'computers', Icon: Monitor, label: 'الكمبيوترات', count: totalComputers, value: computerInvValue,
            from: 'from-indigo-500/20', border: 'border-indigo-500/30', iconBg: 'bg-indigo-500/15', ic: 'text-indigo-500', badge: 'bg-indigo-500',
            options: [
              { label: 'الكل', sub: 'كل الكمبيوترات', go: () => navigate('/computers', { state: { filter: 'all' } }) },
              { label: 'الإكسسوارات', sub: 'إكسسوارات الكمبيوتر', go: () => navigate('/computers', { state: { filter: 'accessory' } }) },
              { label: 'مستعمل', sub: 'الكمبيوترات المستعملة', go: () => navigate('/computers', { state: { filter: 'used' } }) },
            ],
          },
          {
            key: 'devices', Icon: Tv, label: 'الأجهزة', count: totalDevices, value: deviceInvValue,
            from: 'from-amber-500/20', border: 'border-amber-500/30', iconBg: 'bg-amber-500/15', ic: 'text-amber-500', badge: 'bg-amber-500',
            options: [
              { label: 'الكل', sub: 'كل الأجهزة', go: () => navigate('/devices', { state: { filter: 'all' } }) },
              { label: 'الإكسسوارات', sub: 'إكسسوارات الأجهزة', go: () => navigate('/devices', { state: { filter: 'accessory' } }) },
              { label: 'مستعمل', sub: 'الأجهزة المستعملة', go: () => navigate('/devices', { state: { filter: 'used' } }) },
            ],
          },
          {
            key: 'cars', Icon: Car, label: 'السيارات', count: cars.length, value: carsInvValue,
            from: 'from-emerald-500/20', border: 'border-emerald-500/30', iconBg: 'bg-emerald-500/15', ic: 'text-emerald-500', badge: 'bg-emerald-500',
            options: [
              { label: 'الكل', sub: 'كل السيارات', go: () => navigate('/cars', { state: { tab: 'all' } }) },
              { label: 'جديد', sub: 'السيارات الجديدة', go: () => navigate('/cars', { state: { tab: 'new' } }) },
              { label: 'مستعمل', sub: 'السيارات المستعملة', go: () => navigate('/cars', { state: { tab: 'used' } }) },
            ],
          },
        ] as const).map(({ key, Icon, label, count, value, from, border, iconBg, ic, badge, options }) => (
          <div key={key} className="relative" ref={el => { cardRefs.current[key] = el; }}>
            <button
              onClick={() => setOpenCard(openCard === key ? null : key)}
              className={`group w-full relative flex flex-col items-center gap-3 rounded-2xl border bg-card bg-gradient-to-b ${from} to-transparent ${border} p-6
                shadow-[0_2px_10px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]
                hover:-translate-y-1.5 transition-all duration-200 cursor-pointer text-center
                ${openCard === key ? 'ring-2 ring-primary/40 -translate-y-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]' : ''}`}
            >
              <span className={`absolute top-3 left-3 ${badge} text-white text-[10px] font-black px-2 py-0.5 rounded-full tabular-nums`}>
                {count}
              </span>
              <div className={`h-24 w-24 rounded-3xl ${iconBg} flex items-center justify-center transition-transform duration-200 shadow-sm ${openCard === key ? 'scale-110' : 'group-hover:scale-110'}`}>
                <Icon className={`h-14 w-14 ${ic}`} />
              </div>
              <p className="text-sm font-bold text-foreground leading-tight">{label}</p>
              <p className={`text-lg font-black tabular-nums ${ic} leading-none`}>
                {fmt(value)}<span className="text-xs font-medium text-muted-foreground mr-1">ج.م</span>
              </p>
              <ChevronLeft className={`absolute bottom-3 left-3 h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200 ${openCard === key ? '-rotate-90' : 'rotate-90'}`} />
            </button>

            {/* Dropdown */}
            {openCard === key && (
              <div className="absolute top-full mt-2 w-full z-50 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-fade-in">
                {options.map((opt, i) => (
                  <button key={i} onClick={() => { setOpenCard(null); opt.go(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0 text-right">
                    <div className={`h-7 w-7 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-3.5 w-3.5 ${ic}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ═══════ ZONE B2 — 4 Hero KPIs ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKPI label="إجمالي المبيعات" value={`${fmt(totalRevenue)} ج.م`} sub={`${sales.length} فاتورة`} accent="primary" trend="up" linkTo="/sales" />
        <HeroKPI label="صافي الربح" value={`${netProfit >= 0 ? '+' : ''}${fmt(netProfit)} ج.م`} sub={`هامش ${profitMarginPct.toFixed(1)}%`} accent={netProfit >= 0 ? 'emerald' : 'red'} trend={netProfit >= 0 ? 'up' : 'down'} />
        <HeroKPI label="مبيعات اليوم" value={`${fmt(todayRev)} ج.م`} sub={todayVsYesterdayPct !== null ? `${todayVsYesterdayPct >= 0 ? '▲' : '▼'} ${Math.abs(todayVsYesterdayPct).toFixed(0)}% عن أمس` : `${todaySales.length} فاتورة اليوم`} accent="blue" trend={todayVsYesterdayPct !== null ? (todayVsYesterdayPct >= 0 ? 'up' : 'down') : undefined} linkTo="/pos" />
        <HeroKPI label="قيمة المخزون" value={`${fmt(totalInvValue)} ج.م`} sub={`${totalMobiles + totalComputers + totalDevices + cars.length} وحدة`} accent="amber" linkTo="/mobiles" />
      </div>

      {/* ═══════ QUICK STAT CHIPS ROW ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatChip label="متوسط الفاتورة" value={`${fmt(avgInvoice)} ج.م`} icon={Receipt} accent="text-blue-500" />
        <StatChip label="هامش الربح" value={`${profitMarginPct.toFixed(1)}%`} icon={Percent} accent="text-emerald-500" />
        <StatChip label="أفضل يوم (7 أيام)" value={weeklyRevTotal > 0 ? `${bestDay.day}` : '—'} icon={Award} accent="text-amber-500" />
        <StatChip label="أرباح الصيانة" value={`${fmt(maintProfit)} ج.م`} icon={Wrench} accent="text-indigo-500" />
        <StatChip label="نسبة الإنجاز (صيانة)" value={`${maintCompletionRate.toFixed(0)}%`} icon={Target} accent="text-cyan-500" />
        <StatChip label="ديون التقسيط المتبقية" value={`${fmt(totalRemainingDebt)} ج.م`} icon={CreditCard} accent="text-orange-500" />
      </div>

      {/* ═══════ MONTHLY COMPARISON STRIP ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">مبيعات هذا الشهر</p>
            <p className="text-2xl font-black tabular-nums text-foreground">{fmt(thisMonthRev)}<span className="text-sm font-medium text-muted-foreground mr-1">ج.م</span></p>
            {monthGrowthPct !== null && (
              <p className={`text-xs font-bold ${monthGrowthPct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {monthGrowthPct >= 0 ? '▲' : '▼'} {Math.abs(monthGrowthPct).toFixed(1)}% عن الشهر الماضي
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 lg:border-r lg:border-l border-border/30 lg:px-4">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">ربح هذا الشهر</p>
            <p className="text-2xl font-black tabular-nums text-emerald-500">{fmt(thisMonthProfit)}<span className="text-sm font-medium text-muted-foreground mr-1">ج.م</span></p>
            <p className="text-xs text-muted-foreground">{thisMonthRev > 0 ? `هامش ${((thisMonthProfit / thisMonthRev) * 100).toFixed(1)}%` : 'لا توجد مبيعات'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground">فواتير هذا الشهر</p>
            <p className="text-2xl font-black tabular-nums text-blue-500">{thisMonthCount}</p>
            <p className="text-xs text-muted-foreground">
              الشهر الماضي: {lastMonthRev > 0 ? `${fmt(lastMonthRev)} ج.م` : 'لا يوجد'}
            </p>
          </div>
        </div>
      </div>

      {/* ═══════ STATS ROW 2 — Monthly Trend + Category Revenue ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Monthly Revenue Trend — 6 months */}
        <div>
          <SectionLabel title="إيرادات آخر 6 أشهر" sub="مبيعات + صيانة شهريًا" />
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-end gap-2 h-32">
              {(() => {
                const maxRev = Math.max(...monthlyTrend.map(m => m.rev), 1);
                return monthlyTrend.map((m, i) => {
                  const isCurrentMonth = i === 5;
                  const barH = Math.max(4, (m.rev / maxRev) * 100);
                  return (
                    <div key={i} className="flex flex-col items-center gap-1 flex-1 group relative min-w-0">
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 hidden group-hover:flex bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap z-20 flex-col items-center">
                        <span>{fmt(m.rev)} ج.م</span>
                        <span className="opacity-60">{m.count} فاتورة</span>
                      </div>
                      <div className="w-full flex items-end" style={{ height: '100px' }}>
                        <div className={`w-full rounded-t-lg transition-all duration-700 ${isCurrentMonth ? 'bg-primary' : m.rev > 0 ? 'bg-primary/30 group-hover:bg-primary/50' : 'bg-muted/50'}`}
                          style={{ height: `${barH}px` }} />
                      </div>
                      <span className={`text-[9px] font-semibold ${isCurrentMonth ? 'text-primary' : 'text-muted-foreground'}`}>{m.label}</span>
                    </div>
                  );
                });
              })()}
            </div>
            <div className="mt-3 pt-3 border-t border-border/30 flex justify-between text-xs">
              <span className="text-muted-foreground">أعلى شهر: <span className="font-bold text-foreground">{monthlyTrend.reduce((b, m) => m.rev > b.rev ? m : b, monthlyTrend[0])?.label ?? '—'}</span></span>
              <span className="font-bold text-foreground">{fmt(monthlyTrend.reduce((s, m) => s + m.rev, 0))} ج.م إجمالي</span>
            </div>
          </div>
        </div>

        {/* Revenue by Category */}
        <div>
          <SectionLabel title="الإيرادات حسب الفئة" sub="توزيع المبيعات" />
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3.5">
            {categoryRevenue.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">لا توجد بيانات مبيعات بعد</div>
            ) : (() => {
              const CAT_COLORS: Record<string, string> = {
                'موبيلات': 'bg-cyan-500', 'كمبيوترات': 'bg-indigo-500',
                'أجهزة': 'bg-amber-500', 'سيارات': 'bg-emerald-500', 'صيانة': 'bg-violet-500',
              };
              const totalCatRev = categoryRevenue.reduce((s, [, v]) => s + v, 0);
              return categoryRevenue.map(([cat, rev]) => (
                <div key={cat} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{cat}</span>
                    <span className="font-bold tabular-nums">{fmt(rev)} ج.م <span className="text-muted-foreground text-xs">({totalCatRev > 0 ? Math.round((rev / totalCatRev) * 100) : 0}%)</span></span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${CAT_COLORS[cat] ?? 'bg-primary'}`}
                      style={{ width: `${totalCatRev > 0 ? Math.min(100, (rev / totalCatRev) * 100) : 0}%` }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ═══════ STATS ROW 3 — Payment Methods + Inventory Health + Cars ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Payment Methods */}
        <div>
          <SectionLabel title="طرق الدفع" sub={`${sales.length} فاتورة إجمالاً`} />
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
            {paymentStats.map(p => (
              <div key={p.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">{p.label}</span>
                  <span className="font-bold tabular-nums">{p.count} فاتورة <span className="text-muted-foreground text-xs">({p.pct}%)</span></span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${p.color}`} style={{ width: `${p.pct}%` }} />
                </div>
              </div>
            ))}
            {sales.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد مبيعات بعد</p>}
          </div>
        </div>

        {/* Inventory Health */}
        <div>
          <SectionLabel title="صحة المخزون" sub="نسبة المتاح في كل فئة" />
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-4">
            {invHealth.map(h => {
              const pctH = h.total > 0 ? Math.round((h.inStock / h.total) * 100) : 0;
              return (
                <div key={h.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground">{h.label}</span>
                    <span className="font-bold tabular-nums">{h.inStock}/{h.total} <span className={`text-xs font-bold ${pctH >= 60 ? 'text-emerald-500' : pctH >= 30 ? 'text-amber-500' : 'text-red-500'}`}>({pctH}%)</span></span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${pctH >= 60 ? h.color : pctH >= 30 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pctH}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cars Summary */}
        <div>
          <SectionLabel title="السيارات" sub={`${cars.length} سيارة في المخزون`} action={<Link to="/cars" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>} />
          <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'جديدة', val: newCars.length, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'مستعملة', val: usedCars.length, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              ].map(item => (
                <div key={item.label} className={`rounded-xl ${item.bg} p-3 text-center`}>
                  <p className={`text-2xl font-black tabular-nums ${item.color}`}>{item.val}</p>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="space-y-2 pt-1 border-t border-border/30">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">إجمالي رأس المال</span>
                <span className="font-bold tabular-nums text-foreground">{fmt(carsInvValue)} ج.م</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">متوسط سعر السيارة</span>
                <span className="font-bold tabular-nums text-foreground">{fmt(avgCarPrice)} ج.م</span>
              </div>
              {mostExpensiveCar && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الأعلى قيمة</span>
                  <span className="font-bold text-foreground truncate max-w-[60%] text-left">{mostExpensiveCar.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ #17: FINANCIAL OVERVIEW STRIP — New Modules ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'رصيد الخزنة والمحافظ',
            value: `${fmt(walletTotalBalance)} ج.م`,
            icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
            accent: 'bg-emerald-500/10 text-emerald-500',
            link: '/wallets',
            status: walletTotalBalance > 0 ? '' : 'لا يوجد رصيد',
            statusColor: walletTotalBalance > 0 ? 'text-emerald-500' : 'text-muted-foreground',
          },
          {
            label: 'مستحقات الموردين',
            value: `${fmt(suppliersOwed)} ج.م`,
            icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
            accent: 'bg-orange-500/10 text-orange-500',
            link: '/suppliers',
            status: suppliersOwed > 0 ? 'مبالغ مستحقة' : 'لا يوجد ديون',
            statusColor: suppliersOwed > 0 ? 'text-orange-500' : 'text-emerald-500',
          },
          {
            label: 'فواتير شراء غير مدفوعة',
            value: `${fmt(unpaidPurchases)} ج.م`,
            icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
            accent: 'bg-red-500/10 text-red-500',
            link: '/purchase-invoices',
            status: unpaidPurchases > 0 ? 'تحتاج سداد' : 'كل الفواتير مسددة',
            statusColor: unpaidPurchases > 0 ? 'text-red-500' : 'text-emerald-500',
          },
          {
            label: 'تذكيرات متأخرة',
            value: `${overdueReminders} تذكير`,
            icon: <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
            accent: 'bg-amber-500/10 text-amber-500',
            link: '/reminders',
            status: overdueReminders > 0 ? 'تحتاج متابعة' : 'لا يوجد تذكيرات',
            statusColor: overdueReminders > 0 ? 'text-amber-500' : 'text-emerald-500',
          },
        ].map(card => (
          <Link key={card.label} to={card.link}
            className="rounded-2xl border border-border/50 bg-card p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-muted-foreground leading-tight">{card.label}</p>
              <p className="text-lg font-black tabular-nums text-foreground mt-0.5">{card.value}</p>
              <p className={`text-[10px] font-bold ${card.statusColor}`}>{card.status}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─── COL 1: Inventory + Installments + Low Stock ─── */}
        <div className="space-y-5">


          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div>
              <SectionLabel
                title="تنبيه: مخزون منخفض"
                sub={`${lowStockItems.length} منتج بحاجة لإعادة شراء`}
              />
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
                {lowStockItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-amber-500/20 last:border-0 hover:bg-amber-500/10 transition-colors">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                    <span className="text-xs font-bold text-amber-500 shrink-0">{item.qty} وحدة</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{item.cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Installments Summary */}
          <div>
            <SectionLabel
              title="التقسيط"
              sub={overdueContracts > 0 ? `⚠ ${overdueContracts} عقد متأخر` : 'لا توجد متأخرات'}
              action={<Link to="/installments" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>}
            />
            <div className="rounded-2xl border border-border/50 bg-card p-5 space-y-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                {[
                  { label: 'إجمالي', val: totalInstallments, color: 'text-foreground' },
                  { label: 'محصّل', val: totalCollected, color: 'text-emerald-500' },
                  { label: 'متبقي', val: totalRemainingDebt, color: 'text-amber-500' },
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-muted-foreground font-medium">{item.label}</p>
                    <p className={`text-base font-bold tabular-nums ${item.color}`}>{fmt(item.val)}</p>
                    <p className="text-muted-foreground/60 font-medium">ج.م</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                  <span>نسبة التحصيل</span>
                  <span className="font-bold text-emerald-500">{pct(totalCollected, totalInstallments)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${totalInstallments > 0 ? Math.min(100, (totalCollected / totalInstallments) * 100) : 0}%` }} />
                </div>
              </div>
              {overdueContracts > 0 && (
                <Link to="/installments" className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 hover:bg-red-500/15 transition-colors">
                  <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                  <span className="text-xs font-semibold text-red-500">{overdueContracts} عقد متأخر — اضغط للمتابعة</span>
                </Link>
              )}
            </div>
          </div>

          {/* Operational Metrics */}
          <div>
            <SectionLabel title="مؤشرات التشغيل" />
            <div className="space-y-2">
              <MetricPill icon={Wrench} label="طلبات الصيانة" value={`${currentMaint.length}`} sub={`${activeMaintCount} نشط الآن`} linkTo="/maintenance" />
              <MetricPill icon={TrendingDown} label="إجمالي المصروفات" value={`${fmt(totalExpenses)} ج.م`} sub={`${currentExpenses.length} بند`} linkTo="/expenses" />
              <MetricPill icon={DollarSign} label="إيرادات أخرى" value={`${fmt(totalOtherRev)} ج.م`} sub={`${currentOtherRev.length} عملية`} linkTo="/other-revenue" />
              <MetricPill icon={AlertCircle} label="خسائر الهالك" value={`${fmt(totalDamaged)} ج.م`} sub={`${currentDamaged.length} عنصر`} linkTo="/damaged" />
            </div>
          </div>
        </div>

        {/* ─── COL 2: Weekly Chart + Expenses + Profit ─── */}
        <div className="space-y-5">

          {/* Weekly Sales Trend */}
          <div>
            <SectionLabel
              title="المبيعات — آخر 7 أيام"
              sub={`إجمالي: ${fmtFull(weeklyRevTotal)} ج.م`}
            />
            <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              <WeeklyBarChart data={weeklyData} />
              {/* quick stats under chart */}
              <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-muted-foreground">هذا الأسبوع</p>
                  <p className="font-bold text-foreground tabular-nums">{fmt(weeklyRevTotal)} ج.م</p>
                </div>
                <div>
                  <p className="text-muted-foreground">أفضل يوم</p>
                  <p className="font-bold text-primary">{weeklyRevTotal > 0 ? bestDay.day : '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">متوسط يومي</p>
                  <p className="font-bold text-foreground tabular-nums">{fmt(weeklyRevTotal / 7)} ج.م</p>
                </div>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div>
            <SectionLabel
              title="المصروفات"
              sub="توزيع حسب الفئة"
              action={<Link to="/expenses" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>}
            />
            <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {expenseByCategory.length === 0 ? (
                <div className="py-8 text-center space-y-2">
                  <TrendingDown className="h-8 w-8 text-muted-foreground/20 mx-auto" />
                  <p className="text-sm text-muted-foreground">لا توجد مصروفات</p>
                  <Link to="/expenses" className="text-xs text-primary font-semibold hover:underline">إضافة مصروف</Link>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {expenseByCategory.map(([cat, total]) => (
                    <BarRow key={cat} label={catLabels[cat] ?? cat} value={total} total={totalExpenses} color="bg-red-500" />
                  ))}
                  <div className="pt-2 border-t border-border/40 flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">الإجمالي</span>
                    <span className="text-lg font-black text-red-500 tabular-nums">{fmtFull(totalExpenses)} ج.م</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Profitability Breakdown */}
          <div>
            <SectionLabel title="تحليل الربحية" />
            <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-1">
              {[
                { label: 'أرباح المبيعات', value: totalProfit, positive: true },
                { label: 'أرباح الصيانة', value: maintProfit, positive: true },
                { label: 'إيرادات أخرى', value: totalOtherRev, positive: true },
                { label: 'المصروفات', value: -totalExpenses, positive: false },
                { label: 'خسائر الهالك', value: -totalDamaged, positive: false },
              ].map(({ label, value, positive }) => (
                <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${positive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                    <span className="text-sm text-foreground font-medium">{label}</span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${value >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {value >= 0 ? '+' : ''}{fmtFull(Math.abs(value))} ج.م
                  </span>
                </div>
              ))}
              <div className={`mt-3 rounded-xl p-4 flex items-center justify-between ${netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
                <span className="text-base font-bold text-foreground">صافي الربح</span>
                <span className={`text-2xl font-black tabular-nums ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {netProfit >= 0 ? '+' : ''}{fmtFull(netProfit)} ج.م
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── COL 3: Sales Activity + Best Sellers + Maintenance ─── */}
        <div className="space-y-5">

          {/* Best Selling Products */}
          <div>
            <SectionLabel
              title="الأكثر مبيعًا"
              sub="حسب إجمالي الإيراد"
              action={<Link to="/sales" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>}
            />
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {bestSellers.length === 0 ? (
                <div className="py-10 text-center">
                  <Star className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد بيانات مبيعات بعد</p>
                </div>
              ) : bestSellers.map((p, i) => (
                <BestSellerRow key={i} rank={i + 1} name={p.name} count={p.count} revenue={p.revenue} category={p.category} />
              ))}
            </div>
          </div>

          {/* Maintenance Status */}
          <div>
            <SectionLabel
              title="حالة الصيانة"
              sub={`متوسط الربح: ${fmt(avgMaintProfit)} ج.م / طلب`}
              action={<Link to="/maintenance" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>}
            />
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {[
                { label: 'انتظار', status: 'pending', icon: Clock, color: 'text-amber-500' },
                { label: 'قيد الإصلاح', status: 'in_progress', icon: Activity, color: 'text-blue-500' },
                { label: 'تم الإصلاح', status: 'done', icon: CheckCircle2, color: 'text-emerald-500' },
                { label: 'تم التسليم', status: 'delivered', icon: Users, color: 'text-muted-foreground' },
              ].map(({ label, status, icon: Icon, color }) => {
                const count = currentMaint.filter(m => m.status === status).length;
                return (
                  <Link key={status} to="/maintenance"
                    className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0">
                    <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                    <span className="flex-1 text-sm text-foreground font-medium">{label}</span>
                    <span className={`text-xl font-black tabular-nums ${count > 0 ? color : 'text-muted-foreground/30'}`}>{count}</span>
                  </Link>
                );
              })}
              {/* Completion rate bar */}
              <div className="px-4 py-3 bg-muted/20 border-t border-border/30">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5">
                  <span>معدل الإنجاز</span>
                  <span className="font-bold text-emerald-500">{maintCompletionRate.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                    style={{ width: `${maintCompletionRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Sales */}
          <div>
            <SectionLabel
              title="آخر المبيعات"
              sub={`متوسط الفاتورة: ${fmt(avgInvoice)} ج.م`}
              action={<Link to="/sales" className="text-xs text-primary font-semibold hover:underline">عرض الكل</Link>}
            />
            <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
              {recentSales.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                  لا توجد مبيعات حتى الآن
                </div>
              ) : recentSales.map((s, i) => (
                <div key={s.id}
                  className={`flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors ${i < recentSales.length - 1 ? 'border-b border-border/30' : ''}`}>
                  <div>
                    <p className="font-mono text-xs font-bold text-muted-foreground tracking-wider">#{s.invoiceNumber}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{s.date?.slice(0, 10) ?? ''}</p>
                  </div>
                  <div className="text-left">
                    <span className="text-base font-black text-foreground tabular-nums">
                      {fmtFull(s.total ?? 0)}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground mr-0.5">ج.م</span>
                    {(s.grossProfit ?? 0) > 0 && (
                      <p className="text-[10px] text-emerald-500 font-bold text-left">
                        ربح: {fmt(s.grossProfit ?? 0)} ج.م
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
