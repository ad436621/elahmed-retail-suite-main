import { useState, useMemo } from 'react';
import { FileText, Plus, X, Check, Search, Trash2, ChevronLeft, AlertCircle } from 'lucide-react';
import {
    getPurchaseInvoices, addPurchaseInvoice, applyPayment, deletePurchaseInvoice, getTotalUnpaid,
    type PurchaseInvoice, type PurchaseInvoiceItem, type InvoiceStatus, type PaymentMethod,
} from '@/data/purchaseInvoicesData';
import { getSuppliers } from '@/data/suppliersData';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const fmt = (n: number) => n.toLocaleString('ar-EG');

const STATUS_LABELS: Record<InvoiceStatus, string> = { draft: 'مسودة', confirmed: 'مؤكدة', partial: 'جزئي', paid: 'مدفوعة' };
const STATUS_COLORS: Record<InvoiceStatus, string> = { draft: 'bg-gray-100 text-gray-600', confirmed: 'bg-blue-100 text-blue-700', partial: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700' };
const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'cash', label: 'نقدي' }, { value: 'card', label: 'بطاقة' },
    { value: 'wallet', label: 'محفظة' }, { value: 'bank', label: 'بنك' }, { value: 'credit', label: 'آجل' },
];

const emptyItem = (): PurchaseInvoiceItem => ({
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    productName: '', category: '', quantity: 1, unitPrice: 0, totalPrice: 0, notes: '',
});

