// ============================================================
// صفحة الشركاء — Partners Page
// ============================================================

import { useState, useMemo } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Phone, MapPin } from 'lucide-react';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';
import { useConfirm } from '@/components/ConfirmDialog';

// ── Types ────────────────────────────────────────────────────
export interface Partner {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    partnershipType: 'investor' | 'supplier_partner' | 'franchise' | 'other';
    sharePercent?: number;
    capitalAmount?: number;
    notes?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

const TYPE_LABELS: Record<Partner['partnershipType'], string> = {
    investor: 'مستثمر',
    supplier_partner: 'شريك توريد',
    franchise: 'وكيل',
    other: 'أخرى',
};

// ── Data helpers ─────────────────────────────────────────────
const KEY = STORAGE_KEYS.PARTNERS ?? 'gx_partners';

function getPartners(): Partner[] {
    return getStorageItem<Partner[]>(KEY, []);
}
function savePartners(list: Partner[]) {
    setStorageItem(KEY, list);
}

// ── Component ────────────────────────────────────────────────
export default function PartnersPage() {
    const [partners, setPartners] = useState(getPartners);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Partner>>({});

    const filtered = useMemo(() => {
        if (!search.trim()) return partners;
        const q = search.toLowerCase();
        return partners.filter(p => p.name.toLowerCase().includes(q) || p.phone?.includes(q));
    }, [partners, search]);

    const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 });

    function handleSave() {
        const now = new Date().toISOString();
        if (editId) {
            const updated = partners.map(p => p.id === editId ? { ...p, ...form, updatedAt: now } : p);
            savePartners(updated);
            setPartners(updated);
        } else {
            const newP: Partner = {
                id: crypto.randomUUID(),
                name: form.name || 'شريك جديد',
                phone: form.phone,
                address: form.address,
                partnershipType: form.partnershipType || 'other',
                sharePercent: form.sharePercent,
                capitalAmount: form.capitalAmount,
                notes: form.notes,
                active: true,
                createdAt: now,
                updatedAt: now,
            };
            const updated = [...partners, newP];
            savePartners(updated);
            setPartners(updated);
        }
        setShowForm(false);
        setEditId(null);
        setForm({});
    }

    const { confirm } = useConfirm();

    async function handleDelete(id: string) {
        const p = partners.find(x => x.id === id);
        const ok = await confirm({ title: 'حذف شريك', message: `هل أنت متأكد من حذف الشريك "${p?.name ?? ''}"؟`, confirmLabel: 'حذف', danger: true });
        if (!ok) return;
        const updated = partners.filter(p => p.id !== id);
        savePartners(updated);
        setPartners(updated);
    }

    function startEdit(p: Partner) {
        setForm(p);
        setEditId(p.id);
        setShowForm(true);
    }

    const totalCapital = partners.reduce((s, p) => s + (p.capitalAmount || 0), 0);

    return (
        <div className="space-y-6 pb-10 animate-fade-in" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">الشركاء</h1>
                        <p className="text-xs text-muted-foreground">{partners.length} شريك — رأس مال: {fmt(totalCapital)} ج.م</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث..." className="pr-9 pl-3 py-2 text-sm rounded-xl border border-border bg-card w-52" />
                    </div>
                    <button onClick={() => { setForm({}); setEditId(null); setShowForm(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
                        <Plus className="h-4 w-4" /> إضافة شريك
                    </button>
                </div>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => (
                    <div key={p.id} className="rounded-2xl border border-border/50 bg-card p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-bold text-foreground">{p.name}</h3>
                                <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{TYPE_LABELS[p.partnershipType]}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></button>
                                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                            </div>
                        </div>
                        {p.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" />{p.phone}</div>}
                        {p.address && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{p.address}</div>}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                            <div><p className="text-xs text-muted-foreground">نسبة الشراكة</p><p className="font-bold text-foreground">{p.sharePercent ?? 0}%</p></div>
                            <div><p className="text-xs text-muted-foreground">رأس المال</p><p className="font-bold text-foreground">{fmt(p.capitalAmount || 0)} ج.م</p></div>
                        </div>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <div className="col-span-full py-16 text-center text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>لا يوجد شركاء — أضف شريك جديد</p>
                    </div>
                )}
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowForm(false)}>
                    <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md space-y-4 mx-4" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل شريك' : 'إضافة شريك جديد'}</h2>
                        {([
                            { key: 'name', label: 'الاسم', type: 'text' },
                            { key: 'phone', label: 'الهاتف', type: 'tel' },
                            { key: 'address', label: 'العنوان', type: 'text' },
                            { key: 'sharePercent', label: 'نسبة الشراكة %', type: 'number' },
                            { key: 'capitalAmount', label: 'رأس المال', type: 'number' },
                            { key: 'notes', label: 'ملاحظات', type: 'text' },
                        ] as const).map(f => (
                            <div key={f.key}>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                                <input type={f.type} value={(form as any)[f.key] ?? ''}
                                    onChange={e => setForm(prev => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background" />
                            </div>
                        ))}
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground mb-1 block">نوع الشراكة</label>
                            <select value={form.partnershipType ?? 'other'} onChange={e => setForm(prev => ({ ...prev, partnershipType: e.target.value as Partner['partnershipType'] }))}
                                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background">
                                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors">حفظ</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
