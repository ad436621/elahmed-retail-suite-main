import { useState, useMemo } from 'react';
import { Truck, Plus, X, Check, Search, Trash2, Pencil, Phone, MapPin, DollarSign, AlertCircle } from 'lucide-react';
import { getSuppliers, addSupplier, updateSupplier, deleteSupplier, addSupplierTransaction, getTotalOwedToSuppliers, type Supplier } from '@/data/suppliersData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const fmt = (n: number) => n.toLocaleString('ar-EG');

const emptyForm = { name: '', phone: '', address: '', balance: 0, notes: '' };

export default function SuppliersPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [suppliers, setSuppliers] = useState<Supplier[]>(() => getSuppliers());
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [showPayDialog, setShowPayDialog] = useState<Supplier | null>(null);
    const [payAmount, setPayAmount] = useState(0);

    const refresh = () => setSuppliers(getSuppliers());

    const filtered = useMemo(() =>
        suppliers.filter(s => s.name.includes(search) || (s.phone ?? '').includes(search)),
        [suppliers, search]);

    const totalOwed = getTotalOwedToSuppliers();

    const handleSubmit = () => {
        if (!form.name.trim()) { toast({ title: 'خطأ', description: 'اسم المورد مطلوب', variant: 'destructive' }); return; }
        if (editId) {
            updateSupplier(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            addSupplier(form);
            toast({ title: '✅ تمت الإضافة', description: form.name });
        }
        setForm(emptyForm); setEditId(null); setShowForm(false); refresh();
    };

    const startEdit = (s: Supplier) => {
        setForm({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', balance: s.balance, notes: s.notes ?? '' });
        setEditId(s.id); setShowForm(true);
    };

    const handlePay = () => {
        if (!showPayDialog || payAmount <= 0) return;
        addSupplierTransaction({ supplierId: showPayDialog.id, supplierName: showPayDialog.name, type: 'payment', amount: payAmount, createdBy: user?.fullName ?? 'system', createdAt: new Date().toISOString() });
        toast({ title: '✅ تم تسجيل الدفعة', description: `${fmt(payAmount)} ج.م` });
        setShowPayDialog(null); setPayAmount(0); refresh();
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 border border-orange-200">
                        <Truck className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الموردون</h1>
                        <p className="text-xs text-muted-foreground">{suppliers.length} مورد • مستحقات: <span className="text-red-600 font-bold">{fmt(totalOwed)} ج.م</span></p>
                    </div>
                </div>
                <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
                    <Plus className="h-4 w-4" /> إضافة مورد
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">إجمالي الموردين</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{suppliers.length}</p>
                </div>
                <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-900/10 p-4">
                    <p className="text-xs text-red-600">مستحقات للموردين</p>
                    <p className="text-2xl font-bold text-red-700 mt-1">{fmt(totalOwed)} ج.م</p>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">موردون بديون</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{suppliers.filter(s => s.balance > 0).length}</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف..." className={`${IC} pr-9`} />
            </div>

            {/* List */}
            <div className="space-y-3">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا يوجد موردون</div>
                ) : filtered.map(s => (
                    <div key={s.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 hover:border-primary/30 transition-all">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground">{s.name}</p>
                                {s.balance > 0 && (
                                    <span className="flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                        <AlertCircle className="h-3 w-3" /> {fmt(s.balance)} ج.م
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                                {s.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{s.phone}</span>}
                                {s.address && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{s.address}</span>}
                            </div>
                            {s.notes && <p className="mt-1 text-xs text-muted-foreground">{s.notes}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                            {s.balance > 0 && (
                                <button onClick={() => { setShowPayDialog(s); setPayAmount(0); }}
                                    className="flex items-center gap-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                                    <DollarSign className="h-3.5 w-3.5" /> دفع
                                </button>
                            )}
                            <button onClick={() => startEdit(s)} className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => { deleteSupplier(s.id); toast({ title: 'تم الحذف' }); refresh(); }}
                                className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? 'تعديل مورد' : 'إضافة مورد'}</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم المورد *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الهاتف</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">الرصيد المبدئي</label><input type="number" min={0} value={form.balance} onChange={e => setForm(f => ({ ...f, balance: +e.target.value }))} className={IC} /></div>
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان</label><input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={IC} /></div>
                            <div className="col-span-2"><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label><textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={`${IC} resize-none`} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ' : 'إضافة'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Dialog */}
            {showPayDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">تسجيل دفعة للمورد</h2>
                            <button onClick={() => setShowPayDialog(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground">{showPayDialog.name} • مستحق: <span className="font-bold text-red-600">{fmt(showPayDialog.balance)} ج.م</span></p>
                        <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ المدفوع (ج.م)</label>
                            <input type="number" min={0} value={payAmount} onChange={e => setPayAmount(+e.target.value)} className={IC} /></div>
                        <div className="flex gap-2">
                            <button onClick={handlePay} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500">
                                <Check className="h-4 w-4" /> تأكيد الدفع
                            </button>
                            <button onClick={() => setShowPayDialog(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
