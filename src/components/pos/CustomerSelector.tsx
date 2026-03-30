// ============================================================
// CustomerSelector — POS customer selection component
// Features: default cash customer, search, add inline
// ============================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { UserCheck, Search, Plus, X, ChevronDown } from 'lucide-react';
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

export default function CustomerSelector({ selected, onChange }: CustomerSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhone, setNewPhone] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowAddForm(false);
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

    const customers = useMemo(() => getCustomers(), [isOpen]);

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

    const handleAddCustomer = () => {
        if (!newName.trim()) return;
        const created = addCustomer({
            name: newName.trim(),
            phone: newPhone.trim() || undefined,
        });
        onChange({ id: created.id, name: created.name, phone: created.phone });
        setNewName('');
        setNewPhone('');
        setShowAddForm(false);
        setIsOpen(false);
    };

    const isCash = selected.id === '__cash__';

    return (
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
                        عميل نقدي
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
                    <div className="max-h-40 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-3">لا يوجد عملاء مطابقين</p>
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

                    {/* Add new customer */}
                    <div className="border-t border-border/40">
                        {!showAddForm ? (
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-bold text-primary hover:bg-primary/5 transition-colors"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                إضافة عميل جديد
                            </button>
                        ) : (
                            <div className="p-2 space-y-1.5">
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="اسم العميل *"
                                    className="w-full h-8 bg-muted/30 border border-border/50 rounded-lg px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && handleAddCustomer()}
                                />
                                <input
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                    placeholder="رقم الهاتف (اختياري)"
                                    className="w-full h-8 bg-muted/30 border border-border/50 rounded-lg px-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    onKeyDown={e => e.key === 'Enter' && handleAddCustomer()}
                                />
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleAddCustomer}
                                        disabled={!newName.trim()}
                                        className="flex-1 h-7 bg-primary text-primary-foreground rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-primary/90 transition-colors"
                                    >
                                        حفظ
                                    </button>
                                    <button
                                        onClick={() => { setShowAddForm(false); setNewName(''); setNewPhone(''); }}
                                        className="h-7 px-3 bg-muted text-muted-foreground rounded-lg text-xs font-bold hover:bg-muted/80 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export { CASH_CUSTOMER };
