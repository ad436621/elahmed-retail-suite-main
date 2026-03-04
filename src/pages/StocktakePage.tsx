// ============================================================
// صفحة جرد المخزون — Stocktake Page
// ============================================================

import { useState, useMemo } from 'react';
import { ClipboardCheck, Download, Search, CheckCircle2, AlertTriangle, Package } from 'lucide-react';
import { getMobiles } from '@/data/mobilesData';
import { getComputers } from '@/data/computersData';
import { getDevices } from '@/data/devicesData';
import { getCars } from '@/data/carsData';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

// ── Types ────────────────────────────────────────────────────
interface StocktakeItem {
    id: string;
    name: string;
    category: string;
    expectedQty: number;
    actualQty: number | null;
    difference: number;
    status: 'pending' | 'matched' | 'discrepancy';
}

interface StocktakeSession {
    id: string;
    date: string;
    items: StocktakeItem[];
    completedAt?: string;
    createdBy: string;
}

const STOCKTAKE_KEY = STORAGE_KEYS.STOCKTAKE ?? 'gx_stocktake';

// ── Component ────────────────────────────────────────────────
export default function StocktakePage() {
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [sessions] = useState<StocktakeSession[]>(() => getStorageItem<StocktakeSession[]>(STOCKTAKE_KEY, []));

    // Build current inventory for stocktake
    const inventoryItems = useMemo(() => {
        const items: StocktakeItem[] = [];
        getMobiles().forEach(m => items.push({
            id: m.id, name: m.name, category: 'موبيلات',
            expectedQty: m.quantity || 1, actualQty: null, difference: 0, status: 'pending',
        }));
        getComputers().forEach(c => items.push({
            id: c.id, name: c.name, category: 'كمبيوترات',
            expectedQty: c.quantity || 1, actualQty: null, difference: 0, status: 'pending',
        }));
        getDevices().forEach(d => items.push({
            id: d.id, name: d.name, category: 'أجهزة',
            expectedQty: d.quantity || 1, actualQty: null, difference: 0, status: 'pending',
        }));
        getCars().forEach(c => items.push({
            id: c.id, name: c.name, category: 'سيارات',
            expectedQty: 1, actualQty: null, difference: 0, status: 'pending',
        }));
        return items;
    }, []);

    const [items, setItems] = useState<StocktakeItem[]>(inventoryItems);

    const filtered = useMemo(() => {
        let list = items;
        if (activeCategory !== 'all') list = list.filter(i => i.category === activeCategory);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i => i.name.toLowerCase().includes(q));
        }
        return list;
    }, [items, activeCategory, search]);

    const categories = ['all', 'موبيلات', 'كمبيوترات', 'أجهزة', 'سيارات'];
    const catLabels: Record<string, string> = { all: 'الكل', 'موبيلات': 'موبيلات', 'كمبيوترات': 'كمبيوترات', 'أجهزة': 'أجهزة', 'سيارات': 'سيارات' };

    const countMatched = items.filter(i => i.status === 'matched').length;
    const countDiscrepancy = items.filter(i => i.status === 'discrepancy').length;
    const countPending = items.filter(i => i.status === 'pending').length;

    function updateActualQty(id: string, qty: string) {
        setItems(prev => prev.map(item => {
            if (item.id !== id) return item;
            const actual = qty === '' ? null : parseInt(qty);
            if (actual === null) return { ...item, actualQty: null, difference: 0, status: 'pending' as const };
            const diff = actual - item.expectedQty;
            return {
                ...item,
                actualQty: actual,
                difference: diff,
                status: diff === 0 ? 'matched' as const : 'discrepancy' as const,
            };
        }));
    }

    function saveStocktake() {
        const session: StocktakeSession = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            items: items.filter(i => i.actualQty !== null),
            completedAt: new Date().toISOString(),
            createdBy: 'current_user',
        };
        const existing = getStorageItem<StocktakeSession[]>(STOCKTAKE_KEY, []);
        setStorageItem(STOCKTAKE_KEY, [...existing, session]);
        alert('تم حفظ جلسة الجرد بنجاح ✅');
    }

    const fmt = (n: number) => n.toLocaleString('ar-EG');

    return (
        <div className="space-y-6 pb-10 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <ClipboardCheck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">جرد المخزون</h1>
                        <p className="text-xs text-muted-foreground">{items.length} صنف — آخر جرد: {sessions.length > 0 ? new Date(sessions[sessions.length - 1].date).toLocaleDateString('ar-EG') : 'لا يوجد'}</p>
                    </div>
                </div>
                <button onClick={saveStocktake}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                    <Download className="h-4 w-4" /> حفظ الجرد
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'في الانتظار', count: countPending, color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Package },
                    { label: 'مطابق', count: countMatched, color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
                    { label: 'فرق', count: countDiscrepancy, color: 'text-red-500', bg: 'bg-red-500/10', icon: AlertTriangle },
                ].map(s => (
                    <div key={s.label} className={`rounded-2xl border border-border/50 ${s.bg} p-4 flex items-center gap-3`}>
                        <s.icon className={`h-6 w-6 ${s.color}`} />
                        <div>
                            <p className={`text-2xl font-black ${s.color}`}>{s.count}</p>
                            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="بحث بالاسم..." className="w-full pr-9 pl-3 py-2 text-sm rounded-xl border border-border bg-card" />
                </div>
                <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                    {categories.map(c => (
                        <button key={c} onClick={() => setActiveCategory(c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeCategory === c ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                            {catLabels[c]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border/50 bg-card shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/30 bg-muted/30">
                            <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-muted-foreground">الفئة</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-muted-foreground">الكمية المتوقعة</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-muted-foreground">الكمية الفعلية</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-muted-foreground">الفرق</th>
                            <th className="py-3 px-4 text-center text-xs font-semibold text-muted-foreground">الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(item => (
                            <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                                <td className="py-2.5 px-4 font-medium text-foreground max-w-[250px] truncate">{item.name}</td>
                                <td className="py-2.5 px-4 text-muted-foreground">{item.category}</td>
                                <td className="py-2.5 px-4 text-center font-bold tabular-nums">{fmt(item.expectedQty)}</td>
                                <td className="py-2.5 px-4 text-center">
                                    <input type="number" min={0} value={item.actualQty ?? ''}
                                        onChange={e => updateActualQty(item.id, e.target.value)}
                                        className="w-20 px-2 py-1 text-center text-sm rounded-lg border border-border bg-background tabular-nums mx-auto"
                                        placeholder="—" />
                                </td>
                                <td className={`py-2.5 px-4 text-center font-bold tabular-nums ${item.difference === 0 ? 'text-muted-foreground' : item.difference > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {item.actualQty !== null ? (item.difference > 0 ? '+' : '') + fmt(item.difference) : '—'}
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                    {item.status === 'pending' && <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">انتظار</span>}
                                    {item.status === 'matched' && <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">مطابق ✓</span>}
                                    {item.status === 'discrepancy' && <span className="text-xs font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">فرق ⚠</span>}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">لا يوجد أصناف</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
