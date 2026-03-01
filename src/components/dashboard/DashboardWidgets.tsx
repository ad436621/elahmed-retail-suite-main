// ============================================================
// Dashboard Sub-Components
// Extracted from Dashboard.tsx for clean separation of concerns
// ============================================================

import { useState, useRef, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, ArrowLeft, Search, X, Layers,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

export interface SearchResult {
    id: string;
    label: string;
    sub: string;
    route: string;
    badge: string;
    badgeColor: string;
}

// ─── Helpers ────────────────────────────────────────────────

export const fmt = (n: number) => n.toLocaleString('ar-EG');
export const pct = (a: number, b: number) => b ? ((a / b) * 100).toFixed(1) : '0';

// ─── Global Search Bar ──────────────────────────────────────

interface GlobalSearchProps {
    mobiles: any[];
    mobileAcc: any[];
    devices: any[];
    deviceAcc: any[];
    computers: any[];
    computerAcc: any[];
    maintenance: any[];
    contracts: any[];
    sales: any[];
}

export function GlobalSearch({
    mobiles, mobileAcc, devices, deviceAcc, computers, computerAcc,
    maintenance, contracts, sales,
}: GlobalSearchProps) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

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

        mobileAcc.filter(a => a.name?.toLowerCase().includes(ql) || a.subcategory?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(a => res.push({ id: `macc-${a.id}`, label: a.name, sub: `إكسسوار موبايل | ${a.subcategory || ''}`, route: '/mobiles', badge: 'إكسسوار', badgeColor: 'bg-cyan-50 text-cyan-600' }));

        devices.filter(d => d.name?.toLowerCase().includes(ql) || d.model?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(d => res.push({ id: `dev-${d.id}`, label: d.name, sub: `${d.model || ''} | ${d.color || ''}`, route: '/devices', badge: 'جهاز', badgeColor: 'bg-amber-100 text-amber-700' }));

        deviceAcc.filter(a => a.name?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(a => res.push({ id: `dacc-${a.id}`, label: a.name, sub: `إكسسوار أجهزة`, route: '/devices', badge: 'إكسسوار', badgeColor: 'bg-amber-50 text-amber-600' }));

        computers.filter(c => c.name?.toLowerCase().includes(ql) || c.model?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(c => res.push({ id: `comp-${c.id}`, label: c.name, sub: `${c.model || ''} | ${c.processor || ''}`, route: '/computers', badge: 'كمبيوتر', badgeColor: 'bg-indigo-100 text-indigo-700' }));

        computerAcc.filter(a => a.name?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(a => res.push({ id: `cacc-${a.id}`, label: a.name, sub: `إكسسوار كمبيوترات`, route: '/computers', badge: 'إكسسوار', badgeColor: 'bg-indigo-50 text-indigo-600' }));

        maintenance.filter(m => m.customerName?.toLowerCase().includes(ql) || m.deviceName?.toLowerCase().includes(ql) || m.orderNumber?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(m => res.push({ id: `mnt-${m.id}`, label: m.customerName, sub: `صيانة: ${m.deviceName} | ${m.orderNumber}`, route: '/maintenance', badge: 'صيانة', badgeColor: 'bg-orange-100 text-orange-700' }));

        contracts.filter(c => c.customerName?.toLowerCase().includes(ql) || c.productName?.toLowerCase().includes(ql) || c.contractNumber?.toLowerCase().includes(ql))
            .slice(0, 4).forEach(c => res.push({ id: `ins-${c.id}`, label: c.customerName, sub: `تقسيط: ${c.productName} | ${c.contractNumber}`, route: '/installments', badge: 'تقسيط', badgeColor: 'bg-blue-100 text-blue-700' }));

        sales.filter(s => s.invoiceNumber?.toLowerCase().includes(ql))
            .slice(0, 3).forEach(s => res.push({ id: `sale-${s.id}`, label: `فاتورة ${s.invoiceNumber}`, sub: `${s.date?.slice(0, 10) || ''} | ${fmt(s.total ?? 0)} ج.م`, route: '/sales', badge: 'مبيعات', badgeColor: 'bg-emerald-100 text-emerald-700' }));

        return res.slice(0, 12);
    }, [q, mobiles, mobileAcc, devices, deviceAcc, computers, computerAcc, maintenance, contracts, sales]);

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
                    className="h-12 w-full rounded-2xl border border-border/50 bg-card/80 pr-12 pl-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/50 transition-all shadow-xl"
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

// ─── Stat Card ──────────────────────────────────────────────

interface StatCardProps {
    icon: React.ElementType;
    label: string;
    value: string;
    sub?: string;
    color: string;
    trend?: 'up' | 'down';
    linkTo?: string;
}

export function StatCard({ icon: Icon, label, value, sub, color, trend, linkTo }: StatCardProps) {
    const card = (
        <div className={`group relative overflow-hidden rounded-3xl border border-border/50 bg-card/80 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 ${linkTo ? 'cursor-pointer' : ''}`}>
            <div className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${color} shadow-inner bg-gradient-to-br from-white/40 to-transparent`}>
                <Icon className="h-6 w-6" />
            </div>
            <p className="text-[1.65rem] font-extrabold text-foreground tabular-nums leading-none tracking-tight">{value}</p>
            {sub && <p className="mt-1.5 text-xs font-semibold text-muted-foreground">{sub}</p>}
            <p className="mt-3 text-sm font-bold text-muted-foreground">{label}</p>
            {trend === 'up' && <TrendingUp className="absolute top-5 left-5 h-5 w-5 text-emerald-500 opacity-50 bg-emerald-100/50 p-1 rounded-full" />}
            {trend === 'down' && <TrendingDown className="absolute top-5 left-5 h-5 w-5 text-red-500 opacity-50 bg-red-100/50 p-1 rounded-full" />}
            {linkTo && <ArrowLeft className="absolute bottom-5 left-5 h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors group-hover:-translate-x-1" />}
        </div>
    );
    if (linkTo) return <Link to={linkTo}>{card}</Link>;
    return card;
}

// ─── Section Header ─────────────────────────────────────────

export function SectionHeader({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="flex items-center gap-4 mb-6 relative pl-4">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 rounded-l-full bg-gradient-to-b from-primary to-primary/40 shadow-[0_0_12px_rgba(var(--primary),0.5)]" />
            <div className="pr-4">
                <h2 className="text-xl font-black text-foreground tracking-tight">{title}</h2>
                {sub && <p className="text-sm font-medium text-muted-foreground mt-1 bg-muted/50 px-2 py-0.5 rounded-full inline-block">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Bar Row ────────────────────────────────────────────────

export function BarRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
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

// ─── Category Card ──────────────────────────────────────────

interface CategoryCardProps {
    icon: React.ElementType;
    iconBg: string;
    label: string;
    sub: string;
    gradient: string;
    to: string;
    items: { label: string; route: string; state?: object }[];
}

export function CategoryCard({ icon: Icon, iconBg, label, sub, gradient, to, items }: CategoryCardProps) {
    const [open, setOpen] = useState(false);
    return (
        <div className="relative">
            <button onClick={() => setOpen(o => !o)}
                className={`group w-full rounded-3xl border border-white/20 bg-gradient-to-br ${gradient} p-6 shadow-xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 text-right overflow-hidden relative`}>
                <div className="absolute -left-8 -top-8 h-32 w-32 rounded-full bg-white/30 blur-3xl pointer-events-none group-hover:scale-150 transition-transform duration-700" />
                <div className={`mb-4 relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg} shadow-lg ring-4 ring-white/30`}>
                    <Icon className="h-7 w-7 text-white" />
                </div>
                <p className="text-xl relative z-10 font-black text-slate-800 tracking-tight">{label}</p>
                <p className="text-sm relative z-10 font-semibold text-slate-600/80 mt-1">{sub}</p>
            </button>
            {open && (
                <div className="absolute top-full mt-2 right-0 left-0 z-40 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-scale-in">
                    {items.map(it => (
                        <Link key={it.route} to={it.route} state={it.state} onClick={() => setOpen(false)}
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
