import { useState, useEffect, useMemo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Plus, Trash2, Pencil, X, Check, Headphones, Search,
    AlignLeft, LayoutGrid, List, Tag, FileSpreadsheet, ImageOff
} from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';
import { InventoryProductCard } from '@/components/InventoryProductCard';
import { isBarcodeDuplicate } from '@/repositories/productRepository';
import { useToast } from '@/hooks/use-toast';
import { useInventoryData } from '@/hooks/useInventoryData';
import { getWeightedAvgCost } from '@/data/batchesData';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { getCategoriesBySection, addCategory, DynamicCategory } from '@/data/categoriesData';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';

// ─── Types ────────────────────────────────────────────────────

export type CategorySection = 'computer' | 'device';
export type InventoryColor = 'indigo' | 'orange';

export interface SharedInventoryConfig {
    /** Icon shown in page header (e.g. <Laptop />) */
    icon: ReactNode;
    /** Page title */
    title: string;
    /** Category section slug used in categoriesData */
    categorySection: CategorySection;
    /** Color theme for active filter buttons */
    accentColor: InventoryColor;
    /** inventoryType passed to ExcelColumnMappingDialog */
    excelInventoryType: string;

    // ─ Devices CRUD ─
    getDevices: () => any[];
    addDevice: (payload: any) => void;
    updateDevice: (id: string, payload: any) => void;
    deleteDevice: (id: string) => void;
    deviceStorageKey: string;

    // ─ Accessories CRUD ─
    getAccessories: () => any[];
    addAccessory: (payload: any) => void;
    updateAccessory: (id: string, payload: any) => void;
    deleteAccessory: (id: string) => void;
    accessoryStorageKey: string;

    /** Extra fields that only some inventory types have (e.g. processor for computers) */
    extraDeviceField?: {
        key: string;
        label: string;
        searchable?: boolean;
    };

    /** Transforms a raw row from Excel into the device payload */
    buildDeviceFromExcelRow: (row: Record<string, any>) => any;
}

// ─── Shared Form State ────────────────────────────────────────

const makeEmptyForm = () => ({
    name: '', barcode: '', category: '', condition: 'new' as 'new' | 'used',
    quantity: 1, oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    model: '', color: '', extra: '', notes: '', description: '', image: undefined as string | undefined
});

const IC = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60";

// ─── Accent Color Maps ────────────────────────────────────────

const accentStyles: Record<InventoryColor, {
    iconBg: string; iconText: string; iconBorder: string;
    filterActive: string; categoryActive: string; categoryHover: string;
}> = {
    indigo: {
        iconBg: 'bg-indigo-100', iconText: 'text-indigo-600', iconBorder: 'border-indigo-200',
        filterActive: 'bg-indigo-50 text-indigo-700 border-indigo-300',
        categoryActive: 'bg-indigo-50 text-indigo-700 border-indigo-300',
        categoryHover: 'hover:bg-muted/50',
    },
    orange: {
        iconBg: 'bg-orange-100', iconText: 'text-orange-600', iconBorder: 'border-orange-200',
        filterActive: 'bg-orange-50 text-orange-700 border-orange-300',
        categoryActive: 'bg-orange-50 text-orange-700 border-orange-300',
        categoryHover: 'hover:bg-muted/50',
    },
};

// ─── Main Component ───────────────────────────────────────────

