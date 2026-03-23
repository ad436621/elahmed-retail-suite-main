import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Pencil, X, Check, Wrench, Printer, Search, TrendingUp, ImagePlus, ImageOff, AlignLeft, CalendarClock, DollarSign, PenTool, CheckCircle2, PackageCheck, AlertCircle } from 'lucide-react';
import { 
    RepairTicket, RepairTicketPart, RepairEvent, 
    getRepairTickets, addRepairTicket, updateRepairTicket, deleteRepairTicket,
    getTicketParts, addTicketPart, removeTicketPart,
    getRepairEvents, logRepairEvent
} from '@/data/repairsData';
import { useToast } from '@/hooks/use-toast';
import { usePagination, PaginationBar } from '@/hooks/usePagination';

const statusLabels: Record<string, string> = {
    received: '⏳ استلام',
    diagnosing: '🔍 فحص واختبار',
    repairing: '🔧 قيد الإصلاح', 
    waiting_parts: '📦 بانتظار القطع',
    ready: '✅ جاهز للتسليم', 
    delivered: '🤝 تم التسليم',
    cancelled: '❌ ملغي',
    // Fallbacks for legacy
    pending: '⏳ انتظار',
    in_progress: '🔧 إصلاح',
    waiting_for_parts: '📦 قطع',
    completed: '✅ جاهز'
};

const statusStyles: Record<string, { bg: string; color: string; border: string }> = {
    received: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    diagnosing: { bg: 'rgba(14,165,233,0.12)', color: '#0ea5e9', border: 'rgba(14,165,233,0.3)' },
    repairing: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
    waiting_parts: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.3)' },
    ready: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
    delivered: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
    cancelled: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', border: 'rgba(239,68,68,0.3)' },
    // Fallbacks
    pending: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
    in_progress: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
    waiting_for_parts: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', border: 'rgba(236,72,153,0.3)' },
    completed: { bg: 'rgba(16,185,129,0.12)', color: '#10b981', border: 'rgba(16,185,129,0.3)' },
};

