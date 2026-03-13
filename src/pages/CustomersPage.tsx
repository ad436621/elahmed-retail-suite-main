// ============================================================
// Customers Page — Customer management with add/edit/delete
// ============================================================

import { useState, useMemo } from 'react';
import { Users, Plus, Search, Pencil, Trash2, Phone, MapPin, X, Save, MessageSquare, Download } from 'lucide-react';
import { exportToExcel, CUSTOMER_COLUMNS, prepareCustomersForExport } from '@/services/excelService';
import {
    getCustomers, addCustomer, updateCustomer, deleteCustomer,
    type Customer,
} from '@/data/customersData';
import { getContracts } from '@/data/installmentsData';
import { useConfirm } from '@/components/ConfirmDialog';

// ─── Customer Form Modal ──────────────────────────────────────

function CustomerModal({
    customer,
    onClose,
    onSave,
}: {
    customer?: Customer;
    onClose: () => void;
    onSave: () => void;
}) {
    const isEdit = !!customer;
    const [form, setForm] = useState({
        name: customer?.name ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
        email: customer?.email ?? '',
        notes: customer?.notes ?? '',
    });
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setError('الاسم مطلوب'); return; }
        if (isEdit && customer) {
            updateCustomer(customer.id, form);
        } else {
            addCustomer(form);
        }
        onSave();
        onClose();
    };

    const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [k]: e.target.value }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border/50">
                    <h2 className="text-lg font-extrabold text-foreground">
                        {isEdit ? 'تعديل عميل' : 'إضافة عميل جديد'}
                    </h2>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <p className="text-sm text-destructive font-medium">{error}</p>}

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">الاسم *</label>
                        <input data-validation="text-only" value={form.name} onChange={f('name')} placeholder="اسم العميل"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">رقم الهاتف</label>
                            <input data-validation="phone" value={form.phone} onChange={f('phone')} placeholder="01xxxxxxxxx" type="tel"
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1.5">البريد الإلكتروني</label>
                            <input value={form.email} onChange={f('email')} placeholder="example@mail.com" type="email"
                                className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">العنوان</label>
                        <input data-validation="text-only" value={form.address} onChange={f('address')} placeholder="عنوان العميل"
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1.5">ملاحظات</label>
                        <textarea value={form.notes} onChange={f('notes')} placeholder="أي ملاحظات..." rows={2}
                            className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none" />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="submit"
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                            <Save className="h-4 w-4" />
                            {isEdit ? 'حفظ التعديلات' : 'إضافة العميل'}
                        </button>
                        <button type="button" onClick={onClose}
                            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────

export default function CustomersPage() {
    const [customers, setCustomers] = useState(getCustomers);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState<Customer | undefined>();
    const { confirm } = useConfirm();

    const refresh = () => setCustomers(getCustomers());

    const filtered = useMemo(() =>
        customers.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.phone?.includes(search) ||
            c.address?.toLowerCase().includes(search.toLowerCase())
        ), [customers, search]);

    const handleEdit = (c: Customer) => { setEditTarget(c); setShowModal(true); };
    const handleAdd = () => { setEditTarget(undefined); setShowModal(true); };
    const handleDelete = async (c: Customer) => {
        // Check if customer has active contracts
        const contracts = getContracts();
        const activeContracts = contracts.filter(ct =>
            ct.customerName === c.name && (ct.status === 'active' || ct.status === 'overdue')
        );
        if (activeContracts.length > 0) {
            await confirm({
                title: 'لا يمكن الحذف',
                message: `العميل "${c.name}" لديه ${activeContracts.length} عقد تقسيط نشط. قم بإنهاء العقود أولاً.`,
                confirmLabel: 'حسناً',
                danger: false
            });
            return;
        }
        const ok = await confirm({ title: 'حذف عميل', message: `هل أنت متأكد من حذف العميل "${c.name}"؟`, confirmLabel: 'حذف', danger: true });
        if (ok) { deleteCustomer(c.id); refresh(); }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
                        <Users className="h-6 w-6 text-primary" /> إدارة العملاء
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">{customers.length} عميل مسجل</p>
                </div>
                <div className="flex items-center gap-2">
                <button onClick={handleAdd}
                    className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg">
                    <Plus className="h-4 w-4" /> إضافة عميل
                </button>
                <button onClick={() => exportToExcel({ data: prepareCustomersForExport(customers), columns: CUSTOMER_COLUMNS, fileName: 'العملاء' })}
                    className="flex items-center gap-2 rounded-2xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-5 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-sm">
                    <Download className="h-4 w-4" /> تصدير Excel
                </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم الهاتف أو العنوان..."
                    className="w-full rounded-2xl border border-border bg-card pr-10 pl-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 shadow-sm" />
            </div>

            {/* Customers Grid */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Users className="h-16 w-16 opacity-20 mb-4" />
                    <p className="text-lg font-bold">{search ? 'لا توجد نتائج' : 'لا يوجد عملاء'}</p>
                    <p className="text-sm mt-1">{search ? 'جرب بحثاً مختلفاً' : 'ابدأ بإضافة أول عميل'}</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map(c => (
                        <div key={c.id}
                            className="group relative rounded-2xl border border-border bg-card p-5 hover:border-primary/30 hover:shadow-lg transition-all duration-200">

                            {/* Avatar + Name */}
                            <div className="flex items-start gap-3 mb-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-black shrink-0">
                                    {c.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-extrabold text-foreground truncate">{c.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {new Date(c.createdAt).toLocaleDateString('ar-EG')}
                                    </p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5 mb-4">
                                {c.phone && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Phone className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                        <span dir="ltr">{c.phone}</span>
                                    </div>
                                )}
                                {c.address && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5 text-primary/60 shrink-0" />
                                        <span className="truncate">{c.address}</span>
                                    </div>
                                )}
                                {c.notes && (
                                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <MessageSquare className="h-3.5 w-3.5 text-primary/60 shrink-0 mt-0.5" />
                                        <span className="line-clamp-2">{c.notes}</span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(c)}
                                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                                    <Pencil className="h-3.5 w-3.5" /> تعديل
                                </button>
                                <button onClick={() => handleDelete(c)}
                                    className="flex items-center justify-center rounded-xl border border-border p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <CustomerModal
                    customer={editTarget}
                    onClose={() => setShowModal(false)}
                    onSave={refresh}
                />
            )}
        </div>
    );
}
