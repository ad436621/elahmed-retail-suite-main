import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, CreditCard, DollarSign, Search, Printer, Calendar, Smartphone, Monitor, Tv, Car, Layers, Send, Tag, Trash2, AlertTriangle, Download, Pencil, Plus } from 'lucide-react';
import { exportToExcel, INSTALLMENT_COLUMNS, prepareInstallmentsForExport } from '@/services/excelService';
import { InstallmentContract, InstallmentCustomField, InstallmentScheduleItem } from '@/domain/types';
import { getContracts, addContract, addPaymentToContract, deleteContract, updateContract } from '@/data/installmentsData';
import { generateInstallmentSchedule, getDefaultFirstInstallmentDate, getFinancedAmount, normalizeSchedule } from '@/domain/installments';
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
type InventoryFilter = 'all' | 'mobiles' | 'computers' | 'devices' | 'cars';

interface ContractFormState {
    contractType: ContractType;
    customerName: string;
    customerIdCard: string;
    guarantorName: string;
    guarantorIdCard: string;
    guarantorPhone: string;
    guarantorAddress: string;
    customerPhone: string;
    customerAddress: string;
    productId: string;
    productName: string;
    transferType: string;
    cashPrice: number;
    installmentPrice: number;
    downPayment: number;
    months: number;
    firstInstallmentDate: string;
    notes: string;
    schedule: InstallmentScheduleItem[];
    customFields: InstallmentCustomField[];
}

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

const money = (value: number) => `${(value || 0).toLocaleString('ar-EG')} ج.م`;

const emptyForm = (contractType: ContractType = 'product'): ContractFormState => ({
    contractType,
    customerName: '', customerIdCard: '', guarantorName: '', guarantorIdCard: '',
    guarantorPhone: '', guarantorAddress: '',
    customerPhone: '', customerAddress: '',
    productId: '', productName: '',
    transferType: TRANSFER_TYPES_LIST[0],
    cashPrice: 0, installmentPrice: 0, downPayment: 0, months: 12,
    firstInstallmentDate: getDefaultFirstInstallmentDate(),
    notes: '',
    schedule: [],
    customFields: [],
});

const formFromContract = (contract: InstallmentContract): ContractFormState => ({
    contractType: (contract.contractType ?? 'product') as ContractType,
    customerName: contract.customerName,
    customerIdCard: contract.customerIdCard,
    guarantorName: contract.guarantorName,
    guarantorIdCard: contract.guarantorIdCard,
    guarantorPhone: contract.guarantorPhone || '',
    guarantorAddress: contract.guarantorAddress || '',
    customerPhone: contract.customerPhone,
    customerAddress: contract.customerAddress,
    productId: contract.productId || '',
    productName: contract.productName,
    transferType: contract.transferType || TRANSFER_TYPES_LIST[0],
    cashPrice: contract.cashPrice,
    installmentPrice: contract.installmentPrice,
    downPayment: contract.downPayment,
    months: contract.months,
    firstInstallmentDate: contract.firstInstallmentDate || getDefaultFirstInstallmentDate(),
    notes: contract.notes || '',
    schedule: (contract.schedule || []).map(item => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        note: item.note || '',
    })),
    customFields: (contract.customFields || []).map(field => ({ ...field })),
});

