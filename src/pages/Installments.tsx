import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, CreditCard, DollarSign, Search, Printer, Calendar, Smartphone, Monitor, Tv, Car, Layers, Send, Tag, CheckCircle2, Trash2, AlertTriangle, Download } from 'lucide-react';
import { exportToExcel, INSTALLMENT_COLUMNS, prepareInstallmentsForExport } from '@/services/excelService';
import { InstallmentContract } from '@/domain/types';
import { getContracts, addContract, addPaymentToContract, deleteContract, payInstallment } from '@/data/installmentsData';
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

        const newContract = addContract(finalData as unknown as Omit<InstallmentContract, 'id' | 'createdAt' | 'updatedAt'>);

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
        const scheduleRows = c.schedule.map(s => {
            const extra = s.penalty ? `<br><span style="color:#dc2626;font-size:11px">(+${s.penalty} ج.م غرامة)</span>` : '';
            return `<tr>
                <td>القسط ${s.month}</td>
                <td style="font-family:monospace;">${s.dueDate}</td>
                <td><b>${(s.amount + (s.penalty || 0)).toLocaleString()}</b> ج.م ${extra}</td>
                <td>${s.paid ? '<span style="color:#16a34a;font-weight:bold;">✅ مسدد</span>' : '<span style="color:#ea580c;font-weight:bold;">⏳ مستحق</span>'}</td>
            </tr>`;
        }).join('');
        
        const cType = (c.contractType ?? 'product') as ContractType;
        const totalP = (c.installmentPrice || (c as unknown as {totalPrice?: number}).totalPrice || 0);
        
        const html = `<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>عقد ${TYPE_LABELS[cType]} بالأجل - ${c.contractNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    * { box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; padding: 40px; max-width: 900px; margin: auto; background: #fff; color: #0f172a; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { margin: 0; color: #1e3a8a; font-size: 28px; font-weight: 900; letter-spacing: -0.5px; }
    .header p { margin: 5px 0 0; color: #64748b; font-size: 15px; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 30px;}
    .box { border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; background: #f8fafc; }
    .box h3 { margin-top: 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; color: #1e293b; font-size: 17px; margin-bottom: 15px; font-weight: 700; }
    .row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 6px; }
    .row:last-child { border-bottom: none; padding-bottom: 0; margin-bottom: 0; }
    .row strong { color: #475569; font-weight: 600; }
    .row span { font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px; }
    th { background: #f1f5f9; color: #334155; font-weight: 700; padding: 12px; border: 1px solid #cbd5e1; text-align: right; }
    td { padding: 12px; border: 1px solid #cbd5e1; text-align: right; vertical-align: middle; }
    .terms { margin-top: 40px; font-size: 13px; color: #334155; border-top: 2px solid #e2e8f0; padding-top: 25px; background: #f8fafc; padding: 25px; border-radius: 12px; }
    .terms h4 { margin: 0 0 15px; color: #0f172a; font-size: 16px; font-weight: 700; }
    .terms ol { padding-right: 25px; margin: 0; }
    .terms li { margin-bottom: 10px; text-align: justify; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 50px; text-align: center; }
    .sig-block { background: #f1f5f9; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
    .sig-block h4 { margin: 0 0 10px; color: #334155; font-size: 15px; }
    .sig-line { border-bottom: 2px dashed #94a3b8; margin: 50px 20px 20px; }
    .sig-name { font-size: 13px; color: #64748b; font-weight: 600; }
    @media print { body { padding: 0; max-width: none; } .box, .terms, .sig-block { border-color: #000; background: transparent; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>📝 عقد اتفاق بيع بالأجل / تقسيط</h1>
    <p>رقم العقد: <span style="font-family:monospace;color:#0f172a;font-weight:700;">${c.contractNumber}</span> &nbsp;|&nbsp; تاريخ التحرير: <span style="font-family:monospace;color:#0f172a;font-weight:700;">${new Date().toLocaleDateString('ar-EG')}</span></p>
  </div>

  <div class="grid">
    <div class="box">
      <h3>👤 الطرف الأول (البائع / الدائن)</h3>
      <div class="row"><strong>اسم الشركة / المعرض:</strong> <span>...............</span></div>
      <div class="row"><strong>المدير المسئول:</strong> <span>...............</span></div>
      <div class="row"><strong>رقم الهاتف:</strong> <span>...............</span></div>
    </div>
    
    <div class="box">
      <h3>👥 الطرف الثاني (المشتري / المدين)</h3>
      <div class="row"><strong>الاســــــــــم:</strong> <span>${c.customerName || '—'}</span></div>
      <div class="row"><strong>الرقم القومي:</strong> <span>${c.customerIdCard || '—'}</span></div>
      <div class="row"><strong>رقم الهاتف:</strong> <span style="font-family:monospace">${c.customerPhone || '—'}</span></div>
      <div class="row"><strong>العنـــــــوان:</strong> <span>${c.customerAddress || '—'}</span></div>
    </div>
  </div>

  <div class="grid-3">
    <div class="box">
      <h3>📌 تفاصيل ${cType === 'transfer' ? 'التحويل' : cType === 'car' ? 'السيارة' : 'المنتج'}</h3>
      <div class="row" style="flex-direction:column;border:none;">
        <span style="font-size:16px;color:#2563eb;margin-top:5px;line-height:1.4;">${c.productName}</span>
      </div>
      ${c.notes ? `<div class="row" style="border:none;margin-top:10px;"><strong style="font-size:12px;">ملاحظة:</strong> <span style="font-size:13px">${c.notes}</span></div>` : ''}
    </div>
    <div class="box">
      <h3>🛡️ بيانات الضامن المتضامن</h3>
      <div class="row"><strong>الاســــــــــم:</strong> <span>${c.guarantorName || '—'}</span></div>
      <div class="row"><strong>الرقم القومي:</strong> <span>${c.guarantorIdCard || '—'}</span></div>
      <div class="row"><strong>رقم الهاتف:</strong> <span style="font-family:monospace">${c.guarantorPhone || '—'}</span></div>
      <div class="row"><strong>العنـــــــوان:</strong> <span>${c.guarantorAddress || '—'}</span></div>
    </div>
    <div class="box" style="background:#eff6ff; border-color:#bfdbfe;">
      <h3 style="color:#1d4ed8;border-bottom-color:#bfdbfe;">💰 القيم المالية</h3>
      <div class="row"><strong>إجمالي قيمة التعاقد:</strong> <span style="color:#1d4ed8;font-size:16px">${totalP.toLocaleString()} ج.م</span></div>
      <div class="row"><strong>المقدم المدفوع:</strong> <span>${c.downPayment.toLocaleString()} ج.م</span></div>
      <div class="row"><strong>الباقي للتقسيط:</strong> <span style="color:#dc2626;font-size:16px">${c.remaining.toLocaleString()} ج.م</span></div>
      <div class="row"><strong>عدد الأشهر / الأقساط:</strong> <span>${c.months} شهر</span></div>
      <div class="row"><strong>قيمة القسط الشهري:</strong> <span>${c.monthlyInstallment.toLocaleString()} ج.م</span></div>
    </div>
  </div>

  <h3 style="border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px; color:#1e293b;">📅 جدول سداد الأقساط</h3>
  <table>
    <thead><tr><th>البيان</th><th>تاريخ الاستحقاق المتفق عليه</th><th>المبلغ المستحق</th><th>حالة السداد</th></tr></thead>
    <tbody>${scheduleRows}</tbody>
  </table>

  <div class="terms">
    <h4>⚖️ الشروط والأحكام والاتفاق</h4>
    <p style="margin-top:0;font-weight:600;">أقر أنا الموقع أدناه (الطرف الثاني - المشتري) بصفتي بكامل أهليتي القانونية وأقر (الضامن المتضامن) بما يلي:</p>
    <ol>
      <li>بأنني استلمت (المنتج / السلعة / التحويل) المذكور بياناته أعلاه بحالة جيدة وخالية من العيوب واستلمتها استلاماً فعلياً.</li>
      <li>أتعهد بسداد الأقساط الشهرية الموضحة بالجدول أعلاه في مواعيد استحقاقها تماماً وبدون أي تأخير للطرف الأول.</li>
      <li>في حالة تأخري عن سداد أي قسط في موعده يحق للطرف الأول المطالبة بكامل المبلغ المتبقي فورا دفعة واحدة دون الحاجة لتنبيه أو إنذار.</li>
      <li>في حالة التأخير يحق للطرف الأول احتساب غرامات تأخير وإضافتها على المديونية المتبقية حسب ما يراه مناسبا.</li>
      <li>يقر الضامن بأنه ضامن متضامن متكافل مع الطرف الثاني في كافة التزاماته المادية ويسأل ماله الخاص عن سداد المديونية في حالة تعثر الطرف الثاني.</li>
      <li>يخضع هذا العقد لأحكام القوانين المدنية والتجارية، وتعتبر محاكم الدائرة التابع لها الطرف الأول هي المختصة في حال نشوب أي نزاع قانوني.</li>
    </ol>
  </div>

  <div class="signatures">
    <div class="sig-block">
      <h4>الطرف الأول (البائع)</h4>
      <div class="sig-line"></div>
      <div class="sig-name">الاسم / التوقيع / الختم</div>
    </div>
    <div class="sig-block">
      <h4>الطرف الثاني (المشتري)</h4>
      <div class="sig-line"></div>
      <div class="sig-name">الاسم: ${c.customerName || ''}<br>التوقيع / البصمة</div>
    </div>
    <div class="sig-block">
      <h4>الضامن المتضامن</h4>
      <div class="sig-line"></div>
      <div class="sig-name">الاسم: ${c.guarantorName || ''}<br>التوقيع / البصمة</div>
    </div>
  </div>
</body>
</html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 250); }
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
                    <button
                        onClick={() => exportToExcel({ data: prepareInstallmentsForExport(contracts), columns: INSTALLMENT_COLUMNS, fileName: 'التقسيط' })}
                        className="flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-sm">
                        <Download className="h-4 w-4" /> تصدير Excel
                    </button>
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
            {showForm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowForm(false)}>
                    <div className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] animate-scale-in" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between shrink-0 p-5 border-b border-border/50">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                {form.contractType === 'transfer' ? <><Send className="h-6 w-6 text-amber-500" /> عقد أجل تحويل مالي</>
                                    : form.contractType === 'car' ? <><Car className="h-6 w-6 text-sky-500" /> عقد أجل سيارة</>
                                        : <><Tag className="h-6 w-6 text-primary" /> عقد أجل بضاعة</>}
                            </h2>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 bg-muted/50 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Scrolling Content */}
                        <div className="overflow-y-auto p-5 space-y-6">
                            
                            {/* Type Switch */}
                            <div className="flex rounded-xl overflow-hidden border border-border/60 bg-muted/30 p-1 gap-1 w-full max-w-md mx-auto">
                                {(['product', 'transfer', 'car'] as ContractType[]).map(t => (
                                    <button key={t}
                                        onClick={() => setForm(f => ({ ...f, contractType: t, productName: '', productId: '' }))}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${form.contractType === t
                                            ? t === 'product' ? 'bg-primary text-primary-foreground shadow-sm'
                                                : t === 'transfer' ? 'bg-amber-500 text-white shadow-sm'
                                                    : 'bg-sky-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}>
                                        {t === 'product' ? <><Tag className="h-4 w-4"/> بضاعة</> : t === 'transfer' ? <><Send className="h-4 w-4"/> تحويل</> : <><Car className="h-4 w-4"/> سيارة</>}
                                    </button>
                                ))}
                            </div>

                            {/* Section: Customer Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-primary flex items-center gap-2 border-b border-border/50 pb-2"><CreditCard className="h-4 w-4" /> بيانات العميل الأساسية</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اسم العميل <span className="text-destructive">*</span></label>
                                        <input data-validation="text-only" value={form.customerName}
                                            onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className={IC} placeholder="الاسم الرباعي..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">موبايل العميل</label>
                                        <input data-validation="phone" value={form.customerPhone}
                                            onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} className={IC} placeholder="01X..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">رقم البطاقة</label>
                                        <input value={form.customerIdCard}
                                            onChange={e => setForm(f => ({ ...f, customerIdCard: e.target.value }))} className={IC} placeholder="14 رقم..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">العنوان</label>
                                        <input value={form.customerAddress}
                                            onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} className={IC} placeholder="المدينة، الحي..." />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Guarantor Info */}
                            <div className="space-y-4 bg-muted/10 p-4 rounded-2xl border border-border/30">
                                <h3 className="font-semibold text-sm text-primary flex items-center gap-2 border-b border-border/50 pb-2"><Layers className="h-4 w-4" /> تفاصيل الضامن (اختياري)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اسم الضامن</label>
                                        <input data-validation="text-only" value={form.guarantorName}
                                            onChange={e => setForm(f => ({ ...f, guarantorName: e.target.value }))} className={IC} placeholder="اسم الضامن..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">بطاقة الضامن</label>
                                        <input value={form.guarantorIdCard}
                                            onChange={e => setForm(f => ({ ...f, guarantorIdCard: e.target.value }))} className={IC} placeholder="14 رقم..." />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Section: Product/Transfer Info */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-primary flex items-center gap-2 border-b border-border/50 pb-2">
                                    {form.contractType === 'transfer' ? <><Send className="h-4 w-4"/> بيانات التحويل</> : <><Tag className="h-4 w-4"/> بيانات المنتج</>}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {form.contractType === 'transfer' ? (
                                        <>
                                            <div className="md:col-span-2">
                                                <label className="mb-1.5 block text-xs font-semibold text-amber-600">🔄 نوع التحويل <span className="text-destructive">*</span></label>
                                                <select value={form.transferType}
                                                    onChange={e => setForm(f => ({ ...f, transferType: e.target.value }))} className={IC}>
                                                    {TRANSFER_TYPES_LIST.map(t => <option key={t}>{t}</option>)}
                                                </select>
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ملاحظة (اختياري)</label>
                                                <input value={form.notes}
                                                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                                    placeholder="تفاصيل إضافية عن التحويل..."
                                                    className={IC} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="md:col-span-2">
                                            <label className="mb-1.5 block text-xs font-semibold text-foreground">
                                                {form.contractType === 'car' ? '🚗 اسم السيارة / الموديل *' : '📦 المنتج (من المخزون)'}
                                            </label>
                                            {form.contractType !== 'car' && (
                                                <div className="bg-muted/30 border border-border/50 p-4 rounded-xl space-y-3 mb-3">
                                                    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                                                        {productCategories.map(cat => {
                                                            const Icon = cat.icon;
                                                            return (
                                                                <button key={cat.id} type="button" onClick={() => setProductCategory(cat.id)}
                                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${productCategory === cat.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-background border border-border text-muted-foreground hover:bg-muted'}`}>
                                                                    <Icon className="h-3.5 w-3.5" />{cat.label}
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
                                                                {p.name} {p.quantity === 0 ? '(نفد المخزون)' : `(${p.sellingPrice.toLocaleString()} ج.م - ${p.quantity} قطعة)`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <div className="flex items-center gap-2">
                                                        <hr className="flex-1 border-border/50" />
                                                        <span className="text-[10px] text-muted-foreground">أو</span>
                                                        <hr className="flex-1 border-border/50" />
                                                    </div>
                                                </div>
                                            )}
                                            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اسم المنتج (يدوي بدون خصم من المخزون)</label>
                                            <input value={form.productName}
                                                onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: '' }))}
                                                placeholder={form.contractType === 'car' ? 'مثال: تويوتا كورولا 2022' : 'اسم المنتج...'}
                                                className={IC} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Section: Financials */}
                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm text-primary flex items-center gap-2 border-b border-border/50 pb-2"><DollarSign className="h-4 w-4" /> التفاصيل المالية</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">سعر الكاش (ج.م)</label>
                                        <input type="number" min={0} value={form.cashPrice || ''}
                                            onChange={e => setForm(f => ({ ...f, cashPrice: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">إجمالي الأجل <span className="text-destructive">*</span></label>
                                        <input type="number" min={0} value={form.installmentPrice || ''}
                                            onChange={e => setForm(f => ({ ...f, installmentPrice: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">المقدم (ج.م)</label>
                                        <input type="number" min={0} value={form.downPayment || ''}
                                            onChange={e => setForm(f => ({ ...f, downPayment: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">عدد الأشهر</label>
                                        <input type="number" min={1} value={form.months || ''}
                                            onChange={e => setForm(f => ({ ...f, months: +e.target.value }))} className={IC} />
                                    </div>
                                </div>

                                {form.installmentPrice > 0 && (
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 grid grid-cols-3 gap-2 text-center text-sm shadow-inner transition-all">
                                        <div><p className="text-muted-foreground text-xs mb-1">المبلغ المتبقي</p><p className="font-bold text-blue-700 text-lg">{remaining.toLocaleString()} ج.م</p></div>
                                        <div className="border-x border-blue-200/50"><p className="text-muted-foreground text-xs mb-1">القسط الشهري</p><p className="font-bold text-primary text-lg">{monthly.toLocaleString()} ج.م</p></div>
                                        <div><p className="text-muted-foreground text-xs mb-1">عدد الأشهر</p><p className="font-bold text-foreground text-lg">{form.months}</p></div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-5 shrink-0 border-t border-border/50 bg-muted/20">
                            <button onClick={handleSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5">
                                <Check className="h-5 w-5" /> إنشاء العقد
                            </button>
                            <button onClick={() => setShowForm(false)}
                                className="px-6 rounded-xl border border-border/80 bg-background text-foreground py-3 text-sm font-semibold hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ─── Payment Modal ──────────────────────────────────── */}
            {showPayment && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowPayment(null)}>
                    <div className="w-full max-w-sm rounded-3xl border border-border bg-card shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-border/50">
                            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">تسجيل دفعة جديدة</h2>
                            <button onClick={() => setShowPayment(null)} className="rounded-full p-2 hover:bg-muted transition-colors">
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="space-y-4 p-5">
                            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">المبلغ المدفوع (ج.م)</label>
                                <input type="number" min={0} value={payment.amount || ''}
                                    onChange={e => setPayment(p => ({ ...p, amount: +e.target.value }))} className={IC} autoFocus /></div>
                            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">التاريخ</label>
                                <input type="date" value={payment.date}
                                    onChange={e => setPayment(p => ({ ...p, date: e.target.value }))} className={IC} /></div>
                            <div><label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ملاحظة (اختياري)</label>
                                <input value={payment.note} placeholder="رقم الإيصال أو أي تفاصيل إضافية..."
                                    onChange={e => setPayment(p => ({ ...p, note: e.target.value }))} className={IC} /></div>
                        </div>
                        <div className="flex gap-3 p-5 border-t border-border/50 bg-muted/20">
                            <button onClick={() => handlePayment(showPayment)}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow hover:bg-emerald-500 transition-all">
                                <Check className="h-5 w-5" /> حفظ وتسجيل الدفعة
                            </button>
                            <button onClick={() => setShowPayment(null)}
                                className="px-5 rounded-xl border border-border/80 bg-background py-3 text-sm font-semibold hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ─── Schedule Modal ────────────────────────────────── */}
            {showSchedule && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowSchedule(null)}>
                    <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl animate-scale-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between shrink-0 p-5 border-b border-border/50">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> جدول الأقساط الشهرية</h3>
                            <button onClick={() => setShowSchedule(null)} className="rounded-full p-2 bg-muted/50 hover:bg-muted transition-colors">
                                <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-5 pb-2 shrink-0 bg-muted/10 border-b border-border/30">
                            <p className="text-sm mb-1 font-semibold text-foreground flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /> {showSchedule.customerName}</p>
                            <p className="text-xs text-muted-foreground mb-1">{showSchedule.productName} — قسط شهري: <span className="font-bold text-primary">{showSchedule.monthlyInstallment.toLocaleString()} ج.م</span></p>
                        </div>
                        
                        <div className="overflow-y-auto p-4 space-y-3">
                            {showSchedule.schedule.map(s => {
                                const today = new Date().toISOString().slice(0, 10);
                                const isOverdue = !s.paid && s.dueDate < today;
                                return (
                                    <div key={s.month} className={`flex items-center justify-between rounded-2xl px-4 py-3 border text-sm gap-2 transition-all hover:scale-[1.01] ${s.paid ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/20 shadow-sm'
                                        : isOverdue ? 'bg-red-50/80 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 shadow-sm'
                                            : 'bg-background hover:bg-muted/30 border-border shadow-sm'
                                        }`}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`font-black text-sm w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${s.paid ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : isOverdue ? 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400' : 'bg-primary/10 text-primary'
                                                }`}>{s.month}</span>
                                            <div>
                                                <p className="text-xs text-muted-foreground mb-0.5">{s.dueDate}</p>
                                                <p className={`font-bold text-sm ${s.paid ? 'text-emerald-700 dark:text-emerald-400' : isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{s.amount.toLocaleString()} ج.م</p>
                                            </div>
                                        </div>
                                        {s.paid ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 text-xs text-emerald-600 bg-emerald-100/50 rounded-lg font-bold shrink-0"><CheckCircle2 className="h-4 w-4" /> مدفوع</span>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    payInstallment(showSchedule.id, s.month, s.amount);
                                                    refresh();
                                                    // Update showSchedule state to reflect change
                                                    setShowSchedule(prev => prev ? { ...prev, schedule: prev.schedule.map(x => x.month === s.month ? { ...x, paid: true } : x), paidTotal: prev.paidTotal + s.amount, remaining: Math.max(0, prev.remaining - s.amount) } : null);
                                                }}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 shadow-sm ${isOverdue ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                    }`}>
                                                <DollarSign className="h-4 w-4" /> {isOverdue ? 'دفع متأخر' : 'دفع الآن'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {/* Totals summary */}
                        <div className="p-4 shrink-0 bg-muted/20 border-t border-border/50">
                            <div className="rounded-2xl border border-border/80 bg-background p-4 grid grid-cols-2 gap-3 text-center text-sm shadow-sm">
                                <div className="border-l border-border/50"><p className="text-muted-foreground text-xs mb-1 font-semibold">المبلغ المسدد</p><p className="font-black text-emerald-600 text-lg">{showSchedule.paidTotal.toLocaleString()} ج.م</p></div>
                                <div><p className="text-muted-foreground text-xs mb-1 font-semibold">المبلغ المتبقي</p><p className="font-black text-primary text-lg">{showSchedule.remaining.toLocaleString()} ج.م</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            , document.body)}

            {/* ─── Contracts List ────────────────────────────────── */}
            <div className="space-y-4">
                {paginatedItems.length === 0 ? (
                    <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">لا توجد عقود</div>
                ) : paginatedItems.map(c => {
                    const cType = (c.contractType ?? 'product') as ContractType;
                    const totalPrice = c.installmentPrice || (c as unknown as {totalPrice?: number}).totalPrice || 0;
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
            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-w-sm rounded-[2rem] border border-border bg-card p-6 shadow-2xl animate-scale-in text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 mx-auto mb-4 border-4 border-white dark:border-card shadow-sm">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>
                        <h3 className="font-black text-xl text-foreground mb-1">تأكيد الحذف</h3>
                        <p className="text-sm text-muted-foreground mb-6">هذا الإجراء نهائي ولا يمكن التراجع عنه.</p>
                        
                        <div className="bg-muted/30 border border-border/50 rounded-2xl p-4 mb-6 text-right">
                            <p className="text-xs text-muted-foreground mb-1">هل أنت متأكد من حذف العقد؟</p>
                            <p className="text-sm font-bold text-foreground mb-1 break-words">«{deleteTarget.customerName}»</p>
                            <p className="text-xs text-foreground font-semibold break-words bg-primary/10 text-primary py-1 px-2 rounded-md inline-block mt-1 mb-2">{deleteTarget.productName}</p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Layers className="h-3 w-3"/> رقم العقد: <span className="font-mono">{deleteTarget.contractNumber}</span></p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => { deleteContract(deleteTarget.id); setDeleteTarget(null); refresh(); toast({ title: '🗑️ تم حذف العقد', description: deleteTarget.customerName }); }}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-3 text-sm font-bold text-white shadow-md shadow-red-600/20 transition-all">
                                <Trash2 className="h-4 w-4" /> نعم، احذف العقد
                            </button>
                            <button onClick={() => setDeleteTarget(null)}
                                className="px-5 rounded-xl border border-border/80 bg-background text-foreground py-3 text-sm font-semibold hover:bg-muted transition-colors">
                                تراجع
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
}