export default function SharedInventoryPage({ config }: { config: SharedInventoryConfig }) {
    const { toast } = useToast();
    const location = useLocation();
    const ac = accentStyles[config.accentColor];

    const fetchCategories = () => getCategoriesBySection(config.categorySection);
    const [categories, setCategories] = useState<DynamicCategory[]>(fetchCategories);

    const devices = useInventoryData(config.getDevices, [config.deviceStorageKey]);
    const accessories = useInventoryData(config.getAccessories, [config.accessoryStorageKey]);

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editType, setEditType] = useState<'device' | 'accessory'>('device');
    const [f, setF] = useState(makeEmptyForm());

    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState<'device' | 'accessory'>('device');
    const [activeBatchesModal, setActiveBatchesModal] = useState<{ id: string; name: string } | null>(null);
    const [showExcelRestore, setShowExcelRestore] = useState(false);

    useEffect(() => {
        const s = (location.state as { filter?: string })?.filter;
        if (s) setActiveFilter(s);
    }, [location.state]);

    const unifiedProducts = useMemo(() => {
        const list: any[] = [];
        devices.forEach(d => {
            const cat = categories.find(ct => ct.id === d.category);
            list.push({
                _raw: d, _type: 'device',
                id: d.id, name: d.name, barcode: d.barcode, image: d.image, description: d.description,
                quantity: d.quantity, salePrice: d.salePrice, newCostPrice: d.newCostPrice, oldCostPrice: d.oldCostPrice,
                category: d.category, condition: d.condition || 'new', categoryName: cat?.name,
                model: d.model, color: d.color, extra: config.extraDeviceField ? d[config.extraDeviceField.key] : '',
            });
        });
        accessories.forEach(a => {
            const cat = categories.find(ct => ct.id === a.category);
            list.push({
                _raw: a, _type: 'accessory',
                id: a.id, name: a.name, barcode: a.barcode, image: a.image, description: a.description,
                quantity: a.quantity, salePrice: a.salePrice, newCostPrice: a.newCostPrice, oldCostPrice: a.oldCostPrice,
                category: a.category, condition: (a as any).condition || 'new', categoryName: cat?.name,
                model: a.model, color: a.color, extra: '',
            });
        });
        return list;
    }, [devices, accessories, categories, config.extraDeviceField]);

    const filteredList = useMemo(() => {
        let res = unifiedProducts;
        if (activeFilter === 'used') {
            res = res.filter(p => p.condition === 'used');
        } else if (activeFilter === 'accessory') {
            res = res.filter(p => p._type === 'accessory');
        } else if (activeFilter !== 'all') {
            res = res.filter(p => p.category === activeFilter);
        }
        if (search) {
            const sl = search.toLowerCase();
            res = res.filter(p =>
                p.name.toLowerCase().includes(sl) ||
                (p.model && p.model.toLowerCase().includes(sl)) ||
                (config.extraDeviceField?.searchable && p.extra && p.extra.toLowerCase().includes(sl)) ||
                (p.color && p.color.toLowerCase().includes(sl))
            );
        }
        return res;
    }, [unifiedProducts, search, activeFilter, config.extraDeviceField]);

    const refreshData = () => setCategories(fetchCategories());

    const handleCategorySubmit = () => {
        if (!newCatName.trim()) { toast({ title: 'خطأ', description: 'اسم التصنيف مطلوب', variant: 'destructive' }); return; }
        addCategory({ name: newCatName, section: config.categorySection, type: newCatType });
        setCategories(fetchCategories());
        setShowCategoryForm(false);
        setNewCatName('');
        toast({ title: 'نجاح', description: 'تم إنشاء التصنيف' });
    };

    const handleFormSubmit = () => {
        if (!f.name.trim() || !f.category) { toast({ title: 'خطأ', description: 'الاسم والتصنيف مطلوبان', variant: 'destructive' }); return; }
        if (f.barcode && isBarcodeDuplicate(f.barcode, editId || undefined)) { toast({ title: 'خطأ', description: 'الباركود المدخل مكرر', variant: 'destructive' }); return; }

        const selectedCat = categories.find(c => c.id === f.category);
        if (!selectedCat) return;

        if (selectedCat.type === 'device') {
            const payload: any = {
                name: f.name, barcode: f.barcode, category: f.category, condition: f.condition,
                quantity: f.quantity, model: f.model, color: f.color,
                oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice, salePrice: f.salePrice,
                notes: f.notes, description: f.description, image: f.image,
            };
            if (config.extraDeviceField) payload[config.extraDeviceField.key] = f.extra;
            if (editId) config.updateDevice(editId, payload);
            else config.addDevice(payload);
        } else {
            const payload: any = {
                name: f.name, barcode: f.barcode, category: f.category, subcategory: '', condition: f.condition,
                quantity: f.quantity, color: f.color, model: f.model,
                oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice,
                salePrice: f.salePrice, notes: f.notes, description: f.description, image: f.image,
            };
            if (editId) config.updateAccessory(editId, payload);
            else config.addAccessory(payload);
        }
        toast({ title: '✅ تم الحفظ بنجاح', description: f.name });
        setShowForm(false); setEditId(null);
        refreshData();
        setTimeout(() => window.dispatchEvent(new Event('local-storage-sync')), 200);
    };

    const openAdd = () => {
        setF({ ...makeEmptyForm(), category: categories[0]?.id || '' });
        setEditId(null);
        setShowForm(true);
    };

    const openEdit = (item: any) => {
        setF({
            name: item.name, barcode: item.barcode || '', category: item.category || '', condition: item.condition,
            quantity: item.quantity, oldCostPrice: item.oldCostPrice, newCostPrice: item.newCostPrice, salePrice: item.salePrice,
            model: item.model || '', color: item.color || '', extra: item.extra || '',
            notes: item.notes || '', description: item.description || '', image: item.image
        });
        setEditId(item.id);
        setEditType(item._type);
        setShowForm(true);
    };

    const activeCategoryType = categories.find(c => c.id === f.category)?.type || 'device';

    return (
        <div className="space-y-5 animate-fade-in" dir="rtl">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${ac.iconBg} border ${ac.iconBorder} shadow-sm`}>
                        <span className={ac.iconText}>{config.icon}</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{unifiedProducts.length} إجمالي المنتجات</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                        <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutGrid className="h-3.5 w-3.5" /> شبكة
                        </button>
                        <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                            <List className="h-3.5 w-3.5" /> جدول
                        </button>
                    </div>
                    <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                        <Plus className="h-4 w-4" /> إضافة منتج
                    </button>
                    <button onClick={() => setShowExcelRestore(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-all shadow-md">
                        <FileSpreadsheet className="h-4 w-4" /> استرداد من Excel
                    </button>
                </div>
            </div>

            {/* ── Category Filters ── */}
            <div className="flex gap-2 w-full overflow-x-auto hide-scrollbar pb-2 pt-1 px-1 -mx-1">
                <button onClick={() => setActiveFilter('all')}
                    className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border transition-all flex items-center gap-2 ${activeFilter === 'all' ? 'bg-primary/10 text-primary border-primary/30 shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/30'}`}>
                    <LayoutGrid className="h-4 w-4" /> الكل
                </button>
                <button onClick={() => setActiveFilter('used')}
                    className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border transition-all flex items-center gap-2 ${activeFilter === 'used' ? 'bg-orange-100 text-orange-700 border-orange-300 shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-orange-300'}`}>
                    <Check className="h-4 w-4" /> مستعمل
                </button>
                <div className="shrink-0 w-px h-6 bg-border mx-1 self-center" />
                {categories.map(c => (
                    <button key={c.id} onClick={() => setActiveFilter(c.id)}
                        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border transition-all flex items-center gap-2 ${activeFilter === c.id ? ac.categoryActive + ' shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground ' + ac.categoryHover}`}>
                        {c.type === 'device' ? <span className="opacity-70">{config.icon}</span> : <Headphones className="h-4 w-4 opacity-70" />}
                        {c.name}
                    </button>
                ))}
                <button onClick={() => setShowCategoryForm(true)}
                    className="shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border border-dashed border-primary/40 text-primary hover:bg-primary/5 transition-all flex items-center gap-2">
                    <Plus className="h-4 w-4" /> إضافة تصنيف
                </button>
            </div>

            {/* ── Search ── */}
            <div className="relative max-w-md">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="بحث في المنتجات المعروضة..."
                    className={`${IC} pr-10`} />
            </div>

            {/* ── Grid / Table ── */}
            {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredList.length === 0 ? (
                        <div className="col-span-4 py-20 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                            <span className="block mx-auto mb-4 text-muted-foreground/15 [&>svg]:h-14 [&>svg]:w-14 [&>svg]:mx-auto">{config.icon}</span>
                            <p className="text-base font-medium">لا توجد منتجات مطابقة للبحث</p>
                        </div>
                    ) : filteredList.map(item => (
                        <InventoryProductCard key={item.id} item={item}
                            onEdit={() => openEdit(item)}
                            onDelete={() => {
                                item._type === 'device' ? config.deleteDevice(item.id) : config.deleteAccessory(item.id);
                                setTimeout(() => window.dispatchEvent(new Event('local-storage-sync')), 100);
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm min-w-[900px]">
                            <thead>
                                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-semibold">
                                    <th className="px-3 py-3 text-right">صورة</th>
                                    <th className="px-3 py-3 text-right">الاسم والمواصفات</th>
                                    <th className="px-3 py-3 text-right">التصنيف</th>
                                    <th className="px-3 py-3 text-right">الحالة</th>
                                    <th className="px-3 py-3 text-center">الكمية</th>
                                    <th className="px-3 py-3 text-right">تكلفة الوحدة</th>
                                    <th className="px-3 py-3 text-right">سعر البيع</th>
                                    <th className="px-3 py-3 text-right">توقعات الربح</th>
                                    <th className="px-3 py-3 text-left">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredList.length === 0 ? (
                                    <tr><td colSpan={9} className="py-14 text-center text-muted-foreground">لا توجد منتجات</td></tr>
                                ) : filteredList.map((item, i) => {
                                    const avgCost = getWeightedAvgCost(item.id) || item.newCostPrice;
                                    const detailParts = [item.model, item.extra, item.color].filter(Boolean);
                                    const details = detailParts.join(' · ');
                                    return (
                                        <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                            <td className="px-3 py-2 w-12">
                                                {item.image ? <img src={item.image} alt={item.name} className="h-10 w-10 rounded-xl object-cover border border-border shadow-sm" /> : <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center"><ImageOff className="h-4 w-4 text-muted-foreground/30" /></div>}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="font-semibold text-foreground max-w-[200px] truncate">{item.name}</div>
                                                <div className="text-[10px] text-muted-foreground truncate">{details || '—'}</div>
                                            </td>
                                            <td className="px-3 py-2 text-xs font-semibold text-primary">{item.categoryName || '—'}</td>
                                            <td className="px-3 py-2">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                    {item.condition === 'used' ? 'مستعمل' : 'جديد'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-muted text-foreground'}`}>{item.quantity}</span>
                                            </td>
                                            <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                                                <button onClick={() => setActiveBatchesModal({ id: item.id, name: item.name })} className="hover:text-primary transition-colors underline decoration-dotted underline-offset-2" title="الضغط لعرض التفاصيل">{avgCost.toLocaleString()}</button>
                                            </td>
                                            <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{item.salePrice.toLocaleString()}</td>
                                            <td className="px-3 py-2 text-xs font-bold text-emerald-600 tabular-nums">{(item.salePrice - avgCost).toLocaleString()}</td>
                                            <td className="px-3 py-2 text-left">
                                                <div className="flex justify-end gap-1.5">
                                                    <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                    <button onClick={() => { item._type === 'device' ? config.deleteDevice(item.id) : config.deleteAccessory(item.id); setTimeout(() => window.dispatchEvent(new Event('local-storage-sync')), 100); }} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Add/Edit Form Modal ── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in my-8">
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">{editId ? '✏️ تعديل المنتج' : '➕ إضافة منتج'}</h2>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <ImageUpload value={f.image} onChange={v => setF(p => ({ ...p, image: v }))} />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">التصنيف *</label>
                                    <select value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className={IC}>
                                        <option value="" disabled>-- اختر تصنيفاً --</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'device' ? 'جهاز' : 'إكسسوار'})</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">حالة المنتج *</label>
                                    <div className="flex gap-2 h-10">
                                        <button type="button" onClick={() => setF(p => ({ ...p, condition: 'new' }))} className={`flex-1 rounded-xl border text-sm font-semibold transition-all ${f.condition === 'new' ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-input text-muted-foreground'}`}>جديد</button>
                                        <button type="button" onClick={() => setF(p => ({ ...p, condition: 'used' }))} className={`flex-1 rounded-xl border text-sm font-semibold transition-all ${f.condition === 'used' ? 'bg-orange-100 border-orange-400 text-orange-700' : 'bg-transparent border-input text-muted-foreground'}`}>مستعمل</button>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-border/50" />

                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">اسم المنتج *</label><input data-validation="text-only" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} className={IC} autoFocus /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الباركود</label><input value={f.barcode} onChange={e => setF(p => ({ ...p, barcode: e.target.value }))} placeholder="تلقائي" className={IC} /></div>
                            </div>

                            {activeCategoryType === 'device' ? (
                                <div className={`grid ${config.extraDeviceField ? 'grid-cols-3' : 'grid-cols-2'} gap-3 bg-muted/20 p-3 rounded-xl border border-border/40`}>
                                    <div className="col-span-full mb-1"><span className="text-xs font-bold text-primary flex items-center gap-1"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{config.icon}</span> مواصفات الجهاز</span></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">الموديل</label><input value={f.model} onChange={e => setF(p => ({ ...p, model: e.target.value }))} className={IC} /></div>
                                    {config.extraDeviceField && (
                                        <div><label className="mb-1 block text-xs text-muted-foreground">{config.extraDeviceField.label}</label><input value={f.extra} onChange={e => setF(p => ({ ...p, extra: e.target.value }))} className={IC} /></div>
                                    )}
                                    <div><label className="mb-1 block text-xs text-muted-foreground">اللون</label><input data-validation="text-only" value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} className={IC} /></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border/40">
                                    <div className="col-span-full mb-1"><span className="text-xs font-bold text-primary flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> بيانات الإكسسوار</span></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">الموديل</label><input value={f.model} onChange={e => setF(p => ({ ...p, model: e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">اللون</label><input data-validation="text-only" value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} className={IC} /></div>
                                </div>
                            )}

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><AlignLeft className="h-3 w-3" /> ملاحظات التاجر / تفاصيل</label>
                                <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} rows={2} className={`${IC} resize-none`} />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div><label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">الكمية</label><input type="number" min={0} value={f.quantity} onChange={e => setF(p => ({ ...p, quantity: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">س. شراء قديم</label><input type="number" min={0} value={f.oldCostPrice} onChange={e => setF(p => ({ ...p, oldCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">التكلفة الفعلية</label><input type="number" min={0} value={f.newCostPrice} onChange={e => setF(p => ({ ...p, newCostPrice: +e.target.value }))} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-bold text-primary uppercase">سعر البيع</label><input type="number" min={0} value={f.salePrice} onChange={e => setF(p => ({ ...p, salePrice: +e.target.value }))} className={`${IC} border-primary/40 focus:ring-primary`} /></div>
                            </div>
                        </div>

                        <div className="flex gap-2 px-4 pb-4 border-t border-border pt-3 bg-muted/10 rounded-b-2xl">
                            <button onClick={handleFormSubmit} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                            </button>
                            <button onClick={() => { setShowForm(false); setEditId(null); }} className="flex-none rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors bg-card">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Category Creation Modal ── */}
            {showCategoryForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-5 animate-scale-in">
                        <h3 className="text-lg font-bold mb-4">إنشاء تصنيف جديد</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم التصنيف</label>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="مثال: شاشات" className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">النوع التقني للتصنيف</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setNewCatType('device')} className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-all ${newCatType === 'device' ? 'bg-primary/10 text-primary border-primary/40' : 'bg-transparent text-muted-foreground'}`}>جهاز مستقل</button>
                                    <button onClick={() => setNewCatType('accessory')} className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-all ${newCatType === 'accessory' ? 'bg-primary/10 text-primary border-primary/40' : 'bg-transparent text-muted-foreground'}`}>ملحق / إكسسوار</button>
                                </div>
                                <p className="text-[10px] text-muted-foreground/80 mt-1">تحديد &quot;جهاز&quot; يطلب إدخال بيانات أكثر. أما &quot;إكسسوار&quot; فيكتفي بالموديل واللون.</p>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleCategorySubmit} className="flex-1 bg-primary text-primary-foreground font-bold py-2 rounded-xl hover:bg-primary/90 transition-all">إضافة التصنيف</button>
                            <button onClick={() => setShowCategoryForm(false)} className="px-4 border border-border rounded-xl font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Batches Modal ── */}
            {activeBatchesModal && (
                <ProductBatchesModal
                    productId={activeBatchesModal.id}
                    productName={activeBatchesModal.name}
                    onClose={() => setActiveBatchesModal(null)}
                />
            )}

            {/* ── Excel Restore ── */}
            <ExcelColumnMappingDialog
                open={showExcelRestore}
                onOpenChange={setShowExcelRestore}
                inventoryType={config.excelInventoryType as any}
                onSuccess={() => window.dispatchEvent(new Event('local-storage-sync'))}
                onDataSave={data => {
                    data.forEach(row => {
                        config.buildDeviceFromExcelRow(row);
                    });
                }}
            />
        </div>
    );
}
