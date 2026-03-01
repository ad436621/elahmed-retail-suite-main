// ============================================================
// Mobiles Inventory — ELOS-style layout with stat cards,
// action bar, data table, and side panel for quick add/filter
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Plus, Trash2, Pencil, X, Check, Smartphone, Headphones, Search,
    AlignLeft, LayoutGrid, List, Tag, FileSpreadsheet, ImageOff,
    Filter, SlidersHorizontal, RotateCcw, Package, ChevronDown, ChevronUp
} from 'lucide-react';
import {
    getMobiles, addMobile, updateMobile, deleteMobile,
    getMobileAccessories, addMobileAccessory, updateMobileAccessory, deleteMobileAccessory,
} from '@/data/mobilesData';
import { MobileItem } from '@/domain/types';
import { getWeightedAvgCost } from '@/data/batchesData';
import { useToast } from '@/hooks/use-toast';
import { useInventoryData } from '@/hooks/useInventoryData';
import { InventoryProductCard } from '@/components/InventoryProductCard';
import { ImageUpload } from '@/components/ImageUpload';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { getCategoriesBySection, addCategory, DynamicCategory } from '@/data/categoriesData';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';

const IC = 'w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const emptyForm = {
    name: '', barcode: '', category: '', condition: 'new' as 'new' | 'used',
    quantity: 1, oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    storage: '', ram: '', color: '', supplier: '', serialNumber: '',
    model: '', description: '', image: '',
};

const fmt = (n: number) => n.toLocaleString('ar-EG');

// ─── Main Component ──────────────────────────────────────────

