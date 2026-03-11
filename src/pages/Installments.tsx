import { useState, useMemo } from 'react';
import { X, Check, CreditCard, DollarSign, Search, Printer, Calendar, Smartphone, Monitor, Tv, Car, Layers, Send, Tag, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { InstallmentContract } from '@/domain/types';
import { getContracts, addContract, addPaymentToContract, deleteContract, markScheduleItemPaid } from '@/data/installmentsData';
import { getAllInventoryProducts, updateProductQuantity } from '@/repositories/productRepository';
import { saveMovements } from '@/repositories/stockRepository';
import { validateStock } from '@/domain/stock';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams } from 'react-router-dom';
import { usePagination, PaginationBar } from '@/hooks/usePagination';

// ─── Constants ───────────────────────────────────────────────
const TRANSFER_TYPES_LIST = ['فودافون كاش', 'اتصالات كاش', 'اورنج كاش', 'ويي', 'انستاباي', 'تحويل بنكي'];

type ContractType = 'product' | 'transfer' | 'car';

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const STATUS_COLORS: Record<InstallmentContract['status'], string> = {
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
};
const STATUS_LABELS: Record<InstallmentContract['status'], string> = {
    active: 'نشط', completed: 'مكتمل', overdue: 'متأخر',
};
const TYPE_LABELS: Record<ContractType, string> = {
    product: 'بضاعة', transfer: 'تحويل', car: 'سيارة',
};
const TYPE_COLORS: Record<ContractType, string> = {
    product: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400',
    transfer: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    car: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
};

const emptyForm = {
    contractType: 'product' as ContractType,
    customerName: '', customerIdCard: '', guarantorName: '', guarantorIdCard: '',
    customerPhone: '', customerAddress: '',
    productId: '', productName: '',
    transferType: TRANSFER_TYPES_LIST[0],
    cashPrice: 0, installmentPrice: 0, downPayment: 0, months: 12,
    notes: '',
};

