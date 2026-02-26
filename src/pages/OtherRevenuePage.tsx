import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check, DollarSign, Search } from 'lucide-react';
import { OtherRevenue } from '@/domain/types';
import { getOtherRevenues, addOtherRevenue, updateOtherRevenue, deleteOtherRevenue, getOtherRevenueCategories, getTotalOtherRevenueThisMonth } from '@/data/otherRevenueData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const emptyForm: Omit<OtherRevenue, 'id' | 'createdAt'> = {
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: 0,
    category: '',
    addedBy: '',
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function OtherRevenuePage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [items, setItems] = useState<OtherRevenue[]>(() => getOtherRevenues());
    const [categories, setCategories] = useState<string[]>(() => getOtherRevenueCategories());
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [newCategory, setNewCategory] = useState('');

    const refresh = () => {
        setItems(getOtherRevenues());
        setCategories(getOtherRevenueCategories());
    };

    const handleSubmit = () => {
        if (!form.description.trim()) {
            toast({ title: 'خطأ', description: 'الوصف مطلوب', variant: 'destructive' });
            return;
        }
        if (editId) {
            updateOtherRevenue(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            addOtherRevenue({ ...form, addedBy: user?.fullName || 'غير معروف' });
            toast({ title: '✅ تمت الإضافة', description: form.description });
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
        toast({ title: '✅ تم تحديد التصنيف', description: 'احفظ الإيراد لإضافة التصنيف' });
    };

    const startEdit = (item: OtherRevenue) => {
        setForm({
            date: item.date,
            description: item.description,
            amount: item.amount,
            category: item.category,
            addedBy: item.addedBy,
        });
        setEditId(item.id);
        setShowForm(true);
    };

    const filtered = items.filter(i =>
        (i.description.toLowerCase().includes(search.toLowerCase()) ||
            i.category.toLowerCase().includes(search.toLowerCase())) &&
        (!selectedCategory || i.category === selectedCategory)
    );

    const totalThisMonth = getTotalOtherRevenueThisMonth();
    const totalAll = items.reduce((sum, i) => sum + i.amount, 0);

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-100 border border-green-200">
                        <DollarSign className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الأرباح الأخرى</h1>
                        <p className="text-xs text-muted-foreground">{items.length} إيراد • {categories.length} تصنيف</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2">
                        <p className="text-xs text-green-600">هذا الشهر</p>
                        <p className="text-lg font-bold text-green-700">{totalThisMonth.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2">
                        <p className="text-xs text-blue-600">الإجمالي</p>
                        <p className="text-lg font-bold text-blue-700">{totalAll.toLocaleString('ar-EG')} ج.م</p>
                    </div>
                    <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة إيراد
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
                            <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل إيراد' : 'إضافة إيراد'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label>
                                    <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ (ج.م)</label>
                                    <input type="number" min={0} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))} className={IC} />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الوصف *</label>
                                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="مثال: عمولة سامسونج شهر مارس" className={IC} />
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
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الوصف</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التصنيف</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المبلغ</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المستخدم</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">لا توجد إيرادات</td></tr>
                        ) : filtered.map((item, i) => (
                            <tr key={item.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString('ar-EG')}</td>
                                <td className="px-4 py-3 font-semibold text-foreground">{item.description}</td>
                                <td className="px-4 py-3"><span className="rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-semibold">{item.category || 'أخرى'}</span></td>
                                <td className="px-4 py-3 text-sm font-bold text-green-600">{item.amount.toLocaleString()} ج.م</td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{item.addedBy}</td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <button onClick={() => startEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => { deleteOtherRevenue(item.id); toast({ title: 'تم الحذف' }); refresh(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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
