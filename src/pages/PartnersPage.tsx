// ============================================================
// صفحة الشركاء — Partners Page (Relational DB Version)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Search, Phone, MapPin, Loader2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { getPartners, addPartner, updatePartner, deletePartner } from '@/data/partnersData';

// ── Types ────────────────────────────────────────────────────
export interface Partner {
    id: string;
    name: string;
    phone?: string;
    address?: string;
    partnershipType: 'investor' | 'supplier_partner' | 'franchise' | 'other';
    sharePercent?: number;            // General overall share
    profitShareDevices?: number;      // ELOS Feature: share from devices
    profitShareAccessories?: number;  // ELOS Feature: share from accessories
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

// ── Component ────────────────────────────────────────────────
export default function PartnersPage() {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<Partner>>({});

    useEffect(() => {
        loadPartners();
    }, []);

    async function loadPartners() {
        try {
            setIsLoading(true);
            const data = await getPartners();
            setPartners(data || []);
        } catch (err) {
            console.error('Failed to load partners', err);
        } finally {
            setIsLoading(false);
        }
    }

    const filtered = useMemo(() => {
        if (!search.trim()) return partners;
        const q = search.toLowerCase();
        return partners.filter(p => p.name.toLowerCase().includes(q) || p.phone?.includes(q));
    }, [partners, search]);

    const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 });

    async function handleSave() {
        if (!form.name) return;
        try {
            if (editId) {
                await updatePartner(editId, form);
            } else {
                await addPartner({
                    ...(form as Omit<Partner, 'id' | 'createdAt' | 'updatedAt'>),
                    active: true,
                    partnershipType: form.partnershipType || 'other',
                    name: form.name,
                });
            }
            await loadPartners();
            setShowForm(false);
            setEditId(null);
            setForm({});
        } catch (err) {
            console.error('Failed to save partner', err);
        }
    }

    const { confirm } = useConfirm();

    async function handleDelete(id: string) {
        const p = partners.find(x => x.id === id);
        const ok = await confirm({ title: 'حذف شريك', message: `هل أنت متأكد من حذف الشريك "${p?.name ?? ''}"؟`, confirmLabel: 'حذف', danger: true });
        if (!ok) return;
        
        try {
            await deletePartner(id);
            await loadPartners();
        } catch (err) {
            console.error('Failed to delete partner', err);
        }
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
                        <h1 className="text-2xl font-bold text-foreground">الشركاء والمستثمرون</h1>
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

            {/* Content */}
            {isLoading ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
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
                                <div><p className="text-xs text-muted-foreground">أرباح أجهزة المحل</p><p className="font-bold text-foreground">{p.profitShareDevices ?? 0}%</p></div>
                                <div><p className="text-xs text-muted-foreground">أرباح الإكسسوارات</p><p className="font-bold text-foreground">{p.profitShareAccessories ?? 0}%</p></div>
                                <div className="col-span-2 pt-1"><p className="text-xs text-muted-foreground">النسبة العامة الكلية</p><p className="font-bold text-foreground">{p.sharePercent ?? 0}%</p></div>
                                <div className="col-span-2"><p className="text-xs text-muted-foreground">رأس المال المُسجل</p><p className="font-bold text-green-600 dark:text-green-400">{fmt(p.capitalAmount || 0)} ج.م</p></div>
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="col-span-full py-16 text-center text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>لا يوجد شركاء — أضف شريك جديد لإدارة حصص الأرباح</p>
                        </div>
                    )}
                </div>
            )}

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in" onClick={() => setShowForm(false)}>
                    <div className="bg-card rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md space-y-4 mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-foreground">{editId ? 'تعديل شريك' : 'إضافة شريك جديد'}</h2>
                        
                        <div className="grid gap-3">
                            {([
                                { key: 'name', label: 'اسم الشريك', type: 'text' },
                                { key: 'phone', label: 'رقم الهاتف', type: 'tel' },
                                { key: 'address', label: 'العنوان', type: 'text' },
                            ] as const).map(f => (
                                <div key={f.key}>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">{f.label}</label>
                                    <input type={f.type} value={(form as any)[f.key] ?? ''}
                                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background" />
                                </div>
                            ))}

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">رأس المال (ج.م)</label>
                                    <input type="number" value={form.capitalAmount ?? ''}
                                        onChange={e => setForm(prev => ({ ...prev, capitalAmount: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">النسبة العامة %</label>
                                    <input type="number" value={form.sharePercent ?? ''}
                                        onChange={e => setForm(prev => ({ ...prev, sharePercent: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block text-blue-600 dark:text-blue-400">نصيب % (أجهزة)</label>
                                    <input type="number" value={form.profitShareDevices ?? ''}
                                        onChange={e => setForm(prev => ({ ...prev, profitShareDevices: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-primary/30 bg-primary/5 focus:border-primary" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-muted-foreground mb-1 block text-blue-600 dark:text-blue-400">نصيب % (إكسسوار)</label>
                                    <input type="number" value={form.profitShareAccessories ?? ''}
                                        onChange={e => setForm(prev => ({ ...prev, profitShareAccessories: Number(e.target.value) }))}
                                        className="w-full px-3 py-2 text-sm rounded-xl border border-primary/30 bg-primary/5 focus:border-primary" />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">نوع الشراكة</label>
                                <select value={form.partnershipType ?? 'other'} onChange={e => setForm(prev => ({ ...prev, partnershipType: e.target.value as Partner['partnershipType'] }))}
                                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background">
                                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors">حفظ التغييرات</button>
                            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
