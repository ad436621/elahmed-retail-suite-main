// ============================================================
// SubSectionPage — Generic reusable sub-inventory page
// Used by: Car Spare Parts, Car Oils,
//          Mobile Accessories, Mobile Spare Parts,
//          Computer Accessories, Computer Spare Parts,
//          Device Accessories,  Device Spare Parts
// ============================================================
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus, Trash2, Pencil, X, Check, Search, ImagePlus, ImageOff,
    AlertTriangle, FolderOpen, Settings2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────

export interface SubItem {
    id: string;
    name: string;
    brand?: string;
    category?: string;
    model?: string;
    quantity: number;
    costPrice: number;
    salePrice: number;
    minStock?: number;
    notes?: string;
    image?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}

export interface NavButton {
    label: string;
    path: string;
    icon: React.ReactNode;
    color: string;
    hoverColor: string;
    isActive: boolean;
}

export interface SubSectionPageConfig {
    title: string;
    icon: React.ReactNode;
    iconBg: string;
    iconText: string;
    addBtnClass: string;
    /** Default categories shown on first load */
    categories?: string[];
    /** localStorage key prefix — categories are persisted here */
    storageKey?: string;
    navButtons: NavButton[];
    getItems: () => SubItem[];
    addItem: (item: Omit<SubItem, 'id' | 'createdAt' | 'updatedAt'>) => SubItem;
    updateItem: (id: string, updates: Partial<SubItem>) => void;
    deleteItem: (id: string) => void;
    getCapital?: () => number;
}

// ─── LocalStorage helpers ────────────────────────────────────

function loadCats(key: string, defaults: string[]): string[] {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw) as string[];
    } catch { /* ignore */ }
    return defaults;
}

function saveCats(key: string, cats: string[]): void {
    localStorage.setItem(key, JSON.stringify(cats));
}

// ─── ImageUpload ─────────────────────────────────────────────

function ImageUpload({ value, onChange }: {
    value?: string;
    onChange: (v: string | undefined) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX = 600;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                onChange(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    };
    return (
        <div className="flex items-center gap-3">
            {value ? (
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/30 shrink-0">
                    <img src={value} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => onChange(undefined)}
                        className="absolute top-0.5 right-0.5 rounded-full bg-red-500 p-0.5 text-white">
                        <X className="h-2.5 w-2.5" />
                    </button>
                </div>
            ) : (
                <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0">
                    <ImageOff className="h-6 w-6 text-muted-foreground/40" />
                </div>
            )}
            <button type="button" onClick={() => ref.current?.click()}
                className="flex-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center justify-center gap-2">
                <ImagePlus className="h-4 w-4" /> {value ? 'تغيير الصورة' : 'إضافة صورة'}
            </button>
            <input ref={ref} type="file" accept="image/*" onChange={handle} className="hidden" />
        </div>
    );
}

// ─── Categories Manager Modal ─────────────────────────────────