export default function MobilesInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const { confirm } = useConfirm();

    const fetchCategories = () => getCategoriesBySection('mobile');
    const [categories, setCategories] = useState<DynamicCategory[]>(fetchCategories);

    const mobiles = useInventoryData(getMobiles, ['gx_mobiles_v2']);
    const accessories = useInventoryData(getMobileAccessories, ['gx_mobile_accessories']);

    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');

    // ── Side Panel Filters ──
    const [filterImei, setFilterImei] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [filterCondition, setFilterCondition] = useState<'all' | 'new' | 'used'>('all');
    const [filterStock, setFilterStock] = useState<'all' | 'in' | 'out'>('all');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');
    const [showFilters, setShowFilters] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editType, setEditType] = useState<'device' | 'accessory'>('device');
    const [f, setF] = useState(emptyForm);

    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState<'device' | 'accessory'>('device');
    const [activeBatchesModal, setActiveBatchesModal] = useState<{ id: string; name: string } | null>(null);
    const [showExcelRestore, setShowExcelRestore] = useState(false);
    const { user } = useAuth();

    useEffect(() => {
        const s = (location.state as { filter?: string })?.filter;
        if (s) setActiveFilter(s);
    }, [location.state]);

    // ── Unified Data ──
    const unifiedProducts = useMemo(() => {
        const list: any[] = [];
        mobiles.forEach(m => {
            const cat = categories.find(c => c.id === m.category);
            list.push({
                _raw: m, _type: 'device',
                id: m.id, name: m.name, barcode: m.barcode, image: m.image, description: m.description,
                quantity: m.quantity, salePrice: m.salePrice, newCostPrice: m.newCostPrice, oldCostPrice: m.oldCostPrice,
                category: m.category, condition: m.condition || 'new', categoryName: cat?.name,
                storage: m.storage, ram: m.ram, color: m.color, supplier: m.supplier, serialNumber: m.serialNumber
            });
        });
        accessories.forEach(a => {
            const cat = categories.find(c => c.id === a.category);
            list.push({
                _raw: a, _type: 'accessory',
                id: a.id, name: a.name, barcode: a.barcode, image: a.image, description: a.description,
                quantity: a.quantity, salePrice: a.salePrice, newCostPrice: a.newCostPrice, oldCostPrice: a.oldCostPrice,
                category: a.category, condition: (a as any).condition || 'new', categoryName: cat?.name,
                model: a.model, color: a.color
            });
        });
        return list;
    }, [mobiles, accessories, categories]);

    // ── Extract unique suppliers for filter dropdown ──
    const uniqueSuppliers = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.supplier) set.add(p.supplier); });
        return Array.from(set).sort();
    }, [unifiedProducts]);

    const filteredList = useMemo(() => {
        let res = unifiedProducts;
        // Category tab filter
        if (activeFilter === 'used') res = res.filter(p => p.condition === 'used');
        else if (activeFilter !== 'all') res = res.filter(p => p.category === activeFilter);
        // Text search
        if (search) {
            const sl = search.toLowerCase();
            res = res.filter(p =>
                p.name.toLowerCase().includes(sl) ||
                (p.serialNumber && p.serialNumber.toLowerCase().includes(sl)) ||
                (p.model && p.model.toLowerCase().includes(sl)) ||
                (p.color && p.color.toLowerCase().includes(sl))
            );
        }
        // IMEI / Serial filter
        if (filterImei.trim()) {
            const imeiLower = filterImei.toLowerCase();
            res = res.filter(p => p.serialNumber && p.serialNumber.toLowerCase().includes(imeiLower));
        }
        // Supplier filter
        if (filterSupplier !== 'all') {
            res = res.filter(p => p.supplier === filterSupplier);
        }
        // Condition filter
        if (filterCondition !== 'all') {
            res = res.filter(p => p.condition === filterCondition);
        }
        // Stock status
        if (filterStock === 'in') res = res.filter(p => p.quantity > 0);
        else if (filterStock === 'out') res = res.filter(p => p.quantity === 0);
        // Price range
        const minP = parseFloat(filterMinPrice);
        const maxP = parseFloat(filterMaxPrice);
        if (!isNaN(minP)) res = res.filter(p => p.salePrice >= minP);
        if (!isNaN(maxP)) res = res.filter(p => p.salePrice <= maxP);
        return res;
    }, [unifiedProducts, search, activeFilter, filterImei, filterSupplier, filterCondition, filterStock, filterMinPrice, filterMaxPrice]);

    const activeFiltersCount = [filterImei, filterSupplier !== 'all', filterCondition !== 'all', filterStock !== 'all', filterMinPrice, filterMaxPrice].filter(Boolean).length;

    const resetFilters = () => {
        setFilterImei(''); setFilterSupplier('all'); setFilterCondition('all');
        setFilterStock('all'); setFilterMinPrice(''); setFilterMaxPrice('');
        setSearch(''); setActiveFilter('all');
    };

    // ── Stats ──
    const stats = useMemo(() => {
        const totalItems = filteredList.reduce((s, p) => s + p.quantity, 0);
        const totalCost = filteredList.reduce((s, p) => s + (getWeightedAvgCost(p.id) || p.newCostPrice) * p.quantity, 0);
        const totalSale = filteredList.reduce((s, p) => s + p.salePrice * p.quantity, 0);
        return { totalItems, totalCost, totalSale };
    }, [filteredList]);

    // ── Handlers ──
    const refreshData = () => {
        setCategories(fetchCategories());
        window.dispatchEvent(new Event('local-storage-sync'));
    };

    const handleCategorySubmit = () => {
        if (!newCatName.trim()) return;
        addCategory({
            name: newCatName.trim(),
            section: 'mobile',
            type: newCatType,
        });
        setCategories(fetchCategories());
        setNewCatName('');
        setShowCategoryForm(false);
        toast({ title: '✅ تم إضافة التصنيف', description: newCatName });
    };

    const handleFormSubmit = () => {
        if (!f.category) { toast({ title: '⚠️ اختر تصنيفاً', variant: 'destructive' }); return; }
        if (!f.name.trim()) { toast({ title: '⚠️ أدخل اسم المنتج', variant: 'destructive' }); return; }
        const catType = categories.find(c => c.id === f.category)?.type || 'device';
        if (catType === 'device') {
            const deviceData: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'> = {
                name: f.name, barcode: f.barcode || `MOB-${Date.now()}`, deviceType: 'mobile',
                category: f.category, condition: f.condition, quantity: f.quantity,
                storage: f.storage, ram: f.ram, color: f.color, supplier: f.supplier,
                oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice, salePrice: f.salePrice,
                serialNumber: f.serialNumber, notes: '', description: f.description, image: f.image,
            };
            editId ? updateMobile(editId, deviceData) : addMobile(deviceData);
        } else {
            const accData = {
                name: f.name, barcode: f.barcode || `ACC-${Date.now()}`,
                category: f.category, quantity: f.quantity,
                oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice, salePrice: f.salePrice,
                model: f.model, color: f.color, description: f.description, image: f.image,
            };
            editId ? updateMobileAccessory(editId, accData) : addMobileAccessory(accData);
        }
        toast({ title: editId ? '✅ تم تعديل المنتج' : '✅ تم إضافة المنتج' });
        closeForm();
        refreshData();
    };

    const openAdd = () => { setEditId(null); setF(emptyForm); setShowForm(true); };
    const openEdit = (item: any) => {
        setEditId(item.id);
        setEditType(item._type);
        setF({
            name: item.name, barcode: item.barcode || '', category: item.category,
            condition: item.condition, quantity: item.quantity,
            oldCostPrice: item.oldCostPrice, newCostPrice: item.newCostPrice, salePrice: item.salePrice,
            storage: item.storage || '', ram: item.ram || '', color: item.color || '',
            supplier: item.supplier || '', serialNumber: item.serialNumber || '',
            model: item.model || '', description: item.description || '', image: item.image || '',
        });
        setShowForm(true);
    };
    const closeForm = () => setShowForm(false);

    const handleDelete = async (item: any) => {
        const ok = await confirm({
            title: 'حذف منتج',
            message: `هل أنت متأكد من حذف "${item.name}"؟ لا يمكن التراجع.`,
            confirmLabel: 'حذف',
            danger: true,
        });
        if (!ok) return;
        item._type === 'device' ? deleteMobile(item.id) : deleteMobileAccessory(item.id);
        setTimeout(() => window.dispatchEvent(new Event('local-storage-sync')), 100);
        toast({ title: '🗑️ تم حذف المنتج' });
    };

    const activeCategoryType = categories.find(c => c.id === f.category)?.type || 'device';

    // ── Render ──
    return (
        <div className="animate-fade-in" dir="rtl">

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 border border-cyan-200">
                        <Smartphone className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-foreground">مخزون الموبايلات</h1>
                        <p className="text-xs text-muted-foreground mt-0.5">{unifiedProducts.length} منتج مسجل • {filteredList.length} ظاهر</p>
                    </div>
                </div>
            </div>

            {/* ─── Stat Cards ─── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                        <span className="text-emerald-600 text-sm">💰</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">قيمة البيع المتوقعة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{fmt(stats.totalSale)}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
                        <span className="text-amber-600 text-sm">📦</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">قيمة التكلفة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{fmt(stats.totalCost)}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 text-sm">📋</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">الأجهزة المتوفرة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{stats.totalItems}</p>
                    </div>
                </div>
            </div>

            {/* ─── Action Buttons Row ─── */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button onClick={openAdd}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
                    <Plus className="h-3.5 w-3.5" /> إضافة منتج
                </button>
                <button onClick={() => setShowExcelRestore(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> استرداد Excel
                </button>
                <button onClick={() => setShowCategoryForm(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 transition-all">
                    <Tag className="h-3.5 w-3.5" /> تصنيف
                </button>

                <div className="flex-1" />

                {/* Filter toggle */}
                <button onClick={() => setShowFilters(s => !s)}
                    className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border transition-all ${showFilters ? 'bg-primary/10 text-primary border-primary/30' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
                    <SlidersHorizontal className="h-4 w-4" /> الفلاتر
                    {activeFiltersCount > 0 && (
                        <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-destructive text-white text-[10px] font-black flex items-center justify-center">{activeFiltersCount}</span>
                    )}
                </button>

                {/* View Mode Toggle */}
                <div className="flex gap-1 rounded-xl border border-border p-1 bg-muted/30">
                    <button onClick={() => setViewMode('grid')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                        <LayoutGrid className="h-3.5 w-3.5" /> شبكة
                    </button>
                    <button onClick={() => setViewMode('table')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1.5 ${viewMode === 'table' ? 'bg-card shadow text-primary border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                        <List className="h-3.5 w-3.5" /> جدول
                    </button>
                </div>
            </div>

            {/* ═══ MAIN LAYOUT: Side Panel + Content ═══ */}
            <div className="flex gap-4">

                {/* ─── Right (RTL): Filter Side Panel ─── */}
                {showFilters && (
                    <div className="hidden lg:block w-64 shrink-0">
                        <div className="rounded-2xl border border-border bg-card p-3.5 space-y-3.5 sticky top-4">
                            {/* Panel Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-black text-foreground">الفلاتر</span>
                                    {activeFiltersCount > 0 && (
                                        <span className="h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFiltersCount}</span>
                                    )}
                                </div>
                                <button onClick={resetFilters} title="إعادة تعيين" className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            {/* IMEI Search */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <Smartphone className="h-3 w-3 text-primary" /> بحث IMEI
                                </label>
                                <input value={filterImei} onChange={e => setFilterImei(e.target.value)}
                                    placeholder="أدخل رقم IMEI..."
                                    className={`${IC} text-xs font-mono`} />
                            </div>

                            <div className="border-t border-border/50" />

                            {/* Supplier / Brand */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <Package className="h-3 w-3 text-primary" /> الشركة / المورد
                                </label>
                                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className={`${IC} text-xs`}>
                                    <option value="all">عرض الكل</option>
                                    {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Condition */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <SlidersHorizontal className="h-3 w-3 text-primary" /> حالة الجهاز
                                </label>
                                <div className="flex gap-1">
                                    {[{ v: 'all' as const, l: 'الكل' }, { v: 'new' as const, l: 'جديد' }, { v: 'used' as const, l: 'مستعمل' }].map(opt => (
                                        <button key={opt.v} onClick={() => setFilterCondition(opt.v)}
                                            className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all ${filterCondition === opt.v
                                                ? opt.v === 'used' ? 'bg-orange-100 text-orange-700 border-orange-300' : opt.v === 'new' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-primary/10 text-primary border-primary/30'
                                                : 'bg-transparent text-muted-foreground border-border hover:bg-muted/50'
                                                }`}>{opt.l}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Stock Status */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    📦 حالة المخزون
                                </label>
                                <select value={filterStock} onChange={e => setFilterStock(e.target.value as any)} className={`${IC} text-xs`}>
                                    <option value="all">عرض الكل</option>
                                    <option value="in">✅ متاح</option>
                                    <option value="out">❌ نفذ</option>
                                </select>
                            </div>

                            <div className="border-t border-border/50" />

                            {/* Price Range */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    💰 نطاق السعر
                                </label>
                                <div className="flex gap-1.5">
                                    <input value={filterMinPrice} onChange={e => setFilterMinPrice(e.target.value)}
                                        placeholder="من" type="number" min={0}
                                        className={`${IC} text-xs text-center`} />
                                    <span className="text-muted-foreground self-center text-xs">—</span>
                                    <input value={filterMaxPrice} onChange={e => setFilterMaxPrice(e.target.value)}
                                        placeholder="إلى" type="number" min={0}
                                        className={`${IC} text-xs text-center`} />
                                </div>
                            </div>

                            {/* Reset */}
                            <button onClick={resetFilters}
                                className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-border py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted transition-colors">
                                <RotateCcw className="h-3 w-3" /> إعادة تعيين
                            </button>

                            {/* Results Count */}
                            <div className="rounded-xl bg-muted/40 p-2.5 text-center">
                                <p className="text-[10px] text-muted-foreground">نتائج الفلترة</p>
                                <p className="text-base font-black text-foreground">{filteredList.length} <span className="text-[10px] font-medium text-muted-foreground">منتج</span></p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Main Content ─── */}
                <div className="flex-1 min-w-0 space-y-3">

                    {/* Category Tabs */}
                    <div className="flex gap-2 w-full overflow-x-auto hide-scrollbar pb-1 px-1 -mx-1">
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
                                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border transition-all flex items-center gap-2 ${activeFilter === c.id ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                                {c.type === 'device' ? <Smartphone className="h-4 w-4 opacity-70" /> : <Headphones className="h-4 w-4 opacity-70" />}
                                {c.name}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="بحث بالاسم أو السيريال أو اللون..."
                            className={`${IC} pr-10`} />
                    </div>

                    {/* ─── Content ─── */}
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredList.length === 0 ? (
                                <div className="col-span-4 py-20 text-center text-muted-foreground bg-card rounded-2xl border border-dashed border-border">
                                    <Smartphone className="h-14 w-14 mx-auto mb-4 opacity-15" />
                                    <p className="text-base font-medium">لا توجد منتجات مطابقة</p>
                                </div>
                            ) : filteredList.map(item => (
                                <InventoryProductCard key={item.id} item={item}
                                    onEdit={() => openEdit(item)}
                                    onDelete={() => handleDelete(item)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[900px]">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs font-semibold">
                                            <th className="px-3 py-3 text-right w-8"><input type="checkbox" className="rounded" /></th>
                                            <th className="px-3 py-3 text-right">النوع</th>
                                            <th className="px-3 py-3 text-right">الموديل</th>
                                            <th className="px-3 py-3 text-right">الفئة</th>
                                            <th className="px-3 py-3 text-right">الحالة</th>
                                            <th className="px-3 py-3 text-right">IMEI</th>
                                            <th className="px-3 py-3 text-center">الكمية</th>
                                            <th className="px-3 py-3 text-right">التكلفة</th>
                                            <th className="px-3 py-3 text-right">سعر البيع</th>
                                            <th className="px-3 py-3 text-right">المخزون</th>
                                            <th className="px-3 py-3 text-left">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredList.length === 0 ? (
                                            <tr><td colSpan={11} className="py-14 text-center text-muted-foreground">لا توجد منتجات</td></tr>
                                        ) : filteredList.map((item, i) => {
                                            const avgCost = getWeightedAvgCost(item.id) || item.newCostPrice;
                                            const details = item._type === 'device'
                                                ? [item.storage, item.ram, item.color].filter(Boolean).join(' · ')
                                                : [item.model, item.color].filter(Boolean).join(' · ');
                                            return (
                                                <tr key={item.id} className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                                                    <td className="px-3 py-2"><input type="checkbox" className="rounded" /></td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            {item.image
                                                                ? <img src={item.image} alt={item.name} className="h-8 w-8 rounded-lg object-cover border border-border" />
                                                                : <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center"><ImageOff className="h-3 w-3 text-muted-foreground/30" /></div>
                                                            }
                                                            <span className="font-semibold text-foreground truncate max-w-[140px]">{item.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{details || '—'}</td>
                                                    <td className="px-3 py-2 text-xs font-semibold text-primary">{item.categoryName || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {item.condition === 'used' ? 'مستعمل' : 'جديد'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono">{item.serialNumber || '—'}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.quantity === 0 ? 'bg-red-100 text-red-600' : 'bg-muted text-foreground'}`}>{item.quantity}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                                                        <button onClick={() => setActiveBatchesModal({ id: item.id, name: item.name })} className="hover:text-primary transition-colors underline decoration-dotted underline-offset-2" title="عرض الدُفعات">{avgCost.toLocaleString()}</button>
                                                    </td>
                                                    <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{item.salePrice.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-xs font-bold text-emerald-600 tabular-nums">{(item.salePrice - avgCost).toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-left">
                                                        <div className="flex justify-end gap-1">
                                                            <button onClick={() => openEdit(item)} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors"><Pencil className="h-3.5 w-3.5" /></button>
                                                            <button onClick={() => handleDelete(item)} className="rounded-lg p-1.5 hover:bg-red-50 text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
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

                </div>{/* end main content */}

            </div>{/* end flex layout */}

            {/* ─── Product Form Modal ─── */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-4 px-4">
                    <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in my-8">
                        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">
                                {editId ? '✏️ تعديل المنتج' : '➕ إضافة منتج'}
                            </h2>
                            <button onClick={closeForm} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
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
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">اسم المنتج *</label><input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} className={IC} autoFocus /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الباركود</label><input value={f.barcode} onChange={e => setF(p => ({ ...p, barcode: e.target.value }))} placeholder="تلقائي" className={IC} /></div>
                            </div>

                            {activeCategoryType === 'device' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-xl border border-border/40">
                                    <div className="col-span-full mb-1"><span className="text-xs font-bold text-primary flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> مواصفات الجهاز</span></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">التخزين</label><input value={f.storage} onChange={e => setF(p => ({ ...p, storage: e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">الرام</label><input value={f.ram} onChange={e => setF(p => ({ ...p, ram: e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">اللون</label><input value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">المورد</label><input value={f.supplier} onChange={e => setF(p => ({ ...p, supplier: e.target.value }))} className={IC} /></div>
                                    <div className="col-span-2"><label className="mb-1 block text-xs text-muted-foreground">السيريال نمبر</label><input value={f.serialNumber} onChange={e => setF(p => ({ ...p, serialNumber: e.target.value }))} className={IC} /></div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-xl border border-border/40">
                                    <div className="col-span-full mb-1"><span className="text-xs font-bold text-primary flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> بيانات الإكسسوار</span></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">الموديل</label><input value={f.model} onChange={e => setF(p => ({ ...p, model: e.target.value }))} className={IC} /></div>
                                    <div><label className="mb-1 block text-xs text-muted-foreground">اللون</label><input value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} className={IC} /></div>
                                </div>
                            )}

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><AlignLeft className="h-3 w-3" /> ملاحظات / تفاصيل</label>
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
                            <button onClick={handleFormSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                            </button>
                            <button onClick={closeForm}
                                className="flex-none rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors bg-card">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Category Form */}
            {showCategoryForm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
                    <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-5 animate-scale-in">
                        <h3 className="text-lg font-bold mb-4">إنشاء تصنيف جديد</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">اسم التصنيف</label>
                                <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="مثال: ساعات ذكية" className={IC} autoFocus />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">النوع التقني</label>
                                <div className="flex gap-2">
                                    <button onClick={() => setNewCatType('device')} className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-all ${newCatType === 'device' ? 'bg-primary/10 text-primary border-primary/40' : 'bg-transparent text-muted-foreground'}`}>جهاز مستقل</button>
                                    <button onClick={() => setNewCatType('accessory')} className={`flex-1 py-2 text-sm font-bold rounded-xl border transition-all ${newCatType === 'accessory' ? 'bg-primary/10 text-primary border-primary/40' : 'bg-transparent text-muted-foreground'}`}>ملحق / إكسسوار</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleCategorySubmit} className="flex-1 bg-primary text-primary-foreground font-bold py-2 rounded-xl hover:bg-primary/90 transition-all">إضافة التصنيف</button>
                            <button onClick={() => setShowCategoryForm(false)} className="px-4 border border-border rounded-xl font-medium hover:bg-muted transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Batches Modal */}
            {activeBatchesModal && (
                <ProductBatchesModal
                    productId={activeBatchesModal.id}
                    productName={activeBatchesModal.name}
                    onClose={() => setActiveBatchesModal(null)}
                />
            )}

            {/* Excel Restore */}
            <ExcelColumnMappingDialog
                open={showExcelRestore}
                onOpenChange={setShowExcelRestore}
                inventoryType="mobile"
                onSuccess={() => { window.dispatchEvent(new Event('local-storage-sync')); }}
                onDataSave={(data) => {
                    data.forEach(row => {
                        const mobile: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'> = {
                            name: row.name || '', barcode: row.barcode || '', deviceType: row.deviceType || 'mobile',
                            category: row.category || '', condition: row.condition || 'new',
                            quantity: Number(row.quantity) || 0, storage: row.storage || '', ram: row.ram || '',
                            color: row.color || '', supplier: row.supplier || '',
                            oldCostPrice: Number(row.oldCostPrice) || 0, newCostPrice: Number(row.newCostPrice) || 0,
                            salePrice: Number(row.salePrice) || 0, serialNumber: row.serialNumber || '',
                            notes: row.notes || '', description: row.description || '',
                        };
                        addMobile(mobile);
                    });
                }}
            />
        </div>
    );
}
