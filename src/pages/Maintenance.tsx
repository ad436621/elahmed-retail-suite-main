import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Plus,
    Trash2,
    Pencil,
    X,
    Wrench,
    Printer,
    Search,
    AlignLeft,
    CalendarClock,
    DollarSign,
    PenTool,
    CheckCircle2,
    PackageCheck,
} from 'lucide-react';
import {
    type AccessoryRepairPart,
    type RepairTicket,
    type RepairTicketPart,
    addRepairTicket,
    addTicketPart,
    deleteRepairTicket,
    getAccessoryPartsForRepair,
    getRepairTickets,
    getTicketParts,
    removeTicketPart,
    updateRepairTicket,
} from '@/data/repairsData';
import { useToast } from '@/hooks/use-toast';
import { PaginationBar, usePagination } from '@/hooks/usePagination';

const statusLabels: Record<string, string> = {
    received: 'استلام',
    diagnosing: 'فحص وتشخيص',
    repairing: 'قيد الإصلاح',
    waiting_parts: 'بانتظار القطع',
    testing: 'اختبار ومراجعة',
    ready: 'جاهز للتسليم',
    delivered: 'تم التسليم',
    cancelled: 'ملغي',
    pending: 'انتظار',
    in_progress: 'إصلاح',
    waiting_for_parts: 'قطع',
    completed: 'جاهز',
};

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
    received: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.28)' },
    diagnosing: { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9', border: 'rgba(14,165,233,0.28)' },
    repairing: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.28)' },
    waiting_parts: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.28)' },
    testing: { bg: 'rgba(234,179,8,0.12)', color: '#ca8a04', border: 'rgba(234,179,8,0.28)' },
    ready: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.28)' },
    delivered: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'rgba(139,92,246,0.28)' },
    cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.28)' },
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.28)' },
    in_progress: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.28)' },
    waiting_for_parts: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.28)' },
    completed: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.28)' },
};

const OPEN_STATUSES = ['received', 'diagnosing', 'repairing', 'waiting_parts', 'testing', 'pending', 'in_progress', 'waiting_for_parts'];

const statusCards = [
    { id: 'all', label: 'كل الحالات' },
    { id: 'open', label: 'أجهزة قيد العمل' },
    { id: 'repairing', label: 'قيد الإصلاح' },
    { id: 'waiting_parts', label: 'بانتظار القطع' },
    { id: 'testing', label: 'اختبار ومراجعة' },
    { id: 'ready', label: 'جاهز للتسليم' },
    { id: 'delivered', label: 'تم التسليم' },
    { id: 'cancelled', label: 'ملغي' },
    { id: 'pending', label: 'انتظار' },
    { id: 'in_progress', label: 'إصلاح' },
    { id: 'waiting_for_parts', label: 'قطع' },
    { id: 'completed', label: 'جاهز' },
] as const;

const emptyTicket: Partial<RepairTicket> = {
    customer_name: '',
    customer_phone: '',
    device_model: '',
    device_brand: '',
    device_category: 'mobile',
    issue_description: '',
    status: 'received',
    package_price: 0,
    final_cost: 0,
    accessories_received: '',
    device_passcode: '',
    internal_notes: '',
    receipt_notes: '',
};

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const formatCurrency = (value: number) => `${(Number(value) || 0).toLocaleString()} ج.م`;

function normalizeRepairTicketForForm(ticket: Partial<RepairTicket> = {}): Partial<RepairTicket> {
    return {
        ...emptyTicket,
        ...ticket,
        customer_name: ticket.customer_name ?? '',
        customer_phone: ticket.customer_phone ?? '',
        device_model: ticket.device_model ?? ticket.device_type ?? '',
        device_brand: ticket.device_brand ?? '',
        device_category: ticket.device_category ?? 'mobile',
        imei_or_serial: ticket.imei_or_serial ?? ticket.serial_number ?? '',
        issue_description: ticket.issue_description ?? ticket.problem_desc ?? '',
        accessories_received: ticket.accessories_received ?? ticket.accessories ?? '',
        device_passcode: ticket.device_passcode ?? ticket.password ?? '',
        status: (ticket.status ?? 'received') as RepairTicket['status'],
        package_price: Number(ticket.package_price ?? ticket.expected_cost ?? 0) || 0,
        final_cost: Number(ticket.final_cost ?? 0) || 0,
        internal_notes: ticket.internal_notes ?? '',
        receipt_notes: ticket.receipt_notes ?? '',
    };
}

