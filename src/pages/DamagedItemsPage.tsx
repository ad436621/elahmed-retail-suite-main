// ============================================================
// صفحة الهالك — DamagedItemsPage
// ✅ FIXES: refresh() wired correctly, stats strip, pagination, confirm before delete, category filter
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Pencil, X, Check, AlertTriangle, Search, TrendingDown, Package } from 'lucide-react';
import { DamagedItem, DamagedItemCategory } from '@/domain/types';
import { getDamagedItems, addDamagedItem, updateDamagedItem, deleteDamagedItem } from '@/data/damagedData';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { validateStock } from '@/domain/stock';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { usePagination, PaginationBar } from '@/hooks/usePagination';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────

const emptyForm: Omit<DamagedItem, 'id' | 'createdAt'> = {
    date: new Date().toISOString().split('T')[0],
    productName: '',
    productId: undefined,
    quantity: 1,
    costPrice: 0,
    totalLoss: 0,
    reason: '',
    category: 'other',
    addedBy: '',
};

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const CATEGORIES: { id: DamagedItemCategory | 'all'; label: string; emoji: string }[] = [
    { id: 'all', label: 'الكل', emoji: '📦' },
    { id: 'mobile', label: 'موبايل', emoji: '📱' },
    { id: 'computer', label: 'كمبيوتر', emoji: '💻' },
    { id: 'device', label: 'جهاز', emoji: '📺' },
    { id: 'accessory', label: 'إكسسوار', emoji: '🎧' },
    { id: 'cable', label: 'كابل', emoji: '🔌' },
    { id: 'other', label: 'أخرى', emoji: '🔧' },
];

const categoryLabels: Record<DamagedItemCategory, string> = {
    mobile: 'موبايل', accessory: 'إكسسوار', device: 'جهاز',
    computer: 'كمبيوتر', cable: 'كابل', other: 'أخرى',
};

const categoryColors: Record<DamagedItemCategory, string> = {
    mobile: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    computer: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
    device: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    accessory: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-400',
    cable: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400',
    other: 'bg-muted text-muted-foreground',
};

// ── Main Component ───────────────────────────────────────────

