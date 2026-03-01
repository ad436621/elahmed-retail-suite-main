import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Smartphone, Monitor, Tv, Archive, Wrench, CreditCard, TrendingUp, TrendingDown,
  DollarSign, RotateCcw, ShoppingCart, ArrowLeft,
  Activity, Users, CheckCircle2, Clock, AlertCircle, Search, X,
  Layers, Car, AlertTriangle, Warehouse,
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
import { getCars, getCarsCapital } from '@/data/carsData';
import { getDamagedItems, getTotalLossesThisMonth } from '@/data/damagedData';
import { getWeightedAvgCost } from '@/data/batchesData';
import { getWarehouseCapital } from '@/data/warehouseData';
import { getOtherRevenues, getTotalOtherRevenueThisMonth } from '@/data/otherRevenueData';

// Dashboard sub-components (extracted for cleaner code)
import {
  GlobalSearch, StatCard, SectionHeader as SH, BarRow, CategoryCard, fmt, pct,
} from '@/components/dashboard/DashboardWidgets';

/* ═══════════ MAIN DASHBOARD ═══════════ */
export default function Dashboard() {
  /* Load all data */
  const mobiles = useMemo(() => getMobiles(), []);
  const mobileAcc = useMemo(() => getMobileAccessories(), []);
  const devices = useMemo(() => getDevices(), []);
  const deviceAcc = useMemo(() => getDeviceAccessories(), []);
  const computers = useMemo(() => getComputers(), []);
  const computerAcc = useMemo(() => getComputerAccessories(), []);
  const maintenance = useMemo(() => getMaintenanceOrders(), []);
  const contracts = useMemo(() => getContracts(), []);
  const expenses = useMemo(() => getExpenses(), []);
  const allSales = useMemo(() => getAllSales(), []);
  const cars = useMemo(() => getCars(), []);
  const damagedItems = useMemo(() => getDamagedItems(), []);
  const warehouseCapital = useMemo(() => getWarehouseCapital(), []);
  const otherRevenues = useMemo(() => getOtherRevenues(), []);

  /* ─── Monthly Reset Logic ─── */
  const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());

  useEffect(() => {
    if (shouldAutoReset()) {
      archiveCurrentPeriod({ autoArchived: true, note: 'تصفير تلقائي' });
      setResetSettings(getMonthlyResetSettings());
      // Download backup on auto-reset
      downloadManualBackup();
    }
  }, []);

  const lrd = resetSettings.resetDay > 0 ? resetSettings.lastResetDate : '';

  // Filter variable stats according to the last reset date (if active)
  const sales = useMemo(() => lrd ? allSales.filter(s => (s.date || '') >= lrd) : allSales, [allSales, lrd]);
  const currentExpenses = useMemo(() => lrd ? expenses.filter(e => (e.date || '') >= lrd) : expenses, [expenses, lrd]);
  const currentMaint = useMemo(() => lrd ? maintenance.filter(m => (m.createdAt || m.date || '') >= lrd) : maintenance, [maintenance, lrd]);
  const currentContracts = useMemo(() => lrd ? contracts.filter(c => (c.createdAt || '') >= lrd) : contracts, [contracts, lrd]);
  const currentDamaged = useMemo(() => lrd ? damagedItems.filter(d => (d.date || '') >= lrd) : damagedItems, [damagedItems, lrd]);
  const currentOtherRev = useMemo(() => lrd ? otherRevenues.filter(o => (o.date || '') >= lrd) : otherRevenues, [otherRevenues, lrd]);

  /* Sales */
  const totalSalesRevenue = useMemo(() => sales.reduce((s, sale) => s + (sale.total ?? 0), 0), [sales]);
  const totalSalesProfit = useMemo(() => sales.reduce((s, sale) => s + (sale.grossProfit ?? 0), 0), [sales]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = useMemo(() => sales.filter(s => s.date?.startsWith(todayStr)), [sales, todayStr]);
  const todayRevenue = useMemo(() => todaySales.reduce((s, sale) => s + (sale.total ?? 0), 0), [todaySales]);

  /* Expenses & Losses */
  const totalExpenses = useMemo(() => currentExpenses.reduce((s, e) => s + e.amount, 0), [currentExpenses]);
  const monthlyExpenses = useMemo(() => currentExpenses.reduce((s, e) => s + e.amount, 0), [currentExpenses]); // Since it's already filtered by current period, we can just use the total
  const totalDamagedLoss = useMemo(() => currentDamaged.reduce((s, d) => s + d.totalLoss, 0), [currentDamaged]);

  /* Maintenance */
  const maintRevenue = useMemo(() => currentMaint.reduce((s, m) => s + m.totalSale, 0), [currentMaint]);
  const maintProfit = useMemo(() => currentMaint.reduce((s, m) => s + m.netProfit, 0), [currentMaint]);
  const activeMaint = currentMaint.filter(m => m.status === 'pending' || m.status === 'in_progress').length;
  const doneMaint = currentMaint.filter(m => m.status === 'done' || m.status === 'delivered').length;

  /* Other Revenue */
  const totalOtherRevenue = useMemo(() => currentOtherRev.reduce((s, o) => s + o.amount, 0), [currentOtherRev]);

  /* Net */
  const netProfit = totalSalesProfit + maintProfit + totalOtherRevenue - totalExpenses - totalDamagedLoss;

  /* Installments */
  const activeContracts = currentContracts.filter(c => c.status === 'active').length;
  const overdueContracts = currentContracts.filter(c => c.status === 'overdue').length;
  const totalInstallmentValue = useMemo(() => currentContracts.reduce((s, c) => s + c.installmentPrice, 0), [currentContracts]);
  const totalCollected = useMemo(() => currentContracts.reduce((s, c) => s + c.paidTotal, 0), [currentContracts]);
  const totalRemainingDebt = useMemo(() => currentContracts.reduce((s, c) => s + c.remaining, 0), [currentContracts]);

  /* Inventory counts */
  // Mobiles
  const newMobiles = useMemo(() => mobiles.filter(m => m.condition !== 'used').reduce((s, m) => s + (m.quantity || 1), 0), [mobiles]);
  const usedMobiles = useMemo(() => mobiles.filter(m => m.condition === 'used').reduce((s, m) => s + (m.quantity || 1), 0), [mobiles]);
  const totalMobAcc = mobileAcc.reduce((s, a) => s + (a.quantity || 1), 0);
  const totalMobiles = newMobiles + usedMobiles;

  // Computers
  const newComputers = useMemo(() => computers.filter(c => c.condition !== 'used').reduce((s, c) => s + (c.quantity || 1), 0), [computers]);
  const usedComputers = useMemo(() => computers.filter(c => c.condition === 'used').reduce((s, c) => s + (c.quantity || 1), 0), [computers]);
  const totalCompAcc = computerAcc.reduce((s, a) => s + (a.quantity || 1), 0);
  const totalComputers = newComputers + usedComputers;

  // Devices
  const newDevices = useMemo(() => devices.filter(d => d.condition !== 'used').reduce((s, d) => s + (d.quantity || 1), 0), [devices]);
  const usedDevicesCount = useMemo(() => devices.filter(d => d.condition === 'used').reduce((s, d) => s + (d.quantity || 1), 0), [devices]);
  const totalDevAcc = deviceAcc.reduce((s, a) => s + (a.quantity || 1), 0);
  const totalDevices = newDevices + usedDevicesCount;

  // Cars
  const newCarsCount = cars.filter(c => c.condition !== 'used').length;
  const usedCarsCount = cars.filter(c => c.condition === 'used').length;
  const totalUsedCount = useMemo(() => mobiles.filter(m => m.condition === 'used').length + computers.filter(c => c.condition === 'used').length + devices.filter(d => d.condition === 'used').length, [mobiles, computers, devices]);

  /* Inventory values */
  const mobileInvValue = useMemo(() => mobiles.reduce((s, m) => s + (getWeightedAvgCost(m.id) || m.newCostPrice) * (m.quantity || 1), 0), [mobiles]);
  const deviceInvValue = useMemo(() => devices.reduce((s, d) => s + (getWeightedAvgCost(d.id) || d.newCostPrice) * (d.quantity || 1), 0), [devices]);
  const computerInvValue = useMemo(() => computers.reduce((s, c) => s + (getWeightedAvgCost(c.id) || c.newCostPrice) * (c.quantity || 1), 0), [computers]);
  const usedInvValue = useMemo(() => {
    return mobiles.filter(m => m.condition === 'used').reduce((s, m) => s + (getWeightedAvgCost(m.id) || m.newCostPrice) * (m.quantity || 1), 0)
      + computers.filter(c => c.condition === 'used').reduce((s, c) => s + (getWeightedAvgCost(c.id) || c.newCostPrice) * (c.quantity || 1), 0)
      + devices.filter(d => d.condition === 'used').reduce((s, d) => s + (getWeightedAvgCost(d.id) || d.newCostPrice) * (d.quantity || 1), 0);
  }, [mobiles, computers, devices]);
  const carsInvValue = useMemo(() => cars.reduce((s, c) => s + c.purchasePrice, 0), [cars]);
  const totalInvValue = mobileInvValue + deviceInvValue + computerInvValue + carsInvValue;

  /* Expense by category */
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    currentExpenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [currentExpenses]);

  const catLabels: Record<string, string> = {
    rent: 'إيجار', utilities: 'مرافق', salaries: 'رواتب',
    supplies: 'مستلزمات', maintenance: 'صيانة', transport: 'مواصلات', other: 'أخرى',
  };

  const recentSales = useMemo(() => [...sales].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 6), [sales]);

  return (
    <div className="space-y-6 pb-8 animate-fade-in" dir="rtl">

      {/* ── HEADER: Title + Global Search ── */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="shrink-0">
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            لوحة التحكم
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <GlobalSearch
          mobiles={mobiles} mobileAcc={mobileAcc}
          devices={devices} deviceAcc={deviceAcc}
          computers={computers} computerAcc={computerAcc}
          maintenance={maintenance}
          contracts={contracts} sales={sales}
        />
      </div>

      {/* ── 4 CATEGORY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CategoryCard
          icon={Smartphone} iconBg="bg-cyan-500"
          gradient="from-cyan-50 to-sky-50"
          label="الموبيلات"
          sub={`${newMobiles} جديد • ${usedMobiles} مستعمل • ${totalMobAcc} إكسسوار`}
          to="/mobiles"
          items={[
            { label: 'إدارة الموبيلات', route: '/mobiles#mobiles' },
            { label: 'المستعملة', route: '/mobiles', state: { filter: 'used' } },
            { label: 'إكسسوارات الموبيلات', route: '/mobiles#accessories' },
          ]}
        />
        <CategoryCard
          icon={Monitor} iconBg="bg-indigo-500"
          gradient="from-indigo-50 to-blue-50"
          label="الكمبيوترات"
          sub={`${newComputers} جديد • ${usedComputers} مستعمل • ${totalCompAcc} إكسسوار`}
          to="/computers"
          items={[
            { label: 'إدارة الكمبيوترات', route: '/computers#computers' },
            { label: 'المستعملة', route: '/computers', state: { filter: 'used' } },
            { label: 'إكسسوارات الكمبيوترات', route: '/computers#accessories' },
          ]}
        />
        <CategoryCard
          icon={Tv} iconBg="bg-amber-500"
          gradient="from-amber-50 to-orange-50"
          label="الأجهزة"
          sub={`${newDevices} جديد • ${usedDevicesCount} مستعمل • ${totalDevAcc} إكسسوار`}
          to="/devices"
          items={[
            { label: 'إدارة الأجهزة', route: '/devices#devices' },
            { label: 'المستعملة', route: '/devices', state: { filter: 'used' } },
            { label: 'إكسسوارات الأجهزة', route: '/devices#accessories' },
          ]}
        />
        <CategoryCard
          icon={Car} iconBg="bg-emerald-500"
          gradient="from-emerald-50 to-teal-50"
          label="السيارات"
          sub={`${newCarsCount} جديد • ${usedCarsCount} مستعمل`}
          to="/cars"
          items={[
            { label: 'السيارات الجديدة', route: '/cars#new' },
            { label: 'السيارات المستعملة', route: '/cars#used' },
          ]}
        />
      </div>

      {/* ── KPI ROW 1 — Financial ── */}
      <div>
        <SH title="الملخص المالي" sub={lrd ? `مخصّص للفترة من: ${new Date(lrd).toLocaleDateString('ar-EG')}` : 'إجمالي منذ البداية'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={ShoppingCart} label="إجمالي المبيعات" value={`${fmt(totalSalesRevenue)} ج.م`}
            sub={`${sales.length} فاتورة`} color="bg-emerald-100 text-emerald-600" trend="up" linkTo="/sales" />
          <StatCard icon={TrendingUp} label="إجمالي الربح الخام"
            value={`${fmt(totalSalesProfit)} ج.م`}
            sub={`هامش ${pct(totalSalesProfit, totalSalesRevenue)}%`}
            color="bg-blue-100 text-blue-600" trend="up" />
          <StatCard icon={TrendingDown} label="إجمالي المصروفات"
            value={`${fmt(totalExpenses)} ج.م`}
            color="bg-red-100 text-red-500" trend="down" linkTo="/expenses" />
          <StatCard icon={DollarSign} label="صافي الربح"
            value={`${fmt(netProfit)} ج.م`}
            sub={netProfit >= 0 ? '✅ ربح' : '❌ خسارة'}
            color={netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}
            trend={netProfit >= 0 ? 'up' : 'down'} />
        </div>
      </div>

      {/* ── KPI ROW 2 — Operations ── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 md:grid-cols-3 gap-3">
        <StatCard icon={ShoppingCart} label="مبيعات اليوم"
          value={`${fmt(todayRevenue)} ج.م`} sub={`${todaySales.length} فاتورة`}
          color="bg-amber-100 text-amber-600" linkTo="/pos" />
        <StatCard icon={Wrench} label="طلبات الصيانة"
          value={fmt(currentMaint.length)} sub={`${activeMaint} نشط • ${doneMaint} منجز`}
          color="bg-orange-100 text-orange-600" linkTo="/maintenance" />
        <StatCard icon={CreditCard} label="عقود التقسيط"
          value={fmt(currentContracts.length)} sub={`${activeContracts} نشط • ${overdueContracts} متأخر`}
          color="bg-purple-100 text-purple-600" linkTo="/installments" />
        <StatCard icon={RotateCcw} label="إيرادات الصيانة"
          value={`${fmt(maintRevenue)} ج.م`} sub={`ربح: ${fmt(maintProfit)} ج.م`}
          color="bg-teal-100 text-teal-600" />
        <StatCard icon={AlertCircle} label="خسائر الهالك"
          value={`${fmt(totalDamagedLoss)} ج.م`} sub={`${currentDamaged.length} عنصر`}
          color="bg-red-100 text-red-600" trend="down" linkTo="/damaged" />
        <StatCard icon={DollarSign} label="أرباح أخرى"
          value={`${fmt(totalOtherRevenue)} ج.م`} sub={`${currentOtherRev.length} عملية`}
          color="bg-green-100 text-green-600" trend="up" linkTo="/other-revenue" />
      </div>

      {/* ── MAIN 3-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─ COLUMN 1: Inventory ─ */}
        <div className="space-y-4">
          <SH title="المخزون" sub={`قيمة إجمالية: ${fmt(totalInvValue)} ج.م`} />
          <div className="rounded-3xl border border-border/50 bg-card/80 divide-y divide-border/50 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            {([
              { icon: Smartphone, label: 'الموبيلات', count: totalMobiles, acc: totalMobAcc, value: mobileInvValue, color: 'text-cyan-600 bg-cyan-100/80', to: '/mobiles' },
              { icon: Monitor, label: 'الكمبيوترات', count: totalComputers, acc: totalCompAcc, value: computerInvValue, color: 'text-indigo-600 bg-indigo-100/80', to: '/computers' },
              { icon: Tv, label: 'الأجهزة', count: totalDevices, acc: totalDevAcc, value: deviceInvValue, color: 'text-amber-600 bg-amber-100/80', to: '/devices' },
              { icon: Smartphone, label: 'مستعمل', count: totalUsedCount, acc: null, value: usedInvValue, color: 'text-orange-600 bg-orange-100/80', to: '/mobiles', filter: 'used' },
              { icon: Car, label: 'السيارات', count: cars.length, acc: null, value: carsInvValue, color: 'text-emerald-600 bg-emerald-100/80', to: '/cars' },
            ] as const).map(({ icon: Icon, label, count, acc, value, color, to, filter }: { icon: React.ElementType; label: string; count: number; acc: number | null; value: number; color: string; to: string; filter?: string }) => (
              <Link key={to + (filter || '')} to={to} state={filter ? { filter } : undefined} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/60 transition-colors group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-l from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className={`p-3 rounded-2xl ${color} shadow-inner bg-gradient-to-br from-white/40 to-transparent relative z-10`}><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0 relative z-10">
                  <p className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">{label}</p>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">{count} وحدة{acc !== null ? ` • ${acc} إكسسوار` : ''}</p>
                </div>
                <div className="text-left shrink-0 relative z-10 bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-border/60 shadow-sm group-hover:border-primary/30 transition-colors">
                  <p className="text-sm font-black text-foreground">{fmt(value)}</p>
                  <p className="text-[10px] font-bold text-muted-foreground text-center">ج.م</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Installments debt */}
          <div className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <p className="text-base font-black text-foreground flex items-center gap-2 relative z-10 tracking-tight">
              <CreditCard className="h-4 w-4 text-primary" /> ديون التقسيط
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-gradient-to-br from-blue-50/80 to-blue-100/50 border border-blue-200/50 p-3 shadow-sm backdrop-blur-sm">
                <p className="text-muted-foreground font-semibold">الإجمالي</p>
                <p className="font-black text-blue-700 text-sm mt-0.5">{fmt(totalInstallmentValue)} ج.م</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-emerald-50/80 to-emerald-100/50 border border-emerald-200/50 p-3 shadow-sm backdrop-blur-sm">
                <p className="text-muted-foreground font-semibold">محصّل</p>
                <p className="font-black text-emerald-700 text-sm mt-0.5">{fmt(totalCollected)} ج.م</p>
              </div>
              <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 to-amber-100/50 border border-amber-200/50 p-3 shadow-sm backdrop-blur-sm">
                <p className="text-muted-foreground font-semibold">متبقي</p>
                <p className="font-black text-amber-700 text-sm mt-0.5">{fmt(totalRemainingDebt)} ج.م</p>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/80 overflow-hidden shadow-inner relative z-10">
              <div className="h-full rounded-full bg-gradient-to-l from-primary to-amber-400 transition-all duration-700"
                style={{ width: `${totalInstallmentValue > 0 ? Math.min(100, (totalCollected / totalInstallmentValue) * 100) : 0}%` }} />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {pct(totalCollected, totalInstallmentValue)}% تم تحصيله
            </p>
          </div>
        </div>

        {/* ─ COLUMN 2: Expenses ─ */}
        <div className="space-y-4">
          <SH title="المصروفات" sub="توزيع حسب الفئة" />
          <div className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-xl space-y-5">
            {expenseByCategory.length === 0 ? (
              <div className="py-8 text-center">
                <TrendingDown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">لا توجد مصروفات</p>
                <Link to="/expenses" className="text-xs font-bold text-primary hover:underline mt-2 inline-block">إضافة مصروف +</Link>
              </div>
            ) : expenseByCategory.map(([cat, total]) => (
              <BarRow key={cat} label={catLabels[cat] ?? cat} value={total} total={totalExpenses}
                color="bg-gradient-to-r from-red-500 to-orange-400 shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
            ))}
            {totalExpenses > 0 && (
              <div className="rounded-2xl border border-red-200/50 bg-gradient-to-br from-red-50/80 to-red-100/50 p-4 flex justify-between items-center shadow-sm">
                <span className="text-sm font-black text-foreground">الإجمالي</span>
                <span className="text-xl font-black text-red-600 tracking-tight">{fmt(totalExpenses)} ج.م</span>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-border/50 bg-card/80 p-6 shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <p className="text-base font-black text-foreground flex items-center gap-2 relative z-10 tracking-tight">
              <TrendingUp className="h-5 w-5 text-emerald-500" /> تحليل الربحية والتكاليف
            </p>
            {[
              { label: 'أرباح المبيعات', value: totalSalesProfit, color: 'bg-emerald-400' },
              { label: 'أرباح الصيانة', value: maintProfit, color: 'bg-teal-400' },
              { label: 'أرباح أخرى', value: totalOtherRevenue, color: 'bg-green-400' },
              { label: 'خسائر الهالك', value: -totalDamagedLoss, color: 'bg-red-500' },
              { label: 'المصروفات الكلية', value: -totalExpenses, color: 'bg-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-2.5 border-b border-border/40 last:border-0 text-sm relative z-10">
                <span className="flex items-center gap-2.5 text-foreground font-bold">
                  <span className={`h-2.5 w-2.5 rounded-full ${color} shadow-sm`} />{label}
                </span>
                <span className={`font-black tabular-nums tracking-tight ${value < 0 ? 'text-red-500/90' : 'text-emerald-600/90'}`}>
                  {value < 0 ? '-' : '+'}{fmt(Math.abs(value))} ج.م
                </span>
              </div>
            ))}
            <div className={`rounded-2xl border p-4 flex justify-between items-center shadow-lg relative z-10 ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60' : 'bg-gradient-to-br from-red-50 to-red-100/50 border-red-200/60'}`}>
              <span className="font-black text-foreground text-lg">صافي الربح</span>
              <span className={`text-2xl font-black tracking-tighter ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {netProfit >= 0 ? '+' : ''}{fmt(netProfit)} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* ─ COLUMN 3: Maintenance + Recent Sales ─ */}
        <div className="space-y-4">
          <SH title="حالة الصيانة" sub={`${maintenance.length} طلب`} />
          <div className="rounded-3xl border border-border/50 bg-card/80 divide-y divide-border/50 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
            {([
              { label: 'انتظار', count: maintenance.filter(m => m.status === 'pending').length, icon: Clock, color: 'text-amber-600 bg-amber-100/80' },
              { label: 'قيد الإصلاح', count: maintenance.filter(m => m.status === 'in_progress').length, icon: Activity, color: 'text-blue-600 bg-blue-100/80' },
              { label: 'تم الإصلاح', count: maintenance.filter(m => m.status === 'done').length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-100/80' },
              { label: 'تم التسليم', count: maintenance.filter(m => m.status === 'delivered').length, icon: Users, color: 'text-slate-600 bg-slate-200/80' },
            ] as const).map(({ label, count, icon: Icon, color }) => (
              <Link key={label} to="/maintenance" className="flex items-center gap-4 px-5 py-4 hover:bg-muted/60 transition-colors group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-l from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className={`p-3 rounded-2xl ${color} shadow-inner bg-gradient-to-br from-white/40 to-transparent relative z-10`}><Icon className="h-5 w-5" /></div>
                <span className="flex-1 text-base font-extrabold text-foreground group-hover:text-primary transition-colors relative z-10">{label}</span>
                <span className="text-xl font-black text-foreground tabular-nums relative z-10">{count}</span>
              </Link>
            ))}
          </div>

          {overdueContracts > 0 && (
            <div className="rounded-3xl border border-red-200/60 bg-gradient-to-br from-red-50 to-red-100/50 p-5 flex items-start gap-4 shadow-lg relative overflow-hidden">
              <div className="absolute -left-8 -bottom-8 w-24 h-24 bg-red-400/20 rounded-full blur-2xl pointer-events-none" />
              <AlertCircle className="h-6 w-6 text-red-500 mt-0.5 shrink-0 relative z-10" />
              <div className="relative z-10">
                <p className="text-base font-black text-red-700 tracking-tight">{overdueContracts} عقد تقسيط متأخر!</p>
                <p className="text-xs font-semibold text-red-600/80 mt-1">يجب متابعة العملاء المتأخرين</p>
                <Link to="/installments" className="text-sm text-red-600 hover:text-red-800 hover:underline font-bold mt-2 inline-block transition-colors">عرض العقود ←</Link>
              </div>
            </div>
          )}

          <div>
            <SH title="آخر المبيعات" />
            <div className="rounded-3xl border border-border/50 bg-card/80 shadow-xl overflow-hidden relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
              {recentSales.length === 0 ? (
                <div className="py-8 text-center text-sm font-semibold text-muted-foreground relative z-10">لا توجد مبيعات</div>
              ) : recentSales.map((s, i) => (
                <div key={s.id} className={`flex items-center justify-between px-5 py-3.5 text-sm hover:bg-muted/40 transition-colors relative z-10 ${i !== recentSales.length - 1 ? 'border-b border-border/40' : ''}`}>
                  <div>
                    <p className="font-mono text-xs font-bold text-slate-500 tracking-wider">#{s.invoiceNumber}</p>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">{s.date?.slice(0, 10) ?? ''}</p>
                  </div>
                  <span className="font-black text-primary tabular-nums text-base tracking-tight">{fmt(s.total ?? 0)} ج.م</span>
                </div>
              ))}
              <Link to="/sales" className="block text-center py-3.5 text-sm text-primary font-extrabold hover:bg-primary/10 transition-colors border-t border-border/50 relative z-10">
                عرض كل المبيعات ←
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div>
        <SH title="وصول سريع" />
        <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {([
            { icon: ShoppingCart, label: 'نقطة البيع', to: '/pos', color: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/50' },
            { icon: Smartphone, label: 'الموبيلات', to: '/mobiles', color: 'bg-cyan-100/80 text-cyan-700 border-cyan-200/50' },
            { icon: Monitor, label: 'الكمبيوتر', to: '/computers', color: 'bg-indigo-100/80 text-indigo-700 border-indigo-200/50' },
            { icon: Tv, label: 'الأجهزة', to: '/devices', color: 'bg-amber-100/80 text-amber-700 border-amber-200/50' },
            { icon: Wrench, label: 'الصيانة', to: '/maintenance', color: 'bg-orange-100/80 text-orange-700 border-orange-200/50' },
            { icon: CreditCard, label: 'التقسيط', to: '/installments', color: 'bg-blue-100/80 text-blue-700 border-blue-200/50' },
            { icon: TrendingDown, label: 'المصروفات', to: '/expenses', color: 'bg-red-100/80 text-red-700 border-red-200/50' },
          ] as const).map(({ icon: Icon, label, to, color }) => (
            <Link key={to} to={to}
              className={`group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/20 p-4 ${color} hover:-translate-y-1 hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl text-center bg-card/80 relative overflow-hidden`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute -bottom-6 -right-6 w-16 h-16 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
              <Icon className="h-7 w-7 relative z-10" />
              <span className="text-sm font-extrabold leading-tight relative z-10">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
