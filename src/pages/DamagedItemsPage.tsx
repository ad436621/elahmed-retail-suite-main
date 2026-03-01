import { useState, useMemo } from 'react';
import { Plus, Trash2, Pencil, X, Check, AlertTriangle, Search } from 'lucide-react';
import { DamagedItem, DamagedItemCategory } from '@/domain/types';
import { getDamagedItems, addDamagedItem, updateDamagedItem, deleteDamagedItem, getTotalLossesThisMonth } from '@/data/damagedData';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { validateStock } from '@/domain/stock';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useInventoryData } from '@/hooks/useInventoryData';

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

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

const categoryLabels: Record<DamagedItemCategory, string> = {
    mobile: 'موبايل',
    accessory: 'إكسسوار',
    device: 'جهاز',
    computer: 'كمبيوتر',
    cable: 'كابل',
    other: 'أخرى',
};

export default function DamagedItemsPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const items = useInventoryData(getDamagedItems, ['gx_damaged_items']);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const inventory = useMemo(() => getAllInventoryProducts(), [showForm]);

    const refresh = () => { };

    const handleSubmit = () => {
        if (!form.productName.trim()) {
            toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
            return;
        }

        const selectedProduct = inventory.find(p => p.id === form.productId);
        if (!editId && selectedProduct) {
            try {
                validateStock(selectedProduct, form.quantity);
            } catch (err: any) {
                toast({ title: 'خطأ في المخزون', description: err.message || 'الكمية المطلوبة غير متوفرة', variant: 'destructive' });
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

            // Deduct stock if a mapped product was selected
            if (selectedProduct) {
                updateProductQuantity(selectedProduct.id, selectedProduct.quantity - form.quantity);
                saveMovements([{
                    id: crypto.randomUUID(),
                    productId: selectedProduct.id,
                    type: 'manual_adjustment',
                    quantityChange: -form.quantity,
                    previousQuantity: selectedProduct.quantity,
                    newQuantity: selectedProduct.quantity - form.quantity,
                    reason: `تسجيل كعنصر هالك: ${form.reason || 'بدون سبب'}`,
                    referenceId: null,
                    userId: user?.id || 'system',
                    timestamp: new Date().toISOString()
                }]);
            }

            toast({ title: '✅ تمت الإضافة خصم الكمية من المخزون', description: form.productName });
        }
        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
        refresh();
    };

    const startEdit = (item: DamagedItem) => {
        setForm({
            date: item.date,
            productName: item.productName,
            productId: item.productId,
            quantity: item.quantity,
            costPrice: item.costPrice,
            totalLoss: item.totalLoss,
            reason: item.reason,
            category: item.category,
            addedBy: item.addedBy,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    const filtered = items.filter(i =>
        i.productName.toLowerCase().includes(search.toLowerCase()) ||
        i.reason.toLowerCase().includes(search.toLowerCase())
    );

    const totalLosses = getTotalLossesThisMonth();

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 border border-red-200">
                        <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الهالك</h1>
                        <p className="text-xs text-muted-foreground">{items.length} عنصر هالك</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2">
                        <p className="text-xs text-red-600">خسائر هذا الشهر</p>
                        <p className="text-lg font-bold text-red-700">{totalLosses.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <button
                        onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md"
                    >
                        <Plus className="h-4 w-4" /> إضافة هالك
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="بحث..."
                    className={`${IC} pr-9`}
                />
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
                    <div className="w-full max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل هالك' : 'إضافة هالك'}</h2>
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
                            </div >
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">المنتج (اختر من المخزون للخصم التلقائي)</label>
                                <select
                                    value={form.productId || ''}
                                    onChange={e => {
                                        if (!e.target.value) {
                                            setForm(f => ({ ...f, productId: '', productName: '', costPrice: 0 }));
                                            return;
                                        }
                                        const p = inventory.find(x => x.id === e.target.value);
                                        if (p) {
                                            setForm(f => ({ ...f, productId: p.id, productName: p.name, costPrice: p.costPrice }));
                                        }
                                    }}
                                    className={IC}
                                >
                                    <option value="">-- أدخال يدوي (بدون خصم) --</option>
                                    {inventory.map(p => (
                                        <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                                            {p.name} {p.quantity === 0 ? '(نفد المخزون)' : `(${p.costPrice} ج.م للتكلفة - ${p.quantity} قطعة)`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">أو أدخل اسم المنتج يدوياً</label>
                                <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: '' }))} placeholder="اسم المنتج" className={IC} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">الكمية</label>
                                    <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر التكلفة</label>
                                    <input type="number" min={0} value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: +e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">إجمالي الخسارة</label>
                                    <div className={`${IC} bg-muted font-bold text-red-600`}>{(form.quantity * form.costPrice).toLocaleString()} ج.م</div>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">السبب</label>
                                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={2} placeholder="سبب الهلاك..." className={`${IC} resize-none`} />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ' : 'إضافة'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التاريخ</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التصنيف</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الكمية</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">س.التكلفة</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الخسارة</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">السبب</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المستخدم</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={9} className="py-12 text-center text-muted-foreground">لا توجد عناصر هالكة</td></tr>
                        ) : filtered.map((item, i) => (
                            <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('ar-EG')}</td>
                                <td className="px-4 py-3 font-semibold text-foreground">{item.productName}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{categoryLabels[item.category]}</td>
                                <td className="px-4 py-3 text-center">{item.quantity}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{item.costPrice.toLocaleString()}</td>
                                <td className="px-4 py-3 text-sm font-bold text-red-600">{item.totalLoss.toLocaleString()} ج.م</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{item.reason || '—'}</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{item.addedBy}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { deleteDamagedItem(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
