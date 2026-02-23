import { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Smartphone, Monitor, Tv, Archive, Wrench, CreditCard, TrendingUp, TrendingDown,
  DollarSign, RotateCcw, ShoppingCart, ArrowLeft,
  Activity, Users, CheckCircle2, Clock, AlertCircle, Search, X,
  Layers,
} from 'lucide-react';
import { getMobiles, getMobileAccessories } from '@/data/mobilesData';
import { getDevices, getDeviceAccessories } from '@/data/devicesData';
import { getComputers, getComputerAccessories } from '@/data/computersData';
import { getUsedDevices } from '@/data/usedDevicesData';
import { getMaintenanceOrders } from '@/data/maintenanceData';
import { getContracts } from '@/data/installmentsData';
import { getExpenses } from '@/data/expensesData';
import { getAllSales } from '@/repositories/saleRepository';
import { getMonthlyResetSettings, shouldAutoReset, archiveCurrentPeriod } from '@/data/monthlyResetData';

/* ─── Helpers ─── */
const fmt = (n: number) => n.toLocaleString('ar-EG');
const pct = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) : '0';

/* ─── Search result type ─── */
interface SearchResult {
  id: string;
  label: string;
  sub: string;
  route: string;
  badge: string;
  badgeColor: string;
}

/* ─── Global Search Bar ─── */
function GlobalSearch({
  mobiles, mobileAcc, devices, deviceAcc, computers, computerAcc,
  usedDevices, maintenance, contracts, sales,
}: {
  mobiles: ReturnType<typeof getMobiles>;
  mobileAcc: ReturnType<typeof getMobileAccessories>;
  devices: ReturnType<typeof getDevices>;
  deviceAcc: ReturnType<typeof getDeviceAccessories>;
  computers: ReturnType<typeof getComputers>;
  computerAcc: ReturnType<typeof getComputerAccessories>;
  usedDevices: ReturnType<typeof getUsedDevices>;
  maintenance: ReturnType<typeof getMaintenanceOrders>;
  contracts: ReturnType<typeof getContracts>;
  sales: ReturnType<typeof getAllSales>;
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    if (!q.trim() || q.length < 2) return [];
    const ql = q.toLowerCase();
    const res: SearchResult[] = [];

    mobiles.filter(m => m.name?.toLowerCase().includes(ql) || m.serialNumber?.toLowerCase().includes(ql) || m.color?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(m => res.push({ id: `mob-${m.id}`, label: m.name, sub: `${m.color || ''} ${m.storage || ''} | سيريال: ${m.serialNumber || '—'}`, route: '/mobiles', badge: 'موبايل', badgeColor: 'bg-cyan-100 text-cyan-700' }));

    mobileAcc.filter(a => a.name?.toLowerCase().includes(ql) || a.type?.toLowerCase().includes(ql))
      .slice(0, 3).forEach(a => res.push({ id: `macc-${a.id}`, label: a.name, sub: `إكسسوار موبايل | ${a.type || ''}`, route: '/mobiles', badge: 'إكسسوار', badgeColor: 'bg-cyan-50 text-cyan-600' }));

    devices.filter(d => d.name?.toLowerCase().includes(ql) || d.model?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(d => res.push({ id: `dev-${d.id}`, label: d.name, sub: `${d.model || ''} | ${d.color || ''}`, route: '/devices', badge: 'جهاز', badgeColor: 'bg-amber-100 text-amber-700' }));

    deviceAcc.filter(a => a.name?.toLowerCase().includes(ql))
      .slice(0, 3).forEach(a => res.push({ id: `dacc-${a.id}`, label: a.name, sub: `إكسسوار أجهزة`, route: '/devices', badge: 'إكسسوار', badgeColor: 'bg-amber-50 text-amber-600' }));

    computers.filter(c => c.name?.toLowerCase().includes(ql) || c.model?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(c => res.push({ id: `comp-${c.id}`, label: c.name, sub: `${c.model || ''} | ${c.processor || ''}`, route: '/computers', badge: 'كمبيوتر', badgeColor: 'bg-indigo-100 text-indigo-700' }));

    computerAcc.filter(a => a.name?.toLowerCase().includes(ql))
      .slice(0, 3).forEach(a => res.push({ id: `cacc-${a.id}`, label: a.name, sub: `إكسسوار كمبيوترات`, route: '/computers', badge: 'إكسسوار', badgeColor: 'bg-indigo-50 text-indigo-600' }));

    usedDevices.filter(u => u.name?.toLowerCase().includes(ql) || u.model?.toLowerCase().includes(ql) || u.serialNumber?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(u => res.push({ id: `used-${u.id}`, label: u.name, sub: `مستعمل | ${u.model || ''} | سيريال: ${u.serialNumber || '—'}`, route: '/used', badge: 'مستعمل', badgeColor: 'bg-violet-100 text-violet-700' }));

    maintenance.filter(m => m.customerName?.toLowerCase().includes(ql) || m.deviceName?.toLowerCase().includes(ql) || m.orderNumber?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(m => res.push({ id: `mnt-${m.id}`, label: m.customerName, sub: `صيانة: ${m.deviceName} | ${m.orderNumber}`, route: '/maintenance', badge: 'صيانة', badgeColor: 'bg-orange-100 text-orange-700' }));

    contracts.filter(c => c.customerName?.toLowerCase().includes(ql) || c.productName?.toLowerCase().includes(ql) || c.contractNumber?.toLowerCase().includes(ql))
      .slice(0, 4).forEach(c => res.push({ id: `ins-${c.id}`, label: c.customerName, sub: `تقسيط: ${c.productName} | ${c.contractNumber}`, route: '/installments', badge: 'تقسيط', badgeColor: 'bg-blue-100 text-blue-700' }));

    sales.filter(s => s.invoiceNumber?.toLowerCase().includes(ql))
      .slice(0, 3).forEach(s => res.push({ id: `sale-${s.id}`, label: `فاتورة ${s.invoiceNumber}`, sub: `${s.date?.slice(0, 10) || ''} | ${fmt(s.total ?? 0)} ج.م`, route: '/sales', badge: 'مبيعات', badgeColor: 'bg-emerald-100 text-emerald-700' }));

    return res.slice(0, 12);
  }, [q, mobiles, mobileAcc, devices, deviceAcc, computers, computerAcc, usedDevices, maintenance, contracts, sales]);

  const handleSelect = (route: string) => {
    setOpen(false);
    setQ('');
    navigate(route);
  };

  return (
    <div ref={ref} className="relative flex-1 max-w-xl">
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ابحث عن أي شيء... موبايل، عميل، فاتورة، صيانة..."
          className="h-11 w-full rounded-xl border border-border bg-card pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all shadow-soft"
        />
        {q && (
          <button onClick={() => { setQ(''); setOpen(false); }} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 hover:bg-muted text-muted-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && q.length >= 2 && (
        <div className="absolute top-full mt-2 w-full z-50 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden max-h-80 overflow-y-auto animate-fade-in">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد نتائج لـ "{q}"</div>
          ) : (
            <div>
              <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border bg-muted/20">
                {results.length} نتيجة
              </div>
              {results.map(r => (
                <button key={r.id} onClick={() => handleSelect(r.route)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0 text-right">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.badgeColor}`}>{r.badge}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Stat Card ─── */
function StatCard({ icon: Icon, label, value, sub, color, trend, linkTo }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color: string; trend?: 'up' | 'down'; linkTo?: string;
}) {
  const card = (
    <div className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft hover:shadow-md transition-all hover:border-primary/25 ${linkTo ? 'cursor-pointer' : ''}`}>
      <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-2xl font-extrabold text-foreground tabular-nums leading-none">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      <p className="mt-2 text-sm font-medium text-muted-foreground">{label}</p>
      {trend === 'up' && <TrendingUp className="absolute top-4 left-4 h-4 w-4 text-emerald-400 opacity-60" />}
      {trend === 'down' && <TrendingDown className="absolute top-4 left-4 h-4 w-4 text-red-400 opacity-60" />}
      {linkTo && <ArrowLeft className="absolute bottom-4 left-4 h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
    </div>
  );
  if (linkTo) return <Link to={linkTo}>{card}</Link>;
  return card;
}

/* ─── Section header ─── */
function SH({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-5 w-1 rounded-full bg-primary" />
      <div>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Bar Row ─── */
function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{fmt(value)} ج.م</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

/* ─── Category Card ─── */
function CategoryCard({ icon: Icon, iconBg, label, sub, gradient, to, items }: {
  icon: React.ElementType; iconBg: string; label: string; sub: string;
  gradient: string; to: string; items: { label: string; route: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={`group w-full rounded-2xl border border-border bg-gradient-to-br ${gradient} p-5 shadow-soft hover:shadow-lg transition-all hover:-translate-y-0.5 text-right`}>
        <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} shadow-md`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
        <p className="text-lg font-extrabold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </button>
      {open && (
        <div className="absolute top-full mt-2 right-0 left-0 z-40 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-in">
          {items.map(it => (
            <Link key={it.route} to={it.route} onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 border-b border-border/40 last:border-0 transition-colors text-sm font-medium text-foreground">
              <Layers className="h-4 w-4 text-primary shrink-0" />
              {it.label}
            </Link>
          ))}
          <button onClick={() => setOpen(false)} className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border/40 hover:bg-muted/20 transition-colors">
            <X className="h-3 w-3" /> إغلاق
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════ MAIN DASHBOARD ═══════════ */
export default function Dashboard() {
  /* Load all data */
  const mobiles = useMemo(() => getMobiles(), []);
  const mobileAcc = useMemo(() => getMobileAccessories(), []);
  const devices = useMemo(() => getDevices(), []);
  const deviceAcc = useMemo(() => getDeviceAccessories(), []);
  const computers = useMemo(() => getComputers(), []);
  const computerAcc = useMemo(() => getComputerAccessories(), []);
  const usedDevices = useMemo(() => getUsedDevices(), []);
  const maintenance = useMemo(() => getMaintenanceOrders(), []);
  const contracts = useMemo(() => getContracts(), []);
  const expenses = useMemo(() => getExpenses(), []);
  const allSales = useMemo(() => getAllSales(), []);

  /* ─── Monthly Reset Logic ─── */
  const [resetSettings, setResetSettings] = useState(() => getMonthlyResetSettings());

  useEffect(() => {
    if (shouldAutoReset()) {
      archiveCurrentPeriod({ autoArchived: true, note: 'تصفير تلقائي' });
      setResetSettings(getMonthlyResetSettings());
    }
  }, []);

  const lrd = resetSettings.resetDay > 0 ? resetSettings.lastResetDate : '';

  // Filter variable stats according to the last reset date (if active)
  const sales = useMemo(() => lrd ? allSales.filter(s => (s.date || '') >= lrd) : allSales, [allSales, lrd]);
  const currentExpenses = useMemo(() => lrd ? expenses.filter(e => (e.date || '') >= lrd) : expenses, [expenses, lrd]);
  const currentMaint = useMemo(() => lrd ? maintenance.filter(m => (m.createdAt || m.date || '') >= lrd) : maintenance, [maintenance, lrd]);
  const currentContracts = useMemo(() => lrd ? contracts.filter(c => (c.createdAt || '') >= lrd) : contracts, [contracts, lrd]);

  /* Sales */
  const totalSalesRevenue = useMemo(() => sales.reduce((s, sale) => s + (sale.total ?? 0), 0), [sales]);
  const totalSalesProfit = useMemo(() => sales.reduce((s, sale) => s + (sale.grossProfit ?? 0), 0), [sales]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = useMemo(() => sales.filter(s => s.date?.startsWith(todayStr)), [sales, todayStr]);
  const todayRevenue = useMemo(() => todaySales.reduce((s, sale) => s + (sale.total ?? 0), 0), [todaySales]);

  /* Expenses */
  const totalExpenses = useMemo(() => currentExpenses.reduce((s, e) => s + e.amount, 0), [currentExpenses]);
  const monthlyExpenses = useMemo(() => currentExpenses.reduce((s, e) => s + e.amount, 0), [currentExpenses]); // Since it's already filtered by current period, we can just use the total

  /* Net */
  const netProfit = totalSalesProfit - totalExpenses;

  /* Maintenance */
  const maintRevenue = useMemo(() => currentMaint.reduce((s, m) => s + m.totalSale, 0), [currentMaint]);
  const maintProfit = useMemo(() => currentMaint.reduce((s, m) => s + m.netProfit, 0), [currentMaint]);
  const activeMaint = currentMaint.filter(m => m.status === 'pending' || m.status === 'in_progress').length;
  const doneMaint = currentMaint.filter(m => m.status === 'done' || m.status === 'delivered').length;

  /* Installments */
  const activeContracts = currentContracts.filter(c => c.status === 'active').length;
  const overdueContracts = currentContracts.filter(c => c.status === 'overdue').length;
  const totalInstallmentValue = useMemo(() => currentContracts.reduce((s, c) => s + c.totalPrice, 0), [currentContracts]);
  const totalCollected = useMemo(() => currentContracts.reduce((s, c) => s + c.paidTotal, 0), [currentContracts]);
  const totalRemainingDebt = useMemo(() => currentContracts.reduce((s, c) => s + c.remaining, 0), [currentContracts]);

  /* Inventory counts */
  const totalMobiles = mobiles.reduce((s, m) => s + (m.quantity || 1), 0);
  const totalMobAcc = mobileAcc.reduce((s, a) => s + (a.quantity || 1), 0);
  const totalComputers = computers.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalCompAcc = computerAcc.reduce((s, a) => s + (a.quantity || 1), 0);
  const totalDevices = devices.reduce((s, d) => s + (d.quantity || 1), 0);
  const totalDevAcc = deviceAcc.reduce((s, a) => s + (a.quantity || 1), 0);

  /* Inventory values */
  const mobileInvValue = useMemo(() => mobiles.reduce((s, m) => s + m.newCostPrice * (m.quantity || 1), 0), [mobiles]);
  const deviceInvValue = useMemo(() => devices.reduce((s, d) => s + d.newCostPrice * (d.quantity || 1), 0), [devices]);
  const computerInvValue = useMemo(() => computers.reduce((s, c) => s + c.newCostPrice * (c.quantity || 1), 0), [computers]);
  const usedInvValue = useMemo(() => usedDevices.reduce((s, u) => s + u.purchasePrice, 0), [usedDevices]);
  const totalInvValue = mobileInvValue + deviceInvValue + computerInvValue + usedInvValue;

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
          usedDevices={usedDevices} maintenance={maintenance}
          contracts={contracts} sales={sales}
        />
      </div>

      {/* ── 3 CATEGORY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CategoryCard
          icon={Smartphone} iconBg="bg-cyan-500"
          gradient="from-cyan-50 to-sky-50"
          label="الموبيلات"
          sub={`${totalMobiles} وحدة • ${totalMobAcc} إكسسوار`}
          to="/mobiles"
          items={[
            { label: 'إدارة الموبيلات', route: '/mobiles#mobiles' },
            { label: 'إكسسوارات الموبيلات', route: '/mobiles#accessories' },
          ]}
        />
        <CategoryCard
          icon={Monitor} iconBg="bg-indigo-500"
          gradient="from-indigo-50 to-blue-50"
          label="الكمبيوترات"
          sub={`${totalComputers} وحدة • ${totalCompAcc} إكسسوار`}
          to="/computers"
          items={[
            { label: 'إدارة الكمبيوترات', route: '/computers#computers' },
            { label: 'إكسسوارات الكمبيوترات', route: '/computers#accessories' },
          ]}
        />
        <CategoryCard
          icon={Tv} iconBg="bg-amber-500"
          gradient="from-amber-50 to-orange-50"
          label="الأجهزة"
          sub={`${totalDevices} وحدة • ${totalDevAcc} إكسسوار`}
          to="/devices"
          items={[
            { label: 'إدارة الأجهزة', route: '/devices#devices' },
            { label: 'إكسسوارات الأجهزة', route: '/devices#accessories' },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      </div>

      {/* ── MAIN 3-COLUMN GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─ COLUMN 1: Inventory ─ */}
        <div className="space-y-4">
          <SH title="المخزون" sub={`قيمة إجمالية: ${fmt(totalInvValue)} ج.م`} />
          <div className="rounded-2xl border border-border bg-card divide-y divide-border shadow-soft overflow-hidden">
            {([
              { icon: Smartphone, label: 'الموبيلات', count: totalMobiles, acc: totalMobAcc, value: mobileInvValue, color: 'text-cyan-600 bg-cyan-50', to: '/mobiles' },
              { icon: Monitor, label: 'الكمبيوترات', count: totalComputers, acc: totalCompAcc, value: computerInvValue, color: 'text-indigo-600 bg-indigo-50', to: '/computers' },
              { icon: Tv, label: 'الأجهزة', count: totalDevices, acc: totalDevAcc, value: deviceInvValue, color: 'text-amber-600 bg-amber-50', to: '/devices' },
              { icon: Archive, label: 'المستعمل', count: usedDevices.length, acc: null, value: usedInvValue, color: 'text-violet-600 bg-violet-50', to: '/used' },
            ] as const).map(({ icon: Icon, label, count, acc, value, color, to }) => (
              <Link key={to} to={to} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group">
                <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{label}</p>
                  <p className="text-xs text-muted-foreground">{count} وحدة{acc !== null ? ` • ${acc} إكسسوار` : ''}</p>
                </div>
                <div className="text-left shrink-0">
                  <p className="text-sm font-bold text-foreground">{fmt(value)}</p>
                  <p className="text-[10px] text-muted-foreground">ج.م</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Installments debt */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" /> ديون التقسيط
            </p>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-xl bg-blue-50 border border-blue-100 p-2">
                <p className="text-muted-foreground">الإجمالي</p>
                <p className="font-bold text-blue-700 text-sm">{fmt(totalInstallmentValue)} ج.م</p>
              </div>
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-2">
                <p className="text-muted-foreground">محصّل</p>
                <p className="font-bold text-emerald-700 text-sm">{fmt(totalCollected)} ج.م</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-100 p-2">
                <p className="text-muted-foreground">متبقي</p>
                <p className="font-bold text-amber-700 text-sm">{fmt(totalRemainingDebt)} ج.م</p>
              </div>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
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
          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
            {expenseByCategory.length === 0 ? (
              <div className="py-8 text-center">
                <TrendingDown className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد مصروفات</p>
                <Link to="/expenses" className="text-xs text-primary hover:underline mt-1 inline-block">إضافة مصروف +</Link>
              </div>
            ) : expenseByCategory.map(([cat, total]) => (
              <BarRow key={cat} label={catLabels[cat] ?? cat} value={total} total={totalExpenses}
                color="bg-gradient-to-r from-red-400 to-orange-400" />
            ))}
            {totalExpenses > 0 && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-3 flex justify-between items-center">
                <span className="text-sm font-semibold text-foreground">الإجمالي</span>
                <span className="text-lg font-extrabold text-red-600">{fmt(totalExpenses)} ج.م</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-3">
            <p className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> تحليل الربحية
            </p>
            {[
              { label: 'إيرادات المبيعات', value: totalSalesRevenue, color: 'bg-emerald-400' },
              { label: 'إيرادات الصيانة', value: maintRevenue, color: 'bg-teal-400' },
              { label: 'المصروفات الكلية', value: -totalExpenses, color: 'bg-red-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex justify-between items-center py-1.5 border-b border-border/40 last:border-0 text-sm">
                <span className="flex items-center gap-2 text-foreground">
                  <span className={`h-2 w-2 rounded-full ${color}`} />{label}
                </span>
                <span className={`font-bold tabular-nums ${value < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {value < 0 ? '-' : '+'}{fmt(Math.abs(value))} ج.م
                </span>
              </div>
            ))}
            <div className={`rounded-xl border p-3 flex justify-between items-center ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <span className="font-bold text-foreground">صافي الربح</span>
              <span className={`text-xl font-extrabold ${netProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {netProfit >= 0 ? '+' : ''}{fmt(netProfit)} ج.م
              </span>
            </div>
          </div>
        </div>

        {/* ─ COLUMN 3: Maintenance + Recent Sales ─ */}
        <div className="space-y-4">
          <SH title="حالة الصيانة" sub={`${maintenance.length} طلب`} />
          <div className="rounded-2xl border border-border bg-card divide-y divide-border shadow-soft overflow-hidden">
            {([
              { label: 'انتظار', count: maintenance.filter(m => m.status === 'pending').length, icon: Clock, color: 'text-amber-600 bg-amber-50' },
              { label: 'قيد الإصلاح', count: maintenance.filter(m => m.status === 'in_progress').length, icon: Activity, color: 'text-blue-600 bg-blue-50' },
              { label: 'تم الإصلاح', count: maintenance.filter(m => m.status === 'done').length, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'تم التسليم', count: maintenance.filter(m => m.status === 'delivered').length, icon: Users, color: 'text-muted-foreground bg-muted' },
            ] as const).map(({ label, count, icon: Icon, color }) => (
              <Link key={label} to="/maintenance" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                <div className={`p-2 rounded-lg ${color}`}><Icon className="h-4 w-4" /></div>
                <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
                <span className="text-xl font-extrabold text-foreground tabular-nums">{count}</span>
              </Link>
            ))}
          </div>

          {overdueContracts > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">{overdueContracts} عقد تقسيط متأخر!</p>
                <p className="text-xs text-red-500 mt-0.5">يجب متابعة العملاء المتأخرين</p>
                <Link to="/installments" className="text-xs text-red-600 hover:underline font-semibold mt-1 inline-block">عرض العقود ←</Link>
              </div>
            </div>
          )}

          <div>
            <SH title="آخر المبيعات" />
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              {recentSales.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">لا توجد مبيعات</div>
              ) : recentSales.map((s, i) => (
                <div key={s.id} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i !== recentSales.length - 1 ? 'border-b border-border/50' : ''}`}>
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">{s.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{s.date?.slice(0, 10) ?? ''}</p>
                  </div>
                  <span className="font-bold text-primary tabular-nums">{fmt(s.total ?? 0)} ج.م</span>
                </div>
              ))}
              <Link to="/sales" className="block text-center py-2.5 text-xs text-primary font-semibold hover:bg-muted/30 transition-colors border-t border-border/50">
                عرض كل المبيعات ←
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUICK LINKS ── */}
      <div>
        <SH title="وصول سريع" />
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {([
            { icon: ShoppingCart, label: 'نقطة البيع', to: '/pos', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
            { icon: Smartphone, label: 'الموبيلات', to: '/mobiles', color: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
            { icon: Monitor, label: 'الكمبيوتر', to: '/computers', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
            { icon: Tv, label: 'الأجهزة', to: '/devices', color: 'bg-amber-100 text-amber-700 border-amber-200' },
            { icon: Archive, label: 'المستعمل', to: '/used', color: 'bg-violet-100 text-violet-700 border-violet-200' },
            { icon: Wrench, label: 'الصيانة', to: '/maintenance', color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { icon: CreditCard, label: 'التقسيط', to: '/installments', color: 'bg-blue-100 text-blue-700 border-blue-200' },
            { icon: TrendingDown, label: 'المصروفات', to: '/expenses', color: 'bg-red-100 text-red-600 border-red-200' },
          ] as const).map(({ icon: Icon, label, to, color }) => (
            <Link key={to} to={to}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${color} hover:scale-105 transition-all hover:shadow-md text-center`}>
              <Icon className="h-5 w-5" />
              <span className="text-xs font-semibold leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
