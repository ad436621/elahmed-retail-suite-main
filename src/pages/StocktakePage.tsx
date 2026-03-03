import { useState } from 'react';
import { ClipboardList, Plus, X, Check, ChevronLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { getStocktakes, createStocktake, saveStocktakeItems, completeStocktake, buildInventorySnapshot, type Stocktake, type StocktakeItem, type WarehouseType, WAREHOUSE_LABELS } from '@/data/stocktakeData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const fmt = (n: number) => n.toLocaleString('ar-EG');

export default function StocktakePage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [stocktakes, setStocktakes] = useState<Stocktake[]>(() => getStocktakes());
    const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
    const [wType, setWType] = useState<WarehouseType>('all');
    const [wNotes, setWNotes] = useState('');
    const [currentId, setCurrentId] = useState<string | null>(null);
    const [items, setItems] = useState<(StocktakeItem & { countedQuantity: number })[]>([]);
    const [report, setReport] = useState<Stocktake | null>(null);

    const refresh = () => setStocktakes(getStocktakes());

    const startStocktake = () => {
        const stk = createStocktake({ warehouseType: wType, createdBy: user?.fullName ?? 'system', notes: wNotes });
        const snapshot = buildInventorySnapshot(wType);
        const enriched = snapshot.map(s => ({ ...s, stocktakeId: stk.id, countedQuantity: s.systemQuantity, varianceReason: '' }));
        setItems(enriched);
        setCurrentId(stk.id);
        setStep(2);
        refresh();
    };

    const finishStocktake = () => {
        if (!currentId) return;
        saveStocktakeItems(currentId, items);
        completeStocktake(currentId);
        toast({ title: '✅ تم إنهاء الجرد' });
        setStep(3);
        setReport(getStocktakes().find(s => s.id === currentId) ?? null);
        refresh();
    };

    const variance = (item: typeof items[0]) => item.countedQuantity - item.systemQuantity;

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 border border-amber-200"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">جرد المخزون</h1>
                        <p className="text-xs text-muted-foreground">{stocktakes.filter(s => s.status === 'in_progress').length} جارٍ • {stocktakes.filter(s => s.status === 'completed').length} مكتمل</p>
                    </div>
                </div>
                <button onClick={() => { setStep(1); setWType('all'); setWNotes(''); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4" /> جرد جديد
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: 'إجمالي الجردات', value: String(stocktakes.length) },
                    { label: 'جارٍ', value: String(stocktakes.filter(s => s.status === 'in_progress').length), cls: 'text-amber-600' },
                    { label: 'مكتمل', value: String(stocktakes.filter(s => s.status === 'completed').length), cls: 'text-emerald-600' },
                    { label: 'إجمالي الفوارق', value: `${fmt(stocktakes.reduce((a, s) => a + s.totalVarianceValue, 0))} ج.م`, cls: 'text-red-600' },
                ].map(s => (
                    <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className={`text-xl font-bold mt-1 ${s.cls ?? 'text-foreground'}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Stocktakes list */}
            <div className="space-y-3">
                {stocktakes.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد جردات سابقة</div>
                ) : [...stocktakes].reverse().map(stk => {
                    const progress = stk.totalItems > 0 ? Math.round(stk.countedItems / stk.totalItems * 100) : 0;
                    return (
                        <div key={stk.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <p className="font-bold text-foreground">{stk.stocktakeNo} — {WAREHOUSE_LABELS[stk.warehouseType]}</p>
                                    <p className="text-xs text-muted-foreground">{stk.startedAt.slice(0, 10)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${stk.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                        {stk.status === 'completed' ? '✅ مكتمل' : '🔄 جارٍ'}
                                    </span>
                                    {stk.status === 'completed' && (
                                        <button onClick={() => setReport(stk)} className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100">التقرير</button>
                                    )}
                                </div>
                            </div>
                            {stk.totalItems > 0 && (
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>التقدم ({stk.countedItems}/{stk.totalItems})</span>
                                        <span>{stk.varianceItems} فارق • {fmt(stk.totalVarianceValue)} ج.م</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Wizard Step 1 */}
            {step === 1 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">إعداد الجرد</h2>
                            <button onClick={() => setStep(0)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">نوع المخزون</label>
                            <select value={wType} onChange={e => setWType(e.target.value as WarehouseType)} className={IC}>
                                {Object.entries(WAREHOUSE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label>
                            <input value={wNotes} onChange={e => setWNotes(e.target.value)} className={IC} /></div>
                        <button onClick={startStocktake} className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                            بدء الجرد <ChevronLeft className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Wizard Step 2 — Count */}
            {step === 2 && (
                <div className="fixed inset-0 z-50 flex flex-col bg-background">
                    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                        <h2 className="text-lg font-bold">الجرد — عد المخزون ({WAREHOUSE_LABELS[wType]})</h2>
                        <button onClick={() => { setStep(0); refresh(); }} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-3">
                                <AlertTriangle className="h-12 w-12 text-amber-400" />
                                <p className="font-semibold">لا توجد بنود في هذا القسم بعد</p>
                                <p className="text-xs">أضف منتجات أولاً في صفحات المخزون</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm" dir="rtl">
                                <thead className="sticky top-0 bg-card border-b border-border">
                                    <tr>{['المنتج', 'النظام', 'العد الفعلي', 'الفرق'].map(h => <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const diff = item.countedQuantity - item.systemQuantity;
                                        return (
                                            <tr key={item.id} className="border-b border-border/50 hover:bg-muted/10">
                                                <td className="px-4 py-2.5 font-semibold text-foreground">{item.itemName}</td>
                                                <td className="px-4 py-2.5 text-center text-muted-foreground">{item.systemQuantity}</td>
                                                <td className="px-4 py-2.5 w-28">
                                                    <input type="number" min={0} value={item.countedQuantity}
                                                        onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, countedQuantity: +e.target.value } : it))}
                                                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
                                                </td>
                                                <td className={`px-4 py-2.5 text-center font-bold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                                    {diff > 0 ? '+' : ''}{diff}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="p-4 border-t border-border bg-card">
                        <button onClick={finishStocktake} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-500 shadow-md">
                            <Check className="h-4 w-4" /> إنهاء الجرد وحفظ النتائج
                        </button>
                    </div>
                </div>
            )}

            {/* Report Modal */}
            {report && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-lg mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">تقرير الجرد — {report.stocktakeNo}</h2>
                            <button onClick={() => setReport(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">تم عدّه</p><p className="text-lg font-bold">{report.countedItems}/{report.totalItems}</p></div>
                            <div className="rounded-xl border border-border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">بنود بفرق</p><p className="text-lg font-bold text-amber-600">{report.varianceItems}</p></div>
                            <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-3"><p className="text-xs text-red-600">قيمة الفوارق</p><p className="text-lg font-bold text-red-700">{fmt(report.totalVarianceValue)} ج.م</p></div>
                        </div>
                        {report.items.filter(i => i.countedQuantity !== i.systemQuantity).length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-muted-foreground mb-2">بنود الفوارق فقط</p>
                                <div className="overflow-x-auto rounded-xl border border-border">
                                    <table className="w-full text-xs">
                                        <thead><tr className="bg-muted/30">{['المنتج', 'النظام', 'الفعلي', 'الفرق'].map(h => <th key={h} className="px-3 py-2 text-right font-semibold">{h}</th>)}</tr></thead>
                                        <tbody>
                                            {report.items.filter(i => i.countedQuantity !== i.systemQuantity).map(i => {
                                                const d = i.countedQuantity - i.systemQuantity;
                                                return (
                                                    <tr key={i.id} className="border-t border-border/50">
                                                        <td className="px-3 py-2 font-semibold">{i.itemName}</td>
                                                        <td className="px-3 py-2 text-center">{i.systemQuantity}</td>
                                                        <td className="px-3 py-2 text-center">{i.countedQuantity}</td>
                                                        <td className={`px-3 py-2 text-center font-bold ${d > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{d > 0 ? '+' : ''}{d}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                        {report.items.filter(i => i.countedQuantity !== i.systemQuantity).length === 0 && (
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                                <CheckCircle className="h-4 w-4" /> لا توجد فوارق! المخزون مطابق تماماً
                            </div>
                        )}
                        <button onClick={() => setReport(null)} className="w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إغلاق</button>
                    </div>
                </div>
            )}
        </div>
    );
}