function CategoriesManager({ cats, onSave, onClose, addBtnClass }: {
    cats: string[];
    onSave: (cats: string[]) => void;
    onClose: () => void;
    addBtnClass: string;
}) {
    const [list, setList] = useState<string[]>([...cats]);
    const [newName, setNewName] = useState('');
    const [editIdx, setEditIdx] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');

    const addCat = () => {
        const n = newName.trim();
        if (!n || list.includes(n)) return;
        setList(l => [...l, n]);
        setNewName('');
    };

    const deleteCat = (idx: number) => {
        setList(l => l.filter((_, i) => i !== idx));
        if (editIdx === idx) setEditIdx(null);
    };

    const startEdit = (idx: number) => { setEditIdx(idx); setEditVal(list[idx]); };

    const saveEdit = () => {
        if (editIdx === null) return;
        const n = editVal.trim();
        if (!n) return;
        if (list.filter((_, i) => i !== editIdx).includes(n)) return;
        setList(l => l.map((c, i) => i === editIdx ? n : c));
        setEditIdx(null);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
            <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-bold">إدارة التصنيفات</h3>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Add new */}
                <div className="px-5 pt-4 pb-3 flex gap-2">
                    <input
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addCat()}
                        placeholder="اسم التصنيف الجديد..."
                        className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        autoFocus
                    />
                    <button onClick={addCat}
                        className={cn('flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white', addBtnClass)}>
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                {/* List */}
                <div className="px-5 pb-4 space-y-1.5 max-h-64 overflow-y-auto">
                    {list.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات بعد</p>
                    )}
                    {list.map((cat, idx) => (
                        <div key={idx}
                            className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 group hover:border-primary/30 transition-colors">
                            {editIdx === idx ? (
                                <input
                                    value={editVal}
                                    onChange={e => setEditVal(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') saveEdit();
                                        if (e.key === 'Escape') setEditIdx(null);
                                    }}
                                    className="flex-1 rounded-lg border border-primary/40 px-2 py-1 text-sm focus:outline-none bg-background"
                                    autoFocus
                                />
                            ) : (
                                <span className="flex-1 text-sm font-medium text-foreground">{cat}</span>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {editIdx === idx ? (
                                    <>
                                        <button onClick={saveEdit}
                                            className="rounded-md p-1 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600">
                                            <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => setEditIdx(null)}
                                            className="rounded-md p-1 hover:bg-muted text-muted-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(idx)}
                                            className="rounded-md p-1 hover:bg-primary/10 text-primary">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => deleteCat(idx)}
                                            className="rounded-md p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 pb-5">
                    <button onClick={() => onSave(list)}
                        className={cn('flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white', addBtnClass)}>
                        <Check className="h-4 w-4" /> حفظ التصنيفات
                    </button>
                    <button onClick={onClose}
                        className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Shared constants ─────────────────────────────────────────

const IC = 'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';
const emptyForm = (): Omit<SubItem, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: '', brand: '', category: '', model: '',
    quantity: 0, costPrice: 0, salePrice: 0, minStock: 2, notes: '', image: undefined,
});

// ─── Main Component ──────────────────────────────────────────

export default function SubSectionPage({ config }: { config: SubSectionPageConfig }) {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    // ── Dynamic Categories (persisted to localStorage) ──
    const catsKey = config.storageKey ? `${config.storageKey}__cats` : '';
    const [cats, setCats] = useState<string[]>(() =>
        catsKey ? loadCats(catsKey, config.categories ?? []) : (config.categories ?? [])
    );
    const [showCatManager, setShowCatManager] = useState(false);

    const handleSaveCats = (newCats: string[]) => {
        setCats(newCats);
        if (catsKey) saveCats(catsKey, newCats);
        setShowCatManager(false);
        toast({ title: '✅ تم حفظ التصنيفات', description: `${newCats.length} تصنيف` });
    };

    // ── Items ──
    const [items, setItems] = useState<SubItem[]>(() => config.getItems());
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<SubItem, 'id' | 'createdAt' | 'updatedAt'>>(emptyForm());
    const [search, setSearch] = useState('');
    const [catFilter, setCatFilter] = useState('الكل');

    const refresh = () => setItems(config.getItems());

    // Reset filter when category is deleted
    useEffect(() => {
        if (catFilter !== 'الكل' && !cats.includes(catFilter)) setCatFilter('الكل');
    }, [cats, catFilter]);

    const handleSubmit = () => {
        if (!form.name.trim()) {
            toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' });
            return;
        }
        if (editId) {
            config.updateItem(editId, form);
            toast({ title: '✅ تم التعديل' });
        } else {
            config.addItem(form);
            toast({ title: '✅ تمت الإضافة', description: form.name });
        }
        setForm(emptyForm()); setEditId(null); setShowForm(false); refresh();
    };

    const startEdit = (item: SubItem) => {
        setForm({
            name: item.name, brand: item.brand ?? '', category: item.category ?? '',
            model: item.model ?? '', quantity: item.quantity, costPrice: item.costPrice,
            salePrice: item.salePrice, minStock: item.minStock ?? 2,
            notes: item.notes ?? '', image: item.image,
        });
        setEditId(item.id); setShowForm(true);
    };

    const handleDelete = async (id: string, name: string) => {
        const ok = await confirm({ title: 'حذف منتج', message: `هل أنت متأكد من حذف "${name}"؟`, confirmLabel: 'حذف', danger: true });
        if (!ok) return;
        config.deleteItem(id);
        toast({ title: `🗑️ تم حذف "${name}"` });
        refresh();
    };

    const allCats = cats.length ? ['الكل', ...cats] : [];
    const filtered = items.filter(i =>
        (catFilter === 'الكل' || i.category === catFilter) &&
        (i.name.toLowerCase().includes(search.toLowerCase()) ||
            (i.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (i.model ?? '').toLowerCase().includes(search.toLowerCase()))
    );
    const capital = config.getCapital
        ? config.getCapital()
        : items.reduce((s, i) => s + i.costPrice * i.quantity, 0);
    const lowStock = items.filter(i => i.minStock !== undefined && i.quantity <= i.minStock);

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* ═══ Nav Buttons ═══ */}
            <div className="flex gap-2 flex-wrap">
                {config.navButtons.map((btn, i) => (
                    <button key={i}
                        onClick={() => !btn.isActive && navigate(btn.path)}
                        className={cn(
                            'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-md transition-all',
                            btn.isActive
                                ? `${btn.color} text-white ring-2 ring-white/40 ring-offset-1 cursor-default`
                                : `bg-muted text-muted-foreground hover:text-white ${btn.hoverColor}`
                        )}>
                        {btn.icon} {btn.label}
                    </button>
                ))}
            </div>

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', config.iconBg)}>
                        <span className={config.iconText}>{config.icon}</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
                        <p className="text-xs text-muted-foreground">
                            {items.length} صنف • رأس المال: {capital.toLocaleString('ar-EG')} ج.م
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {lowStock.length > 0 && (
                        <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                                {lowStock.length} مخزون منخفض
                            </span>
                        </div>
                    )}
                    <button
                        onClick={() => setShowCatManager(true)}
                        className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-sm">
                        <Settings2 className="h-4 w-4" /> التصنيفات ({cats.length})
                    </button>
                    <button
                        onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm()); }}
                        className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-md', config.addBtnClass)}>
                        <Plus className="h-4 w-4" /> إضافة
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap items-start">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="بحث بالاسم، الماركة، الموديل..."
                        className={`${IC} pr-9`} />
                </div>
                {allCats.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                        {allCats.map(cat => (
                            <button key={cat} onClick={() => setCatFilter(cat)}
                                className={cn('rounded-xl px-3 py-2 text-xs font-semibold transition-all',
                                    catFilter === cat
                                        ? `${config.addBtnClass} text-white`
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                )}>
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Categories Manager Modal */}
            {showCatManager && (
                <CategoriesManager
                    cats={cats}
                    onSave={handleSaveCats}
                    onClose={() => setShowCatManager(false)}
                    addBtnClass={config.addBtnClass}
                />
            )}

            {/* Add/Edit Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-6 px-4" onClick={() => { setShowForm(false); setEditId(null); }}>
                    <div className="w-full max-w-xl mx-auto rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">{editId ? '✏️ تعديل' : '➕ إضافة'} — {config.title}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }}
                                className="rounded-lg p-1.5 hover:bg-muted">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>

                        <ImageUpload value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} />

                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الاسم *</label>
                                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الماركة</label>
                                <input value={form.brand ?? ''} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الموديل</label>
                                <input value={form.model ?? ''} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} className={IC} />
                            </div>
                            {cats.length > 0 && (
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">التصنيف</label>
                                    <select value={form.category ?? ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={IC}>
                                        <option value="">-- اختر تصنيف --</option>
                                        {cats.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الكمية</label>
                                <input type="number" min={0} value={form.quantity}
                                    onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">حد التنبيه</label>
                                <input type="number" min={0} value={form.minStock ?? 2}
                                    onChange={e => setForm(f => ({ ...f, minStock: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">سعر الشراء</label>
                                <input type="number" min={0} value={form.costPrice}
                                    onChange={e => setForm(f => ({ ...f, costPrice: +e.target.value }))} className={IC} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">سعر البيع</label>
                                <input type="number" min={0} value={form.salePrice}
                                    onChange={e => setForm(f => ({ ...f, salePrice: +e.target.value }))} className={IC} />
                            </div>
                            {form.salePrice > 0 && form.costPrice > 0 && (
                                <div className={`col-span-2 rounded-xl border p-3 flex justify-between ${form.salePrice >= form.costPrice ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                                    <span className={`text-sm font-semibold ${form.salePrice >= form.costPrice ? 'text-emerald-600' : 'text-red-600'}`}>
                                        هامش الربح
                                    </span>
                                    <span className={`text-lg font-extrabold ${form.salePrice >= form.costPrice ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {(form.salePrice - form.costPrice).toLocaleString()} ج.م
                                    </span>
                                </div>
                            )}
                            <div className="col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">ملاحظات</label>
                                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={2} className={`${IC} resize-none`} />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={handleSubmit}
                                className={cn('flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white', config.addBtnClass)}>
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }}
                                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border bg-muted/30">
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">المنتج</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الماركة</th>
                            {cats.length > 0 && (
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">التصنيف</th>
                            )}
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الكمية</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">سعر الشراء</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">سعر البيع</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">الربح</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={cats.length ? 8 : 7}
                                    className="py-16 text-center text-muted-foreground">
                                    <span className={cn('block mx-auto mb-3 opacity-20 [&>svg]:h-10 [&>svg]:w-10 [&>svg]:mx-auto', config.iconText)}>
                                        {config.icon}
                                    </span>
                                    <p className="text-sm">لا توجد منتجات مضافة</p>
                                </td>
                            </tr>
                        ) : filtered.map((item, i) => (
                            <tr key={item.id}
                                className={cn('border-b border-border/50 hover:bg-muted/20 transition-colors',
                                    i % 2 !== 0 && 'bg-muted/5')}>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name}
                                                className="h-9 w-9 rounded-lg object-cover shrink-0 border border-border" />
                                        ) : (
                                            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                                                <span className={cn('opacity-30 [&>svg]:h-4 [&>svg]:w-4', config.iconText)}>
                                                    {config.icon}
                                                </span>
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-semibold text-foreground leading-tight">{item.name}</p>
                                            {item.model && (
                                                <p className="text-[10px] text-muted-foreground">{item.model}</p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">{item.brand || '—'}</td>
                                {cats.length > 0 && (
                                    <td className="px-4 py-3">
                                        {item.category ? (
                                            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary">
                                                {item.category}
                                            </span>
                                        ) : '—'}
                                    </td>
                                )}
                                <td className="px-4 py-3">
                                    <span className={cn('font-bold text-sm',
                                        item.minStock !== undefined && item.quantity <= item.minStock
                                            ? 'text-red-600'
                                            : 'text-foreground')}>
                                        {item.quantity}
                                        {item.minStock !== undefined && item.quantity <= item.minStock && (
                                            <AlertTriangle className="inline h-3 w-3 ml-1" />
                                        )}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                                    {item.costPrice.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-sm font-bold tabular-nums">
                                    {item.salePrice.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-xs font-bold text-emerald-600 tabular-nums">
                                    {(item.salePrice - item.costPrice).toLocaleString()}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-1">
                                        <button onClick={() => startEdit(item)}
                                            className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"
                                            title="تعديل">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(item.id, item.name)}
                                            className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive transition-colors"
                                            title="حذف">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