function prepareRepairTicketForSubmit(ticket: Partial<RepairTicket>): Partial<RepairTicket> {
    const normalized = normalizeRepairTicketForForm(ticket);
    return {
        ...ticket,
        customer_name: normalized.customer_name,
        customer_phone: normalized.customer_phone,
        device_model: normalized.device_model,
        device_type: normalized.device_model,
        device_brand: normalized.device_brand,
        device_category: normalized.device_category,
        imei_or_serial: normalized.imei_or_serial,
        serial_number: normalized.imei_or_serial,
        issue_description: normalized.issue_description,
        problem_desc: normalized.issue_description,
        accessories_received: normalized.accessories_received,
        accessories: normalized.accessories_received,
        device_passcode: normalized.device_passcode,
        password: normalized.device_passcode,
        status: normalized.status,
        package_price: Number(normalized.package_price ?? 0) || 0,
        expected_cost: Number(normalized.package_price ?? 0) || 0,
        final_cost: Number(normalized.final_cost ?? 0) || 0,
        internal_notes: normalized.internal_notes,
        receipt_notes: normalized.receipt_notes,
    };
}

function getRepairInventoryType(deviceCategory?: string): string | null {
    switch (deviceCategory) {
        case 'mobile':
        case 'tablet':
            return 'mobile_spare_part';
        case 'device':
            return 'device_spare_part';
        case 'computer':
        case 'laptop':
            return 'computer_spare_part';
        default:
            return null;
    }
}

function matchesStatusFilter(ticket: RepairTicket, filter: string): boolean {
    if (filter === 'all') return true;
    if (filter === 'open') return OPEN_STATUSES.includes(ticket.status);
    return ticket.status === filter;
}