export default function PurchaseInvoicesPage() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>(() => getPurchaseInvoices());
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [step, setStep] = useState(0);
    const [payDialog, setPayDialog] = useState<PurchaseInvoice | null>(null);
    const [payAmount, setPayAmount] = useState(0);

    const suppliers = getSuppliers();
    const [wForm, setWForm] = useState({
        supplierName: '', supplierId: '', invoiceDate: new Date().toISOString().slice(0, 10),
        paymentMethod: 'cash' as PaymentMethod, paidAmount: 0, notes: '',
    });
    const [wItems, setWItems] = useState<PurchaseInvoiceItem[]>([emptyItem()]);
    const totalAmount = wItems.reduce((s, i) => s + i.totalPrice, 0);
    const refresh = () => setInvoices(getPurchaseInvoices());

    const filtered = useMemo(() => invoices
        .filter(i => statusFilter === 'all' || i.status === statusFilter)
        .filter(i => i.invoiceNumber.includes(search) || i.supplierName.includes(search))
        .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
        [invoices, search, statusFilter]);

    const updateItem = (idx: number, field: keyof PurchaseInvoiceItem, val: string | number) => {
        setWItems(items => items.map((it, i) => {
            if (i !== idx) return it;
            const u = { ...it, [field]: val };
            if (field === 'quantity' || field === 'unitPrice') {
                u.totalPrice = Number(field === 'quantity' ? val : u.quantity) * Number(field === 'unitPrice' ? val : u.unitPrice);
            }
            return u;
        }));
    };

    const handleSubmit = () => {
        if (!wForm.supplierName.trim()) { toast({ title: 'خطأ', description: 'اسم المورد مطلوب', variant: 'destructive' }); return; }
        addPurchaseInvoice({ ...wForm, totalAmount, items: wItems, createdBy: user?.fullName ?? 'system' });
        toast({ title: '✅ تمت إضافة الفاتورة' });
        setStep(0);
        setWForm({ supplierName: '', supplierId: '', invoiceDate: new Date().toISOString().slice(0, 10), paymentMethod: 'cash', paidAmount: 0, notes: '' });
        setWItems([emptyItem()]);
        refresh();
    };

    const handlePay = () => {
        if (!payDialog || payAmount <= 0) return;
        applyPayment(payDialog.id, payAmount);
        toast({ title: '✅ تم تسجيل الدفعة' });
        setPayDialog(null); setPayAmount(0); refresh();
    };

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 border border-sky-200"><FileText className="h-5 w-5 text-sky-600" /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">فواتير الشراء</h1>
                        <p className="text-xs text-muted-foreground">مستحقات: <span className="text-red-600 font-bold">{fmt(getTotalUnpaid())} ج.م</span></p>
                    </div>
                </div>
                <button onClick={() => setStep(1)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm">
                    <Plus className="h-4 w-4" /> فاتورة جديدة
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['all', 'confirmed', 'partial', 'paid'] as const).map(s => (
                    <div key={s} onClick={() => setStatusFilter(s)} className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all">
                        <p className="text-xs text-muted-foreground">{s === 'all' ? 'الكل' : STATUS_LABELS[s]}</p>
                        <p className="text-xl font-bold mt-1">{s === 'all' ? invoices.length : invoices.filter(i => i.status === s).length}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className={`${IC} pr-9`} />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as InvoiceStatus | 'all')} className="rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none">
                    <option value="all">كل الحالات</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-soft">
                <table className="w-full text-sm">
                    <thead><tr className="border-b border-border bg-muted/30">
                        {['الفاتورة', 'المورد', 'التاريخ', 'الإجمالي', 'مدفوع', 'متبقي', 'الحالة', ''].map(h => (
                            <th key={h} className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">لا توجد فواتير</td></tr>
                        ) : filtered.map((inv, i) => (
                            <tr key={inv.id} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                <td className="px-3 py-2.5 font-mono text-xs font-semibold">{inv.invoiceNumber}</td>
                                <td className="px-3 py-2.5 text-xs font-semibold">{inv.supplierName}</td>
                                <td className="px-3 py-2.5 text-xs text-muted-foreground">{inv.invoiceDate}</td>
                                <td className="px-3 py-2.5 text-xs font-bold">{fmt(inv.totalAmount)}</td>
                                <td className="px-3 py-2.5 text-xs text-emerald-600">{fmt(inv.paidAmount)}</td>
                                <td className="px-3 py-2.5 text-xs text-red-600 font-bold">{fmt(inv.remaining)}</td>
                                <td className="px-3 py-2.5">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[inv.status]}`}>{STATUS_LABELS[inv.status]}</span>
                                </td>
                                <td className="px-3 py-2.5">
                                    <div className="flex gap-1">
                                        {inv.status !== 'paid' && (
                                            <button onClick={() => { setPayDialog(inv); setPayAmount(0); }} className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">دفع</button>
                                        )}
                                        <button onClick={() => { deletePurchaseInvoice(inv.id); refresh(); }} className="rounded-lg p-1.5 bg-red-50 text-destructive hover:bg-red-100"><Trash2 className="h-3 w-3" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Wizard */}
            {step > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-lg mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">فاتورة جديدة — {step}/3</h2>
                            <button onClick={() => setStep(0)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map(s => <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`} />)}
                        </div>

                        {step === 1 && (
                            <div className="space-y-3">
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المورد *</label>
                                    {suppliers.length > 0 ? (
                                        <select value={wForm.supplierId} onChange={e => { const s = suppliers.find(s => s.id === e.target.value); setWForm(f => ({ ...f, supplierId: e.target.value, supplierName: s?.name ?? '' })); }} className={IC}>
                                            <option value="">-- اختر مورد --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    ) : (
                                        <input value={wForm.supplierName} onChange={e => setWForm(f => ({ ...f, supplierName: e.target.value }))} placeholder="اسم المورد" className={IC} />
                                    )}
                                </div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label><input type="date" value={wForm.invoiceDate} onChange={e => setWForm(f => ({ ...f, invoiceDate: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظات</label><input value={wForm.notes} onChange={e => setWForm(f => ({ ...f, notes: e.target.value }))} className={IC} /></div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-3">
                                <div className="overflow-x-auto rounded-xl border border-border">
                                    <table className="w-full text-xs">
                                        <thead><tr className="bg-muted/30">{['المنتج', 'الكمية', 'السعر', 'الإجمالي'].map(h => <th key={h} className="px-2 py-2 text-right font-semibold text-muted-foreground">{h}</th>)}</tr></thead>
                                        <tbody>
                                            {wItems.map((item, idx) => (
                                                <tr key={item.id} className="border-t border-border/50">
                                                    <td className="p-1"><input value={item.productName} onChange={e => updateItem(idx, 'productName', e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none" /></td>
                                                    <td className="p-1 w-16"><input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, 'quantity', +e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-center focus:outline-none" /></td>
                                                    <td className="p-1 w-24"><input type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', +e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-center focus:outline-none" /></td>
                                                    <td className="p-1 w-20 text-center font-semibold text-emerald-600">{fmt(item.totalPrice)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot><tr className="border-t border-border bg-muted/20"><td colSpan={3} className="px-3 py-2 text-xs font-bold text-muted-foreground">الإجمالي</td><td className="px-3 py-2 font-extrabold">{fmt(totalAmount)}</td></tr></tfoot>
                                    </table>
                                </div>
                                <button onClick={() => setWItems(i => [...i, emptyItem()])} className="w-full rounded-xl border-2 border-dashed border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/5">+ بند جديد</button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-3">
                                <div className="rounded-xl border border-border bg-muted/20 p-4 flex justify-between"><span>إجمالي الفاتورة</span><span className="font-bold">{fmt(totalAmount)} ج.م</span></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">طريقة الدفع</label>
                                    <select value={wForm.paymentMethod} onChange={e => setWForm(f => ({ ...f, paymentMethod: e.target.value as PaymentMethod }))} className={IC}>
                                        {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ المدفوع الآن</label>
                                    <input type="number" min={0} max={totalAmount} value={wForm.paidAmount} onChange={e => setWForm(f => ({ ...f, paidAmount: +e.target.value }))} className={IC} />
                                    <p className="mt-1 text-xs text-muted-foreground">المتبقي: <span className="font-bold text-rose-600">{fmt(totalAmount - wForm.paidAmount)} ج.م</span></p>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            {step > 1 && <button onClick={() => setStep(s => s - 1)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted">السابق</button>}
                            {step < 3 ? (
                                <button onClick={() => setStep(s => s + 1)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground">التالي <ChevronLeft className="h-4 w-4" /></button>
                            ) : (
                                <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"><Check className="h-4 w-4" /> حفظ</button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pay Dialog */}
            {payDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">تسجيل دفعة</h2>
                            <button onClick={() => setPayDialog(null)} className="rounded-lg p-1.5 hover:bg-muted"><X className="h-5 w-5" /></button>
                        </div>
                        <p className="text-sm">{payDialog.invoiceNumber} • متبقي: <span className="font-bold text-rose-600">{fmt(payDialog.remaining)} ج.م</span></p>
                        <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ (ج.م)</label>
                            <input type="number" min={0} value={payAmount} onChange={e => setPayAmount(+e.target.value)} className={IC} />
                            {payAmount > payDialog.remaining && <p className="mt-1 text-xs text-amber-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />يتجاوز المبلغ المتبقي</p>}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePay} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"><Check className="h-4 w-4" /> تأكيد</button>
                            <button onClick={() => setPayDialog(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
