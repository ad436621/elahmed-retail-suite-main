import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Plus, Trash2, Pencil, X, Check, Laptop, Headphones, Search,
    ImagePlus, ImageOff, AlignLeft, LayoutGrid, List,
} from 'lucide-react';
import { ComputerItem, ComputerAccessory } from '@/domain/types';
import {
    getComputers, addComputer, updateComputer, deleteComputer,
    getComputerAccessories, addComputerAccessory, updateComputerAccessory, deleteComputerAccessory,
} from '@/data/computersData';
import { useToast } from '@/hooks/use-toast';

const emptyComputer: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', color: '', quantity: 1,
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    notes: '', description: '', image: undefined,
};
const emptyAcc: Omit<ComputerAccessory, 'id' | 'createdAt' | 'updatedAt'> = {
    name: '', model: '', quantity: 1, color: '',
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    notes: '', description: '', image: undefined,
};

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60";

/* ─── ImageUpload — outside main component ─── */
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
        <div>
            <label className="mb-2 block text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5 text-primary" /> صورة المنتج
            </label>
            <div className="flex items-center gap-3">
                <div className="shrink-0">
                    {value ? (
                        <div className="relative h-20 w-20 rounded-xl overflow-hidden border-2 border-primary/40 shadow-sm">
                            <img src={value} alt="معاينة" className="h-full w-full object-cover" />
                            <button type="button" onClick={() => onChange(undefined)} className="absolute top-1.5 right-1.5 rounded-full bg-red-500/90 p-1 text-white shadow-sm hover:bg-red-600"><X className="h-3 w-3" /></button>
                        </div>
                    ) : (
                        <div className="h-20 w-20 rounded-xl border-2 border-dashed border-border/60 bg-muted/40 flex flex-col items-center justify-center gap-1">
                            <ImageOff className="h-6 w-6 text-muted-foreground/30" />
                            <span className="text-[10px] text-muted-foreground/50">لا صورة</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 flex flex-col justify-center gap-2">
                    <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 py-2 text-xs font-medium text-primary hover:bg-primary/10 hover:border-primary/50 transition-all flex items-center justify-center gap-1.5">
                        <ImagePlus className="h-3.5 w-3.5" />{value ? 'تغيير الصورة' : 'اختر صورة'}
                    </button>
                    <p className="text-[10px] text-muted-foreground/50 text-center">JPG, PNG, WEBP</p>
                </div>
                <input ref={ref} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>
        </div>
    );
}