export default function Maintenance() {
    const { toast } = useToast();
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<RepairTicket>>(normalizeRepairTicketForForm());
    const [ticketParts, setTicketParts] = useState<RepairTicketPart[]>([]);
    const [inventoryParts, setInventoryParts] = useState<AccessoryRepairPart[]>([]);
    const [newPart, setNewPart] = useState({ name: '', salePrice: 0, quantity: 1, part_id: '' });
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
    const [deleteTarget, setDeleteTarget] = useState<RepairTicket | null>(null);

    const currentInventoryType = useMemo(() => getRepairInventoryType(form.device_category), [form.device_category]);
    const partsTotal = useMemo(
        () => ticketParts.reduce((sum, part) => sum + (Number(part.qty || part.quantity || 0) * Number(part.unit_cost || part.unit_price || 0)), 0),
        [ticketParts],
    );

    const refresh = async () => {
        setIsLoading(true);
        try {
            const data = await getRepairTickets({ search: search.trim() || undefined });
            setTickets(data);
        } catch (error) {
            console.error('Failed to load tickets', error);
            toast({ title: 'خطأ', description: 'فشل تحميل أوامر الصيانة', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    const loadInventoryParts = async (deviceCategory?: string) => {
        const inventoryType = getRepairInventoryType(deviceCategory);
        if (!inventoryType) {
            setInventoryParts([]);
            return;
        }

        try {
            setInventoryParts(await getAccessoryPartsForRepair(inventoryType));
        } catch (error) {
            console.error(error);
            toast({ title: 'خطأ', description: 'تعذر تحميل قطع الغيار المناسبة لهذا الجهاز', variant: 'destructive' });
        }
    };

    const loadTicketParts = async (ticketId: string) => {
        try {
            setTicketParts(await getTicketParts(ticketId));
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            void refresh();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (!editId) {
            setInventoryParts([]);
            return;
        }
        void loadInventoryParts(form.device_category);
    }, [editId, form.device_category]);

    const openCreateForm = () => {
        setEditId(null);
        setForm(normalizeRepairTicketForForm());
        setTicketParts([]);
        setInventoryParts([]);
        setNewPart({ name: '', salePrice: 0, quantity: 1, part_id: '' });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditId(null);
        setForm(normalizeRepairTicketForForm());
        setTicketParts([]);
        setInventoryParts([]);
        setNewPart({ name: '', salePrice: 0, quantity: 1, part_id: '' });
    };

    const handleSubmit = async () => {
        const submitData = prepareRepairTicketForSubmit(form);

        if (!submitData.customer_name?.trim() || !String(submitData.device_model ?? '').trim()) {
            toast({ title: 'خطأ', description: 'اسم العميل واسم الجهاز مطلوبان', variant: 'destructive' });
            return;
        }

        try {
            if (editId) {
                await updateRepairTicket(editId, submitData);
                toast({ title: 'تم التحديث', description: 'تم حفظ تعديلات أمر الصيانة' });
            } else {
                await addRepairTicket(submitData);
                toast({ title: 'تم الإنشاء', description: submitData.device_model || 'طلب صيانة جديد' });
            }
            closeForm();
            await refresh();
        } catch (error: any) {
            console.error(error);
            toast({ title: 'خطأ', description: error?.message || 'فشلت عملية حفظ أمر الصيانة', variant: 'destructive' });
        }
    };

    const handleAddPart = async () => {
        if (!editId) {
            toast({ title: 'تنبيه', description: 'احفظ أمر الصيانة أولاً ثم أضف قطع الغيار', variant: 'default' });
            return;
        }

        const quantity = Math.max(1, Number(newPart.quantity || 0));
        const selectedPart = inventoryParts.find((part) => part.id === newPart.part_id);
        const partName = selectedPart?.name || newPart.name.trim();
        const salePrice = Number(newPart.salePrice || 0);

        if (!partName || salePrice <= 0) {
            toast({ title: 'تنبيه', description: 'اختر قطعة أو اكتب اسمها وحدد سعرها', variant: 'destructive' });
            return;
        }

        if (selectedPart && selectedPart.quantity < quantity) {
            toast({
                title: 'كمية غير كافية',
                description: `المتاح من ${selectedPart.name} هو ${selectedPart.quantity} فقط قبل الحفظ.`,
                variant: 'destructive',
            });
            return;
        }

        try {
            await addTicketPart({
                ticket_id: editId,
                part_id: selectedPart?.id || `custom-${Date.now()}`,
                qty: quantity,
                unit_cost: salePrice,
                status: 'used',
                partName,
                source: selectedPart ? 'accessories' : undefined,
            });

            await Promise.all([loadTicketParts(editId), loadInventoryParts(form.device_category)]);
            setNewPart({ name: '', salePrice: 0, quantity: 1, part_id: '' });
            if (selectedPart && selectedPart.quantity - quantity <= Number(selectedPart.minStock || 0)) {
                toast({ title: 'تمت إضافة القطعة', description: `الكمية المتبقية من ${selectedPart.name} اقتربت من الحد الأدنى.` });
            } else {
                toast({ title: 'تمت إضافة القطعة' });
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error?.message || 'فشل إضافة قطعة الغيار', variant: 'destructive' });
        }
    };

    const handleRemovePart = async (partId: string) => {
        try {
            await removeTicketPart(partId);
            if (editId) {
                await Promise.all([loadTicketParts(editId), loadInventoryParts(form.device_category)]);
            }
        } catch (error: any) {
            toast({ title: 'خطأ', description: error?.message || 'فشل إزالة قطعة الغيار', variant: 'destructive' });
        }
    };

    const startEdit = async (ticket: RepairTicket) => {
        setEditId(ticket.id);
        setForm(normalizeRepairTicketForForm(ticket));
        setShowForm(true);
        setNewPart({ name: '', salePrice: 0, quantity: 1, part_id: '' });
        await Promise.all([loadTicketParts(ticket.id), loadInventoryParts(ticket.device_category)]);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteRepairTicket(deleteTarget.id);
            toast({ title: 'تم الحذف', description: deleteTarget.customer_name });
            setDeleteTarget(null);
            await refresh();
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل حذف أمر الصيانة', variant: 'destructive' });
        }
    };

    const printReceipt = (ticket: RepairTicket) => {
        const html = `<html dir="rtl"><head><meta charset="UTF-8"><title>إيصال صيانة</title>
        <style>
          body{font-family:'Tajawal',sans-serif;padding:32px;max-width:640px;margin:auto;color:#111827;}
          h2{text-align:center;font-size:1.6em;margin-bottom:6px;color:#1d4ed8;}
          .sub{text-align:center;color:#6b7280;font-size:.9em;margin-bottom:24px;}
          table{width:100%;border-collapse:collapse;margin-top:20px;}
          td,th{padding:12px;border:1px solid #e5e7eb;text-align:right;}
          th{background:#f8fafc;font-weight:700;width:36%;}
          .total-box{background:#f8fafc;border:2px dashed #cbd5e1;padding:16px;margin-top:24px;border-radius:12px;}
          .total-row{display:flex;justify-content:space-between;margin-bottom:8px;font-weight:700;}
          .footer{margin-top:32px;text-align:center;font-size:.85em;color:#64748b;line-height:1.7;}
        </style></head><body>
        <h2>إيصال استلام صيانة</h2>
        <div class="sub">رقم الطلب: <strong>${ticket.ticket_no}</strong></div>
        <table>
          <tr><th>العميل</th><td>${ticket.customer_name}</td></tr>
          <tr><th>الجوال</th><td>${ticket.customer_phone || '—'}</td></tr>
          <tr><th>التاريخ</th><td>${new Date(ticket.createdAt || ticket.created_at || '').toLocaleDateString('ar-EG')}</td></tr>
          <tr><th>الجهاز</th><td>${ticket.device_model ?? ticket.device_type ?? '—'}</td></tr>
          <tr><th>الرقم التسلسلي</th><td>${ticket.imei_or_serial ?? ticket.serial_number ?? '—'}</td></tr>
          <tr><th>الملحقات</th><td>${ticket.accessories_received ?? ticket.accessories ?? 'لا يوجد'}</td></tr>
          <tr><th>العطل</th><td>${ticket.issue_description ?? ticket.problem_desc ?? '—'}</td></tr>
        </table>
        <div class="total-box">
          <div class="total-row"><span>التكلفة التقديرية:</span><span>${formatCurrency(Number(ticket.package_price || ticket.expected_cost || 0))}</span></div>
          <div class="total-row"><span>التكلفة النهائية:</span><span>${ticket.final_cost != null ? formatCurrency(ticket.final_cost) : 'لم تحدد بعد'}</span></div>
        </div>
        <div class="footer">يرجى الاحتفاظ بالإيصال حتى التسليم النهائي.</div>
        </body></html>`;
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.print();
        }
    };

    const filteredTickets = useMemo(
        () =>
            tickets.filter(
                (ticket) =>
                    (categoryFilter === 'all' || ticket.device_category === categoryFilter) &&
                    matchesStatusFilter(ticket, statusFilter),
            ),
        [tickets, categoryFilter, statusFilter],
    );

    const statusCounts = useMemo(() => {
        const counts: Record<string, number> = { all: tickets.length, open: 0 };
        for (const card of statusCards) counts[card.id] = counts[card.id] || 0;
        for (const ticket of tickets) {
            if (OPEN_STATUSES.includes(ticket.status)) counts.open += 1;
            counts[ticket.status] = (counts[ticket.status] || 0) + 1;
        }
        return counts;
    }, [tickets]);

    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage } = usePagination(filteredTickets, 20);

    return (
        <div className="space-y-5 animate-fade-in pb-12" dir="rtl" data-testid="maintenance-page">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                        <Wrench className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight">إدارة الصيانة الشاملة</h1>
                        <p className="text-sm font-medium text-muted-foreground">{tickets.length} أمر صيانة مسجل</p>
                    </div>
                </div>
                <button data-testid="maintenance-create-ticket" onClick={openCreateForm} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/25">
                    <Plus className="h-5 w-5" /> استلام جهاز جديد
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {statusCards.map((card) => {
                    const active = statusFilter === card.id;
                    return (
                        <button
                            key={card.id}
                            data-testid={`maintenance-status-${card.id}`}
                            onClick={() => setStatusFilter(card.id)}
                            className={`rounded-2xl border p-4 text-right transition-all ${active ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10' : 'border-border bg-card hover:border-primary/30 hover:bg-muted/40'}`}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-bold text-foreground">{card.label}</span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                    {statusCounts[card.id] || 0}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card p-2 rounded-2xl border border-border">
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto hide-scrollbar">
                    {[
                        { id: 'all', label: 'الكل' },
                        { id: 'mobile', label: 'موبايل' },
                        { id: 'tablet', label: 'تابلت' },
                        { id: 'device', label: 'جهاز' },
                        { id: 'laptop', label: 'لاب توب' },
                        { id: 'computer', label: 'كمبيوتر' },
                        { id: 'other', label: 'أخرى' },
                    ].map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setCategoryFilter(category.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === category.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full lg:w-80 shrink-0">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input data-testid="maintenance-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="رقم الطلب، العميل، الهاتف..." className={`${IC} pr-9 transition-all hover:border-primary/50 focus:border-primary`} />
                </div>
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm min-w-[1050px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['رقم الطلب', 'العميل', 'الجهاز', 'وصف العطل', 'التكلفة التقديرية', 'التكلفة النهائية', 'الحالة', ''].map((heading) => (
                                    <th key={heading} className="px-4 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                        {heading}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">جاري تحميل أوامر الصيانة...</td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={8} className="py-16 text-center text-muted-foreground">لا توجد أوامر صيانة مطابقة للفلتر الحالي</td></tr>
                            ) : paginatedItems.map((ticket) => (
                                <tr key={ticket.id} data-testid={`maintenance-ticket-${ticket.id}`} className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-mono text-sm font-bold text-primary">{ticket.ticket_no}</div>
                                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <CalendarClock className="h-3 w-3" />
                                            {(ticket.createdAt || ticket.created_at || '').slice(0, 10)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-foreground">{ticket.customer_name}</div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">{ticket.customer_phone || '---'}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-foreground">{ticket.device_model ?? ticket.device_type ?? '—'}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{ticket.device_category} - {ticket.imei_or_serial ?? ticket.serial_number ?? '---'}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top max-w-[220px]">
                                        <p className="text-xs text-foreground truncate" title={ticket.issue_description ?? ticket.problem_desc ?? ''}>{ticket.issue_description ?? ticket.problem_desc ?? 'غير محدد'}</p>
                                    </td>
                                    <td className="px-4 py-3 align-top"><div className="font-bold text-foreground">{formatCurrency(Number(ticket.package_price || ticket.expected_cost || 0))}</div></td>
                                    <td className="px-4 py-3 align-top"><div className="font-bold text-foreground">{ticket.final_cost != null ? formatCurrency(ticket.final_cost) : '—'}</div></td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                                            style={{
                                                background: statusStyles[ticket.status]?.bg || 'rgba(0,0,0,0.08)',
                                                color: statusStyles[ticket.status]?.color || '#6b7280',
                                                border: `1px solid ${statusStyles[ticket.status]?.border || '#d1d5db'}`,
                                            }}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyles[ticket.status]?.color || '#6b7280' }}></div>
                                            {statusLabels[ticket.status] || ticket.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            <button onClick={() => printReceipt(ticket)} title="طباعة الإيصال" className="rounded-lg p-2 bg-card border border-border hover:bg-muted text-muted-foreground transition-all shadow-sm"><Printer className="h-4 w-4" /></button>
                                            <button data-testid={`maintenance-edit-${ticket.id}`} onClick={() => void startEdit(ticket)} title="تعديل" className="rounded-lg p-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 transition-all shadow-sm"><Pencil className="h-4 w-4" /></button>
                                            <button onClick={() => setDeleteTarget(ticket)} title="حذف" className="rounded-lg p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-destructive transition-all shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-4 pb-3 pt-2 border-t border-border/50">
                    <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPrev={prevPage} onNext={nextPage} onPage={setPage} />
                </div>
            </div>

            {showForm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm px-4 py-4 sm:px-6 sm:py-8 animate-fade-in" onClick={closeForm}>
                    <div data-testid="maintenance-form-modal" className="my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl animate-scale-in sm:max-h-[calc(100vh-4rem)]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-border bg-card">
                            <h2 className="text-xl font-black text-foreground truncate pl-4">{editId ? `تذكرة رقم #${form.ticket_no}` : 'استلام جهاز صيانة جديد'}</h2>
                            <button onClick={closeForm} className="rounded-full shrink-0 p-2 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><AlignLeft className="h-4 w-4" /> بيانات العميل</h3>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">اسم العميل *</label><input data-testid="maintenance-customer-name" value={form.customer_name || ''} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className={IC} /></div>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">رقم الهاتف</label><input data-testid="maintenance-customer-phone" value={form.customer_phone || ''} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} className={IC} /></div>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">الملحقات المستلمة</label><input value={form.accessories_received ?? ''} onChange={(e) => setForm({ ...form, accessories_received: e.target.value })} className={IC} /></div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><PenTool className="h-4 w-4" /> بيانات الجهاز</h3>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">موديل الجهاز *</label><input data-testid="maintenance-device-model" value={form.device_model ?? ''} onChange={(e) => setForm({ ...form, device_model: e.target.value })} className={IC} placeholder="مثال: iPhone 13 Pro Max" /></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">براند الجهاز</label><input data-testid="maintenance-device-brand" value={form.device_brand || ''} onChange={(e) => setForm({ ...form, device_brand: e.target.value })} className={IC} placeholder="مثال: Apple" /></div>
                                        <div>
                                            <label className="mb-1.5 block text-xs font-bold text-muted-foreground">التصنيف</label>
                                            <select data-testid="maintenance-device-category" value={form.device_category || 'mobile'} onChange={(e) => setForm({ ...form, device_category: e.target.value })} className={IC}>
                                                <option value="mobile">موبايل</option><option value="tablet">تابلت</option><option value="device">جهاز</option><option value="laptop">لاب توب</option><option value="computer">كمبيوتر</option><option value="other">أخرى</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">IMEI / SN</label><input data-testid="maintenance-imei" value={form.imei_or_serial ?? ''} onChange={(e) => setForm({ ...form, imei_or_serial: e.target.value })} className={IC} /></div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">الحالة الحالية</label>
                                        <select data-testid="maintenance-status" value={form.status || 'received'} onChange={(e) => setForm({ ...form, status: e.target.value as RepairTicket['status'] })} className={IC}>
                                            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><DollarSign className="h-4 w-4" /> المالية والتفاصيل</h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">التكلفة التقديرية</label><input data-testid="maintenance-package-price" type="number" value={form.package_price ?? ''} onChange={(e) => setForm({ ...form, package_price: Number(e.target.value) || 0 })} className={IC} /></div>
                                        <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">التكلفة النهائية</label><input data-testid="maintenance-final-cost" type="number" value={form.final_cost ?? ''} onChange={(e) => setForm({ ...form, final_cost: Number(e.target.value) || 0 })} className={IC} /></div>
                                    </div>
                                    <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">وصف العطل</label><textarea data-testid="maintenance-issue-description" value={form.issue_description ?? ''} onChange={(e) => setForm({ ...form, issue_description: e.target.value })} rows={3} className={`${IC} resize-none`} /></div>
                                    <div className="rounded-2xl border border-border bg-muted/20 p-4">
                                        <div className="text-xs font-bold text-muted-foreground mb-1">مبلغ الصيانة المسجل</div>
                                        <div className="text-lg font-black text-primary">{formatCurrency(Number(form.final_cost ?? form.package_price ?? 0))}</div>
                                        <p className="text-[11px] text-muted-foreground mt-2">يتم ترحيل هذا المبلغ تلقائياً إلى الأرباح العامة عند الحفظ.</p>
                                    </div>
                                </div>
                            </div>

                            {editId && (
                                <div className="mt-2 pt-6 border-t border-border">
                                    <div className="flex flex-col gap-2 mb-4">
                                        <h3 className="text-sm font-bold text-primary flex items-center gap-2"><PackageCheck className="h-4 w-4" /> قطع الغيار المضافة للتذكرة</h3>
                                        <p className="text-xs text-muted-foreground">{currentInventoryType ? `سيتم الخصم تلقائياً من مخزون ${currentInventoryType}.` : 'هذا التصنيف لا يرتبط بمخزون قطع غيار تلقائي، ويمكنك إضافة قطعة يدوية فقط.'}</p>
                                    </div>

                                    <div className="rounded-2xl border border-border p-4 bg-muted/20">
                                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4 items-end">
                                            <div className="md:col-span-2 flex flex-col gap-1.5">
                                                <label className="block text-xs text-muted-foreground">اختر قطعة من المخزون</label>
                                                <select
                                                    className={IC}
                                                    value={newPart.part_id}
                                                    onChange={(e) => {
                                                        const selected = inventoryParts.find((part) => part.id === e.target.value);
                                                        if (selected) setNewPart({ name: selected.name, salePrice: selected.salePrice || selected.costPrice, quantity: 1, part_id: selected.id });
                                                        else setNewPart((prev) => ({ ...prev, part_id: '', name: '', salePrice: 0 }));
                                                    }}
                                                >
                                                    <option value="">+ إضافة قطعة خارج المخزون (يدوي)</option>
                                                    {inventoryParts.map((part) => <option key={part.id} value={part.id}>{part.name} - (المتاح: {part.quantity})</option>)}
                                                </select>
                                                <input value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value, part_id: '' })} placeholder="أو اكتب اسم القطعة يدوياً..." className={IC} />
                                            </div>
                                            <div><label className="block text-xs text-muted-foreground mb-1">الكمية</label><input type="number" value={newPart.quantity || ''} onChange={(e) => setNewPart({ ...newPart, quantity: Number(e.target.value) || 1 })} className={IC} min="1" /></div>
                                            <div className="md:col-span-2 flex items-end gap-2">
                                                <div className="flex-1"><label className="block text-xs text-muted-foreground mb-1">السعر للعميل</label><input type="number" value={newPart.salePrice || ''} onChange={(e) => setNewPart({ ...newPart, salePrice: Number(e.target.value) || 0 })} className={IC} /></div>
                                                <button onClick={() => void handleAddPart()} className="shrink-0 bg-primary/10 text-primary p-2.5 rounded-xl hover:bg-primary hover:text-primary-foreground transition-colors border border-primary/20"><Plus className="h-5 w-5" /></button>
                                            </div>
                                        </div>

                                        {ticketParts.length > 0 ? (
                                            <div className="space-y-2">
                                                <table className="w-full text-sm text-right">
                                                    <thead className="bg-card border border-border rounded-t-xl"><tr><th className="p-3 font-bold text-muted-foreground text-xs rounded-tr-xl">القطعة</th><th className="p-3 font-bold text-muted-foreground text-xs">الكمية</th><th className="p-3 font-bold text-muted-foreground text-xs">السعر</th><th className="p-3 font-bold text-muted-foreground text-xs">الإجمالي</th><th className="p-3 font-bold text-muted-foreground text-xs rounded-tl-xl w-12 text-center"></th></tr></thead>
                                                    <tbody>
                                                        {ticketParts.map((part) => (
                                                            <tr key={part.id} className="bg-background border-x border-b border-border">
                                                                <td className="p-3 font-medium text-foreground">{part.partName || part.name}</td>
                                                                <td className="p-3 text-muted-foreground">{part.qty || part.quantity}</td>
                                                                <td className="p-3 text-muted-foreground">{formatCurrency(Number(part.unit_cost || part.unit_price || 0))}</td>
                                                                <td className="p-3 font-bold text-primary">{formatCurrency(Number(part.qty || part.quantity || 0) * Number(part.unit_cost || part.unit_price || 0))}</td>
                                                                <td className="p-3 text-center"><button onClick={() => void handleRemovePart(part.id)} className="text-destructive hover:bg-red-50 p-1.5 rounded-lg transition-colors"><X className="h-4 w-4" /></button></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="flex justify-between items-center bg-card border border-border p-4 rounded-xl mt-2">
                                                    <div className="text-sm font-bold text-muted-foreground">إجمالي قطع الغيار:</div>
                                                    <div className="text-xl font-black text-primary">{formatCurrency(partsTotal)}</div>
                                                </div>
                                            </div>
                                        ) : <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لم تتم إضافة قطع غيار بعد.</div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="shrink-0 flex gap-3 px-6 py-4 bg-muted/40 border-t border-border mt-auto">
                            <button data-testid="maintenance-save" onClick={() => void handleSubmit()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 py-3 text-sm font-bold text-white transition-all shadow-md"><CheckCircle2 className="h-4 w-4" /> {editId ? 'تحديث البيانات' : 'حفظ التذكرة'}</button>
                            <button onClick={closeForm} className="flex-1 rounded-xl bg-card border border-border hover:bg-muted py-3 text-sm font-bold text-foreground transition-all">إلغاء</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}

            {deleteTarget && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm px-4 py-6" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-sm:max-w-xs max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center text-center gap-4 mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/10 shadow-inner"><Trash2 className="h-8 w-8 text-red-600" /></div>
                            <div><h3 className="text-xl font-black text-foreground">تأكيد الحذف</h3><p className="text-sm text-muted-foreground mt-1">هل أنت متأكد من حذف أمر الصيانة هذا؟</p></div>
                        </div>
                        <div className="bg-muted p-3 rounded-xl mb-6 text-center"><p className="text-sm font-bold text-foreground">{deleteTarget.customer_name}</p><p className="text-xs text-muted-foreground">{deleteTarget.device_model || deleteTarget.device_type}</p></div>
                        <div className="flex gap-3">
                            <button onClick={() => void handleDelete()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition-all">احذف</button>
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-border bg-card hover:bg-muted py-3 text-sm font-bold transition-all">تراجع</button>
                        </div>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}