// ─── Main Component ───────────────────────────────────────────
export default function Installments() {
    const { toast } = useToast();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();

    // Pre-open form if ?type= param exists (used by POS deferred tab)
    const initialType = (searchParams.get('type') ?? 'product') as ContractType;

    const [contracts, setContracts] = useState<InstallmentContract[]>(() => getContracts());
    const [showForm, setShowForm] = useState(() => searchParams.has('type'));
    const [showPayment, setShowPayment] = useState<string | null>(null);
    const [showSchedule, setShowSchedule] = useState<InstallmentContract | null>(null);
    const [form, setForm] = useState({ ...emptyForm, contractType: initialType });
    const [payment, setPayment] = useState({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
    const [search, setSearch] = useState('');
    const [productCategory, setProductCategory] = useState('all');
    const [deleteTarget, setDeleteTarget] = useState<InstallmentContract | null>(null); // confirm delete

    const productCategories = [
        { id: 'all', label: 'الكل', icon: Layers },
        { id: 'mobiles', label: 'موبيلات', icon: Smartphone },
        { id: 'computers', label: 'كمبيوترات', icon: Monitor },
        { id: 'devices', label: 'أجهزة', icon: Tv },
        { id: 'cars', label: 'سيارات', icon: Car },
    ];

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const inventory = useMemo(() => getAllInventoryProducts(), [showForm, contracts]);

    const filteredInventory = useMemo(() => {
        if (productCategory === 'all') return inventory;
        return inventory.filter(p => {
            const cat = (p.category || '').toLowerCase();
            if (productCategory === 'mobiles') return cat.includes('موبيل') || cat.includes('موبايل') || cat.includes('mobile') || cat.includes('phone') || cat.includes('تبل') || cat.includes('tablet');
            if (productCategory === 'computers') return cat.includes('لابتوب') || cat.includes('كمبير') || cat.includes('computer') || cat.includes('laptop') || cat.includes('desktop');
            if (productCategory === 'devices') return cat.includes('شاشة') || cat.includes('screen') || cat.includes('device') || cat.includes('gaming') || cat.includes('لعب');
            if (productCategory === 'cars') return cat.includes('سيارة') || cat.includes('car');
            return true;
        });
    }, [inventory, productCategory]);

    const refresh = () => setContracts(getContracts());

    const remaining = form.installmentPrice - form.downPayment;
    const monthly = form.months > 0 ? Math.floor(remaining / form.months) : 0;

    // ─── Submit ───────────────────────────────────────────────
    const handleSubmit = () => {
        if (!form.customerName.trim()) {
            toast({ title: 'خطأ', description: 'اسم العميل مطلوب', variant: 'destructive' });
            return;
        }
        if (form.contractType !== 'transfer' && !form.productName.trim()) {
            toast({ title: 'خطأ', description: 'اسم المنتج أو السيارة مطلوب', variant: 'destructive' });
            return;
        }
        if (form.installmentPrice <= 0) {
            toast({ title: 'خطأ', description: 'أدخل إجمالي الأجل', variant: 'destructive' });
            return;
        }

        // Validate stock for product type
        const selectedProduct = form.contractType === 'product' ? inventory.find(p => p.id === form.productId) : null;
        if (selectedProduct) {
            try { validateStock(selectedProduct, 1); }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'الكمية غير متوفرة';
                toast({ title: 'خطأ في المخزون', description: msg, variant: 'destructive' });
                return;
            }
        }

        const { productId, ...contractData } = form;
        const finalData =
            form.contractType === 'transfer'
                ? { ...contractData, productName: `تحويل ${form.transferType}`, contractType: 'transfer' as ContractType }
                : { ...contractData, contractType: form.contractType };

        const newContract = addContract(finalData as any);

        // Deduct from stock if product was selected from inventory
        if (selectedProduct) {
            updateProductQuantity(selectedProduct.id, selectedProduct.quantity - 1);
            saveMovements([{
                id: crypto.randomUUID(),
                productId: selectedProduct.id,
                type: 'sale',
                quantityChange: -1,
                previousQuantity: selectedProduct.quantity,
                newQuantity: selectedProduct.quantity - 1,
                reason: `عقد أجل: ${newContract.contractNumber} (${newContract.customerName})`,
                referenceId: newContract.id,
                userId: user?.id || 'system',
                timestamp: new Date().toISOString(),
            }]);
        }

        toast({ title: `✅ تم إنشاء عقد ${TYPE_LABELS[form.contractType]} بالأجل`, description: form.customerName });
        setForm(emptyForm);
        setShowForm(false);
        refresh();
    };

    // ─── Payment ──────────────────────────────────────────────
    const handlePayment = (contractId: string) => {
        if (payment.amount <= 0) {
            toast({ title: 'خطأ', description: 'المبلغ يجب أن يكون أكبر من صفر', variant: 'destructive' });
            return;
        }
        addPaymentToContract(contractId, payment);
        toast({ title: '✅ تم تسجيل الدفعة', description: `${payment.amount.toLocaleString()} ج.م` });
        setShowPayment(null);
        setPayment({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
        refresh();
    };

    // ─── Print ────────────────────────────────────────────────
    const printContract = (c: InstallmentContract) => {
        const scheduleRows = c.schedule.map(s =>
            `<tr><td>الشهر ${s.month}</td><td>${s.dueDate}</td><td>${s.amount.toLocaleString()} ج.م</td><td>${s.paid ? '✅ مدفوع' : '⏳ منتظر'}</td></tr>`
        ).join('');
        const cType = (c.contractType ?? 'product') as ContractType;
        const html = `<html dir="rtl"><head><meta charset="UTF-8"><title>عقد أجل</title>
        <style>body{font-family:Cairo,sans-serif;padding:32px;max-width:700px;margin:auto;}
        h2{text-align:center;}table{width:100%;border-collapse:collapse;margin-top:16px;}td,th{border:1px solid #ddd;padding:8px;text-align:right;}th{background:#f5f5f5;}
        </style></head><body>
        <h2>💳 عقد ${TYPE_LABELS[cType]} بالأجل — ${c.contractNumber}</h2>
        <p><b>العميل:</b> ${c.customerName} &nbsp; <b>البطاقة:</b> ${c.customerIdCard}</p>
        <p><b>الضامن:</b> ${c.guarantorName} &nbsp; <b>بطاقة الضامن:</b> ${c.guarantorIdCard}</p>
        <p><b>الموبايل:</b> ${c.customerPhone} &nbsp; <b>العنوان:</b> ${c.customerAddress}</p>
        <p><b>${cType === 'transfer' ? 'نوع التحويل' : 'المنتج'}:</b> ${c.productName}</p>
        ${c.notes ? `<p><b>ملاحظة:</b> ${c.notes}</p>` : ''}
        <p><b>إجمالي الأجل:</b> ${(c.installmentPrice || (c as any).totalPrice || 0).toLocaleString()} ج.م &nbsp; <b>سعر الكاش:</b> ${c.cashPrice?.toLocaleString() || '—'} ج.م</p>
        <p><b>المقدم:</b> ${c.downPayment.toLocaleString()} ج.م &nbsp; <b>الباقي:</b> ${c.remaining.toLocaleString()} ج.م</p>
        <p><b>عدد الأشهر:</b> ${c.months} شهر &nbsp; <b>القسط الشهري:</b> ${c.monthlyInstallment.toLocaleString()} ج.م</p>
        <table><thead><tr><th>الشهر</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead>
        <tbody>${scheduleRows}</tbody></table>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const filtered = useMemo(() => contracts.filter(c =>
        c.customerName.includes(search) || c.customerPhone.includes(search) ||
        c.productName.includes(search) || c.contractNumber.includes(search)
    ).sort((a, b) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0), [contracts, search]);

    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage } = usePagination(filtered, 15);

    // ─── Render ───────────────────────────────────────────────
    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 border border-blue-200">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">البيع بالأجل / التقسيط</h1>
                        <p className="text-xs text-muted-foreground">
                            {contracts.length} عقد ·{' '}
                            <span className="text-blue-600">{contracts.filter(c => c.status === 'active').length} نشط</span> ·{' '}
                            <span className="text-red-600">{contracts.filter(c => c.status === 'overdue').length} متأخر</span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(['product', 'transfer', 'car'] as ContractType[]).map(t => (
                        <button key={t}
                            onClick={() => { setForm({ ...emptyForm, contractType: t }); setShowForm(true); }}
                            className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all shadow-sm ${t === 'product' ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                : t === 'transfer' ? 'bg-amber-500 text-white hover:bg-amber-600'
                                    : 'bg-sky-600 text-white hover:bg-sky-700'
                                }`}>
                            {t === 'product' ? <><Tag className="h-4 w-4" /> أجل بضاعة</>
                                : t === 'transfer' ? <><Send className="h-4 w-4" /> أجل تحويل</>
                                    : <><Car className="h-4 w-4" /> أجل سيارة</>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="بحث بالاسم أو المنتج أو رقم العقد..."
                    className={`${IC} pr-9`} />
            </div>

            {/* ─── New Contract Modal ─────────────────────────────── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-6" onClick={() => setShowForm(false)}>
                    <div className="w-full max-w-lg mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">
                                {form.contractType === 'transfer' ? '🔄 عقد أجل تحويل مالي'
                                    : form.contractType === 'car' ? '🚗 عقد أجل سيارة'
                                        : '📦 عقد أجل بضاعة'}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Contract type switcher */}
                        <div className="flex rounded-xl overflow-hidden border border-border/60">
                            {(['product', 'transfer', 'car'] as ContractType[]).map(t => (
                                <button key={t}
                                    onClick={() => setForm(f => ({ ...f, contractType: t, productName: '', productId: '' }))}
                                    className={`flex-1 py-2 text-xs font-bold transition-all ${form.contractType === t
                                        ? t === 'product' ? 'bg-primary text-primary-foreground'
                                            : t === 'transfer' ? 'bg-amber-500 text-white'
                                                : 'bg-sky-600 text-white'
                                        : 'text-muted-foreground hover:bg-muted/50'
                                        }`}>
                                    {t === 'product' ? '📦 بضاعة' : t === 'transfer' ? '🔄 تحويل' : '🚗 سيارة'}
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">اسم العميل *</label>
                                <input data-validation="text-only" value={form.customerName}
                                    onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">رقم البطاقة</label>
                                <input value={form.customerIdCard}
                                    onChange={e => setForm(f => ({ ...f, customerIdCard: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">الضامن</label>
                                <input data-validation="text-only" value={form.guarantorName}
                                    onChange={e => setForm(f => ({ ...f, guarantorName: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">بطاقة الضامن</label>
                                <input value={form.guarantorIdCard}
                                    onChange={e => setForm(f => ({ ...f, guarantorIdCard: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">موبايل العميل</label>
                                <input data-validation="phone" value={form.customerPhone}
                                    onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">العنوان</label>
                                <input value={form.customerAddress}
                                    onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} className={IC} />
                            </div>

                            {/* ── Section based on contract type ── */}
                            {form.contractType === 'transfer' ? (
                                <>
                                    <div className="col-span-2">
                                        <label className="mb-1 block text-xs font-semibold text-amber-600">🔄 نوع التحويل *</label>
                                        <select value={form.transferType}
                                            onChange={e => setForm(f => ({ ...f, transferType: e.target.value }))} className={IC}>
                                            {TRANSFER_TYPES_LIST.map(t => <option key={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظة (اختياري)</label>
                                        <input value={form.notes}
                                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                            placeholder="تفاصيل إضافية عن التحويل..."
                                            className={IC} />
                                    </div>
                                </>
                            ) : (
                                <div className="col-span-2">
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                                        {form.contractType === 'car' ? '🚗 اسم السيارة / الموديل *' : '📦 المنتج (من المخزون)'}
                                    </label>
                                    {form.contractType !== 'car' && (
                                        <>
                                            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                                                {productCategories.map(cat => {
                                                    const Icon = cat.icon;
                                                    return (
                                                        <button key={cat.id} type="button" onClick={() => setProductCategory(cat.id)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all ${productCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}>
                                                            <Icon className="h-3 w-3" />{cat.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <select value={form.productId || ''}
                                                onChange={e => {
                                                    if (!e.target.value) { setForm(f => ({ ...f, productId: '', productName: '', cashPrice: 0, installmentPrice: 0 })); return; }
                                                    const p = inventory.find(x => x.id === e.target.value);
                                                    if (p) {
                                                        const installP = Math.ceil(p.sellingPrice * 1.3);
                                                        setForm(f => ({ ...f, productId: p.id, productName: p.name, cashPrice: p.sellingPrice, installmentPrice: installP }));
                                                    }
                                                }}
                                                className={IC}>
                                                <option value="">-- اختر منتج للصرف من المخزون --</option>
                                                {filteredInventory.map(p => (
                                                    <option key={p.id} value={p.id} disabled={p.quantity === 0}>
                                                        {p.name} {p.quantity === 0 ? '(نفد المخزون)' : `(${p.sellingPrice} ج.م - ${p.quantity} قطعة)`}
                                                    </option>
                                                ))}
                                            </select>
                                            <label className="mb-1 mt-2 block text-xs font-semibold text-muted-foreground">أو أدخل يدوياً (بدون خصم من المخزون)</label>
                                        </>
                                    )}
                                    <input value={form.productName}
                                        onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: '' }))}
                                        placeholder={form.contractType === 'car' ? 'مثال: تويوتا كورولا 2022' : 'اسم المنتج...'}
                                        className={IC} />
                                </div>
                            )}

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">سعر الكاش (ج.م)</label>
                                <input type="number" min={0} value={form.cashPrice}
                                    onChange={e => setForm(f => ({ ...f, cashPrice: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">إجمالي الأجل (ج.م) *</label>
                                <input type="number" min={0} value={form.installmentPrice}
                                    onChange={e => setForm(f => ({ ...f, installmentPrice: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">المقدم (ج.م)</label>
                                <input type="number" min={0} value={form.downPayment}
                                    onChange={e => setForm(f => ({ ...f, downPayment: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground">عدد الأشهر</label>
                                <input type="number" min={1} value={form.months}
                                    onChange={e => setForm(f => ({ ...f, months: +e.target.value }))} className={IC} />
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
                            <button onClick={handleSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
                                <Check className="h-4 w-4" /> إنشاء عقد الأجل
                            </button>
                            <button onClick={() => setShowForm(false)}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Payment Modal ──────────────────────────────────── */}
            {showPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPayment(null)}>
                    <div className="w-full max-w-sm mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-foreground">تسجيل دفعة</h2>
                            <button onClick={() => setShowPayment(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">المبلغ (ج.م)</label>
                                <input type="number" min={0} value={payment.amount}
                                    onChange={e => setPayment(p => ({ ...p, amount: +e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">التاريخ</label>
                                <input type="date" value={payment.date}
                                    onChange={e => setPayment(p => ({ ...p, date: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1 block text-xs font-semibold text-muted-foreground">ملاحظة</label>
                                <input value={payment.note}
                                    onChange={e => setPayment(p => ({ ...p, note: e.target.value }))} className={IC} /></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => handlePayment(showPayment)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 transition-all">
                                <Check className="h-4 w-4" /> تسجيل الدفعة
                            </button>
                            <button onClick={() => setShowPayment(null)}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Schedule Modal ────────────────────────────────── */}
            {showSchedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSchedule(null)}>
                    <div className="w-full max-w-md mx-4 rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold text-foreground">جدول الأقساط الشهرية</h3>
                            <button onClick={() => setShowSchedule(null)} className="rounded-lg p-1.5 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                        <p className="text-sm mb-1 font-semibold text-foreground">{showSchedule.customerName}</p>
                        <p className="text-xs text-muted-foreground mb-4">{showSchedule.productName} — قسط شهري: <span className="font-bold text-primary">{showSchedule.monthlyInstallment.toLocaleString()} ج.م</span></p>
                        <div className="space-y-2">
                            {showSchedule.schedule.map(s => {
                                const today = new Date().toISOString().slice(0, 10);
                                const isOverdue = !s.paid && s.dueDate < today;
                                return (
                                    <div key={s.month} className={`flex items-center justify-between rounded-xl px-3 py-2.5 border text-sm gap-2 ${s.paid ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20'
                                        : isOverdue ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
                                            : 'bg-muted/30 border-border'
                                        }`}>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`font-bold text-xs w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${s.paid ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : isOverdue ? 'bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400' : 'bg-primary/10 text-primary'
                                                }`}>{s.month}</span>
                                            <div>
                                                <p className="text-xs text-muted-foreground">{s.dueDate}</p>
                                                <p className={`font-bold text-sm ${s.paid ? 'text-emerald-700 dark:text-emerald-400' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{s.amount.toLocaleString()} ج.م</p>
                                            </div>
                                        </div>
                                        {s.paid ? (
                                            <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold shrink-0"><CheckCircle2 className="h-4 w-4" /> مدفوع</span>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    markScheduleItemPaid(showSchedule.id, s.month);
                                                    refresh();
                                                    // Update showSchedule state to reflect change
                                                    setShowSchedule(prev => prev ? { ...prev, schedule: prev.schedule.map(x => x.month === s.month ? { ...x, paid: true } : x), paidTotal: prev.paidTotal + s.amount, remaining: Math.max(0, prev.remaining - s.amount) } : null);
                                                }}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${isOverdue ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                    }`}>
                                                <DollarSign className="h-3.5 w-3.5" /> {isOverdue ? 'دفع (متأخر)' : 'دفع'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Totals summary */}
                        <div className="mt-4 rounded-xl bg-muted/30 border border-border p-3 grid grid-cols-2 gap-2 text-center text-xs">
                            <div><p className="text-muted-foreground">تم السداد</p><p className="font-bold text-emerald-600 text-base">{showSchedule.paidTotal.toLocaleString()} ج.م</p></div>
                            <div><p className="text-muted-foreground">الباقي</p><p className="font-bold text-primary text-base">{showSchedule.remaining.toLocaleString()} ج.م</p></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Contracts List ────────────────────────────────── */}
            <div className="space-y-4">
                {paginatedItems.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد عقود</div>
                ) : paginatedItems.map(c => {
                    const cType = (c.contractType ?? 'product') as ContractType;
                    const totalPrice = c.installmentPrice || (c as any).totalPrice || 0;
                    return (
                        <div key={c.id} className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-all hover:shadow-md">
                            <div className="flex items-start justify-between flex-wrap gap-2">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="font-bold text-foreground text-lg">{c.customerName}</h3>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TYPE_COLORS[cType]}`}>{TYPE_LABELS[cType]}</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{c.customerPhone} {c.customerAddress ? `• ${c.customerAddress}` : ''}</p>
                                    <p className="text-xs text-muted-foreground">ضامن: {c.guarantorName || '—'} | بطاقة: {c.customerIdCard || '—'}</p>
                                    {c.notes && <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">📝 {c.notes}</p>}
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
                                        style={{ width: `${Math.min(100, totalPrice > 0 ? (c.paidTotal / totalPrice) * 100 : 0)}%` }} />
                                </div>
                                <div className="flex justify-between text-xs mt-1">
                                    <span className="text-emerald-600">{totalPrice > 0 ? Math.round((c.paidTotal / totalPrice) * 100) : 0}% مسدد</span>
                                    <span className="text-muted-foreground">إجمالي الأجل: {totalPrice.toLocaleString()} ج.م</span>
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
                                    <button onClick={() => setShowPayment(c.id)}
                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                                        <DollarSign className="h-3.5 w-3.5" /> تسجيل دفعة
                                    </button>
                                )}
                                <button onClick={() => setShowSchedule(c)}
                                    className="flex items-center gap-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 text-xs font-semibold hover:bg-blue-100 transition-colors">
                                    <Calendar className="h-3.5 w-3.5" /> جدول الأقساط
                                </button>
                                <button onClick={() => printContract(c)}
                                    className="flex items-center gap-1.5 rounded-xl bg-muted text-muted-foreground border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 transition-colors">
                                    <Printer className="h-3.5 w-3.5" /> طباعة
                                </button>
                                <button onClick={() => setDeleteTarget(c)}
                                    className="flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 text-destructive border border-red-200 dark:border-red-500/20 px-3 py-1.5 text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" /> حذف
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPrev={prevPage} onNext={nextPage} onPage={setPage} />

            {/* ─── Confirm Delete Dialog ─── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/15">
                                <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground">تأكيد حذف العقد</h3>
                                <p className="text-xs text-muted-foreground">هذا الإجراء لا يمكن التراجع عنه</p>
                            </div>
                        </div>
                        <p className="text-sm text-foreground mb-1">هل تريد حذف عقد الأجل:</p>
                        <p className="text-sm font-bold text-foreground mb-1">«{deleteTarget.customerName} — {deleteTarget.productName}»</p>
                        <p className="text-xs text-muted-foreground mb-4">رقم العقد: {deleteTarget.contractNumber}</p>
                        <div className="flex gap-2">
                            <button onClick={() => { deleteContract(deleteTarget.id); setDeleteTarget(null); refresh(); toast({ title: '🗑️ تم حذف العقد', description: deleteTarget.customerName }); }}
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
        </div>
    );
}
