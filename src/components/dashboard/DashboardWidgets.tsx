// ============================================================
// Dashboard Sub-Components — Professional SaaS Grade
// Design principles:
//   · 8pt spacing system (4, 8, 12, 16, 24, 32, 40)
//   · Numbers are heroes — icons support, not dominate
//   · Unified shadow: 0 4px 12px rgba(0,0,0,0.06)
//   · One primary accent per card — not multi-color
//   · Clear hover affordance for every clickable element
// ============================================================

import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, ArrowLeft, Search, X, ChevronLeft,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────
export const fmt = (n: number) =>
    n >= 1_000_000
        ? (n / 1_000_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' م'
        : n >= 1_000
            ? (n / 1_000).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' ك'
            : n.toLocaleString('ar-EG');

export const fmtFull = (n: number) => n.toLocaleString('ar-EG');
export const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : '0');

// ─── Global Search ─────────────────────────────────────────────
interface SearchResult {
    id: string; label: string; sub: string; route: string;
    badge: string; accent: string;
}
interface GlobalSearchProps {
    mobiles: any[]; mobileAcc: any[]; devices: any[]; deviceAcc: any[];
    computers: any[]; computerAcc: any[]; maintenance: any[];
    contracts: any[]; sales: any[];
}

export function GlobalSearch({
    mobiles, mobileAcc, devices, deviceAcc, computers, computerAcc,
    maintenance, contracts, sales,
}: GlobalSearchProps) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const nav = useNavigate();

    useEffect(() => {
        const h = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const results = useMemo<SearchResult[]>(() => {
        if (!q.trim() || q.length < 2) return [];
        const ql = q.toLowerCase();
        const res: SearchResult[] = [];
        mobiles.filter(m => m.name?.toLowerCase().includes(ql) || m.serialNumber?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(m => res.push({ id: `mob-${m.id}`, label: m.name, sub: m.color || '', route: '/mobiles', badge: 'موبايل', accent: 'text-cyan-500' }));
        devices.filter(d => d.name?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(d => res.push({ id: `dev-${d.id}`, label: d.name, sub: d.model || '', route: '/devices', badge: 'جهاز', accent: 'text-amber-500' }));
        computers.filter(c => c.name?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(c => res.push({ id: `comp-${c.id}`, label: c.name, sub: c.processor || '', route: '/computers', badge: 'كمبيوتر', accent: 'text-indigo-500' }));
        maintenance.filter(m => m.customerName?.toLowerCase().includes(ql) || m.deviceName?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(m => res.push({ id: `mnt-${m.id}`, label: m.customerName, sub: m.deviceName, route: '/maintenance', badge: 'صيانة', accent: 'text-orange-500' }));
        contracts.filter(c => c.customerName?.toLowerCase().includes(ql) || c.contractNumber?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(c => res.push({ id: `ins-${c.id}`, label: c.customerName, sub: c.contractNumber, route: '/installments', badge: 'تقسيط', accent: 'text-blue-500' }));
        sales.filter(s => s.invoiceNumber?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(s => res.push({ id: `sale-${s.id}`, label: `فاتورة ${s.invoiceNumber}`, sub: `${fmtFull(s.total ?? 0)} ج.م`, route: '/sales', badge: 'مبيعات', accent: 'text-emerald-500' }));
        return res.slice(0, 12);
    }, [q, mobiles, devices, computers, maintenance, contracts, sales]);

    return (
        <div ref={ref} className="relative w-full max-w-lg">
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                <input
                    value={q}
                    onChange={e => { setQ(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder="بحث... موبايل، عميل، فاتورة"
                    className="h-10 w-full rounded-xl border border-border/60 bg-background/60 pr-10 pl-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                    style={{ direction: 'rtl' }}
                />
                {q && (
                    <button onClick={() => { setQ(''); setOpen(false); }} className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            {open && q.length >= 2 && (
                <div className="absolute top-full mt-1.5 w-full z-50 rounded-xl border border-border bg-card shadow-xl overflow-hidden animate-fade-in max-h-72 overflow-y-auto">
                    {results.length === 0 ? (
                        <div className="px-4 py-5 text-center text-sm text-muted-foreground">لا توجد نتائج</div>
                    ) : results.map(r => (
                        <button key={r.id} onClick={() => { setOpen(false); setQ(''); nav(r.route); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/30 last:border-0 text-right">
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{r.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{r.sub}</p>
                            </div>
                            <span className={`text-[10px] font-bold tabular-nums shrink-0 ${r.accent}`}>{r.badge}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Hero KPI Card ─────────────────────────────────────────────
// The most important metric on the dashboard — large, clear, bold.
interface HeroKPIProps {
    label: string;
    value: string;
    sub?: string;
    accent: 'emerald' | 'blue' | 'red' | 'amber' | 'primary';
    trend?: 'up' | 'down';
    linkTo?: string;
}

const accentMap = {
    emerald: { border: 'border-emerald-500/30', val: 'text-emerald-500', sub: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    blue: { border: 'border-blue-500/30', val: 'text-blue-500', sub: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    red: { border: 'border-red-500/30', val: 'text-red-500', sub: 'bg-red-500/10 text-red-600 dark:text-red-400' },
    amber: { border: 'border-amber-500/30', val: 'text-amber-500', sub: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    primary: { border: 'border-primary/30', val: 'text-primary', sub: 'bg-primary/10 text-primary' },
};

export function HeroKPI({ label, value, sub, accent, trend, linkTo }: HeroKPIProps) {
    const a = accentMap[accent];
    const inner = (
        <div className={`
      group relative flex flex-col gap-3 rounded-2xl border bg-card p-6
      shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]
      transition-all duration-200 hover:-translate-y-0.5
      ${a.border} ${linkTo ? 'cursor-pointer' : ''}
    `}>
            {/* Label row */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-emerald-500" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
            </div>
            {/* Hero number */}
            <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black tabular-nums tracking-tighter leading-none ${a.val}`}>
                    {value}
                </span>
            </div>
            {/* Sub-label */}
            {sub && (
                <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${a.sub}`}>
                    {sub}
                </span>
            )}
            {linkTo && <ArrowLeft className="absolute bottom-4 left-4 h-4 w-4 text-muted-foreground/20 group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />}
        </div>
    );
    if (linkTo) return <Link to={linkTo}>{inner}</Link>;
    return inner;
}

// ─── Metric Pill ──────────────────────────────────────────────
// Secondary metrics — compact horizontal bar with left-accent stripe
interface MetricPillProps {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    linkTo?: string;
}

export function MetricPill({ icon: Icon, label, value, sub, linkTo }: MetricPillProps) {
    const inner = (
        <div className={`
      group flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3
      shadow-[0_1px_4px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
      hover:border-primary/20 hover:bg-muted/30 transition-all duration-150
      ${linkTo ? 'cursor-pointer' : ''}
    `}>
            <div className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-muted/60 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
                <p className="text-base font-bold text-foreground tabular-nums leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5 truncate">{sub}</p>}
            </div>
            {linkTo && <ChevronLeft className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 transition-colors" />}
        </div>
    );
    if (linkTo) return <Link to={linkTo}>{inner}</Link>;
    return inner;
}

// ─── Inventory Strip Row ───────────────────────────────────────
// Compact single-row representation of an inventory category
interface InventoryRowProps {
    icon: React.ElementType;
    label: string;
    count: number;
    value: number;
    accent: string; // tailwind text-xxx-500 class
    to: string;
}

export function InventoryRow({ icon: Icon, label, count, value, accent, to }: InventoryRowProps) {
    return (
        <Link to={to}
            className="group flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors cursor-pointer border-b border-border/30 last:border-0">
            <div className={`h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-muted transition-colors`}>
                <Icon className={`h-4 w-4 ${accent}`} />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
            <span className="text-xs text-muted-foreground font-medium tabular-nums">{count} وحدة</span>
            <div className="text-left shrink-0">
                <span className="text-sm font-bold text-foreground tabular-nums">{fmt(value)}</span>
                <span className="text-[10px] text-muted-foreground font-medium mr-0.5">ج.م</span>
            </div>
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
        </Link>
    );
}

// ─── Bar Row ──────────────────────────────────────────────────
export function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const p = total > 0 ? Math.min(100, (value / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">{label}</span>
                <span className="tabular-nums text-muted-foreground font-semibold">{fmtFull(value)} ج.م</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${p}%` }} />
            </div>
        </div>
    );
}

// ─── Section Label ────────────────────────────────────────────
export function SectionLabel({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div>
                <h2 className="text-base font-bold text-foreground tracking-tight">{title}</h2>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </div>
            {action}
        </div>
    );
}

// keep old exports for any remaining usages
export { SectionLabel as SectionHeader };
export function StatCard(props: any) { return null; } // deprecated — use HeroKPI or MetricPill
export function CategoryCard(props: any) { return null; } // deprecated — use InventoryRow
