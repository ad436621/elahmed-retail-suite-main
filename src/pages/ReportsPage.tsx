// ============================================================
// صفحة التقارير — Reports Page
// ============================================================

import { useMemo, useState } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
    BarChart3, TrendingUp, TrendingDown, ShoppingCart, Wrench, CreditCard,
    Package, Car, Smartphone, Monitor, Tv, DollarSign, AlertTriangle,
    FileText, Download, Calendar, Users, Receipt, Percent,
} from 'lucide-react';
import { getAllSales } from '@/repositories/saleRepository';
import { getMobiles, getMobileAccessories } from '@/data/mobilesData';
import { getDevices, getDeviceAccessories } from '@/data/devicesData';
import { getComputers, getComputerAccessories } from '@/data/computersData';
import { getMaintenanceOrders } from '@/data/maintenanceData';
import { getContracts } from '@/data/installmentsData';
import { getExpenses } from '@/data/expensesData';
import { getCars } from '@/data/carsData';
import { getDamagedItems } from '@/data/damagedData';
import { getOtherRevenues } from '@/data/otherRevenueData';
import { getWeightedAvgCost } from '@/data/batchesData';
// #18 FIX: New module data for extra report tabs
import { getSuppliers, getSupplierTransactions, getTotalOwedToSuppliers } from '@/data/suppliersData';
import { getWallets, getTransactions as getWalletTransactions, getTotalBalance } from '@/data/walletsData';
import { getEmployees } from '@/data/employeesData';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 });
const fmtK = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}ك` : fmt(n);
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

// ── Types ─────────────────────────────────────────────────────
type DateRange = 'today' | 'week' | 'month' | '3months' | '6months' | 'year' | 'all';

const DATE_LABELS: Record<DateRange, string> = {
    today: 'اليوم', week: 'هذا الأسبوع', month: 'هذا الشهر',
    '3months': 'آخر 3 أشهر', '6months': 'آخر 6 أشهر', year: 'هذا العام', all: 'الكل',
};

function getDateRange(range: DateRange): { from: string; to: string } {
    const now = new Date();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now);
    if (range === 'today') { /* same */ }
    else if (range === 'week') from.setDate(from.getDate() - 7);
    else if (range === 'month') from.setMonth(from.getMonth() - 1);
    else if (range === '3months') from.setMonth(from.getMonth() - 3);
    else if (range === '6months') from.setMonth(from.getMonth() - 6);
    else if (range === 'year') from.setFullYear(from.getFullYear() - 1);
    else from.setFullYear(2000);
    return { from: from.toISOString().slice(0, 10), to };
}

function inRange(dateStr: string | undefined, from: string, to: string) {
    if (!dateStr) return false;
    const d = dateStr.slice(0, 10);
    return d >= from && d <= to;
}

// ── KPI Card ─────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color, trend }:
    { label: string; value: string; sub?: string; icon: React.ElementType; color: string; trend?: 'up' | 'down' | null }) {
    return (
        <div className={`rounded-2xl border bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.05)] border-border/50 relative overflow-hidden`}>
            <div className={`absolute inset-x-0 top-0 h-1 ${color}`} />
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className="text-xl font-black text-foreground tabular-nums mt-0.5 leading-tight">{value}</p>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                </div>
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${color.replace('bg-', 'bg-').replace('500', '500/15')}`}>
                    <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
                </div>
            </div>
            {trend && (
                <div className={`mt-2 flex items-center gap-1 text-xs font-bold ${trend === 'up' ? 'text-emerald-500' : 'text-red-500'}`}>
                    {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{trend === 'up' ? 'ارتفاع' : 'انخفاض'}</span>
                </div>
            )}
        </div>
    );
}

// ── Section Title ─────────────────────────────────────────────
function SecTitle({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="mb-3">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
    );
}

// ── Card wrapper ──────────────────────────────────────────────
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]', className)}>
            {children}
        </div>
    );
}

// ── Custom Tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-border bg-card shadow-xl px-3 py-2 text-xs">
            <p className="font-bold text-foreground mb-1">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
                    {p.name}: {fmt(p.value)} ج.م
                </p>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MAIN REPORTS PAGE