/* ─── ProductCard — outside main component ─── */
function ProductCard({ name, image, description, quantity, price, extras, onEdit, onDelete }: {
    name: string; image?: string; description?: string;
    quantity: number; price: number; extras?: string;
    onEdit: () => void; onDelete: () => void;
}) {
    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
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
            <div className="flex flex-col flex-1 p-4 gap-2.5">
                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{name}</h3>
                {extras && <p className="text-xs text-muted-foreground line-clamp-1">{extras}</p>}
                {description && (
                    <div className="rounded-xl bg-muted/40 border border-border/50 px-3 py-2 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                        <AlignLeft className="inline h-3 w-3 ml-1 text-primary/40" />{description}
                    </div>
                )}
                <div className="mt-auto pt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-base font-extrabold text-primary tabular-nums">
                        {price.toLocaleString('ar-EG')} <span className="text-xs font-medium text-muted-foreground">ج.م</span>
                    </span>
                    <div className="flex gap-1.5">
                        <button onClick={onEdit} className="rounded-xl p-2 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={onDelete} className="rounded-xl p-2 bg-red-50 hover:bg-red-100 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ComputersInventory() {
    const location = useLocation();
    const { toast } = useToast();
    const initTab = (location.state as { tab?: string })?.tab === 'accessories' ? 'accessories' : 'main';
    const [tab, setTab] = useState<'main' | 'accessories'>(initTab as 'main' | 'accessories');

    const [computers, setComputers] = useState<ComputerItem[]>(() => getComputers());
    const [accessories, setAccessories] = useState<ComputerAccessory[]>(() => getComputerAccessories());

    const [showComputerForm, setShowComputerForm] = useState(false);
    const [editComputerId, setEditComputerId] = useState<string | null>(null);
    const [cF, setCF] = useState(emptyComputer);

    const [showAccForm, setShowAccForm] = useState(false);
    const [editAccId, setEditAccId] = useState<string | null>(null);
    const [aF, setAF] = useState(emptyAcc);

    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    useEffect(() => {
        const s = (location.state as { tab?: string })?.tab;
        setTab(s === 'accessories' ? 'accessories' : 'main');
    }, [location.state]);

    /* ── Computer CRUD ── */
    const handleComputerSubmit = () => {
        if (!cF.name.trim()) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
        if (editComputerId) { updateComputer(editComputerId, cF); toast({ title: '✅ تم التعديل' }); }
        else { addComputer(cF); toast({ title: '✅ تمت الإضافة', description: cF.name }); }
        setCF(emptyComputer); setEditComputerId(null); setShowComputerForm(false); setComputers(getComputers());
    };
    const openAddComputer = () => { setCF(emptyComputer); setEditComputerId(null); setShowComputerForm(true); };
    const openEditComputer = (c: ComputerItem) => {
        setCF({ name: c.name, model: c.model, color: c.color, quantity: c.quantity, oldCostPrice: c.oldCostPrice, newCostPrice: c.newCostPrice, salePrice: c.salePrice, notes: c.notes, description: c.description ?? '', image: c.image });
        setEditComputerId(c.id); setShowComputerForm(true);
    };

    /* ── Accessory CRUD ── */
    const handleAccSubmit = () => {
        if (!aF.name.trim()) { toast({ title: 'خطأ', description: 'الاسم مطلوب', variant: 'destructive' }); return; }
        if (editAccId) { updateComputerAccessory(editAccId, aF); toast({ title: '✅ تم التعديل' }); }
        else { addComputerAccessory(aF); toast({ title: '✅ تمت الإضافة', description: aF.name }); }
        setAF(emptyAcc); setEditAccId(null); setShowAccForm(false); setAccessories(getComputerAccessories());
    };
    const openAddAcc = () => { setAF(emptyAcc); setEditAccId(null); setShowAccForm(true); };
    const openEditAcc = (a: ComputerAccessory) => {
        setAF({ name: a.name, model: a.model, quantity: a.quantity, color: a.color, oldCostPrice: a.oldCostPrice, newCostPrice: a.newCostPrice, salePrice: a.salePrice, notes: a.notes, description: a.description ?? '', image: a.image });
        setEditAccId(a.id); setShowAccForm(true);
    };

    const filteredComputers = computers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.model.toLowerCase().includes(search.toLowerCase()));
    const filteredAcc = accessories.filter(a => a.name.toLowerCase().includes(search.toLowerCase()) || a.model.toLowerCase().includes(search.toLowerCase()));

    const ProfitBadge = ({ sale, cost }: { sale: number; cost: number }) => sale > 0 && cost > 0 ? (
        <div className={`mt-3 rounded-xl border px-4 py-3 flex items-center justify-between ${(sale - cost) >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <span className={`text-sm font-semibold ${(sale - cost) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>الربح المتوقع</span>
            <span className={`text-xl font-extrabold tabular-nums ${(sale - cost) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{(sale - cost).toLocaleString('ar-EG')} ج.م</span>
        </div>
    ) : null;

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">

            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 border border-indigo-200 shadow-sm">
                        <Laptop className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">كمبيوتر وإكسسوارات</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{tab === 'main' ? `${computers.length} كمبيوتر` : `${accessories.length} إكسسوار`}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}><LayoutGrid className="h-3.5 w-3.5" /> شبكة</button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}><List className="h-3.5 w-3.5" /> جدول</button>
                    </div>
                    <button onClick={tab === 'main' ? openAddComputer : openAddAcc}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> {tab === 'main' ? 'إضافة كمبيوتر' : 'إضافة إكسسوار'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 rounded-2xl bg-muted/50 p-1 w-fit border border-border/50">
                <button onClick={() => { setTab('main'); setSearch(''); }} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'main' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}><Laptop className="h-4 w-4" /> كمبيوترات</button>
                <button onClick={() => { setTab('accessories'); setSearch(''); }} className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'accessories' ? 'bg-card shadow-sm text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}><Headphones className="h-4 w-4" /> إكسسوارات</button>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className={`${IC} pr-10`} />
            </div>

            {/* ── Computer Form Modal — INLINE JSX ── */}
            {showComputerForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
                    <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">{editComputerId ? '✏️ تعديل كمبيوتر' : '➕ إضافة كمبيوتر'}</h2>
                            <button onClick={() => { setShowComputerForm(false); setEditComputerId(null); }} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-4 space-y-3">
                            <ImageUpload value={cF.image} onChange={v => setCF(f => ({ ...f, image: v }))} />
                            <div className="border-t border-border/50" />
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">اسم المنتج *</label>
                                <input value={cF.name} onChange={e => setCF(f => ({ ...f, name: e.target.value }))} placeholder="مثال: Lenovo ThinkPad X1 Carbon" className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><AlignLeft className="h-3.5 w-3.5 text-primary" /> الوصف التفصيلي</label>
                                <textarea value={cF.description} onChange={e => setCF(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="وصف تفصيلي..." className={`${IC} resize-none`} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">الموديل</label><input value={cF.model} onChange={e => setCF(f => ({ ...f, model: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">اللون</label><input value={cF.color} onChange={e => setCF(f => ({ ...f, color: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">العدد</label><input type="number" min={0} value={cF.quantity} onChange={e => setCF(f => ({ ...f, quantity: +e.target.value }))} className={IC} /></div>
                            </div>
                            <div>
                                <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">الأسعار</p>
                                <div className="grid grid-cols-3 gap-3">
                                    <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء قديم</label><input type="number" min={0} value={cF.oldCostPrice} onChange={e => setCF(f => ({ ...f, oldCostPrice: +e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء جديد</label><input type="number" min={0} value={cF.newCostPrice} onChange={e => setCF(f => ({ ...f, newCostPrice: +e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs font-medium text-muted-foreground">سعر البيع</label><input type="number" min={0} value={cF.salePrice} onChange={e => setCF(f => ({ ...f, salePrice: +e.target.value }))} className={IC} /></div>
                                </div>
                                <ProfitBadge sale={cF.salePrice} cost={cF.newCostPrice} />
                            </div>
                        </div>
                        <div className="flex gap-2 px-4 pb-4 pt-1">
                            <button onClick={handleComputerSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editComputerId ? 'حفظ التعديلات' : 'إضافة الكمبيوتر'}
                            </button>
                            <button onClick={() => { setShowComputerForm(false); setEditComputerId(null); }} className="flex-none rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Accessory Form Modal — INLINE JSX ── */}
            {showAccForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
                    <div className="w-full max-w-xl rounded-3xl border border-border bg-card shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
                            <h2 className="text-xl font-bold text-foreground">{editAccId ? '✏️ تعديل إكسسوار' : '➕ إضافة إكسسوار'}</h2>
                            <button onClick={() => { setShowAccForm(false); setEditAccId(null); }} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground"><X className="h-5 w-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <ImageUpload value={aF.image} onChange={v => setAF(f => ({ ...f, image: v }))} />
                            <div className="border-t border-border/50" />
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide">اسم الإكسسوار *</label>
                                <input value={aF.name} onChange={e => setAF(f => ({ ...f, name: e.target.value }))} placeholder="مثال: ماوس لاسلكي" className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5"><AlignLeft className="h-3.5 w-3.5 text-primary" /> الوصف</label>
                                <textarea value={aF.description} onChange={e => setAF(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="وصف تفصيلي..." className={`${IC} resize-none`} />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">الموديل</label><input value={aF.model} onChange={e => setAF(f => ({ ...f, model: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">اللون</label><input value={aF.color} onChange={e => setAF(f => ({ ...f, color: e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">العدد</label><input type="number" min={0} value={aF.quantity} onChange={e => setAF(f => ({ ...f, quantity: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء قديم</label><input type="number" min={0} value={aF.oldCostPrice} onChange={e => setAF(f => ({ ...f, oldCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">س.شراء جديد</label><input type="number" min={0} value={aF.newCostPrice} onChange={e => setAF(f => ({ ...f, newCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-medium text-muted-foreground">سعر البيع</label><input type="number" min={0} value={aF.salePrice} onChange={e => setAF(f => ({ ...f, salePrice: +e.target.value }))} className={IC} /></div>
                            </div>
                            <ProfitBadge sale={aF.salePrice} cost={aF.newCostPrice} />
                        </div>
                        <div className="flex gap-3 px-6 pb-6 pt-2">
                            <button onClick={handleAccSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editAccId ? 'حفظ التعديلات' : 'إضافة الإكسسوار'}
                            </button>
                            <button onClick={() => { setShowAccForm(false); setEditAccId(null); }} className="flex-none rounded-xl border border-border px-6 py-3 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Content ── */}
            {(() => {
                const items = (tab === 'main' ? filteredComputers : filteredAcc) as (ComputerItem | ComputerAccessory)[];
                const isEmpty = items.length === 0;
                const EmptyIcon = tab === 'main' ? Laptop : Headphones;
                const emptyText = tab === 'main' ? 'لا توجد كمبيوترات' : 'لا توجد إكسسوارات';
                const onEdit = (it: ComputerItem | ComputerAccessory) => tab === 'main' ? openEditComputer(it as ComputerItem) : openEditAcc(it as ComputerAccessory);
                const onDel = (it: ComputerItem | ComputerAccessory) => {
                    if (tab === 'main') { deleteComputer(it.id); setComputers(getComputers()); }
                    else { deleteComputerAccessory(it.id); setAccessories(getComputerAccessories()); }
                    toast({ title: 'تم الحذف', description: it.name });
                };

                if (viewMode === 'grid') return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {isEmpty
                            ? <div className="col-span-4 py-20 text-center text-muted-foreground"><EmptyIcon className="h-14 w-14 mx-auto mb-4 opacity-15" /><p>{emptyText}</p></div>
                            : items.map(item => (
                                <ProductCard key={item.id} name={item.name} image={item.image} description={item.description}
                                    quantity={item.quantity} price={item.salePrice}
                                    extras={[item.model, item.color].filter(Boolean).join(' · ')}
                                    onEdit={() => onEdit(item)} onDelete={() => onDel(item)} />
                            ))
                        }
                    </div>
                );

                return (
                    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-sm min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-semibold">
                                        {['', 'الاسم', 'الموديل', 'اللون', 'العدد', 'س.شراء جديد', 'سعر البيع', 'الربح', 'ملاحظات', ''].map(h => <th key={h} className="px-3 py-3 text-right">{h}</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {isEmpty
                                        ? <tr><td colSpan={10} className="py-14 text-center text-muted-foreground">{emptyText}</td></tr>
                                        : items.map((item, i) => (
                                            <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                                <td className="px-3 py-2 w-12">{item.image ? <img src={item.image} alt={item.name} className="h-10 w-10 rounded-xl object-cover border border-border" /> : <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/30" /></div>}</td>
                                                <td className="px-3 py-2 font-semibold text-foreground max-w-[140px] truncate">{item.name}</td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">{item.model || '—'}</td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground">{item.color || '—'}</td>
                                                <td className="px-3 py-2 text-center"><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>{item.quantity}</span></td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{item.newCostPrice.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{item.salePrice.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-xs font-bold text-emerald-600 tabular-nums">{(item.salePrice - item.newCostPrice).toLocaleString()}</td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground max-w-[100px] truncate">{item.notes || '—'}</td>
                                                <td className="px-3 py-2"><div className="flex gap-1">
                                                    <button onClick={() => onEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button onClick={() => onDel(item)} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div></td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