const emptyTicket: Partial<RepairTicket> = {
    customer_name: '', 
    customer_phone: '', 
    device_model: '', 
    device_brand: '',
    device_category: 'mobile', 
    issue_description: '', 
    status: 'received', 
    package_price: 0, 
    accessories_received: '', 
    device_passcode: '',
    internal_notes: '', 
    receipt_notes: ''
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all";

export default function Maintenance() {
    const { toast } = useToast();
    const [tickets, setTickets] = useState<RepairTicket[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<RepairTicket>>(emptyTicket);
    
    // Ticket Parts State (for Edit Modal)
    const [ticketParts, setTicketParts] = useState<RepairTicketPart[]>([]);
    const [newPart, setNewPart] = useState({ name: '', costPrice: 0, salePrice: 0, quantity: 1 });
    
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
    const [deleteTarget, setDeleteTarget] = useState<RepairTicket | null>(null);

    const refresh = async () => {
        setIsLoading(true);
        try {
            const data = await getRepairTickets({ search: search !== '' ? search : undefined });
            setTickets(data);
        } catch (error) {
            console.error("Failed to load tickets", error);
            toast({ title: 'خطأ', description: 'فشل في تحميل تذاكر الصيانة', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            refresh();
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const handleAddPart = async () => {
        if (!editId) {
            toast({ title: 'تنبيه', description: 'يجب حفظ طلب الصيانة أولاً لتتمكن من إضافة قطع غيار', variant: 'default' });
            return;
        }
        if (!newPart.name.trim() || newPart.salePrice <= 0 || newPart.quantity <= 0) return;
        
        try {
            const part = await addTicketPart({
                ticket_id: editId,
                part_id: 'custom-' + Date.now(),
                qty: newPart.quantity,
                unit_cost: newPart.salePrice, // In this UI, selling price is unitPrice
                status: 'used'
            });
            // Re-fetch parts to get names etc
            const updatedParts = await getTicketParts(editId);
            setTicketParts(updatedParts);
            setNewPart({ name: '', costPrice: 0, salePrice: 0, quantity: 1 });
            toast({ title: '✅ أضيفت القطعة' });
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل إضافة القطعة', variant: 'destructive' });
        }
    };

    const handleRemovePart = async (id: string) => {
        try {
            await removeTicketPart(id);
            setTicketParts(ticketParts.filter(p => p.id !== id));
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل إزالة القطعة', variant: 'destructive' });
        }
    };

    const handleSubmit = async () => {
        if (!form.customer_name?.trim() || (!form.device_model?.trim() && !form.device_type?.trim())) {
            toast({ title: 'خطأ', description: 'اسم العميل واسم الجهاز مطلوبان', variant: 'destructive' });
            return;
        }
        
        // Map legacy fields if present
        const submitData = {
            ...form,
            issue_description: form.issue_description || form.problem_desc || '',
            device_model: form.device_model || form.device_type || '',
            accessories_received: form.accessories_received || form.accessories || '',
            device_passcode: form.device_passcode || form.password || '',
            package_price: form.package_price || form.expected_cost || 0
        };

        try {
            if (editId) { 
                await updateRepairTicket(editId, submitData); 
                toast({ title: '✅ تم التعديل' }); 
            } else { 
                await addRepairTicket(submitData); 
                toast({ title: '✅ تم إنشاء طلب الصيانة', description: submitData.device_model }); 
            }
            setForm(emptyTicket); setEditId(null); setShowForm(false); 
            refresh();
        } catch (error) {
            toast({ title: 'خطأ', description: 'عملية الحفظ فشلت', variant: 'destructive' });
        }
    };

    const startEdit = async (ticket: RepairTicket) => {
        // Ensure mapping for UI consistency
        const mapped = {
            ...ticket,
            device_type: ticket.device_model,
            problem_desc: ticket.issue_description,
            accessories: ticket.accessories_received,
            password: ticket.device_passcode,
            expected_cost: ticket.package_price,
            deposit_amount: 0 // Fetch from payments later if needed
        };
        setForm(mapped);
        setEditId(ticket.id); 
        setShowForm(true);
        // Load Parts
        try {
            const parts = await getTicketParts(ticket.id);
            setTicketParts(parts);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteRepairTicket(deleteTarget.id);
            toast({ title: '🗑️ تم الحذف', description: deleteTarget.customer_name });
            setDeleteTarget(null);
            refresh();
        } catch (error) {
            toast({ title: 'خطأ', description: 'فشل حذف الطلب', variant: 'destructive' });
        }
    };

    // Print client receipt
    const printReceipt = (ticket: RepairTicket) => {
        const html = `<html dir="rtl"><head><meta charset="UTF-8"><title>إيصال استلام صيانة</title>
        <style>
          body{font-family:'Tajawal',sans-serif;padding:32px;max-width:600px;margin:auto;color:#1a1a1a;}
          h2{text-align:center;font-size:1.6em;margin-bottom:4px;color:#1e3a8a;}
          .sub{text-align:center;color:#666;font-size:.9em;margin-bottom:24px;}
          table{width:100%;border-collapse:collapse;margin-top:20px;}
          td,th{padding:12px;border:1px solid #e5e7eb;text-align:right;}
          th{background:#f3f4f6;font-weight:700;width:35%;color:#374151;}
          .total-box{background:#f8fafc;border:2px dashed #cbd5e1;padding:16px;margin-top:24px;border-radius:12px;}
          .total-row{display:flex;justify-content:space-between;margin-bottom:8px;}
          .footer{margin-top:40px;text-align:center;font-size:.85em;color:#64748b;line-height:1.6;}
        </style></head><body>
        <h2>🔧 إيصال استلام جهاز</h2>
        <div class="sub">رقم الطلب: <strong>${ticket.ticket_no}</strong></div>
        
        <table>
          <tr><th>العميل</th><td>${ticket.customer_name}</td></tr>
          <tr><th>الجوال</th><td>${ticket.customer_phone || '—'}</td></tr>
          <tr><th>التاريخ</th><td>${new Date(ticket.createdAt || ticket.created_at || '').toLocaleDateString('ar-EG')}</td></tr>
          <tr><th>الجهاز</th><td>${ticket.device_model || ticket.device_type}</td></tr>
          <tr><th>الرقم التسلسلي</th><td>${ticket.imei_or_serial || ticket.serial_number || '—'}</td></tr>
          <tr><th>الملحقات المستلمة</th><td>${ticket.accessories_received || ticket.accessories || 'لا يوجد'}</td></tr>
          <tr><th>وصف العطل</th><td>${ticket.issue_description || ticket.problem_desc || '—'}</td></tr>
        </table>
        
        <div class="total-box">
            <div class="total-row"><span>التكلفة التقديرية:</span> <strong>${(ticket.package_price || ticket.expected_cost || 0).toLocaleString()} ج.م</strong></div>
        </div>
        
        <div class="footer">
            <strong>شروط الصيانة:</strong><br/>
            المركز غير مسئول عن فقدان الداتا أثناء البرمجة.<br/>
            الأجهزة التي لا يتم استلامها خلال 30 يوم من تاريخ الإبلاغ بانتهاء الصيانة لا يحق للعميل المطالبة بها.<br/>
            الضمان يشمل القطع المستبدلة فقط وليس سوء الاستخدام.
            <br/><br/>توقيع المستلم: ............................  توقيع العميل: ............................
        </div>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); w.print(); }
    };

    const filtered = useMemo(() => tickets.filter(t =>
        (categoryFilter === 'all' || t.device_category === categoryFilter) &&
        (statusFilter === 'all' || t.status === statusFilter)
    ), [tickets, categoryFilter, statusFilter]);

    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage } = usePagination(filtered, 20);

    // Calculate Stats
    const stats = useMemo(() => {
        return {
            open: tickets.filter(t => ['received', 'diagnosing', 'repairing', 'waiting_parts', 'pending', 'in_progress'].includes(t.status)).length,
            ready: tickets.filter(t => ['ready', 'completed'].includes(t.status)).length,
            delivered: tickets.filter(t => t.status === 'delivered').length
        };
    }, [tickets]);

    return (
        <div className="space-y-5 animate-fade-in pb-12" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/20">
                        <Wrench className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight">إدارة الصيانة الشاملة</h1>
                        <p className="text-sm font-medium text-muted-foreground">{tickets.length} طلب صيانة مسجل</p>
                    </div>
                </div>
                <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyTicket); setTicketParts([]); }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/25">
                    <Plus className="h-5 w-5" /> استلام جهاز جديد
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-400 to-amber-500"></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-600 transition-transform group-hover:scale-110">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground shrink-0 mb-1">أجهزة قيد العمل</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.open}</h3>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 transition-transform group-hover:scale-110">
                        <PackageCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground shrink-0 mb-1">جاهز للتسليم</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.ready}</h3>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex items-center gap-4 relative overflow-hidden group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 transition-transform group-hover:scale-110">
                        <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-muted-foreground shrink-0 mb-1">تمت بنجاح</p>
                        <h3 className="text-3xl font-black text-foreground">{stats.delivered}</h3>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-card p-2 rounded-2xl border border-border">
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto hide-scrollbar">
                    {([
                        { id: 'all', label: 'الكل' },
                        { id: 'mobile', label: 'موبيل' },
                        { id: 'tablet', label: 'تابلت' },
                        { id: 'laptop', label: 'لابتوب' },
                        { id: 'computer', label: 'كمبيوتر' },
                        { id: 'other', label: 'أخرى' },
                    ]).map(c => (
                        <button
                            key={c.id}
                            onClick={() => setCategoryFilter(c.id)}
                            className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${categoryFilter === c.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}`}
                        >
                            {c.label}
                        </button>
                    ))}
                    <div className="w-px h-8 bg-border my-auto mx-2 hidden lg:block"></div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-muted px-4 py-2 rounded-xl text-sm font-semibold border-none focus:ring-2 focus:ring-primary/40 outline-none">
                        <option value="all">كل الحالات</option>
                        {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div className="relative w-full lg:w-80 shrink-0">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="رقم الطلب، العميل، التليفون..." className={`${IC} pr-9 transition-all hover:border-primary/50 focus:border-primary`} />
                </div>
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm min-w-[900px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/30">
                                {['رقم الطلب', 'العميل والجوال', 'الجهاز وتصنيفه', 'الوصف', 'التكلفة الاسترشادية', 'الحالة', ''].map(h => (
                                    <th key={h} className="px-4 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">جاري تحميل البيانات...</td></tr>
                            ) : paginatedItems.length === 0 ? (
                                <tr><td colSpan={7} className="py-16 text-center text-muted-foreground">
                                    <div className="flex flex-col items-center gap-3">
                                        <Wrench className="h-10 w-10 opacity-20" />
                                        <p>لا توجد تذاكر صيانة تطابق بحثك</p>
                                    </div>
                                </td></tr>
                            ) : paginatedItems.map((o) => (
                                <tr key={o.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors group">
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-mono text-sm font-bold text-primary">{o.ticket_no}</div>
                                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {(o.createdAt || o.created_at || "").slice(0, 10)}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-foreground">{o.customer_name}</div>
                                        <div className="text-xs font-medium text-muted-foreground mt-0.5">{o.customer_phone || '---'}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-foreground">{o.device_model || o.device_type} <span className="text-xs font-normal text-muted-foreground">({o.device_brand || 'بدون براند'})</span></div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{o.device_category} - {o.imei_or_serial || o.serial_number || '---'}</div>
                                    </td>
                                    <td className="px-4 py-3 align-top max-w-[200px]">
                                        <p className="text-xs text-foreground truncate" title={o.issue_description || o.problem_desc}>{o.issue_description || o.problem_desc || 'غير محدد'}</p>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="font-bold text-foreground">{(o.package_price || o.expected_cost || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground">ج.م</span></div>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span
                                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                                            style={{
                                                background: statusStyles[o.status]?.bg || 'rgba(0,0,0,0.1)',
                                                color: statusStyles[o.status]?.color || '#666',
                                                border: `1px solid ${statusStyles[o.status]?.border || '#ddd'}`,
                                            }}
                                        >
                                            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusStyles[o.status]?.color || '#666' }}></div>
                                            {statusLabels[o.status] || o.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                                            <button onClick={() => printReceipt(o)} title="إيصال الاستلام" className="rounded-lg p-2 bg-card border border-border hover:bg-muted text-muted-foreground transition-all shadow-sm"><Printer className="h-4 w-4" /></button>
                                            <button onClick={() => startEdit(o)} title="تعديل ومعالجة" className="rounded-lg p-2 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 text-blue-600 transition-all shadow-sm"><Pencil className="h-4 w-4" /></button>
                                            <button onClick={() => setDeleteTarget(o)} title="حذف" className="rounded-lg p-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 text-destructive transition-all shadow-sm"><Trash2 className="h-4 w-4" /></button>
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

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-6" onClick={() => setShowForm(false)}>
                    <div className="w-full max-w-4xl mx-4 rounded-3xl border border-border bg-background p-0 shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
                            <h2 className="text-xl font-black text-foreground">{editId ? `تذكرة رقم #${form.ticket_no}` : 'استلام جهاز صيانة جديد'}</h2>
                            <button onClick={() => setShowForm(false)} className="rounded-full p-2 hover:bg-muted transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Section 1: Customer Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><AlignLeft className="h-4 w-4" /> بيانات العميل</h3>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold text-muted-foreground">اسم العميل *</label>
                                    <input value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} className={IC} />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-bold text-muted-foreground">رقم الهاتف</label>
                                    <input value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} className={IC} />
                                </div>
                            </div>
                            
                            {/* Section 2: Device Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><PenTool className="h-4 w-4" /> بيانات الجهاز</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">موديل الجهاز *</label>
                                        <input value={form.device_model || form.device_type} onChange={e => setForm({ ...form, device_model: e.target.value })} className={IC} placeholder="مثال: iPhone 13 Pro Max" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">براند الجهاز</label>
                                        <input value={form.device_brand || ''} onChange={e => setForm({ ...form, device_brand: e.target.value })} className={IC} placeholder="مثال: Apple" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">التصنيف</label>
                                        <select value={form.device_category} onChange={e => setForm({ ...form, device_category: e.target.value })} className={IC}>
                                            <option value="mobile">موبايل</option>
                                            <option value="tablet">تابلت</option>
                                            <option value="laptop">لابتوب</option>
                                            <option value="computer">كمبيوتر</option>
                                            <option value="other">أخرى</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">الحالة الحالية</label>
                                        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className={IC}>
                                            {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">IMEI / SN</label>
                                        <input value={form.imei_or_serial || form.serial_number || ''} onChange={e => setForm({ ...form, imei_or_serial: e.target.value })} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">رمز الدخول</label>
                                        <input value={form.device_passcode || form.password || ''} onChange={e => setForm({ ...form, device_passcode: e.target.value })} className={IC} />
                                    </div>
                                </div>
                            </div>
                            
                            {/* Section 3: Financial & Details */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><DollarSign className="h-4 w-4" /> التفاصيل والمالية</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="col-span-2">
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">التكلفة التقديرية (ج.م)</label>
                                        <input type="number" value={form.package_price || form.expected_cost || ''} onChange={e => setForm({ ...form, package_price: +e.target.value })} className={IC} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">وصف العطل (شكوى العميل)</label>
                                        <textarea value={form.issue_description || form.problem_desc || ''} onChange={e => setForm({ ...form, issue_description: e.target.value })} rows={2} className={`${IC} resize-none`} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="mb-1.5 block text-xs font-bold text-muted-foreground">المشتملات المستلمة</label>
                                        <input value={form.accessories_received || form.accessories || ''} onChange={e => setForm({ ...form, accessories_received: e.target.value })} className={IC} />
                                    </div>
                                </div>
                            </div>

                            {/* Section 4: Parts Management (Only shown on edit) */}
                            {editId && (
                                <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4 pt-6 border-t border-border">
                                    <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-4"><PackageCheck className="h-4 w-4" /> قطع الغيار المضافة للتذكرة</h3>
                                    
                                    <div className="rounded-2xl border border-border p-4 bg-muted/20">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                                            <input value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} placeholder="اسم القطعة" className={IC} />
                                            <input type="number" value={newPart.quantity || ''} onChange={e => setNewPart({ ...newPart, quantity: +e.target.value })} placeholder="الكمية" className={IC} min="1" />
                                            <div className="flex gap-2 md:col-span-2">
                                                <input type="number" value={newPart.salePrice || ''} onChange={e => setNewPart({ ...newPart, salePrice: +e.target.value })} placeholder="سعر القطعة (للعميل)" className={IC} />
                                                <button onClick={handleAddPart} className="shrink-0 bg-primary text-primary-foreground p-2.5 rounded-xl hover:bg-primary/90 transition-colors"><Plus className="h-5 w-5" /></button>
                                            </div>
                                        </div>
                                        
                                        {ticketParts.length > 0 && (
                                            <div className="space-y-2">
                                                <table className="w-full text-sm text-right">
                                                    <thead className="bg-card border border-border rounded-t-xl">
                                                        <tr>
                                                            <th className="p-3 font-bold text-muted-foreground text-xs rounded-tr-xl">القطعة</th>
                                                            <th className="p-3 font-bold text-muted-foreground text-xs">الكمية</th>
                                                            <th className="p-3 font-bold text-muted-foreground text-xs">السعر</th>
                                                            <th className="p-3 font-bold text-muted-foreground text-xs">الإجمالي</th>
                                                            <th className="p-3 font-bold text-muted-foreground text-xs rounded-tl-xl w-12 text-center"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {ticketParts.map((p) => (
                                                            <tr key={p.id} className="bg-background border-x border-b border-border">
                                                                <td className="p-3 font-medium text-foreground">{p.partName || p.name}</td>
                                                                <td className="p-3 text-muted-foreground">{p.qty || p.quantity}</td>
                                                                <td className="p-3 text-muted-foreground">{(p.unit_cost || p.unit_price).toLocaleString()} ج.م</td>
                                                                <td className="p-3 font-bold text-primary">{((p.qty || p.quantity) * (p.unit_cost || p.unit_price)).toLocaleString()} ج.م</td>
                                                                <td className="p-3 text-center">
                                                                    <button onClick={() => handleRemovePart(p.id)} className="text-destructive hover:bg-red-50 p-1.5 rounded-lg transition-colors"><X className="h-4 w-4" /></button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="flex justify-between items-center bg-card border border-border p-4 rounded-xl mt-2">
                                                    <div className="text-sm font-bold text-muted-foreground">إجمالي قطع الغيار:</div>
                                                    <div className="text-xl font-black text-primary">{ticketParts.reduce((s, p) => s + ((p.qty || p.quantity) * (p.unit_cost || p.unit_price)), 0).toLocaleString()} <span className="text-sm">ج.م</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex gap-3 px-6 py-4 bg-muted/40 border-t border-border">
                            <button onClick={handleSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 py-3 text-sm font-bold text-white transition-all shadow-md">
                                <CheckCircle2 className="h-4 w-4" /> {editId ? 'تحديث البيانات' : 'دخول التذكرة'}
                            </button>
                            <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl bg-card border border-border hover:bg-muted py-3 text-sm font-bold text-foreground transition-all">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => setDeleteTarget(null)}>
                    <div className="w-full max-sm:max-w-xs max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col items-center justify-center text-center gap-4 mb-6">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-500/10 shadow-inner">
                                <Trash2 className="h-8 w-8 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-foreground">تأكيد الحذف</h3>
                                <p className="text-sm text-muted-foreground mt-1">هل أنت متأكد من حذف هذا الطلب؟</p>
                            </div>
                        </div>
                        <div className="bg-muted p-3 rounded-xl mb-6 text-center">
                            <p className="text-sm font-bold text-foreground">{deleteTarget.customer_name}</p>
                            <p className="text-xs text-muted-foreground">{deleteTarget.device_model || deleteTarget.device_type}</p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleDelete} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 py-3 text-sm font-bold text-white transition-all">
                                احذف
                            </button>
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl border border-border bg-card hover:bg-muted py-3 text-sm font-bold transition-all">
                                تراجع
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