// ═══════════════════════════════════════════════════════════════
export default function ReportsPage() {
    const [dateRange, setDateRange] = useState<DateRange>('month');
    const [activeTab, setActiveTab] = useState('overview');

    // ── Raw Data ───────────────────────────────────────────────
    const allSales = useMemo(() => getAllSales(), []);
    const mobiles = useMemo(() => getMobiles(), []);
    const mobileAcc = useMemo(() => getMobileAccessories(), []);
    const computers = useMemo(() => getComputers(), []);
    const computerAcc = useMemo(() => getComputerAccessories(), []);
    const devices = useMemo(() => getDevices(), []);
    const deviceAcc = useMemo(() => getDeviceAccessories(), []);
    const cars = useMemo(() => getCars(), []);
    const maintenance = useMemo(() => getMaintenanceOrders(), []);
    const contracts = useMemo(() => getContracts(), []);
    const expenses = useMemo(() => getExpenses(), []);
    const damagedItems = useMemo(() => getDamagedItems(), []);
    const otherRevenues = useMemo(() => getOtherRevenues(), []);
    // #18 FIX: New module data
    const suppliers = useMemo(() => getSuppliers(), []);
    const supplierTxns = useMemo(() => getSupplierTransactions(), []);
    const wallets = useMemo(() => getWallets(), []);
    const walletTxns = useMemo(() => getWalletTransactions(), []);
    const employees = useMemo(() => getEmployees(), []);

    // ── Date filtering ─────────────────────────────────────────
    const { from, to } = getDateRange(dateRange);
    const sales = useMemo(
        () => allSales.filter(s => !s.voidedAt && inRange(s.date, from, to)),
        [allSales, from, to]
    );
    const filteredMaint = useMemo(
        () => maintenance.filter(m => inRange(m.createdAt, from, to)),
        [maintenance, from, to]
    );
    const filteredExpenses = useMemo(
        () => expenses.filter(e => inRange(e.date, from, to)),
        [expenses, from, to]
    );
    const filteredContracts = useMemo(
        () => contracts.filter(c => inRange(c.createdAt ?? c.date, from, to)),
        [contracts, from, to]
    );

    // ── Core KPIs ─────────────────────────────────────────────
    const totalRevenue = useMemo(() => sales.reduce((s, x) => s + x.total, 0), [sales]);
    const totalProfit = useMemo(() => sales.reduce((s, x) => s + (x.grossProfit ?? 0), 0), [sales]);
    const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + e.amount, 0), [filteredExpenses]);
    const maintRevenue = useMemo(() => filteredMaint.reduce((s, m) => s + m.totalSale, 0), [filteredMaint]);
    const maintProfit = useMemo(() => filteredMaint.reduce((s, m) => s + m.netProfit, 0), [filteredMaint]);
    const totalOtherRev = useMemo(() => otherRevenues.filter(o => inRange(o.date, from, to)).reduce((s, o) => s + o.amount, 0), [otherRevenues, from, to]);
    const totalDamaged = useMemo(() => damagedItems.filter(d => inRange(d.date, from, to)).reduce((s, d) => s + d.totalLoss, 0), [damagedItems, from, to]);
    const netProfit = totalProfit + maintProfit + totalOtherRev - totalExpenses - totalDamaged;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgInvoice = sales.length > 0 ? totalRevenue / sales.length : 0;

    // ── Inventory Values ──────────────────────────────────────
    const mobileInvValue = useMemo(() => mobiles.reduce((s, m) => s + (getWeightedAvgCost(m.id) || m.newCostPrice) * (m.quantity || 1), 0), [mobiles]);
    const computerInvValue = useMemo(() => computers.reduce((s, c) => s + (getWeightedAvgCost(c.id) || c.newCostPrice) * (c.quantity || 1), 0), [computers]);
    const deviceInvValue = useMemo(() => devices.reduce((s, d) => s + (getWeightedAvgCost(d.id) || d.newCostPrice) * (d.quantity || 1), 0), [devices]);
    const carsInvValue = useMemo(() => cars.reduce((s, c) => s + c.purchasePrice, 0), [cars]);
    const totalInvValue = mobileInvValue + computerInvValue + deviceInvValue + carsInvValue;

    // ── Daily Sales for chart ─────────────────────────────────
    const dailyData = useMemo(() => {
        const days = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : 90;
        return Array.from({ length: Math.min(days, 30) }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (Math.min(days, 30) - 1 - i));
            const ds = d.toISOString().slice(0, 10);
            const daySales = sales.filter(s => s.date?.startsWith(ds));
            const dayMaint = filteredMaint.filter(m => (m.createdAt ?? '').startsWith(ds));
            return {
                date: `${d.getDate()}/${d.getMonth() + 1}`,
                مبيعات: daySales.reduce((s, x) => s + x.total, 0),
                ربح: daySales.reduce((s, x) => s + (x.grossProfit ?? 0), 0),
                صيانة: dayMaint.reduce((s, m) => s + m.totalSale, 0),
            };
        });
    }, [sales, filteredMaint, dateRange]);

    // ── Monthly for 12-month chart ────────────────────────────
    const monthlyData = useMemo(() => Array.from({ length: 12 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (11 - i));
        const yy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0');
        const prefix = `${yy}-${mm}`;
        const mSales = allSales.filter(s => !s.voidedAt && s.date?.startsWith(prefix));
        const mMaint = maintenance.filter(m => (m.createdAt ?? '').startsWith(prefix));
        const mExp = expenses.filter(e => (e.date ?? '').startsWith(prefix));
        return {
            شهر: MONTHS_AR[d.getMonth()],
            مبيعات: mSales.reduce((s, x) => s + x.total, 0),
            ربح: mSales.reduce((s, x) => s + (x.grossProfit ?? 0), 0),
            صيانة: mMaint.reduce((s, m) => s + m.totalSale, 0),
            مصروفات: mExp.reduce((s, e) => s + e.amount, 0),
        };
    }), [allSales, maintenance, expenses]);

    // ── Revenue distribution pie ──────────────────────────────
    const revenuePie = useMemo(() => {
        const data = [
            { name: 'موبيلات', value: 0 },
            { name: 'كمبيوترات', value: 0 },
            { name: 'أجهزة', value: 0 },
            { name: 'سيارات', value: 0 },
            { name: 'صيانة', value: maintRevenue },
        ];
        sales.forEach(sale => {
            (sale.items ?? []).forEach((item: any) => {
                const src = item.source ?? '';
                const rev = (item.qty ?? item.quantity ?? 1) * (item.price ?? 0);
                if (src.includes('mobile')) data[0].value += rev;
                else if (src.includes('computer')) data[1].value += rev;
                else if (src.includes('device')) data[2].value += rev;
                else if (src.includes('car')) data[3].value += rev;
                else data[0].value += rev;
            });
        });
        return data.filter(d => d.value > 0);
    }, [sales, maintRevenue]);

    // ── Payment methods ───────────────────────────────────────
    const paymentData = useMemo(() => [
        { name: 'كاش', value: sales.filter(s => s.paymentMethod === 'cash').length },
        { name: 'كارت', value: sales.filter(s => s.paymentMethod === 'card').length },
        { name: 'مختلط', value: sales.filter(s => s.paymentMethod === 'split').length },
    ].filter(d => d.value > 0), [sales]);

    // ── Best sellers ──────────────────────────────────────────
    const bestSellers = useMemo(() => {
        const map: Record<string, { name: string; count: number; revenue: number; profit: number }> = {};
        sales.forEach(sale => {
            (sale.items ?? []).forEach((item: any) => {
                const k = item.productId ?? item.name;
                if (!map[k]) map[k] = { name: item.name ?? k, count: 0, revenue: 0, profit: 0 };
                map[k].count += item.quantity ?? item.qty ?? 1;
                map[k].revenue += (item.price ?? 0) * (item.quantity ?? item.qty ?? 1);
                map[k].profit += ((item.price ?? 0) - (item.cost ?? 0)) * (item.quantity ?? item.qty ?? 1);
            });
        });
        return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    }, [sales]);

    // ── Expense breakdown ─────────────────────────────────────
    const expenseMap: Record<string, string> = {
        rent: 'إيجار', utilities: 'مرافق', salaries: 'رواتب',
        supplies: 'مستلزمات', maintenance: 'صيانة', transport: 'مواصلات', other: 'أخرى',
    };
    const expensePie = useMemo(() => {
        const map: Record<string, number> = {};
        filteredExpenses.forEach(e => { map[e.category] = (map[e.category] ?? 0) + e.amount; });
        return Object.entries(map).map(([k, v]) => ({ name: expenseMap[k] ?? k, value: v })).sort((a, b) => b.value - a.value);
    }, [filteredExpenses]);

    // ── Maintenance status ────────────────────────────────────
    const maintStatus = useMemo(() => [
        { name: 'انتظار', value: filteredMaint.filter(m => m.status === 'pending').length, color: '#f59e0b' },
        { name: 'قيد الإصلاح', value: filteredMaint.filter(m => m.status === 'in_progress').length, color: '#3b82f6' },
        { name: 'تم الإصلاح', value: filteredMaint.filter(m => m.status === 'done').length, color: '#10b981' },
        { name: 'تم التسليم', value: filteredMaint.filter(m => m.status === 'delivered').length, color: '#6b7280' },
    ], [filteredMaint]);

    // ── Installments ──────────────────────────────────────────
    const totalInstall = filteredContracts.reduce((s, c) => s + c.installmentPrice, 0);
    const totalCollected = filteredContracts.reduce((s, c) => s + c.paidTotal, 0);
    const totalRemaining = filteredContracts.reduce((s, c) => s + c.remaining, 0);
    const overdueCount = filteredContracts.filter(c => c.status === 'overdue').length;

    // ── Tabs ──────────────────────────────────────────────────
    const TABS = [
        { id: 'overview', label: 'لمحة عامة', icon: BarChart3 },
        { id: 'sales', label: 'المبيعات', icon: ShoppingCart },
        { id: 'inventory', label: 'المخزون', icon: Package },
        { id: 'pnl', label: 'الأرباح والخسائر', icon: TrendingUp },
        { id: 'maintenance', label: 'الصيانة', icon: Wrench },
        { id: 'installments', label: 'التقسيط', icon: CreditCard },
        { id: 'expenses', label: 'المصروفات', icon: TrendingDown },
        { id: 'suppliers', label: 'الموردون', icon: Users },
        { id: 'wallets', label: 'المحافظ', icon: Receipt },
        { id: 'employees', label: 'الموظفون', icon: FileText },
    ];

    return (
        <div className="space-y-6 pb-10 animate-fade-in" dir="rtl">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">التقارير</h1>
                        <p className="text-xs text-muted-foreground">تحليل شامل لأداء المنشأة</p>
                    </div>
                </div>
                {/* Date range filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    {(Object.keys(DATE_LABELS) as DateRange[]).map(r => (
                        <button key={r} onClick={() => setDateRange(r)}
                            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                dateRange === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>
                            {DATE_LABELS[r]}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-muted/40 rounded-xl p-1 overflow-x-auto">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                                activeTab === tab.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                            <Icon className="h-3.5 w-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ═══════════════════════════════════════════════
          TAB: لمحة عامة
          ═══════════════════════════════════════════════ */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي المبيعات" value={`${fmt(totalRevenue)} ج.م`} sub={`${sales.length} فاتورة`} icon={ShoppingCart} color="bg-primary" trend={totalRevenue > 0 ? 'up' : null} />
                        <KPICard label="صافي الربح" value={`${netProfit >= 0 ? '+' : ''}${fmt(netProfit)} ج.م`} sub={`هامش ${profitMargin.toFixed(1)}%`} icon={TrendingUp} color={netProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'} trend={netProfit >= 0 ? 'up' : 'down'} />
                        <KPICard label="إيراد الصيانة" value={`${fmt(maintRevenue)} ج.م`} sub={`${filteredMaint.length} طلب`} icon={Wrench} color="bg-violet-500" />
                        <KPICard label="قيمة المخزون" value={`${fmt(totalInvValue)} ج.م`} sub={`${mobiles.length + computers.length + devices.length + cars.length} صنف`} icon={Package} color="bg-amber-500" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="متوسط الفاتورة" value={`${fmt(avgInvoice)} ج.م`} icon={Receipt} color="bg-blue-500" />
                        <KPICard label="إجمالي المصروفات" value={`${fmt(totalExpenses)} ج.م`} icon={TrendingDown} color="bg-red-500" trend={totalExpenses > 0 ? 'down' : null} />
                        <KPICard label="إيرادات أخرى" value={`${fmt(totalOtherRev)} ج.م`} icon={DollarSign} color="bg-cyan-500" />
                        <KPICard label="خسائر الهالك" value={`${fmt(totalDamaged)} ج.م`} icon={AlertTriangle} color="bg-orange-500" />
                    </div>

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        {/* Daily trend */}
                        <Card>
                            <SecTitle title="اتجاه المبيعات والأرباح" sub="يومياً خلال الفترة المحددة" />
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={dailyData}>
                                    <defs>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={45} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend />
                                    <Area type="monotone" dataKey="مبيعات" stroke="#6366f1" fill="url(#salesGrad)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="ربح" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Card>

                        {/* Revenue pie */}
                        <Card>
                            <SecTitle title="توزيع الإيرادات" sub="حسب الفئة" />
                            {revenuePie.length === 0 ? (
                                <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">لا توجد بيانات</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie data={revenuePie} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {revenuePie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => [`${fmt(v)} ج.م`, '']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </div>

                    {/* Monthly trend */}
                    <Card>
                        <SecTitle title="الاتجاه الشهري — آخر 12 شهر" sub="مبيعات + صيانة + مصروفات" />
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis dataKey="شهر" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={50} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend />
                                <Bar dataKey="مبيعات" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="صيانة" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: المبيعات
          ═══════════════════════════════════════════════ */}
            {activeTab === 'sales' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي المبيعات" value={`${fmt(totalRevenue)} ج.م`} sub={`${sales.length} فاتورة`} icon={ShoppingCart} color="bg-primary" />
                        <KPICard label="إجمالي الربح" value={`${fmt(totalProfit)} ج.م`} sub={`${profitMargin.toFixed(1)}% هامش`} icon={TrendingUp} color="bg-emerald-500" />
                        <KPICard label="متوسط الفاتورة" value={`${fmt(avgInvoice)} ج.م`} icon={Receipt} color="bg-blue-500" />
                        <KPICard label="فواتير اليوم" value={`${allSales.filter(s => !s.voidedAt && s.date?.startsWith(new Date().toISOString().slice(0, 10))).length}`} sub="مقارنة بالفترة المحددة" icon={Calendar} color="bg-amber-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="مبيعات وأرباح يومية" />
                            <ResponsiveContainer width="100%" height={260}>
                                <LineChart data={dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={50} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend />
                                    <Line type="monotone" dataKey="مبيعات" stroke="#6366f1" strokeWidth={2.5} dot={false} />
                                    <Line type="monotone" dataKey="ربح" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                                </LineChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card>
                            <SecTitle title="طرق الدفع" />
                            {paymentData.length === 0 ? (
                                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">لا توجد مبيعات</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={paymentData} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                            {paymentData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => [`${v} فاتورة`, '']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>
                    </div>

                    {/* Best Sellers Table */}
                    <Card>
                        <SecTitle title="أكثر المنتجات مبيعًا" sub={`خلال ${DATE_LABELS[dateRange]}`} />
                        {bestSellers.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">لا توجد مبيعات في الفترة المحددة</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/30">
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">#</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الكمية</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الإيراد</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الربح</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bestSellers.map((p, i) => (
                                            <tr key={i} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3">
                                                    <span className={`text-xs font-black ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-medium text-foreground max-w-[200px] truncate">{p.name}</td>
                                                <td className="py-2.5 px-3 tabular-nums text-muted-foreground">{p.count}</td>
                                                <td className="py-2.5 px-3 tabular-nums font-bold">{fmt(p.revenue)} ج.م</td>
                                                <td className={`py-2.5 px-3 tabular-nums font-bold ${p.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(p.profit)} ج.م</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: المخزون
          ═══════════════════════════════════════════════ */}
            {activeTab === 'inventory' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي قيمة المخزون" value={`${fmt(totalInvValue)} ج.م`} icon={Package} color="bg-primary" />
                        <KPICard label="قيمة الموبيلات" value={`${fmt(mobileInvValue)} ج.م`} sub={`${mobiles.length} نوع`} icon={Smartphone} color="bg-cyan-500" />
                        <KPICard label="قيمة الكمبيوترات" value={`${fmt(computerInvValue)} ج.م`} sub={`${computers.length} نوع`} icon={Monitor} color="bg-indigo-500" />
                        <KPICard label="قيمة الأجهزة" value={`${fmt(deviceInvValue)} ج.م`} sub={`${devices.length} نوع`} icon={Tv} color="bg-amber-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="توزيع قيمة المخزون" />
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie dataKey="value" cx="50%" cy="50%" outerRadius={100} innerRadius={60}
                                        data={[
                                            { name: 'موبيلات', value: mobileInvValue },
                                            { name: 'كمبيوترات', value: computerInvValue },
                                            { name: 'أجهزة', value: deviceInvValue },
                                            { name: 'سيارات', value: carsInvValue },
                                        ].filter(d => d.value > 0)}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                        {[0, 1, 2, 3].map(i => <Cell key={i} fill={CHART_COLORS[i]} />)}
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [`${fmt(v)} ج.م`, '']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </Card>

                        <div className="space-y-4">
                            {[
                                { label: 'الموبيلات', inStock: mobiles.filter(m => (m.quantity || 0) > 0).length, total: mobiles.length, color: 'bg-cyan-500', textColor: 'text-cyan-500' },
                                { label: 'الكمبيوترات', inStock: computers.filter(c => (c.quantity || 0) > 0).length, total: computers.length, color: 'bg-indigo-500', textColor: 'text-indigo-500' },
                                { label: 'الأجهزة', inStock: devices.filter(d => (d.quantity || 0) > 0).length, total: devices.length, color: 'bg-amber-500', textColor: 'text-amber-500' },
                                { label: 'السيارات', inStock: cars.length, total: cars.length, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
                            ].map(h => {
                                const pctH = h.total > 0 ? Math.round((h.inStock / h.total) * 100) : 0;
                                return (
                                    <Card key={h.label}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-foreground">{h.label}</span>
                                            <span className={`text-sm font-black ${h.textColor}`}>{h.inStock}/{h.total} ({pctH}%)</span>
                                        </div>
                                        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-700 ${h.color}`} style={{ width: `${pctH}%` }} />
                                        </div>
                                        <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                                            <span>في المخزن: {h.inStock}</span>
                                            <span>نفد: {h.total - h.inStock}</span>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cars breakdown */}
                    <Card>
                        <SecTitle title="تفاصيل السيارات" sub={`${cars.length} سيارة`} />
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <KPICard label="جديدة" value={`${cars.filter(c => c.condition === 'new').length}`} icon={Car} color="bg-emerald-500" />
                            <KPICard label="مستعملة" value={`${cars.filter(c => c.condition === 'used').length}`} icon={Car} color="bg-amber-500" />
                            <KPICard label="رأس المال" value={`${fmt(carsInvValue)} ج.م`} icon={DollarSign} color="bg-blue-500" />
                            <KPICard label="متوسط السعر" value={`${fmt(cars.length > 0 ? carsInvValue / cars.length : 0)} ج.م`} icon={TrendingUp} color="bg-violet-500" />
                        </div>
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: الأرباح والخسائر
          ═══════════════════════════════════════════════ */}
            {activeTab === 'pnl' && (
                <div className="space-y-6">
                    {/* P&L summary */}
                    <Card className="border-2 border-primary/20">
                        <SecTitle title="ملخص الأرباح والخسائر" sub={DATE_LABELS[dateRange]} />
                        <div className="space-y-3">
                            {[
                                { label: '+ أرباح المبيعات', value: totalProfit, positive: true },
                                { label: '+ أرباح الصيانة', value: maintProfit, positive: true },
                                { label: '+ إيرادات أخرى', value: totalOtherRev, positive: true },
                                { label: '─ المصروفات', value: totalExpenses, positive: false },
                                { label: '─ خسائر الهالك', value: totalDamaged, positive: false },
                            ].map(({ label, value, positive }) => (
                                <div key={label} className="flex items-center justify-between py-2 border-b border-border/20">
                                    <div className="flex items-center gap-2">
                                        <span className={`h-2 w-2 rounded-full ${positive ? 'bg-emerald-500' : 'bg-red-400'}`} />
                                        <span className="text-sm font-medium text-foreground">{label}</span>
                                    </div>
                                    <span className={`font-bold tabular-nums ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {positive ? '+' : '-'}{fmt(Math.abs(value))} ج.م
                                    </span>
                                </div>
                            ))}
                            <div className={`mt-2 rounded-xl p-4 flex items-center justify-between ${netProfit >= 0 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                <span className="text-lg font-bold text-foreground">صافي الربح</span>
                                <span className={`text-3xl font-black tabular-nums ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {netProfit >= 0 ? '+' : ''}{fmt(netProfit)} ج.م
                                </span>
                            </div>
                        </div>
                    </Card>

                    {/* Monthly P&L chart */}
                    <Card>
                        <SecTitle title="اتجاه الربح الشهري" />
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis dataKey="شهر" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={50} />
                                <Tooltip content={<ChartTooltip />} />
                                <Legend />
                                <Bar dataKey="ربح" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="مصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: الصيانة
          ═══════════════════════════════════════════════ */}
            {activeTab === 'maintenance' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي الإيراد" value={`${fmt(maintRevenue)} ج.م`} sub={`${filteredMaint.length} طلب`} icon={Wrench} color="bg-violet-500" />
                        <KPICard label="صافي الربح" value={`${fmt(maintProfit)} ج.م`} icon={TrendingUp} color="bg-emerald-500" />
                        <KPICard label="متوسط ربح الطلب" value={`${fmt(filteredMaint.length > 0 ? maintProfit / filteredMaint.length : 0)} ج.م`} icon={Receipt} color="bg-blue-500" />
                        <KPICard label="معدل الإنجاز" value={`${filteredMaint.length > 0 ? Math.round((filteredMaint.filter(m => m.status === 'done' || m.status === 'delivered').length / filteredMaint.length) * 100) : 0}%`} icon={Percent} color="bg-cyan-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="حالة الطلبات" />
                            {filteredMaint.length === 0 ? (
                                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">لا توجد طلبات</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={maintStatus.filter(s => s.value > 0)} cx="50%" cy="50%" outerRadius={90} innerRadius={50} dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                            {maintStatus.filter(s => s.value > 0).map((s, i) => <Cell key={i} fill={s.color} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => [`${v} طلب`, '']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>

                        <Card>
                            <SecTitle title="تفاصيل الحالات" />
                            <div className="space-y-4 mt-2">
                                {maintStatus.map(s => (
                                    <div key={s.name} className="flex items-center justify-between p-3 rounded-xl border border-border/40">
                                        <div className="flex items-center gap-2">
                                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
                                            <span className="font-medium text-sm">{s.name}</span>
                                        </div>
                                        <span className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: التقسيط
          ═══════════════════════════════════════════════ */}
            {activeTab === 'installments' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي التقسيط" value={`${fmt(totalInstall)} ج.م`} sub={`${filteredContracts.length} عقد`} icon={FileText} color="bg-primary" />
                        <KPICard label="المحصّل" value={`${fmt(totalCollected)} ج.م`} sub={`${totalInstall > 0 ? Math.round((totalCollected / totalInstall) * 100) : 0}%`} icon={TrendingUp} color="bg-emerald-500" />
                        <KPICard label="المتبقي" value={`${fmt(totalRemaining)} ج.م`} icon={CreditCard} color="bg-amber-500" />
                        <KPICard label="عقود متأخرة" value={`${overdueCount}`} sub={overdueCount > 0 ? 'تحتاج متابعة!' : 'لا متأخرات'} icon={AlertTriangle} color={overdueCount > 0 ? 'bg-red-500' : 'bg-emerald-500'} trend={overdueCount > 0 ? 'down' : 'up'} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="توزيع التحصيل" />
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie data={[
                                        { name: 'محصّل', value: totalCollected },
                                        { name: 'متبقي', value: totalRemaining },
                                    ].filter(d => d.value > 0)} cx="50%" cy="50%" outerRadius={90} innerRadius={60} dataKey="value">
                                        <Cell fill="#10b981" />
                                        <Cell fill="#f59e0b" />
                                    </Pie>
                                    <Tooltip formatter={(v: number) => [`${fmt(v)} ج.م`, '']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </Card>

                        <Card>
                            <SecTitle title="إحصائيات العقود" />
                            <div className="space-y-3 mt-2">
                                {[
                                    { label: 'نشط', count: filteredContracts.filter(c => c.status === 'active').length, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                                    { label: 'مكتمل', count: filteredContracts.filter(c => c.status === 'paid').length, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                                    { label: 'متأخر', count: overdueCount, color: 'text-red-500', bg: 'bg-red-500/10' },
                                    { label: 'ملغي', count: filteredContracts.filter(c => c.status === 'cancelled').length, color: 'text-muted-foreground', bg: 'bg-muted/30' },
                                ].map(s => (
                                    <div key={s.label} className={`flex items-center justify-between p-3 rounded-xl ${s.bg}`}>
                                        <span className="font-medium text-sm">{s.label}</span>
                                        <span className={`text-2xl font-black ${s.color}`}>{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: المصروفات
          ═══════════════════════════════════════════════ */}
            {activeTab === 'expenses' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <KPICard label="إجمالي المصروفات" value={`${fmt(totalExpenses)} ج.م`} sub={`${filteredExpenses.length} بند`} icon={TrendingDown} color="bg-red-500" trend={totalExpenses > 0 ? 'down' : null} />
                        <KPICard label="متوسط المصروف" value={`${fmt(filteredExpenses.length > 0 ? totalExpenses / filteredExpenses.length : 0)} ج.م`} icon={Receipt} color="bg-orange-500" />
                        <KPICard label="خسائر الهالك" value={`${fmt(totalDamaged)} ج.م`} icon={AlertTriangle} color="bg-amber-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="توزيع المصروفات" />
                            {expensePie.length === 0 ? (
                                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">لا توجد مصروفات</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie data={expensePie} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                            {expensePie.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                        </Pie>
                                        <Tooltip formatter={(v: number) => [`${fmt(v)} ج.م`, '']} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </Card>

                        <Card>
                            <SecTitle title="تفاصيل الفئات" />
                            {expensePie.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">لا توجد مصروفات في الفترة المحددة</p>
                            ) : (
                                <div className="space-y-3">
                                    {expensePie.map((e, i) => (
                                        <div key={e.name} className="space-y-1.5">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-semibold">{e.name}</span>
                                                <span className="font-bold tabular-nums">{fmt(e.value)} ج.م ({totalExpenses > 0 ? Math.round((e.value / totalExpenses) * 100) : 0}%)</span>
                                            </div>
                                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${totalExpenses > 0 ? (e.value / totalExpenses) * 100 : 0}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>

                    {/* Monthly expenses trend */}
                    <Card>
                        <SecTitle title="اتجاه المصروفات الشهري" />
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={monthlyData}>
                                <defs>
                                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                                <XAxis dataKey="شهر" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={fmtK} tick={{ fontSize: 10 }} width={50} />
                                <Tooltip content={<ChartTooltip />} />
                                <Area type="monotone" dataKey="مصروفات" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Card>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: الموردون
          ═══════════════════════════════════════════════ */}
            {activeTab === 'suppliers' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="عدد الموردين" value={`${suppliers.length}`} sub="مورد نشط" icon={Users} color="bg-primary" />
                        <KPICard label="إجمالي المستحقات" value={`${fmt(getTotalOwedToSuppliers())} ج.م`} sub="ديون للموردين" icon={TrendingDown} color="bg-red-500" trend={getTotalOwedToSuppliers() > 0 ? 'down' : null} />
                        <KPICard label="موردين مديونين" value={`${suppliers.filter(s => s.balance > 0).length}`} sub="يستحقون سداد" icon={AlertTriangle} color="bg-orange-500" />
                        <KPICard label="عمليات الشراء" value={`${supplierTxns.filter(t => t.type === 'purchase').length}`} sub="إجمالي فواتير" icon={Receipt} color="bg-violet-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="الموردون حسب المستحقات" sub="مرتب تنازلياً" />
                            {suppliers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">لا يوجد موردون مسجلون</p>
                            ) : (
                                <div className="space-y-2">
                                    {[...suppliers].sort((a, b) => b.balance - a.balance).slice(0, 8).map((s, i) => (
                                        <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs font-black text-muted-foreground w-5">{i + 1}</span>
                                                <div>
                                                    <p className="font-semibold text-sm text-foreground">{s.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{s.phone}</p>
                                                </div>
                                            </div>
                                            <span className={`text-sm font-black tabular-nums ${s.balance > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {fmt(Math.abs(s.balance))} ج.م
                                                <span className="text-[10px] font-medium mr-1">{s.balance > 0 ? 'مستحق' : s.balance < 0 ? 'له رصيد' : 'مسوّى'}</span>
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>

                        <Card>
                            <SecTitle title="آخر معاملات الموردين" />
                            {supplierTxns.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">لا توجد معاملات</p>
                            ) : (
                                <div className="space-y-2">
                                    {[...supplierTxns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((t) => (
                                        <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30">
                                            <div>
                                                <p className="text-xs font-semibold text-foreground">{t.type === 'purchase' ? '🛒 شراء' : t.type === 'payment' ? '💸 سداد' : '↩ مرتجع'}</p>
                                                <p className="text-[10px] text-muted-foreground">{t.date?.slice(0, 10)}</p>
                                            </div>
                                            <span className={`text-sm font-black tabular-nums ${t.type === 'purchase' ? 'text-red-500' : 'text-emerald-500'}`}>
                                                {t.type === 'purchase' ? '+' : '-'}{fmt(t.amount)} ج.م
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: المحافظ
          ═══════════════════════════════════════════════ */}
            {activeTab === 'wallets' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي الرصيد" value={`${fmt(getTotalBalance())} ج.م`} sub="كل المحافظ" icon={DollarSign} color="bg-emerald-500" />
                        <KPICard label="عدد المحافظ" value={`${wallets.length}`} sub="محافظ وحسابات" icon={Receipt} color="bg-primary" />
                        <KPICard label="معاملات الإيداع" value={`${walletTxns.filter(t => t.type === 'deposit').length}`} icon={TrendingUp} color="bg-blue-500" />
                        <KPICard label="معاملات السحب" value={`${walletTxns.filter(t => t.type === 'withdrawal').length}`} icon={TrendingDown} color="bg-red-500" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <Card>
                            <SecTitle title="رصيد كل محفظة" />
                            {wallets.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">لا توجد محافظ</p>
                            ) : (
                                <div className="space-y-3">
                                    {[...wallets].sort((a, b) => b.balance - a.balance).map(w => {
                                        const total = Math.max(getTotalBalance(), 1);
                                        const pctW = Math.round((w.balance / total) * 100);
                                        return (
                                            <div key={w.id} className="space-y-1.5">
                                                <div className="flex justify-between text-sm">
                                                    <span className="font-semibold text-foreground">{w.name}</span>
                                                    <span className={`font-black tabular-nums ${w.balance > 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(w.balance)} ج.م</span>
                                                </div>
                                                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${Math.max(pctW, 0)}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <Card>
                            <SecTitle title="آخر معاملات المحافظ" />
                            {walletTxns.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-8">لا توجد معاملات</p>
                            ) : (
                                <div className="space-y-2">
                                    {[...walletTxns].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30">
                                            <div>
                                                <p className="text-xs font-semibold text-foreground truncate max-w-[150px]">{t.reason}</p>
                                                <p className="text-[10px] text-muted-foreground">{t.date?.slice(0, 10)} — {t.type === 'deposit' ? 'إيداع' : t.type === 'withdrawal' ? 'سحب' : 'تحويل'}</p>
                                            </div>
                                            <span className={`text-sm font-black tabular-nums ${t.type === 'deposit' || t.type === 'transfer_in' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {t.type === 'deposit' || t.type === 'transfer_in' ? '+' : '-'}{fmt(t.amount)} ج.م
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </Card>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════
          TAB: الموظفون  
          ═══════════════════════════════════════════════ */}
            {activeTab === 'employees' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard label="إجمالي الموظفين" value={`${employees.length}`} sub="موظف مسجل" icon={Users} color="bg-primary" />
                        <KPICard label="موظفون نشطون" value={`${employees.filter(e => e.status === 'active').length}`} icon={TrendingUp} color="bg-emerald-500" />
                        <KPICard label="موظفون مستقيلون" value={`${employees.filter(e => e.status === 'resigned').length}`} icon={TrendingDown} color="bg-red-500" />
                        <KPICard label="إجمالي الرواتب" value={`${fmt(employees.reduce((s, e) => s + (e.salary || 0), 0))} ج.م`} sub="شهرياً" icon={DollarSign} color="bg-amber-500" />
                    </div>

                    <Card>
                        <SecTitle title="الموظفون" sub={`${employees.length} موظف مسجل`} />
                        {employees.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">لا يوجد موظفون مسجلون</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border/30">
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الاسم</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الوظيفة</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الراتب</th>
                                            <th className="py-2 px-3 text-right text-xs font-semibold text-muted-foreground">الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.map(e => (
                                            <tr key={e.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                                <td className="py-2.5 px-3 font-medium text-foreground">{e.name}</td>
                                                <td className="py-2.5 px-3 text-muted-foreground">{e.position || '—'}</td>
                                                <td className="py-2.5 px-3 font-bold tabular-nums">{fmt(e.salary || 0)} ج.م</td>
                                                <td className="py-2.5 px-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${e.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {e.status === 'active' ? 'نشط' : 'غير نشط'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                </div>
            )}

        </div>
    );
}
