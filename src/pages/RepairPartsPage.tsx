import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Pencil, X, Search, Package, AlertTriangle, CheckCircle2, DollarSign, Tag, Layers, MapPin, Hash, QrCode } from 'lucide-react';
import { RepairPart, getRepairParts, addRepairPart, updateRepairPart } from '@/data/repairsData';
import { useToast } from '@/hooks/use-toast';
import { usePagination, PaginationBar } from '@/hooks/usePagination';

const emptyPart: Partial<RepairPart> = {
    name: '',
    category: '',
    sku: '',
    brand: '',
    compatible_models: '',
    unit_cost: 0,
    selling_price: 0,
    qty: 0,
    min_qty: 0,
    barcode: '',
    color: '',
    location: '',
    notes: '',
    active: true
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function RepairPartsPage() {
    const { toast } = useToast();
    const [parts, setParts] = useState<RepairPart[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<RepairPart>>(emptyPart);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    const refresh = async () => {
        setIsLoading(true);
        try {
            const data = await getRepairParts();
            setParts(data);
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل تحميل المخزون', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { refresh(); }, []);

    const categories = useMemo(() => {
        const cats = new Set(parts.map(p => p.category).filter(Boolean));
        return ['all', ...Array.from(cats)];
    }, [parts]);

    const filtered = useMemo(() => {
        return parts.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                                (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
                                (p.brand || '').toLowerCase().includes(search.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        }).sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());
    }, [parts, search, categoryFilter]);

    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage } = usePagination(filtered, 15);

    const handleSubmit = async () => {
        if (!form.name?.trim()) {
            toast({ title: 'خطأ', description: 'اسم القطعة مطلوب', variant: 'destructive' });
            return;
        }

        try {
            // Handle legacy field mapping for consistency
            const submitData = {
                ...form,
                // Ensure unit_cost and selling_price are numbers
                unit_cost: Number(form.unit_cost || form.cost_price || 0),
                selling_price: Number(form.selling_price || 0),
                qty: Number(form.qty || form.current_stock || 0),
                min_qty: Number(form.min_qty || form.min_stock || 0)
            };

            if (editId) {
                await updateRepairPart(editId, submitData);
                toast({ title: '✅ تم التحديث' });
            } else {
                await addRepairPart(submitData);
                toast({ title: '✅ تم الإضافة' });
            }
            setShowForm(false);
            refresh();
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل الحفظ', variant: 'destructive' });
        }
    };

    const startEdit = (part: RepairPart) => {
        setForm(part);
        setEditId(part.id);
        setShowForm(true);
    };

    return (
        <div className="space-y-6 animate-fade-in pb-12" dir="rtl" data-testid="repair-parts-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
                        <Package className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight">مخزون قطع الغيار</h1>
                        <p className="text-sm font-medium text-muted-foreground">{parts.length} قطعة مسجلة</p>
                    </div>
                </div>
                <button data-testid="repair-parts-add" onClick={() => { setForm(emptyPart); setEditId(null); setShowForm(true); }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-500/25">
                    <Plus className="h-5 w-5" /> إضافة قطعة غيار
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center bg-card p-4 rounded-2xl border border-border shadow-sm">
                <div className="md:col-span-2 relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input data-testid="repair-parts-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم القطعة، SKU، أو البراند..." className={`${IC} pr-9`} />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={IC}>
                    <option value="all">كل التصنيفات</option>
                    {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700">نواقص: {parts.filter(p => p.qty <= p.min_qty).length}</span>
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['القطعة', 'التصنيف والبراند', 'المخزون', 'التكلفة / البيع', 'الحالة', ''].map(h => (
                                    <th key={h} className="px-4 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">جاري التحميل...</td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={6} className="py-16 text-center text-muted-foreground">لا توجد نتائج</td></tr>
                            ) : paginatedItems.map((p) => (
                                <tr key={p.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                                    <td className="px-4 py-4">
                                        <div className="font-bold text-foreground">{p.name}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{p.sku || 'No SKU'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-sm font-medium">{p.category || '---'}</div>
                                        <div className="text-xs text-muted-foreground">{p.brand || '---'}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className={`text-sm font-black ${p.qty <= p.min_qty ? 'text-red-500' : 'text-foreground'}`}>{p.qty}</div>
                                        <div className="text-[10px] text-muted-foreground">الحد الأدنى: {p.min_qty}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="text-xs font-bold text-muted-foreground line-through">ج.م {p.unit_cost.toLocaleString()}</div>
                                        <div className="text-sm font-black text-emerald-600">ج.م {p.selling_price.toLocaleString()}</div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {p.active ? 'نشط' : 'غير نشط'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            <button onClick={() => startEdit(p)} className="p-2 hover:bg-muted rounded-lg text-blue-600 transition-colors"><Pencil className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-border/50">
                    <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPrev={prevPage} onNext={nextPage} onPage={setPage} />
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6 px-4" onClick={() => setShowForm(false)}>
                    <div data-testid="repair-parts-form-modal" className="w-full max-w-xl mx-auto rounded-3xl border border-border bg-background shadow-2xl animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
                        
                        {/* ── Modal Body ── */}
                        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto w-full">
                            
                            {/* Section 1: Basic Info */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <h3 className="text-sm font-bold text-foreground">معلومات أساسية</h3>
                            </div>

                            <div>
                                <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">اسم القطعة <span className="text-destructive">*</span></label>
                                <div className="relative">
                                    <Tag className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                                    <input data-testid="repair-parts-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} 
                                        className={`${IC} pr-9 transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="مثال: شاشة ايفون 13 اصلية" autoFocus />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">الباركود</label>
                                    <div className="relative">
                                        <QrCode className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                                        <input value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} 
                                            className={`${IC} pr-9 transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="تلقائي إن تُرِك فارغاً" />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">الماركة</label>
                                    <input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="مثال: Apple, Samsung" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">التصنيف</label>
                                    <div className="relative">
                                        <Layers className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                                        <input data-testid="repair-parts-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} 
                                            className={`${IC} pr-9 transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} list="part-cats" placeholder="-- اختر تصنيف --" />
                                        <datalist id="part-cats">
                                            {categories.filter(c => c !== 'all').map(c => <option key={c} value={c} />)}
                                        </datalist>
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">الموديلات المتوافقة</label>
                                    <input value={form.compatible_models} onChange={e => setForm({ ...form, compatible_models: e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="iPhone 11, 12, XR..." />
                                </div>
                            </div>

                            {/* Section 2: Inventory Details */}
                            <div className="flex items-center gap-2 mt-6 mb-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                                <h3 className="text-sm font-bold text-foreground">المخزون والتخزين</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">SKU / رمز المورد</label>
                                    <div className="relative">
                                        <Hash className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                                        <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} 
                                            className={`${IC} pr-9 transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="#" />
                                    </div>
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">الكمية</label>
                                    <input data-testid="repair-parts-qty" type="number" min={0} value={form.qty || ''} onChange={e => setForm({ ...form, qty: +e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary text-center`} placeholder="0" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">حد التنبيه</label>
                                    <input type="number" min={0} value={form.min_qty || ''} onChange={e => setForm({ ...form, min_qty: +e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary text-center`} placeholder="2" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">مكان التخزين (الرف/الدرج)</label>
                                    <div className="relative">
                                        <MapPin className="absolute right-3 top-3 h-4 w-4 text-muted-foreground/40" />
                                        <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} 
                                            className={`${IC} pr-9 transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="درج A1، رف 2..." />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">سعر الشراء</label>
                                    <input data-testid="repair-parts-unit-cost" type="number" min={0} value={form.unit_cost || ''} onChange={e => setForm({ ...form, unit_cost: +e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary text-center font-bold`} placeholder="0.00" />
                                </div>
                                <div>
                                    <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">سعر البيع</label>
                                    <input data-testid="repair-parts-selling-price" type="number" min={0} value={form.selling_price || ''} onChange={e => setForm({ ...form, selling_price: +e.target.value })} 
                                        className={`${IC} transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary text-center font-bold text-emerald-600`} placeholder="0.00" />
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">هامش الربح</label>
                                <div className={`w-full rounded-xl border px-3 py-2.5 text-sm text-center font-bold transition-colors ${(Number(form.selling_price) - Number(form.unit_cost)) >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                                    {(Number(form.selling_price) - Number(form.unit_cost)).toLocaleString('ar-EG')} ج.م
                                </div>
                            </div>

                            <div>
                                <label className="mb-2 block text-[11px] font-bold text-muted-foreground text-right">ملاحظات إضافية</label>
                                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} 
                                    className={`${IC} min-h-[100px] resize-none transition-colors hover:border-primary/50 focus:border-primary focus:ring-1 focus:ring-primary`} placeholder="ملاحظات حول القطعة..." />
                            </div>
                        </div>

                        {/* ── Modal Footer ── */}
                        <div className="flex gap-4 p-6 pt-2 pb-6 mt-auto">
                            <button onClick={() => setShowForm(false)}
                                className="flex-1 rounded-xl border border-border bg-background py-3.5 text-sm font-bold text-muted-foreground hover:bg-muted/50 transition-colors">
                                إلغاء
                            </button>
                            <button data-testid="repair-parts-save" onClick={handleSubmit}
                                className="flex-1 rounded-xl bg-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
                                <CheckCircle2 className="h-5 w-5" /> {editId ? 'حفظ التعديلات' : 'إضافة القطعة للمخزون'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