export default function DamagedItemsPage() {
    const { toast } = useToast();
    const { user } = useAuth();

    // ✅ FIX: real state instead of useInventoryData hook — refresh works correctly
    const [items, setItems] = useState<DamagedItem[]>(() => getDamagedItems());
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<DamagedItemCategory | 'all'>('all');
    const [deleteTarget, setDeleteTarget] = useState<DamagedItem | null>(null);

    const inventory = useMemo(() => getAllInventoryProducts(), [showForm]);

    // ✅ FIX: refresh actually reloads from localStorage
    const refresh = useCallback(() => setItems(getDamagedItems()), []);

    // ── Stats ────────────────────────────────────────────────
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const stats = useMemo(() => {
        const totalLoss = items.reduce((s, i) => s + i.totalLoss, 0);
        const monthLoss = items
            .filter(i => new Date(i.date) >= startOfMonth)
            .reduce((s, i) => s + i.totalLoss, 0);
        const byCategory = Object.fromEntries(
            Object.keys(categoryLabels).map(k => [
                k,
                items.filter(i => i.category === k).reduce((s, i) => s + i.totalLoss, 0),
            ])
        ) as Record<DamagedItemCategory, number>;
        const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
        return { totalLoss, monthLoss, byCategory, topCategory };
    }, [items]);

    // ── Filtering ────────────────────────────────────────────
    const filtered = useMemo(() =>
        items
            .filter(i =>
                (categoryFilter === 'all' || i.category === categoryFilter) &&
                (i.productName.toLowerCase().includes(search.toLowerCase()) ||
                    i.reason.toLowerCase().includes(search.toLowerCase()))
            )
            .sort((a, b) => b.date.localeCompare(a.date)),
        [items, categoryFilter, search]
    );

    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage } = usePagination(filtered, 20);

    // ── Form Submit ──────────────────────────────────────────
    const handleSubmit = () => {
        if (!form.productName.trim()) {
            toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
            return;
        }

        const selectedProduct = inventory.find(p => p.id === form.productId);
        if (!editId && selectedProduct) {
            try { validateStock(selectedProduct, form.quantity); }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'الكمية المطلوبة غير متوفرة';
                toast({ title: 'خطأ في المخزون', description: msg, variant: 'destructive' });
                return;
            }
        }

        const totalLoss = form.quantity * form.costPrice;

        if (editId) {
            updateDamagedItem(editId, { ...form, totalLoss });
            toast({ title: '✅ تم التعديل' });
        } else {
            const newItem = { ...form, totalLoss, addedBy: user?.fullName || 'غير معروف' };
            addDamagedItem(newItem);

            if (selectedProduct) {
                updateProductQuantity(selectedProduct.id, selectedProduct.quantity - form.quantity);
                saveMovements([{
                    id: crypto.randomUUID(),
                    productId: selectedProduct.id,
                    type: 'manual_adjustment',
                    quantityChange: -form.quantity,
                    previousQuantity: selectedProduct.quantity,
                    newQuantity: selectedProduct.quantity - form.quantity,
                    reason: `تسجيل هالك: ${form.reason || 'بدون سبب'}`,
                    referenceId: null,
                    userId: user?.id || 'system',
                    timestamp: new Date().toISOString(),
                }]);
            }
            toast({ title: '✅ تمت الإضافة', description: `${form.productName} — تم خصم ${form.quantity} قطعة من المخزون` });
        }

        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
        refresh();
    };

    const startEdit = (item: DamagedItem) => {
        setForm({
            date: item.date, productName: item.productName, productId: item.productId,
            quantity: item.quantity, costPrice: item.costPrice, totalLoss: item.totalLoss,
            reason: item.reason, category: item.category, addedBy: item.addedBy,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    // ✅ FIX: confirm delete with state
    const confirmDelete = () => {
        if (!deleteTarget) return;
        deleteDamagedItem(deleteTarget.id);
        toast({ title: '🗑️ تم الحذف', description: deleteTarget.productName });
        setDeleteTarget(null);
        refresh();
    };

    // ── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* ── Header ──────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15 border border-red-200 dark:border-red-500/20">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الهالك والتلف</h1>
                        <p className="text-xs text-muted-foreground">{items.length} عنصر مسجل</p>
                    </div>
                </div>
                <button
                    onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                    <Plus className="h-4 w-4" /> إضافة هالك
                </button>
            </div>

            {/* ── Stats Strip ──────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3">
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">إجمالي الخسائر الكلية</p>
                    <p className="text-xl font-black text-red-700 dark:text-red-400 mt-0.5">{stats.totalLoss.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">خسائر هذا الشهر</p>
                    <p className="text-xl font-black text-amber-700 dark:text-amber-400 mt-0.5">{stats.monthLoss.toLocaleString('ar-EG')} ج.م</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                    <p className="text-xs text-muted-foreground font-medium">عدد العناصر</p>
                    <p className="text-xl font-black text-foreground mt-0.5">{items.length} عنصر</p>
                </div>
                {stats.topCategory && stats.topCategory[1] > 0 && (
                    <div className="rounded-2xl border border-border/60 bg-card px-4 py-3">
                        <p className="text-xs text-muted-foreground font-medium">أكثر فئة هالكاً</p>
                        <p className="text-sm font-black text-foreground mt-0.5">
                            {categoryLabels[stats.topCategory[0] as DamagedItemCategory]}
                            <span className="text-xs text-red-500 mr-1">({stats.topCategory[1].toLocaleString('ar-EG')} ج.م)</span>
                        </p>
                    </div>
                )}
            </div>

            {/* ── Category Filter + Search ─────────────────────── */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex gap-1.5 overflow-x-auto pb-1 hide-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button key={cat.id} onClick={() => setCategoryFilter(cat.id as DamagedItemCategory | 'all')}
                            className={cn(
                                'flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all border',
                                categoryFilter === cat.id
                                    ? 'bg-foreground text-background border-foreground shadow-sm'
                                    : 'border-border/60 bg-card text-muted-foreground hover:border-primary/40'
                            )}>
                            <span>{cat.emoji}</span> {cat.label}
                            {cat.id !== 'all' && stats.byCategory[cat.id as DamagedItemCategory] > 0 && (
                                <span className="text-[10px] opacity-70">({stats.byCategory[cat.id as DamagedItemCategory].toLocaleString('ar-EG')} ج.م)</span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:max-w-xs">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="بحث بالاسم أو السبب..."
                        className={`${IC} pr-9`} />
                </div>
            </div>

            {/* ── Form Modal ───────────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4" onClick={() => { setShowForm(false); setEditId(null); }}>
                    <div className="w-full max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل عنصر هالك' : 'إضافة عنصر هالك'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label>
                                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">التصنيف</label>
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as DamagedItemCategory }))} className={IC}>
                                        {Object.entries(categoryLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">المنتج (اختر من المخزون للخصم التلقائي)</label>
                                <select value={form.productId || ''} onChange={e => {
                                    if (!e.target.value) { setForm(f => ({ ...f, productId: undefined, productName: '', costPrice: 0 })); return; }
                                    const p = inventory.find(x => x.id === e.target.value);
                                    if (p) setForm(f => ({ ...f, productId: p.id, productName: p.name, costPrice: p.costPrice }));
                                }} className={IC}>
                                    <option value="">-- إدخال يدوي (بدون خصم من المخزون) --</option>
                                    {inventory.map(p => (
                                        <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                                            {p.name} {p.quantity === 0 ? '(نفد المخزون)' : `(تكلفة: ${p.costPrice} ج.م — ${p.quantity} قطعة)`}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">أو أدخل اسم المنتج يدوياً</label>
                                <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: undefined }))}
                                    placeholder="اسم المنتج الهالك..." className={IC} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">الكمية</label>
                                    <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر التكلفة (ج.م)</label>
                                    <input type="number" min={0} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">إجمالي الخسارة</label>
                                    <div className={cn(IC, 'bg-red-50 dark:bg-red-500/10 font-black text-red-600 dark:text-red-400 text-center cursor-default')}>
                                        {(form.quantity * form.costPrice).toLocaleString('ar-EG')} ج.م
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">السبب والملاحظات</label>
                                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                                    rows={2} placeholder="سبب الهلاك أو التلف..." className={`${IC} resize-none`} />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <button onClick={handleSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديل' : 'إضافة الهالك'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── ✅ Confirm Delete Dialog ─────────────────────── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
                                <Trash2 className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">تأكيد الحذف</h3>
                                <p className="text-xs text-muted-foreground">هذا الإجراء لا يمكن التراجع عنه</p>
                            </div>
                        </div>
                        <p className="text-sm text-foreground mb-1">هل تريد حذف:</p>
                        <p className="text-sm font-bold text-red-600 mb-4">«{deleteTarget.productName}» — خسارة {deleteTarget.totalLoss.toLocaleString('ar-EG')} ج.م</p>
                        <div className="flex gap-2">
                            <button onClick={confirmDelete}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-sm font-bold text-white transition-all">
                                <Trash2 className="h-4 w-4" /> نعم، احذف
                            </button>
                            <button onClick={() => setDeleteTarget(null)}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Table ────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[700px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['التاريخ', 'المنتج', 'الفئة', 'الكمية', 'التكلفة', 'الخسارة الكلية', 'السبب', 'بواسطة', ''].map(h => (
                                    <th key={h} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedItems.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center">
                                        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                                        <p className="text-muted-foreground text-sm">لا توجد عناصر هالكة</p>
                                        {search && <p className="text-xs text-muted-foreground mt-1">جرب تغيير كلمة البحث أو الفئة</p>}
                                    </td>
                                </tr>
                            ) : paginatedItems.map((item, idx) => (
                                <tr key={item.id} className={cn(
                                    'border-b border-border/40 hover:bg-muted/20 transition-colors',
                                    idx % 2 !== 0 && 'bg-muted/10'
                                )}>
                                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                        {new Date(item.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-foreground">{item.productName}</td>
                                    <td className="px-4 py-3">
                                        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', categoryColors[item.category])}>
                                            {categoryLabels[item.category]}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold">{item.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.costPrice.toLocaleString('ar-EG')} ج.م</td>
                                    <td className="px-4 py-3">
                                        <span className="flex items-center gap-1 text-red-600 font-black text-sm">
                                            <TrendingDown className="h-3.5 w-3.5" />
                                            {item.totalLoss.toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[140px] truncate" title={item.reason}>
                                        {item.reason || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.addedBy}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(item)}
                                                className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors" title="تعديل">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            {/* ✅ FIX: triggers confirm dialog instead of direct delete */}
                                            <button onClick={() => setDeleteTarget(item)}
                                                className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive transition-colors" title="حذف">
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* ✅ Pagination */}
                <div className="px-4 pb-3 pt-1">
                    <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems}
                        pageSize={pageSize} onPrev={prevPage} onNext={nextPage} onPage={setPage} />
                </div>
            </div>
        </div>
    );
}