const getContractStatus = (contract: InstallmentContract): InstallmentContract['status'] => {
    if (contract.remaining <= 0) return 'completed';
    const today = new Date().toISOString().slice(0, 10);
    return contract.schedule.some(item => !item.paid && item.dueDate < today) ? 'overdue' : 'active';
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
    const [editingId, setEditingId] = useState<string | null>(null);
    const [scheduleEdited, setScheduleEdited] = useState(false);
    const [form, setForm] = useState<ContractFormState>(() => emptyForm(initialType));
    const [payment, setPayment] = useState({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
    const [search, setSearch] = useState('');
    const [productCategory, setProductCategory] = useState<InventoryFilter>('all');
    const [deleteTarget, setDeleteTarget] = useState<InstallmentContract | null>(null); // confirm delete
    const editingContract = useMemo(
        () => (editingId ? contracts.find((item) => item.id === editingId) || null : null),
        [contracts, editingId],
    );
    const isInventoryLinkLocked = form.contractType === 'product' && Boolean(editingContract?.productId);

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

    const financedAmount = getFinancedAmount(form.installmentPrice, form.downPayment);
    const previewSchedule = useMemo(() => normalizeSchedule(form.schedule, financedAmount), [form.schedule, financedAmount]);
    const scheduleTotal = useMemo(() => previewSchedule.reduce((sum, item) => sum + item.amount, 0), [previewSchedule]);
    const remaining = financedAmount;
    const monthly = previewSchedule.length > 0 ? scheduleTotal / previewSchedule.length : 0;

    const refresh = () => {
        const nextContracts = getContracts();
        setContracts(nextContracts);
        setShowSchedule(current => current ? nextContracts.find(item => item.id === current.id) || null : null);
    };

    const restoreReservedProductStock = (contract: InstallmentContract) => {
        if (contract.contractType !== 'product' || !contract.productId) return;

        const linkedProduct = getAllInventoryProducts().find((item) => item.id === contract.productId);
        if (!linkedProduct) {
            throw new Error('لا يمكن حذف العقد لأن المنتج المرتبط غير متاح الآن لاسترجاع الكمية. راجع المخزون أولًا.');
        }

        const nextQuantity = linkedProduct.quantity + 1;
        updateProductQuantity(linkedProduct.id, nextQuantity);
        saveMovements([{
            id: crypto.randomUUID(),
            productId: linkedProduct.id,
            type: 'correction',
            quantityChange: 1,
            previousQuantity: linkedProduct.quantity,
            newQuantity: nextQuantity,
            reason: `استرجاع مخزون بعد حذف عقد أجل: ${contract.contractNumber} (${contract.customerName})`,
            referenceId: contract.id,
            userId: user?.id || 'system',
            timestamp: new Date().toISOString(),
        }]);
    };

    const updateBaseForm = (updates: Partial<ContractFormState>) => {
        setForm(current => {
            const next = { ...current, ...updates };
            if (!scheduleEdited) {
                next.schedule = generateInstallmentSchedule(
                    getFinancedAmount(next.installmentPrice, next.downPayment),
                    Math.max(1, next.months),
                    next.firstInstallmentDate,
                );
            }
            return next;
        });
    };

    const rebuildSchedule = () => {
        setScheduleEdited(false);
        setForm(current => ({
            ...current,
            schedule: generateInstallmentSchedule(
                getFinancedAmount(current.installmentPrice, current.downPayment),
                Math.max(1, current.months),
                current.firstInstallmentDate,
            ),
        }));
    };

    const updateScheduleItem = (rowId: string | undefined, field: 'dueDate' | 'amount' | 'note', value: string) => {
        if (!rowId) return;
        setScheduleEdited(true);
        setForm(current => {
            const schedule = current.schedule.map(item =>
                item.id === rowId
                    ? { ...item, [field]: field === 'amount' ? Math.max(0, Number(value || 0)) : value }
                    : item,
            );
            return { ...current, schedule, months: Math.max(1, schedule.length) };
        });
    };

    const addScheduleRow = () => {
        setScheduleEdited(true);
        setForm(current => {
            const lastDueDate = current.schedule[current.schedule.length - 1]?.dueDate || current.firstInstallmentDate;
            const baseDate = new Date(lastDueDate);
            baseDate.setMonth(baseDate.getMonth() + 1);
            const schedule = [
                ...current.schedule,
                {
                    id: crypto.randomUUID(),
                    month: current.schedule.length + 1,
                    dueDate: baseDate.toISOString().slice(0, 10),
                    amount: 0,
                    paidAmount: 0,
                    penalty: 0,
                    paid: false,
                    remainingAfter: 0,
                    note: '',
                },
            ];

            return { ...current, schedule, months: schedule.length };
        });
    };

    const removeScheduleRow = (rowId: string | undefined) => {
        if (!rowId) return;
        setScheduleEdited(true);
        setForm(current => {
            if (current.schedule.length <= 1) return current;
            const schedule = current.schedule.filter(item => item.id !== rowId);
            return { ...current, schedule, months: schedule.length };
        });
    };

    const addCustomField = () => {
        setForm(current => ({
            ...current,
            customFields: [...current.customFields, { id: crypto.randomUUID(), label: '', value: '' }],
        }));
    };

    const updateCustomField = (id: string, key: 'label' | 'value', value: string) => {
        setForm(current => ({
            ...current,
            customFields: current.customFields.map(field => field.id === id ? { ...field, [key]: value } : field),
        }));
    };

    const removeCustomField = (id: string) => {
        setForm(current => ({
            ...current,
            customFields: current.customFields.filter(field => field.id !== id),
        }));
    };

    const closeForm = () => {
        setEditingId(null);
        setScheduleEdited(false);
        setForm(emptyForm(initialType));
        setShowForm(false);
    };

    const openCreateForm = (contractType: ContractType) => {
        setEditingId(null);
        setScheduleEdited(false);
        setForm(emptyForm(contractType));
        setShowForm(true);
    };

    const openEditForm = (contract: InstallmentContract) => {
        setEditingId(contract.id);
        setScheduleEdited(true);
        setForm(formFromContract(contract));
        setShowForm(true);
    };

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
        if (form.downPayment < 0 || form.downPayment > form.installmentPrice) {
            toast({ title: 'خطأ', description: 'المقدم يجب أن يكون بين صفر وإجمالي الأجل', variant: 'destructive' });
            return;
        }
        if (financedAmount > 0 && previewSchedule.length === 0) {
            toast({ title: 'خطأ', description: 'أنشئ جدول الأقساط أولًا', variant: 'destructive' });
            return;
        }
        if (previewSchedule.some(item => !item.dueDate || item.amount <= 0)) {
            toast({ title: 'خطأ', description: 'كل دفعة يجب أن تحتوي على تاريخ ومبلغ صالح', variant: 'destructive' });
            return;
        }
        if (Math.abs(scheduleTotal - financedAmount) > 0.01) {
            toast({ title: 'خطأ', description: 'إجمالي جدول الأقساط يجب أن يساوي المبلغ المتبقي بعد المقدم', variant: 'destructive' });
            return;
        }

        const selectedProduct = form.contractType === 'product' && form.productId ? inventory.find(p => p.id === form.productId) : null;
        const shouldDeductSelectedProduct = Boolean(selectedProduct && (!editingContract || !editingContract.productId));
        if (selectedProduct && shouldDeductSelectedProduct) {
            try { validateStock(selectedProduct, 1); }
            catch (err: unknown) {
                const msg = err instanceof Error ? err.message : 'الكمية غير متوفرة';
                toast({ title: 'خطأ في المخزون', description: msg, variant: 'destructive' });
                return;
            }
        }

        const payload = {
            contractType: form.contractType,
            customerName: form.customerName.trim(),
            customerIdCard: form.customerIdCard.trim(),
            guarantorName: form.guarantorName.trim(),
            guarantorIdCard: form.guarantorIdCard.trim(),
            guarantorPhone: form.guarantorPhone.trim(),
            guarantorAddress: form.guarantorAddress.trim(),
            customerPhone: form.customerPhone.trim(),
            customerAddress: form.customerAddress.trim(),
            productId: form.contractType === 'product'
                ? (isInventoryLinkLocked ? editingContract?.productId : form.productId || undefined)
                : undefined,
            productName: form.contractType === 'transfer'
                ? `تحويل ${form.transferType}`
                : (isInventoryLinkLocked ? (editingContract?.productName || form.productName.trim()) : form.productName.trim()),
            transferType: form.contractType === 'transfer' ? form.transferType : undefined,
            cashPrice: form.cashPrice,
            installmentPrice: form.installmentPrice,
            downPayment: form.downPayment,
            months: previewSchedule.length || Math.max(1, form.months),
            firstInstallmentDate: form.firstInstallmentDate,
            notes: form.notes.trim(),
            customFields: form.customFields
                .filter(field => field.label.trim() || field.value.trim())
                .map(field => ({ ...field, label: field.label.trim(), value: field.value.trim() })),
            schedule: previewSchedule,
        };

        const savedContract = editingId
            ? updateContract(editingId, payload)
            : addContract(payload as unknown as Omit<InstallmentContract, 'id' | 'createdAt' | 'updatedAt'>);

        if (!savedContract) {
            toast({ title: 'خطأ', description: 'تعذر حفظ العقد', variant: 'destructive' });
            return;
        }

        if (selectedProduct && shouldDeductSelectedProduct) {
            updateProductQuantity(selectedProduct.id, selectedProduct.quantity - 1);
            saveMovements([{
                id: crypto.randomUUID(),
                productId: selectedProduct.id,
                type: 'sale',
                quantityChange: -1,
                previousQuantity: selectedProduct.quantity,
                newQuantity: selectedProduct.quantity - 1,
                reason: `عقد أجل: ${savedContract.contractNumber} (${savedContract.customerName})`,
                referenceId: savedContract.id,
                userId: user?.id || 'system',
                timestamp: new Date().toISOString(),
            }]);
        }

        toast({
            title: editingId ? '✅ تم تحديث العقد' : `✅ تم إنشاء عقد ${TYPE_LABELS[form.contractType]} بالأجل`,
            description: savedContract.customerName,
        });
        closeForm();
        refresh();
    };

    const handlePayment = (contractId: string) => {
        if (payment.amount <= 0) {
            toast({ title: 'خطأ', description: 'المبلغ يجب أن يكون أكبر من صفر', variant: 'destructive' });
            return;
        }
        const contract = contracts.find(item => item.id === contractId);
        if (!contract) return;
        if (payment.amount > contract.remaining + 0.01) {
            toast({ title: 'خطأ', description: 'المبلغ أكبر من الرصيد المتبقي', variant: 'destructive' });
            return;
        }

        addPaymentToContract(contractId, payment);
        toast({ title: '✅ تم تسجيل الدفعة', description: `${payment.amount.toLocaleString()} ج.م` });
        setShowPayment(null);
        setPayment({ amount: 0, date: new Date().toISOString().slice(0, 10), note: '' });
        refresh();
    };

    const buildScheduleTimeline = (contract: InstallmentContract) => {
        let runningRemaining = contract.schedule.reduce((sum, item) => sum + item.amount + (item.penalty || 0), 0);
        const today = new Date().toISOString().slice(0, 10);

        return contract.schedule.map(item => {
            const totalDue = item.amount + (item.penalty || 0);
            runningRemaining = Math.max(0, Number((runningRemaining - (item.paidAmount || 0)).toFixed(2)));
            const outstanding = Math.max(0, totalDue - (item.paidAmount || 0));

            return {
                ...item,
                totalDue,
                actualRemainingAfter: runningRemaining,
                statusLabel: outstanding <= 0 ? 'مدفوع' : item.dueDate < today ? 'متأخر' : 'مفتوح',
            };
        });
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

    const filtered = useMemo(() => contracts
        .map(contract => ({ ...contract, status: getContractStatus(contract) }))
        .filter(c =>
            c.customerName.includes(search) || c.customerPhone.includes(search) ||
            c.productName.includes(search) || c.contractNumber.includes(search)
        )
        .sort((a, b) => b.createdAt?.localeCompare(a.createdAt ?? '') ?? 0), [contracts, search]);

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
                            <span className="text-blue-600">{contracts.filter(c => getContractStatus(c) === 'active').length} نشط</span> ·{' '}
                            <span className="text-red-600">{contracts.filter(c => getContractStatus(c) === 'overdue').length} متأخر</span>
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
                            onClick={() => openCreateForm(t)}
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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 sm:p-6" onClick={closeForm}>
                    <div className="w-full max-w-5xl rounded-3xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] animate-scale-in" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between shrink-0 p-5 border-b border-border/50">
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                {form.contractType === 'transfer' ? <><Send className="h-6 w-6 text-amber-500" /> عقد أجل تحويل مالي</>
                                    : form.contractType === 'car' ? <><Car className="h-6 w-6 text-sky-500" /> عقد أجل سيارة</>
                                        : <><Tag className="h-6 w-6 text-primary" /> عقد أجل بضاعة</>}
                                {editingId && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">تعديل</span>}
                            </h2>
                            <button onClick={closeForm} className="rounded-full p-2 bg-muted/50 hover:bg-muted transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Scrolling Content */}
                        <div className="overflow-y-auto p-5 space-y-6">
                            
                            {/* Type Switch */}
                            <div className="flex rounded-xl overflow-hidden border border-border/60 bg-muted/30 p-1 gap-1 w-full max-w-md mx-auto">
                                {(['product', 'transfer', 'car'] as ContractType[]).map(t => (
                                    <button key={t}
                                        onClick={() => {
                                            setScheduleEdited(false);
                                            setForm(f => ({
                                                ...emptyForm(t),
                                                customerName: f.customerName,
                                                customerIdCard: f.customerIdCard,
                                                customerPhone: f.customerPhone,
                                                customerAddress: f.customerAddress,
                                                guarantorName: f.guarantorName,
                                                guarantorIdCard: f.guarantorIdCard,
                                                guarantorPhone: f.guarantorPhone,
                                                guarantorAddress: f.guarantorAddress,
                                            }));
                                        }}
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
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">هاتف الضامن</label>
                                        <input value={form.guarantorPhone}
                                            onChange={e => setForm(f => ({ ...f, guarantorPhone: e.target.value }))} className={IC} placeholder="01X..." />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">عنوان الضامن</label>
                                        <input value={form.guarantorAddress}
                                            onChange={e => setForm(f => ({ ...f, guarantorAddress: e.target.value }))} className={IC} placeholder="العنوان..." />
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
                                                        disabled={isInventoryLinkLocked}
                                                        onChange={e => {
                                                            if (!e.target.value) { updateBaseForm({ productId: '', productName: '', cashPrice: 0, installmentPrice: 0 }); return; }
                                                            const p = inventory.find(x => x.id === e.target.value);
                                                            if (p) {
                                                                const installP = Math.ceil(p.sellingPrice * 1.3);
                                                                updateBaseForm({ productId: p.id, productName: p.name, cashPrice: p.sellingPrice, installmentPrice: installP });
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
                                                    {isInventoryLinkLocked && <p className="text-[11px] text-amber-700">هذا العقد مرتبط بمخزون فعلي بالفعل، لذلك تغيير الربط معطل حتى لا تختل الكميات.</p>}
                                                    <div className="flex items-center gap-2">
                                                        <hr className="flex-1 border-border/50" />
                                                        <span className="text-[10px] text-muted-foreground">أو</span>
                                                        <hr className="flex-1 border-border/50" />
                                                    </div>
                                                </div>
                                            )}
                                            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">اسم المنتج (يدوي بدون خصم من المخزون)</label>
                                        <input value={form.productName}
                                            disabled={isInventoryLinkLocked}
                                            onChange={e => setForm(f => ({ ...f, productName: e.target.value, productId: '' }))}
                                            placeholder={form.contractType === 'car' ? 'مثال: تويوتا كورولا 2022' : 'اسم المنتج...'}
                                            className={IC} />
                                        {isInventoryLinkLocked && <p className="mt-1 text-[11px] text-muted-foreground">يمكن تعديل البيانات المالية والجدول، لكن اسم المنتج المرتبط بالمخزون يبقى ثابتًا داخل العقد.</p>}
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
                                            onChange={e => updateBaseForm({ cashPrice: +e.target.value })} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">إجمالي الأجل <span className="text-destructive">*</span></label>
                                        <input type="number" min={0} value={form.installmentPrice || ''}
                                            onChange={e => updateBaseForm({ installmentPrice: +e.target.value })} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">المقدم (ج.م)</label>
                                        <input type="number" min={0} value={form.downPayment || ''}
                                            onChange={e => updateBaseForm({ downPayment: +e.target.value })} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">عدد الأشهر</label>
                                        <input type="number" min={1} value={form.months || ''}
                                            onChange={e => updateBaseForm({ months: Math.max(1, +e.target.value || 1) })} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">أول تاريخ استحقاق</label>
                                        <input type="date" value={form.firstInstallmentDate}
                                            onChange={e => updateBaseForm({ firstInstallmentDate: e.target.value })} className={IC} />
                                    </div>
                                </div>

                                {form.installmentPrice > 0 && (
                                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 grid grid-cols-3 gap-2 text-center text-sm shadow-inner transition-all">
                                        <div><p className="text-muted-foreground text-xs mb-1">المبلغ المتبقي</p><p className="font-bold text-blue-700 text-lg">{money(remaining)}</p></div>
                                        <div className="border-x border-blue-200/50"><p className="text-muted-foreground text-xs mb-1">متوسط القسط</p><p className="font-bold text-primary text-lg">{money(monthly)}</p></div>
                                        <div><p className="text-muted-foreground text-xs mb-1">عدد الأشهر</p><p className="font-bold text-foreground text-lg">{form.months}</p></div>
                                    </div>
                                )}

                                {!scheduleEdited && previewSchedule.length > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                        تم إنشاء جدول الأقساط تلقائيًا. يمكنك تعديله يدويًا من القسم التالي إذا احتجت.
                                    </p>
                                )}
                                {Math.abs(scheduleTotal - financedAmount) > 0.01 && form.installmentPrice > 0 && (
                                    <p className="text-xs font-semibold text-red-600">
                                        إجمالي الجدول الحالي {money(scheduleTotal)} ولا يساوي الرصيد المطلوب {money(financedAmount)}.
                                    </p>
                                )}
                            </div>

                            <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
                                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/50 pb-2">
                                    <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><Calendar className="h-4 w-4" /> جدول الأقساط القابل للتعديل</h3>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={addScheduleRow}
                                            className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors">
                                            <Plus className="h-3.5 w-3.5" /> دفعة جديدة
                                        </button>
                                        <button type="button" onClick={rebuildSchedule}
                                            className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors">
                                            إعادة التوزيع
                                        </button>
                                    </div>
                                </div>
                                {scheduleEdited && (
                                    <p className="text-xs text-amber-700">
                                        تم تعديل الجدول يدويًا. لن يتم إعادة حسابه تلقائيًا إلا إذا استخدمت زر إعادة التوزيع.
                                    </p>
                                )}
                                {previewSchedule.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border/60 bg-background p-6 text-center text-sm text-muted-foreground">
                                        أدخل القيم المالية وسيتم إنشاء جدول الأقساط هنا.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[760px] text-sm">
                                            <thead>
                                                <tr className="border-b border-border/50 text-muted-foreground">
                                                    <th className="pb-2 text-right font-semibold">رقم الدفعة</th>
                                                    <th className="pb-2 text-right font-semibold">تاريخ الاستحقاق</th>
                                                    <th className="pb-2 text-right font-semibold">المبلغ</th>
                                                    <th className="pb-2 text-right font-semibold">الرصيد بعد الدفعة</th>
                                                    <th className="pb-2 text-right font-semibold">ملاحظة</th>
                                                    <th className="pb-2 text-right font-semibold">حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {previewSchedule.map(item => (
                                                    <tr key={item.id || item.month} className="border-b border-border/40 last:border-0">
                                                        <td className="py-3 font-bold text-foreground">{item.month}</td>
                                                        <td className="py-3 pl-3">
                                                            <input type="date" value={item.dueDate}
                                                                onChange={e => updateScheduleItem(item.id, 'dueDate', e.target.value)} className={IC} />
                                                        </td>
                                                        <td className="py-3 pl-3">
                                                            <input type="number" min={0} value={item.amount || ''}
                                                                onChange={e => updateScheduleItem(item.id, 'amount', e.target.value)} className={IC} />
                                                        </td>
                                                        <td className="py-3 font-semibold text-foreground">{money(item.remainingAfter || 0)}</td>
                                                        <td className="py-3 pl-3">
                                                            <input value={item.note || ''}
                                                                onChange={e => updateScheduleItem(item.id, 'note', e.target.value)}
                                                                className={IC} placeholder="اختياري" />
                                                        </td>
                                                        <td className="py-3">
                                                            <button type="button" onClick={() => removeScheduleRow(item.id)} disabled={previewSchedule.length <= 1}
                                                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                                                                حذف
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
                                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/50 pb-2">
                                    <h3 className="font-semibold text-sm text-primary flex items-center gap-2"><Plus className="h-4 w-4" /> حقول إضافية وملاحظات</h3>
                                    <button type="button" onClick={addCustomField}
                                        className="flex items-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors">
                                        <Plus className="h-3.5 w-3.5" /> إضافة حقل
                                    </button>
                                </div>
                                {form.customFields.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-border/60 bg-background p-4 text-center text-sm text-muted-foreground">
                                        لا توجد حقول إضافية بعد.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {form.customFields.map(field => (
                                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
                                                <input value={field.label}
                                                    onChange={e => updateCustomField(field.id, 'label', e.target.value)}
                                                    className={IC} placeholder="اسم الحقل" />
                                                <input value={field.value}
                                                    onChange={e => updateCustomField(field.id, 'value', e.target.value)}
                                                    className={IC} placeholder="القيمة" />
                                                <button type="button" onClick={() => removeCustomField(field.id)}
                                                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors">
                                                    حذف
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">ملاحظات العقد</label>
                                    <textarea value={form.notes}
                                        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                        className={`${IC} min-h-[120px] resize-y`} placeholder="أي ملاحظات أو بيانات إضافية..." />
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 p-5 shrink-0 border-t border-border/50 bg-muted/20">
                            <button onClick={handleSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 transition-all hover:-translate-y-0.5">
                                <Check className="h-5 w-5" /> {editingId ? 'حفظ التعديلات' : 'إنشاء العقد'}
                            </button>
                            <button onClick={closeForm}
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
                    <div className="w-full max-w-5xl rounded-3xl border border-border bg-card shadow-2xl animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between shrink-0 p-5 border-b border-border/50">
                            <div>
                                <h3 className="text-lg font-bold text-foreground flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" /> تفاصيل عقد التقسيط</h3>
                                <p className="text-xs text-muted-foreground mt-1">{showSchedule.contractNumber} • {showSchedule.productName}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => openEditForm(showSchedule)}
                                    className="flex items-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 px-3 py-2 text-xs font-semibold hover:bg-amber-100 transition-colors">
                                    <Pencil className="h-3.5 w-3.5" /> تعديل
                                </button>
                                <button onClick={() => setShowSchedule(null)} className="rounded-full p-2 bg-muted/50 hover:bg-muted transition-colors">
                                    <X className="h-4 w-4 text-muted-foreground" />
                                </button>
                            </div>
                        </div>
                        <div className="overflow-y-auto p-5 space-y-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-border/70 bg-background p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">العميل</p>
                                    <p className="font-bold text-foreground">{showSchedule.customerName}</p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                                    <p className="font-bold text-emerald-600">{money(showSchedule.paidTotal)}</p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                                    <p className="font-bold text-primary">{money(showSchedule.remaining)}</p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background p-4 text-center">
                                    <p className="text-xs text-muted-foreground mb-1">عدد الدفعات</p>
                                    <p className="font-bold text-foreground">{showSchedule.schedule.length}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-4">
                                <div className="rounded-2xl border border-border/70 bg-background p-4">
                                    <h4 className="text-sm font-semibold text-foreground mb-3">جدول السداد</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[720px] text-sm">
                                            <thead>
                                                <tr className="border-b border-border/50 text-muted-foreground">
                                                    <th className="pb-2 text-right font-semibold">الدفعة</th>
                                                    <th className="pb-2 text-right font-semibold">تاريخ الاستحقاق</th>
                                                    <th className="pb-2 text-right font-semibold">قيمة القسط</th>
                                                    <th className="pb-2 text-right font-semibold">المدفوع</th>
                                                    <th className="pb-2 text-right font-semibold">الرصيد بعد الدفعة</th>
                                                    <th className="pb-2 text-right font-semibold">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {buildScheduleTimeline(showSchedule).map(item => (
                                                    <tr key={item.id || item.month} className="border-b border-border/40 last:border-0">
                                                        <td className="py-3 font-bold text-foreground">{item.month}</td>
                                                        <td className="py-3 text-foreground">{item.dueDate}</td>
                                                        <td className="py-3 font-semibold text-foreground">{money(item.totalDue)}</td>
                                                        <td className="py-3 text-foreground">{money(item.paidAmount || 0)}</td>
                                                        <td className="py-3 font-semibold text-foreground">{money(item.actualRemainingAfter)}</td>
                                                        <td className="py-3">
                                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.statusLabel === 'مدفوع' ? 'bg-emerald-100 text-emerald-700' : item.statusLabel === 'متأخر' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                                {item.statusLabel}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-border/70 bg-background p-4">
                                        <h4 className="text-sm font-semibold text-foreground mb-3">بيانات إضافية</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">العميل</span><span className="font-semibold text-foreground">{showSchedule.customerName}</span></div>
                                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">الهاتف</span><span className="font-semibold text-foreground">{showSchedule.customerPhone || '—'}</span></div>
                                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">الضامن</span><span className="font-semibold text-foreground">{showSchedule.guarantorName || '—'}</span></div>
                                            <div className="flex justify-between gap-2"><span className="text-muted-foreground">هاتف الضامن</span><span className="font-semibold text-foreground">{showSchedule.guarantorPhone || '—'}</span></div>
                                        </div>
                                        {showSchedule.notes && <div className="mt-3 rounded-xl bg-muted/30 p-3 text-sm text-foreground">{showSchedule.notes}</div>}
                                    </div>

                                    <div className="rounded-2xl border border-border/70 bg-background p-4">
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <h4 className="text-sm font-semibold text-foreground">سجل الدفعات</h4>
                                            {showSchedule.remaining > 0 && (
                                                <button
                                                    onClick={() => {
                                                        const nextInstallment = showSchedule.schedule.find(item => !item.paid);
                                                        setPayment({
                                                            amount: nextInstallment ? Math.max(0, (nextInstallment.amount + (nextInstallment.penalty || 0)) - (nextInstallment.paidAmount || 0)) : showSchedule.remaining,
                                                            date: new Date().toISOString().slice(0, 10),
                                                            note: nextInstallment ? `دفعة القسط رقم ${nextInstallment.month}` : '',
                                                        });
                                                        setShowPayment(showSchedule.id);
                                                    }}
                                                    className="flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                                                >
                                                    <DollarSign className="h-3.5 w-3.5" /> دفعة جديدة
                                                </button>
                                            )}
                                        </div>
                                        {showSchedule.payments.length === 0 ? (
                                            <div className="rounded-xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
                                                لا توجد دفعات مسجلة بعد.
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                                {showSchedule.payments.map(p => (
                                                    <div key={p.id} className="rounded-xl bg-muted/20 p-3 text-sm">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-semibold text-emerald-600">+{money(p.amount)}</span>
                                                            <span className="text-muted-foreground">{p.date}</span>
                                                        </div>
                                                        {p.note && <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {(showSchedule.customFields?.length ?? 0) > 0 && (
                                        <div className="rounded-2xl border border-border/70 bg-background p-4">
                                            <h4 className="text-sm font-semibold text-foreground mb-3">الحقول الإضافية</h4>
                                            <div className="space-y-2">
                                                {showSchedule.customFields?.map(field => (
                                                    <div key={field.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/20 px-3 py-2 text-sm">
                                                        <span className="text-muted-foreground">{field.label}</span>
                                                        <span className="font-semibold text-foreground">{field.value || '—'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
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
                                    <button onClick={() => {
                                        const nextInstallment = c.schedule.find(item => !item.paid);
                                        setPayment({
                                            amount: nextInstallment ? Math.max(0, (nextInstallment.amount + (nextInstallment.penalty || 0)) - (nextInstallment.paidAmount || 0)) : c.remaining,
                                            date: new Date().toISOString().slice(0, 10),
                                            note: nextInstallment ? `دفعة القسط رقم ${nextInstallment.month}` : '',
                                        });
                                        setShowPayment(c.id);
                                    }}
                                        className="flex items-center gap-1.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-100 transition-colors">
                                        <DollarSign className="h-3.5 w-3.5" /> تسجيل دفعة
                                    </button>
                                )}
                                <button onClick={() => openEditForm(c)}
                                    className="flex items-center gap-1.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 transition-colors">
                                    <Pencil className="h-3.5 w-3.5" /> تعديل
                                </button>
                                <button onClick={() => setShowSchedule(c)}
                                    className="flex items-center gap-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 text-xs font-semibold hover:bg-blue-100 transition-colors">
                                    <Calendar className="h-3.5 w-3.5" /> تفاصيل العقد
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
                            <button onClick={() => {
                                try {
                                    restoreReservedProductStock(deleteTarget);
                                } catch (error: unknown) {
                                    const description = error instanceof Error ? error.message : 'تعذر استرجاع الكمية المرتبطة بالعقد';
                                    toast({ title: 'تعذر حذف العقد', description, variant: 'destructive' });
                                    return;
                                }

                                deleteContract(deleteTarget.id);
                                setDeleteTarget(null);
                                refresh();
                                toast({ title: '🗑️ تم حذف العقد', description: deleteTarget.customerName });
                            }}
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
