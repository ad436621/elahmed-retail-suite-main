import { useState, useMemo } from 'react';
import { Plus, Trash2, X, Check, CreditCard, DollarSign, Search, Printer, Calendar } from 'lucide-react';
import { InstallmentContract } from '@/domain/types';
import { getContracts, addContract, addPaymentToContract, deleteContract } from '@/data/installmentsData';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { validateStock } from '@/domain/stock';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const emptyForm = {
    customerName: '', customerIdCard: '', guarantorName: '', guarantorIdCard: '',
    customerPhone: '', customerAddress: '', productId: '', productName: '',
    cashPrice: 0, installmentPrice: 0, downPayment: 0, months: 12,
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

const statusColors: Record<InstallmentContract['status'], string> = {
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    overdue: 'bg-red-100 text-red-700',
};
const statusLabels: Record<InstallmentContract['status'], string> = {
    active: 'نشط', completed: 'مكتمل', overdue: 'متأخر',
};

export default function Installments() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [contracts, setContracts] = useState<InstallmentContract[]>(() => getContracts());
    const [showForm, setShowForm] = useState(false);
    const [showPayment, setShowPayment] = useState<string | null>(null);
    const [showSchedule, setShowSchedule] = useState<InstallmentContract | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [payment, setPayment] = useState({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
    const [search, setSearch] = useState('');

    const inventory = useMemo(() => getAllInventoryProducts(), [showForm]);

    const refresh = () => setContracts(getContracts());

    const remaining = form.installmentPrice - form.downPayment;
    const monthly = form.months > 0 ? Math.floor(remaining / form.months) : 0;

    const handleSubmit = () => {
        if (!form.customerName.trim() || !form.productName.trim()) {
            toast({ title: 'خطأ', description: 'اسم العميل والمنتج مطلوبان', variant: 'destructive' });
            return;
        }

        const selectedProduct = inventory.find(p => p.id === form.productId);
        if (selectedProduct) {
            try {
                validateStock(selectedProduct, 1);
            } catch (err: any) {
                toast({ title: 'خطأ في المخزون', description: err.message || 'الكمية غير متوفرة', variant: 'destructive' });
                return;
            }
        }

        const { productId, ...contractData } = form;
        const newContract = addContract(contractData as any);

        if (selectedProduct) {
            updateProductQuantity(selectedProduct.id, selectedProduct.quantity - 1);
            saveMovements([{
                id: crypto.randomUUID(),
                productId: selectedProduct.id,
                type: 'sale', // Treating installment item as sold
                quantityChange: -1,
                previousQuantity: selectedProduct.quantity,
                newQuantity: selectedProduct.quantity - 1,
                reason: `عقد تقسيط: ${newContract.contractNumber} (${newContract.customerName})`,
                referenceId: newContract.id,
                userId: user?.id || 'system',
                timestamp: new Date().toISOString()
            }]);
        }

        toast({ title: '✅ تم إنشاء العقد بنجاح وتم خصم المنتج من المخزون', description: form.customerName });
        setForm(emptyForm); setShowForm(false); refresh();
    };

    const handlePayment = (contractId: string) => {
        if (payment.amount <= 0) { toast({ title: 'خطأ', description: 'المبلغ يجب أن يكون أكبر من صفر', variant: 'destructive' }); return; }
        addPaymentToContract(contractId, payment);
        toast({ title: '✅ تم تسجيل الدفعة', description: `${payment.amount.toLocaleString()} ج.م` });
        setShowPayment(null); setPayment({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' }); refresh();
    };

    const printContract = (c: InstallmentContract) => {
        const scheduleRows = c.schedule.map(s =>
            `<tr><td>الشهر ${s.month}</td><td>${s.dueDate}</td><td>${s.amount.toLocaleString()} ج.م</td><td>${s.paid ? '✅ مدفوع' : '⏳ منتظر'}</td></tr>`
        ).join('');
        const html = `<html dir="rtl"><head><meta charset="UTF-8"><title>عقد تقسيط</title>
        <style>body{font-family:Cairo,sans-serif;padding:32px;max-width:700px;margin:auto;}
        h2{text-align:center;}table{width:100%;border-collapse:collapse;margin-top:16px;}td,th{border:1px solid #ddd;padding:8px;text-align:right;}th{background:#f5f5f5;}
        </style></head><body>
        <h2>💳 عقد تقسيط — ${c.contractNumber}</h2>
        <p><b>العميل:</b> ${c.customerName} &nbsp; <b>البطاقة:</b> ${c.customerIdCard}</p>
        <p><b>الضامن:</b> ${c.guarantorName} &nbsp; <b>بطاقة الضامن:</b> ${c.guarantorIdCard}</p>
        <p><b>الموبايل:</b> ${c.customerPhone} &nbsp; <b>العنوان:</b> ${c.customerAddress}</p>
        <p><b>المنتج:</b> ${c.productName}</p>
        <p><b>إجمالي سعر التقسيط:</b> ${c.installmentPrice?.toLocaleString() || (c as any).totalPrice?.toLocaleString()} ج.م &nbsp; <b>سعر الكاش:</b> ${c.cashPrice?.toLocaleString() || '—'} ج.م</p>
        <p><b>المقدم:</b> ${c.downPayment.toLocaleString()} ج.م &nbsp; <b>الباقي:</b> ${c.remaining.toLocaleString()} ج.م</p>
        <p><b>عدد الأشهر:</b> ${c.months} شهر &nbsp; <b>القسط الشهري:</b> ${c.monthlyInstallment.toLocaleString()} ج.م</p>
        <table><thead><tr><th>الشهر</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead>
        <tbody>${scheduleRows}</tbody></table>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const filtered = contracts.filter(c =>
        c.customerName.includes(search) || c.customerPhone.includes(search) || c.productName.includes(search) || c.contractNumber.includes(search)
    );

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">التقسيط</h1>
                        <p className="text-xs text-muted-foreground">{contracts.length} عقد</p>
                    </div>
                </div>
                <button onClick={() => { setShowForm(true); setForm(emptyForm); }}
                    className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                    <Plus className="h-4 w-4" /> عقد تقسيط جديد
                </button>
            </div>

            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو المنتج أو رقم العقد..." className={`${IC} pr-9`} />
            </div>

            {/* New Contract Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6">
                    <div className="w-full max-w-lg mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">عقد تقسيط جديد</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم العميل *</label>
                                <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم البطاقة</label>
                                <input value={form.customerIdCard} onChange={e => setForm(f => ({ ...f, customerIdCard: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الضامن</label>
                                <input value={form.guarantorName} onChange={e => setForm(f => ({ ...f, guarantorName: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">بطاقة الضامن</label>
                                <input value={form.guarantorIdCard} onChange={e => setForm(f => ({ ...f, guarantorIdCard: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الموبايل</label>
                                <input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان</label>
                                <input value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} className={IC} />
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">المنتج (من المخزون) *</label>
                                <select
                                    value={form.productId || ''}
                                    onChange={e => {
                                        if (!e.target.value) {
                                            setForm(f => ({ ...f, productId: '', productName: '', cashPrice: 0, installmentPrice: 0 }));
                                            return;
                                        }
                                        const p = inventory.find(x => x.id === e.target.value);
                                        if (p) {
                                            const installP = Math.ceil(p.sellingPrice * 1.3); // Default 30% increase
                                            setForm(f => ({ ...f, productId: p.id, productName: p.name, cashPrice: p.sellingPrice, installmentPrice: installP }));
                                        }
                                    }}
                                    className={IC}
                                >
                                    <option value="">-- اختر منتج للصرف من المخزون --</option>
                                    {inventory.map(p => (
                                        <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                                            {p.name} {p.quantity === 0 ? '(نفد المخزون)' : `(${p.sellingPrice} ج.م - ${p.quantity} قطعة)`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">أو أدخل اسم المنتج يدوياً (بدون خصم من المخزون)</label>
                                <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: '' }))} placeholder="اسم المنتج..." className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر الكاش (ج.م)</label>
                                <input type="number" min={0} value={form.cashPrice} onChange={e => setForm(f => ({ ...f, cashPrice: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">إجمالي التقسيط (ج.م)</label>
                                <input type="number" min={0} value={form.installmentPrice} onChange={e => setForm(f => ({ ...f, installmentPrice: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">المقدم (ج.م)</label>
                                <input type="number" min={0} value={form.downPayment} onChange={e => setForm(f => ({ ...f, downPayment: +e.target.value }))} className={IC} />
                            </div>
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">عدد الأشهر</label>
                                <input type="number" min={1} value={form.months} onChange={e => setForm(f => ({ ...f, months: +e.target.value }))} className={IC} />
                            </div>
                        </div>
                        {form.installmentPrice > 0 && (
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 grid grid-cols-3 gap-2 text-center text-xs">
                                <div><p className="text-muted-foreground">الباقي</p><p className="font-bold text-blue-700 text-base">{remaining.toLocaleString()} ج.م</p></div>
                                <div><p className="text-muted-foreground">القسط الشهري</p><p className="font-bold text-primary text-base">{monthly.toLocaleString()} ج.م</p></div>
                                <div><p className="text-muted-foreground">عدد الأشهر</p><p className="font-bold text-foreground text-base">{form.months}</p></div>
                            </div>
                        )}
                        <div className="flex gap-2 pt-1">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> إنشاء العقد
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">تسجيل دفعة</h2>
                            <button onClick={() => setShowPayment(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <div className="space-y-3">
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ (ج.م)</label><input type="number" min={0} value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: +e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label><input type="date" value={payment.date} onChange={e => setPayment(p => ({ ...p, date: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظة</label><input value={payment.note} onChange={e => setPayment(p => ({ ...p, note: e.target.value }))} className={IC} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handlePayment(showPayment)} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all"><Check className="h-4 w-4" /> تسجيل الدفعة</button>
                            <button onClick={() => setShowPayment(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Schedule Modal */}
            {showSchedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSchedule(null)}>
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-foreground">جدول الأقساط</h3>
                            <button onClick={() => setShowSchedule(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        <p className="text-sm mb-4 text-muted-foreground">{showSchedule.customerName} — {showSchedule.productName}</p>
                        <div className="space-y-2">
                            {showSchedule.schedule.map(s => (
                                <div key={s.month} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border text-sm ${s.paid ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/30 border-border'}`}>
                                    <span className="font-semibold text-foreground">الشهر {s.month}</span>
                                    <span className="text-muted-foreground text-xs">{s.dueDate}</span>
                                    <span className={`font-bold ${s.paid ? 'text-emerald-600' : 'text-primary'}`}>{s.amount.toLocaleString()} ج.م</span>
                                    {s.paid ? <span className="text-xs text-emerald-600 font-semibold">✅ مدفوع</span> : <span className="text-xs text-muted-foreground">⏳ منتظر</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Contracts */}
            <div className="space-y-4">
                {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد عقود</div>
                ) : filtered.map(c => (
                    <div key={c.id} className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-all hover:shadow-md">
                        <div className="flex items-start justify-between flex-wrap gap-2">
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-bold text-foreground text-lg">{c.customerName}</h3>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[c.status]}`}>{statusLabels[c.status]}</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">{c.customerPhone} {c.customerAddress ? `• ${c.customerAddress}` : ''}</p>
                                <p className="text-xs text-muted-foreground">ضامن: {c.guarantorName || '—'} | بطاقة: {c.customerIdCard || '—'}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-xs text-muted-foreground">{c.contractNumber}</p>
                                <p className="text-sm font-semibold text-foreground">{c.productName}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">قسط شهري: <span className="font-bold text-primary">{c.monthlyInstallment.toLocaleString()} ج.م</span></p>
                            </div>
                        </div>

                        {/* Progress */}
                        <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                <span>تم السداد: <span className="font-semibold text-emerald-600">{c.paidTotal.toLocaleString()} ج.م</span></span>
                                <span>الباقي: <span className="font-semibold text-primary">{c.remaining.toLocaleString()} ج.م</span></span>
                            </div>
                            {c.status !== 'completed' && c.schedule.length > 0 && (
                                <div className="text-[11px] text-muted-foreground mb-1.5">
                                    تاريخ الانتهاء المتوقع: <span className="font-semibold">{c.schedule[c.schedule.length - 1].dueDate}</span>
                                </div>
                            )}
                            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-l from-primary to-amber-400 transition-all duration-500"
                                    style={{ width: `${Math.min(100, (c.paidTotal / (c.installmentPrice || (c as any).totalPrice)) * 100)}%` }} />
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                                <span className="text-emerald-600">{Math.round((c.paidTotal / (c.installmentPrice || (c as any).totalPrice)) * 100)}% مسدد</span>
                                <span className="text-muted-foreground">إجمالي التقسيط: {(c.installmentPrice || (c as any).totalPrice).toLocaleString()} ج.م</span>
                            </div>
                        </div>

                        {/* Payment history */}
                        {c.payments.length > 0 && (
                            <div className="rounded-xl bg-muted/20 p-3">
                                <p className="text-xs font-semibold text-muted-foreground mb-2">سجل الدفعات ({c.payments.length})</p>
                                <div className="space-y-1 max-h-20 overflow-y-auto">
                                    {c.payments.map(p => (
                                        <div key={p.id} className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">{p.date}</span>
                                            <span className="font-semibold text-emerald-600">+{p.amount.toLocaleString()} ج.م</span>
                                            {p.note && <span className="text-muted-foreground">{p.note}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 flex-wrap">
                            {c.status !== 'completed' && (
                                <button onClick={() => setShowPayment(c.id)} className="flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                                    <DollarSign className="h-3.5 w-3.5" /> تسجيل دفعة
                                </button>
                            )}
                            <button onClick={() => setShowSchedule(c)} className="flex items-center gap-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 text-xs font-semibold hover:bg-blue-100 transition-colors">
                                <Calendar className="h-3.5 w-3.5" /> جدول الأقساط
                            </button>
                            <button onClick={() => printContract(c)} className="flex items-center gap-1.5 rounded-xl bg-muted text-muted-foreground border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 transition-colors">
                                <Printer className="h-3.5 w-3.5" /> طباعة
                            </button>
                            <button onClick={() => { deleteContract(c.id); refresh(); toast({ title: 'تم الحذف' }); }} className="flex items-center gap-1.5 rounded-xl bg-red-50 text-destructive border border-red-200 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 transition-colors">
                                <X className="h-3.5 w-3.5" /> حذف
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
