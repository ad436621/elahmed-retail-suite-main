import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Plus, Trash2, Pencil, X, Check, Smartphone, Headphones, Search,
    ImagePlus, ImageOff, AlignLeft, LayoutGrid, List,
} from 'lucide-react';
import { MobileItem, MobileAccessory } from '@/domain/types';
import {
    getMobiles, addMobile, updateMobile, deleteMobile,
    getMobileAccessories, addMobileAccessory, updateMobileAccessory, deleteMobileAccessory,
} from '@/data/mobilesData';
import { useToast } from '@/hooks/use-toast';

/* ─── Defaults ─── */
const emptyMobile: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', quantity: 1, storage: '', ram: '', color: '', supplier: '',
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0, serialNumber: '',
    notes: '', description: '', image: undefined,
};
const emptyAccessory: Omit<MobileAccessory, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', quantity: 1, color: '',
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    notes: '', description: '', image: undefined,
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60";

/* ─────────────────────────────────────────
   ImageUpload — defined OUTSIDE main component
   to avoid remounting on every render
───────────────────────────────────────── */
function ImageUpload({ value, onChange }: { value?: string; onChange: (v: string | undefined) => void }) {
    const ref = useRef<HTMLInputElement>(null);
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => onChange(ev.target?.result as string);
        reader.readAsDataURL(file);
    };
    return (
        <div className="col-span-2">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة المنتج
            </label>
            <div className="flex items-center gap-3">
                {/* Preview */}
                <div className="shrink-0">
                    {value ? (
                        <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-sm">
                            <img src={value} alt="معاينة" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => onChange(undefined)}
                                className="absolute top-1.5 right-1.5 rounded-full bg-red-500/90 p-1 text-white shadow-sm hover:bg-red-600 transition-colors">
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border/60 bg-muted/40 flex flex-col items-center justify-center gap-1">
                            <ImageOff className="h-6 w-6 text-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground/50">لا صورة</span>
                        </div>
                    )}
                </div>
                {/* Upload button */}
                <div className="flex-1 flex flex-col justify-center gap-2">
                    <button type="button" onClick={() => ref.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-2 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-1.5">
                        <ImagePlus className="h-3.5 w-3.5" />
                        {value ? 'تغيير الصورة' : 'اختر صورة'}
                    </button>
                    <p className="text-[10px] text-muted-foreground/50 text-center">JPG, PNG, WEBP</p>
                </div>
                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────
   ProductCard — defined OUTSIDE main component
───────────────────────────────────────── */
function ProductCard({ name, image, description, quantity, price, extras, onEdit, onDelete }: {
    name: string; image?: string; description?: string;
    quantity: number; price: number; extras?: string;
    onEdit: () => void; onDelete: () => void;
}) {
    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            {/* Image */}
            <div className="relative h-44 w-full bg-muted/30 overflow-hidden">
                {image ? (
                    <img src={image} alt={name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <ImageOff className="h-10 w-10 text-muted-foreground/20" />
                        <span className="text-xs text-muted-foreground/40">لا توجد صورة</span>
                    </div>
                )}
                <span className={`absolute top-2 right-2 rounded-full px-2.5 py-0.5 text-xs font-bold shadow-sm ${quantity === 0 ? 'bg-red-500 text-white' : 'bg-primary text-primary-foreground'}`}>
                    {quantity === 0 ? 'نفد المخزون' : `${quantity} وحدة`}
                </span>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 p-4 gap-2.5">
                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{name}</h3>
                {extras && <p className="text-xs text-muted-foreground line-clamp-1">{extras}</p>}
                {description && (
                    <div className="rounded-xl bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        <AlignLeft className="inline h-3 w-3 ml-1 text-primary/40 shrink-0" />
                        {description}
                    </div>
                )}
                <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-base font-extrabold text-primary tabular-nums">
                        {price.toLocaleString('ar-EG')} <span className="text-xs font-medium text-muted-foreground">ج.م</span>
                    </span>
                    <div className="flex gap-1.5">
                        <button onClick={onEdit} title="تعديل"
                            className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={onDelete} title="حذف"
                            className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═════════════════════════════════════════
   MAIN COMPONENT
═════════════════════════════════════════ */
export default function MobilesInventory() {
    const location = useLocation();
    const { toast } = useToast();
    const initTab = (location.state as { tab?: string })?.tab === 'accessories' ? 'accessories' : 'main';

    const [tab, setTab] = useState<'main' | 'accessories'>(initTab as 'main' | 'accessories');
    const [mobiles, setMobiles] = useState<MobileItem[]>(() => getMobiles());
    const [showMobileForm, setShowMobileForm] = useState(false);
    const [editMobileId, setEditMobileId] = useState<string | null>(null);
    const [mF, setMF] = useState(emptyMobile);  // mobile form state

    const [accessories, setAccessories] = useState<MobileAccessory[]>(() => getMobileAccessories());
    const [showAccForm, setShowAccForm] = useState(false);
    const [editAccId, setEditAccId] = useState<string | null>(null);
    const [aF, setAF] = useState(emptyAccessory);  // accessory form state

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    useEffect(() => {
        const s = (location.state as { tab?: string })?.tab;
        setTab(s === 'accessories' ? 'accessories' : 'main');
    }, [location.state]);

    const refreshMobiles = () => setMobiles(getMobiles());
    const refreshAccessories = () => setAccessories(getMobileAccessories());

    /* ── Mobile CRUD ── */
    const handleMobileSubmit = () => {
        if (!mF.name.trim()) { toast({ title: 'خطأ', description: 'اسم الموبايل مطلوب', variant: 'destructive' }); return; }
        if (editMobileId) { updateMobile(editMobileId, mF); toast({ title: '✅ تم التعديل', description: mF.name }); }
        else { addMobile(mF); toast({ title: '✅ تمت الإضافة', description: mF.name }); }
        setMF(emptyMobile); setEditMobileId(null); setShowMobileForm(false); refreshMobiles();
    };
    const openAddMobile = () => { setMF(emptyMobile); setEditMobileId(null); setShowMobileForm(true); };
    const openEditMobile = (m: MobileItem) => {
        setMF({ name: m.name, quantity: m.quantity, storage: m.storage, ram: m.ram, color: m.color, supplier: m.supplier, oldCostPrice: m.oldCostPrice, newCostPrice: m.newCostPrice, salePrice: m.salePrice, serialNumber: m.serialNumber, notes: m.notes, description: m.description ?? '', image: m.image });
        setEditMobileId(m.id); setShowMobileForm(true);
    };
    const closeMobileForm = () => { setShowMobileForm(false); setEditMobileId(null); };

    /* ── Accessory CRUD ── */
    const handleAccSubmit = () => {
        if (!aF.name.trim()) { toast({ title: 'خطأ', description: 'اسم الإكسسوار مطلوب', variant: 'destructive' }); return; }
        if (editAccId) { updateMobileAccessory(editAccId, aF); toast({ title: '✅ تم التعديل', description: aF.name }); }
        else { addMobileAccessory(aF); toast({ title: '✅ تمت الإضافة', description: aF.name }); }
        setAF(emptyAccessory); setEditAccId(null); setShowAccForm(false); refreshAccessories();
    };
    const openAddAcc = () => { setAF(emptyAccessory); setEditAccId(null); setShowAccForm(true); };
    const openEditAcc = (a: MobileAccessory) => {
        setAF({ name: a.name, model: a.model, quantity: a.quantity, color: a.color, oldCostPrice: a.oldCostPrice, newCostPrice: a.newCostPrice, salePrice: a.salePrice, notes: a.notes, description: a.description ?? '', image: a.image });
        setEditAccId(a.id); setShowAccForm(true);
    };
    const closeAccForm = () => { setShowAccForm(false); setEditAccId(null); };

    /* ── Filtered lists ── */
    const filteredMobiles = mobiles.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.color.includes(search) ||
        m.serialNumber.includes(search)
    );
    const filteredAcc = accessories.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.model.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 border border-cyan-200 shadow-sm">
                        <Smartphone className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">موبايل وإكسسوارات</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {tab === 'main' ? `${mobiles.length} موبايل` : `${accessories.length} إكسسوار`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* View toggle */}
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutGrid className="h-3.5 w-3.5" /> شبكة
                        </button>
                        <button onClick={() => setViewMode('table')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                            <List className="h-3.5 w-3.5" /> جدول
                        </button>
                    </div>
                    <button
                        onClick={tab === 'main' ? openAddMobile : openAddAcc}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                        <Plus className="h-4 w-4" />
                        {tab === 'main' ? 'إضافة موبايل' : 'إضافة إكسسوار'}
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => { setTab('main'); setSearch(''); }}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'main' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Smartphone className="h-4 w-4" /> موبايلات
                </button>
                <button onClick={() => { setTab('accessories'); setSearch(''); }}
                    className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'accessories' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    <Headphones className="h-4 w-4" /> إكسسوارات
                </button>
            </div>

            {/* ── Search ── */}
            <div className="relative max-w-md">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder={tab === 'main' ? 'بحث بالاسم أو اللون أو السيريال...' : 'بحث بالاسم أو الموديل...'}
                    className={`${IC} pr-10`} />
            </div>

            {/* ═══════════════════════════════════
                MOBILE FORM MODAL — inline JSX (not a nested component)
            ═══════════════════════════════════ */}
            {showMobileForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">
                                {editMobileId ? '✏️ تعديل موبايل' : '➕ إضافة موبايل'}
                            </h2>
                            <button onClick={closeMobileForm}
                                className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-4 space-y-3">
                            {/* Image upload */}
                            <ImageUpload value={mF.image} onChange={v => setMF(f => ({ ...f, image: v }))} />

                            {/* Divider */}
                            <div className="border-t border-border/50" />

                            {/* Name — full width */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">اسم الموبايل *</label>
                                <input
                                    value={mF.name}
                                    onChange={e => setMF(f => ({ ...f, name: e.target.value }))}
                                    placeholder="مثال: iPhone 15 Pro Max"
                                    className={IC}
                                    autoFocus
                                />
                            </div>

                            {/* Description — full width */}
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <AlignLeft className="h-3.5 w-3.5 text-primary" /> الوصف التفصيلي
                                </label>
                                <textarea
                                    value={mF.description}
                                    onChange={e => setMF(f => ({ ...f, description: e.target.value }))}
                                    rows={2}
                                    placeholder="اكتب وصفاً تفصيلياً — الحالة، المميزات، ملاحظات للبائع..."
                                    className={`${IC} resize-none`}
                                />
                            </div>

                            {/* Specs grid — 3 cols */}
                            <div>
                                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">المواصفات</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">العدد</label>
                                        <input type="number" min={0} value={mF.quantity} onChange={e => setMF(f => ({ ...f, quantity: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">التخزين</label>
                                        <input value={mF.storage} onChange={e => setMF(f => ({ ...f, storage: e.target.value }))} placeholder="128GB" className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">الرام</label>
                                        <input value={mF.ram} onChange={e => setMF(f => ({ ...f, ram: e.target.value }))} placeholder="8GB" className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">اللون</label>
                                        <input value={mF.color} onChange={e => setMF(f => ({ ...f, color: e.target.value }))} placeholder="أسود" className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">المورد</label>
                                        <input value={mF.supplier} onChange={e => setMF(f => ({ ...f, supplier: e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">السيريال نمبر</label>
                                        <input value={mF.serialNumber} onChange={e => setMF(f => ({ ...f, serialNumber: e.target.value }))} placeholder="IMEI / Serial" className={IC} />
                                    </div>
                                </div>
                            </div>

                            {/* Prices grid */}
                            <div>
                                <p className="mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">الأسعار</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء قديم</label>
                                        <input type="number" min={0} value={mF.oldCostPrice} onChange={e => setMF(f => ({ ...f, oldCostPrice: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء جديد</label>
                                        <input type="number" min={0} value={mF.newCostPrice} onChange={e => setMF(f => ({ ...f, newCostPrice: +e.target.value }))} className={IC} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-muted-foreground">سعر البيع</label>
                                        <input type="number" min={0} value={mF.salePrice} onChange={e => setMF(f => ({ ...f, salePrice: +e.target.value }))} className={IC} />
                                    </div>
                                </div>
                                {/* Profit preview */}
                                {mF.salePrice > 0 && mF.newCostPrice > 0 && (
                                    <div className={`mt-3 rounded-xl border px-4 py-3 flex items-center justify-between ${(mF.salePrice - mF.newCostPrice) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        <span className={`text-sm font-semibold ${(mF.salePrice - mF.newCostPrice) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>الربح المتوقع</span>
                                        <span className={`text-xl font-extrabold tabular-nums ${(mF.salePrice - mF.newCostPrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                            {(mF.salePrice - mF.newCostPrice).toLocaleString('ar-EG')} ج.م
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex gap-2 px-4 pb-4 pt-1">
                            <button onClick={handleMobileSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editMobileId ? 'حفظ التعديلات' : 'إضافة الموبايل'}
                            </button>
                            <button onClick={closeMobileForm}
                                className="flex-none rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════
                ACCESSORY FORM MODAL — inline JSX
            ═══════════════════════════════════ */}
            {showAccForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">
                                {editAccId ? '✏️ تعديل إكسسوار' : '➕ إضافة إكسسوار'}
                            </h2>
                            <button onClick={closeAccForm} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-3">
                            <ImageUpload value={aF.image} onChange={v => setAF(f => ({ ...f, image: v }))} />
                            <div className="border-t border-border/50" />
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">اسم الإكسسوار *</label>
                                <input value={aF.name} onChange={e => setAF(f => ({ ...f, name: e.target.value }))} placeholder="مثال: سماعة بلوتوث" className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                                    <AlignLeft className="h-3.5 w-3.5 text-primary" /> الوصف التفصيلي
                                </label>
                                <textarea value={aF.description} onChange={e => setAF(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="وصف تفصيلي للمنتج..." className={`${IC} resize-none`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">الموديل</label><input value={aF.model} onChange={e => setAF(f => ({ ...f, model: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">العدد</label><input type="number" min={0} value={aF.quantity} onChange={e => setAF(f => ({ ...f, quantity: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">اللون</label><input value={aF.color} onChange={e => setAF(f => ({ ...f, color: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء قديم</label><input type="number" min={0} value={aF.oldCostPrice} onChange={e => setAF(f => ({ ...f, oldCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء جديد</label><input type="number" min={0} value={aF.newCostPrice} onChange={e => setAF(f => ({ ...f, newCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">سعر البيع</label><input type="number" min={0} value={aF.salePrice} onChange={e => setAF(f => ({ ...f, salePrice: +e.target.value }))} className={IC} /></div>
                            </div>
                            {aF.salePrice > 0 && aF.newCostPrice > 0 && (
                                <div className={`rounded-xl border px-4 py-3 flex items-center justify-between ${(aF.salePrice - aF.newCostPrice) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                    <span className={`text-sm font-semibold ${(aF.salePrice - aF.newCostPrice) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>الربح المتوقع</span>
                                    <span className={`text-xl font-extrabold tabular-nums ${(aF.salePrice - aF.newCostPrice) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {(aF.salePrice - aF.newCostPrice).toLocaleString('ar-EG')} ج.م
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 px-6 pb-6 pt-2">
                            <button onClick={handleAccSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editAccId ? 'حفظ التعديلات' : 'إضافة الإكسسوار'}
                            </button>
                            <button onClick={closeAccForm}
                                className="flex-none rounded-xl border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════
                CONTENT: Grid or Table
            ═══════════════════════════════════ */}
            {tab === 'main' && (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredMobiles.length === 0 ? (
                            <div className="col-span-4 py-20 text-center text-muted-foreground">
                                <Smartphone className="h-14 w-14 mx-auto mb-4 opacity-15" />
                                <p className="text-base font-medium">لا توجد موبايلات</p>
                                <button onClick={openAddMobile} className="mt-3 text-sm text-primary hover:underline">+ إضافة أول موبايل</button>
                            </div>
                        ) : filteredMobiles.map(m => (
                            <ProductCard key={m.id}
                                name={m.name} image={m.image} description={m.description}
                                quantity={m.quantity} price={m.salePrice}
                                extras={[m.storage, m.ram, m.color].filter(Boolean).join(' · ')}
                                onEdit={() => openEditMobile(m)}
                                onDelete={() => { deleteMobile(m.id); toast({ title: 'تم الحذف', description: m.name }); refreshMobiles(); }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-sm min-w-[750px]">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-semibold">
                                        {['', 'الاسم', 'تخزين', 'رام', 'لون', 'مورد', 'العدد', 'س.شراء جديد', 'سعر البيع', 'الربح', ''].map(h => (
                                            <th key={h} className="px-3 py-3 text-right">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMobiles.length === 0 ? (
                                        <tr><td colSpan={11} className="py-14 text-center text-muted-foreground">لا توجد موبايلات</td></tr>
                                    ) : filteredMobiles.map((m, i) => (
                                        <tr key={m.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                            <td className="px-3 py-2 w-12">
                                                {m.image
                                                    ? <img src={m.image} alt={m.name} className="h-10 w-10 rounded-xl object-cover border border-border shadow-sm" />
                                                    : <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/30" /></div>
                                                }
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-foreground max-w-[160px] truncate">{m.name}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{m.storage || '—'}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{m.ram || '—'}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{m.color || '—'}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{m.supplier || '—'}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>{m.quantity}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{m.newCostPrice.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{m.salePrice.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs font-bold text-emerald-600 tabular-nums">{(m.salePrice - m.newCostPrice).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => openEditMobile(m)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button onClick={() => { deleteMobile(m.id); toast({ title: 'تم الحذف' }); refreshMobiles(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}

            {/* ── Accessories content ── */}
            {tab === 'accessories' && (
                viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredAcc.length === 0 ? (
                            <div className="col-span-4 py-20 text-center text-muted-foreground">
                                <Headphones className="h-14 w-14 mx-auto mb-4 opacity-15" />
                                <p className="text-base font-medium">لا توجد إكسسوارات</p>
                                <button onClick={openAddAcc} className="mt-3 text-sm text-primary hover:underline">+ إضافة أول إكسسوار</button>
                            </div>
                        ) : filteredAcc.map(a => (
                            <ProductCard key={a.id}
                                name={a.name} image={a.image} description={a.description}
                                quantity={a.quantity} price={a.salePrice}
                                extras={[a.model, a.color].filter(Boolean).join(' · ')}
                                onEdit={() => openEditAcc(a)}
                                onDelete={() => { deleteMobileAccessory(a.id); toast({ title: 'تم الحذف', description: a.name }); refreshAccessories(); }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-semibold">
                                        {['', 'الاسم', 'الموديل', 'العدد', 'اللون', 'س.شراء جديد', 'سعر البيع', 'الربح', ''].map(h => (
                                            <th key={h} className="px-3 py-3 text-right">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAcc.length === 0 ? (
                                        <tr><td colSpan={9} className="py-14 text-center text-muted-foreground">لا توجد إكسسوارات</td></tr>
                                    ) : filteredAcc.map((a, i) => (
                                        <tr key={a.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                            <td className="px-3 py-2 w-12">
                                                {a.image
                                                    ? <img src={a.image} alt={a.name} className="h-10 w-10 rounded-xl object-cover border border-border shadow-sm" />
                                                    : <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/30" /></div>
                                                }
                                            </td>
                                            <td className="px-3 py-2 font-semibold text-foreground">{a.name}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{a.model || '—'}</td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${a.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>{a.quantity}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground">{a.color || '—'}</td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{a.newCostPrice.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{a.salePrice.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs font-bold text-emerald-600 tabular-nums">{(a.salePrice - a.newCostPrice).toLocaleString()}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => openEditAcc(a)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button onClick={() => { deleteMobileAccessory(a.id); toast({ title: 'تم الحذف' }); refreshAccessories(); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
