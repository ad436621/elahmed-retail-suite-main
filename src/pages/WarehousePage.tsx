import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, Warehouse, Search, LayoutGrid, List } from 'lucide-react';
import { WarehouseItem } from '@/domain/types';
import { getWarehouseItems, addWarehouseItem, updateWarehouseItem, deleteWarehouseItem, getWarehouseCategories, getWarehouseCapital } from '@/data/warehouseData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const emptyForm: Omit<WarehouseItem, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', category: '', quantity: 1, costPrice: 0, notes: '', addedBy: '',
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function WarehousePage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [items, setItems] = useState<WarehouseItem[]>(() => getWarehouseItems());
    const [categories, setCategories] = useState<string[]>(() => getWarehouseCategories());
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [newCategory, setNewCategory] = useState('');

    const refresh = () => {
        setItems(getWarehouseItems());
        setCategories(getWarehouseCategories());
    };

    const handleSubmit = () => {
        if (!form.name.trim()) {
            toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
            return;
        }
        if (editId) {
            updateWarehouseItem(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            addWarehouseItem({ ...form, addedBy: user?.fullName || 'غير معروف' });
            toast({ title: '✅ تمت الإضافة', description: form.name });
        }
        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
        refresh();
    };

    const addNewCategory = () => {
        const cat = newCategory.trim();
        if (!cat) return;
        if (categories.includes(cat)) {
            toast({ title: 'خطأ', description: 'التصنيف موجود بالفعل', variant: 'destructive' });
            return;
        }
        // Set the new category in the form - it will be added when item is saved
        setForm(f => ({ ...f, category: cat }));
        setNewCategory('');
        toast({ title: '✅ تم تحديد التصنيف', description: 'احفظ العنصر لإضافة التصنيف' });
    };

    const startEdit = (item: WarehouseItem) => {
        setForm({
            name: item.name, category: item.category, quantity: item.quantity,
            costPrice: item.costPrice, notes: item.notes, addedBy: item.addedBy,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    const filtered = items.filter(i =>
        (i.name.toLowerCase().includes(search.toLowerCase()) ||
            i.category.toLowerCase().includes(search.toLowerCase())) &&
        (!selectedCategory || i.category === selectedCategory)
    );

    const totalCapital = getWarehouseCapital();

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 border border-teal-200">
                        <Warehouse className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">المستودع</h1>
                        <p className="text-xs text-muted-foreground">{items.length} عنصر • {categories.length} تصنيف</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-teal-50 border border-teal-200 px-4 py-2">
                        <p className="text-xs text-teal-600">رأس المال</p>
                        <p className="text-lg font-bold text-teal-700">{totalCapital.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>شبكة</button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground'}`}>جدول</button>
                    </div>
                    <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة عنصر
                    </button>
                </div>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
                <button onClick={() => setSelectedCategory('')} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>الكل</button>
                {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>{cat}</button>
                ))}
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className={`${IC} pr-9`} />
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4">
                    <div className="w-full max-w-lg mx-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل عنصر' : 'إضافة عنصر'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم المنتج *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اسم المنتج" className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">التصنيف</label>
                                <div className="flex gap-2">
                                    <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={IC}>
                                        <option value="">اختر تصنيف</option>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    <input value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNewCategory()} placeholder="تصنيف جديد" className={`${IC} w-32`} />
                                </div>
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
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">الإجمالي</label>
                                    <div className={`${IC} bg-muted font-bold`}>{(form.quantity * form.costPrice).toLocaleString()} ج.م</div>
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label>
                                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${IC} resize-none`} />
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

            {/* Content */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.length === 0 ? (
                        <div className="col-span-4 py-16 text-center text-muted-foreground">
                            <Warehouse className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>لا توجد عناصر</p>
                        </div>
                    ) : filtered.map(item => (
                        <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-lg hover:-translate-y-0.5 transition-all">
                            <div className="p-4 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-foreground">{item.name}</h3>
                                    <span className="rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-xs font-semibold">{item.category}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">الكمية: {item.quantity}</p>
                                <div className="mt-auto flex items-center justify-between pt-2 border-t border-border/40">
                                    <p className="text-sm font-bold text-primary">{(item.quantity * item.costPrice).toLocaleString()} ج.م</p>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { deleteWarehouseItem(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التصنيف</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الكمية</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">س.التكلفة</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الإجمالي</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">ملاحظات</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">لا توجد عناصر</td></tr>
                            ) : filtered.map((item, i) => (
                                <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                    <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                                    <td className="px-4 py-3"><span className="rounded-full bg-teal-100 text-teal-700 px-2 py-0.5 text-xs font-semibold">{item.category}</span></td>
                                    <td className="px-4 py-3 text-center">{item.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.costPrice.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-bold text-primary">{(item.quantity * item.costPrice).toLocaleString()} ج.م</td>
                                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[150px] truncate">{item.notes || '—'}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                            <button onClick={() => { deleteWarehouseItem(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
