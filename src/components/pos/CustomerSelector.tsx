// ============================================================
// CustomerSelector — POS customer selection component
// Features: default cash customer, search, full-form modal to add new customer
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, Search, Plus, X, ChevronDown, User, Phone, Mail, MapPin, FileText, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCustomers, addCustomer, Customer } from '@/data/customersData';

export interface SelectedCustomer {
    id: string;
    name: string;
    phone?: string;
}

const CASH_CUSTOMER: SelectedCustomer = {
    id: '__cash__',
    name: 'عميل نقدي',
};

interface CustomerSelectorProps {
    selected: SelectedCustomer;
    onChange: (customer: SelectedCustomer) => void;
}

// ── Add Customer Modal ─────────────────────────────────────
interface AddCustomerModalProps {
    onClose: () => void;
    onSave: (customer: Customer) => void;
}

function AddCustomerModal({ onClose, onSave }: AddCustomerModalProps) {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const nameRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        nameRef.current?.focus();
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.name.trim()) e.name = 'اسم العميل مطلوب';
        return e;
    };

    const handleSubmit = (ev: React.FormEvent) => {
        ev.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        const created = addCustomer({
            name: form.name.trim(),
            phone: form.phone.trim() || undefined,
            email: form.email.trim() || undefined,
            address: form.address.trim() || undefined,
            notes: form.notes.trim() || undefined,
        });
        onSave(created);
    };

    const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60 transition-colors";

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
                dir="rtl"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-gradient-to-l from-primary/5 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-foreground text-base">إضافة عميل جديد</h3>
                            <p className="text-xs text-muted-foreground">سيتم ربط العميل بالفاتورة الحالية</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Name */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <User className="h-3.5 w-3.5" /> اسم العميل <span className="text-red-500">*</span>
                        </label>
                        <input
                            ref={nameRef}
                            value={form.name}
                            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(er => ({ ...er, name: '' })); }}
                            placeholder="أدخل اسم العميل"
                            className={cn(IC, errors.name && 'border-red-500 focus:ring-red-400/40')}
                        />
                        {errors.name && <p className="mt-1 text-[11px] text-red-500 font-medium">{errors.name}</p>}
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" /> رقم الهاتف
                        </label>
                        <input
                            value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                            placeholder="01xxxxxxxxx"
                            type="tel"
                            dir="ltr"
                            className={IC + " text-left"}
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" /> البريد الإلكتروني
                        </label>
                        <input
                            value={form.email}
                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                            placeholder="example@email.com"
                            type="email"
                            dir="ltr"
                            className={IC + " text-left"}
                        />
                    </div>

                    {/* Address */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" /> العنوان
                        </label>
                        <input
                            value={form.address}
                            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                            placeholder="المدينة - الحي"
                            className={IC}
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                            <FileText className="h-3.5 w-3.5" /> ملاحظات
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                            placeholder="ملاحظات اختيارية..."
                            rows={2}
                            className={IC + " resize-none"}
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="submit"
                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
                        >
                            <UserPlus className="h-4 w-4" />
                            حفظ العميل وربطه بالفاتورة
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-3 rounded-xl border border-border text-sm font-bold text-muted-foreground hover:bg-muted transition-colors"
                        >
                            إلغاء
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}

// ── Main Component ─────────────────────────────────────────
export default function CustomerSelector({ selected, onChange }: CustomerSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search when dropdown opens
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const customers = useMemo(() => getCustomers(), [isOpen, showAddModal]);

    const filtered = useMemo(() => {
        if (!search.trim()) return customers;
        const q = search.toLowerCase();
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) ||
            c.phone?.includes(q) ||
            c.email?.toLowerCase().includes(q)
        );
    }, [customers, search]);

    const handleSelect = (customer: SelectedCustomer) => {
        onChange(customer);
        setIsOpen(false);
        setSearch('');
    };

    const handleCustomerSaved = (created: Customer) => {
        onChange({ id: created.id, name: created.name, phone: created.phone });
        setShowAddModal(false);
        setIsOpen(false);
        setSearch('');
    };

    const isCash = selected.id === '__cash__';

    return (
        <>
            <div className="relative" ref={dropdownRef}>
                {/* Toggle button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all border',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isCash
                            ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                    )}
                >
                    <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 text-start truncate">{selected.name}</span>
                    {selected.phone && (
                        <span className="text-xs opacity-70 font-mono">{selected.phone}</span>
                    )}
                    <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </button>

                {/* Dropdown */}
                {isOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        {/* Cash customer quick button */}
                        <button
                            onClick={() => handleSelect(CASH_CUSTOMER)}
                            className={cn(
                                'flex w-full items-center gap-2 px-3 py-2.5 text-sm font-bold border-b border-border/40 transition-colors',
                                isCash
                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400'
                                    : 'hover:bg-muted/50 text-muted-foreground'
                            )}
                        >
                            <span className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-xs font-black text-blue-600">💵</span>
                            عميل نقدي (بدون تسجيل)
                        </button>

                        {/* Search */}
                        <div className="p-2 border-b border-border/40">
                            <div className="relative">
                                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <input
                                    ref={searchInputRef}
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="بحث بالاسم أو الهاتف..."
                                    className="w-full h-8 bg-muted/30 border border-border/50 rounded-lg pr-8 pl-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        {/* Customer list */}
                        <div className="max-h-44 overflow-y-auto">
                            {filtered.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">
                                    {search ? 'لا يوجد عملاء مطابقين' : 'لا يوجد عملاء بعد'}
                                </p>
                            ) : (
                                filtered.map(c => (
                                    <button
                                        key={c.id}
                                        onClick={() => handleSelect({ id: c.id, name: c.name, phone: c.phone })}
                                        className={cn(
                                            'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                                            selected.id === c.id && 'bg-emerald-50 dark:bg-emerald-500/10'
                                        )}
                                    >
                                        <span className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary shrink-0">
                                            {c.name.charAt(0)}
                                        </span>
                                        <span className="flex-1 text-start font-medium truncate">{c.name}</span>
                                        {c.phone && <span className="text-[10px] text-muted-foreground font-mono">{c.phone}</span>}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Add new customer button */}
                        <div className="border-t border-border/40">
                            <button
                                onClick={() => { setShowAddModal(true); setIsOpen(false); }}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                إضافة عميل جديد...
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Full Customer Add Modal */}
            {showAddModal && (
                <AddCustomerModal
                    onClose={() => setShowAddModal(false)}
                    onSave={handleCustomerSaved}
                />
            )}
        </>
    );
}

export { CASH_CUSTOMER };
