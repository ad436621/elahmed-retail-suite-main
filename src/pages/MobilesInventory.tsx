// ============================================================
// Mobiles Inventory — ELOS-style layout with stat cards,
// action bar, data table, and side panel for quick add/filter
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { generateBarcode as genBarcode } from '@/lib/idGenerator';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination, PaginationBar } from '@/hooks/usePagination';
import {
    Plus, Trash2, Pencil, X, Check, Smartphone, Headphones, Search,
    AlignLeft, LayoutGrid, List, Tag, FileSpreadsheet, ImageOff,
    Filter, SlidersHorizontal, RotateCcw, Package, Wrench, Download, Info
} from 'lucide-react';
import { exportToExcel, MOBILE_COLUMNS, prepareConditionForExport } from '@/services/excelService';
import {
    getMobiles, addMobile, updateMobile, deleteMobile,
} from '@/data/mobilesData';
import { getWarehouses, Warehouse } from '@/data/warehousesData';
import { MobileItem } from '@/domain/types';
import { getWeightedAvgCost } from '@/data/batchesData';
import { useToast } from '@/hooks/use-toast';
import { useInventoryData } from '@/hooks/useInventoryData';
import { InventoryProductCard } from '@/components/InventoryProductCard';
import { ImageUpload } from '@/components/ImageUpload';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { loadCats, saveCats } from '@/data/categoriesData';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import { useConfirm } from '@/components/ConfirmDialog';
import { FilterBar, type FilterBarField } from '@/components/FilterBar';
import { ProductDetailsModal, type ProductDetailsData } from '@/components/ProductDetailsModal';
import { calculateMarginPercent, calculateProfitAmount, calculateSalePriceFromProfit, getMarginTone, normalizeCostPrice } from '@/domain/pricing';
import { PRODUCT_CONDITION_OPTIONS, type ProductConditionValue, getProductConditionBadgeClass, getProductConditionLabel } from '@/domain/productConditions';
import { isBarcodeDuplicate } from '@/repositories/productRepository';

const IC = 'w-full rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all';

const emptyForm = {
    name: '', barcode: '', category: '', condition: 'new' as ProductConditionValue,
    quantity: 1, oldCostPrice: 0, newCostPrice: 0, salePrice: 0, profitMargin: 0,
    storage: '', ram: '', color: '', supplier: '', serialNumber: '',
    imei2: '', model: '', description: '', image: '', notes: '', subcategory: '',
    boxNumber: '', source: '', taxExcluded: false, warehouseId: '', brand: '',
};

interface UnitEntry {
    imei1: string;
    imei2: string;
    color: string;
    barcode: string;
}

interface InventoryViewItem {
    _raw: MobileItem;
    _type: 'device';
    id: string;
    name: string;
    model?: string;
    barcode?: string;
    image?: string;
    description: string;
    quantity: number;
    salePrice: number;
    newCostPrice: number;
    oldCostPrice: number;
    profitMargin: number;
    category?: string;
    condition: NonNullable<MobileItem['condition']>;
    categoryName?: string;
    storage: string;
    ram: string;
    color: string;
    brand: string;
    supplier: string;
    source: string;
    serialNumber: string;
    warehouseId: string;
}

const emptyUnit = (): UnitEntry => ({ imei1: '', imei2: '', color: '', barcode: '' });
const normalizeIdentifier = (value: string) => value.replace(/\s+/g, '').trim();

const fmt = (n: number) => n.toLocaleString('ar-EG');

// ─── Predefined Options ──────────────────────────────────────
const BRAND_OPTIONS = [
    'Samsung', 'Apple', 'Huawei', 'Xiaomi', 'Oppo', 'Vivo', 'Realme',
    'OnePlus', 'Nokia', 'Motorola', 'Honor', 'Tecno', 'Infinix', 'Itel',
    'Google', 'Sony', 'LG', 'Lenovo', 'Nothing',
];
const STORAGE_OPTIONS = ['16GB', '32GB', '64GB', '128GB', '256GB', '512GB', '1TB'];
const RAM_OPTIONS = ['2GB', '3GB', '4GB', '6GB', '8GB', '12GB', '16GB'];
const CONDITION_OPTIONS = [
    { v: 'new', l: 'جديد' },
    { v: 'like_new', l: 'مثل الجديد' },
    { v: 'used', l: 'مستعمل' },
    { v: 'broken', l: 'معطل' },
] as const;


// ─── Mobile Categories Manager Modal ─────────────────────────

function MobilesCategoriesManager({
    cats, onClose, onSave
}: {
    cats: string[];
    onClose: () => void;
    onSave: (cats: string[]) => void;
}) {
    const [list, setList] = useState<string[]>([...cats]);
    const [newName, setNewName] = useState('');
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');

    const addCat = () => {
        const n = newName.trim();
        if (!n) return;
        if (list.includes(n)) return; // duplicate check
        setList(l => [...l, n]);
        setNewName('');
    };

    const deleteCat = (idx: number) => {
        setList(l => l.filter((_, i) => i !== idx));
        if (editIndex === idx) setEditIndex(null);
    };

    const startEdit = (cat: string, idx: number) => {
        setEditIndex(idx);
        setEditVal(cat);
    };

    const saveEdit = () => {
        if (editIndex === null) return;
        const n = editVal.trim();
        if (!n) return;
        setList(l => l.map((c, i) => i === editIndex ? n : c));
        setEditIndex(null);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/72 px-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-primary" />
                        <h3 className="text-base font-bold">إدارة تصنيفات الموبايلات</h3>
                        <span className="rounded-full bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5">{list.length}</span>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Add new */}
                <div className="px-5 pt-4 pb-3 space-y-2.5">
                    <div className="flex gap-2">
                        <input
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addCat()}
                            placeholder="اسم التصنيف الجديد..."
                            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            autoFocus
                        />
                        <button onClick={addCat}
                            className="flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 px-4 py-2 text-sm font-bold text-white transition-colors">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="px-5 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
                    {list.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات بعد</p>
                    )}
                    {list.map((cat, idx) => (
                        <div key={idx}
                            className="group flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                            {editIndex === idx ? (
                                <div className="flex-1 ml-3">
                                    <input
                                        value={editVal}
                                        onChange={e => setEditVal(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEdit();
                                            if (e.key === 'Escape') setEditIndex(null);
                                        }}
                                        className="w-full rounded-lg border border-primary/40 px-2 py-1 text-sm focus:outline-none bg-background"
                                        autoFocus
                                    />
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className="shrink-0 h-5 w-5 rounded-full flex items-center justify-center bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400">
                                        <Smartphone className="h-3 w-3" />
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-foreground">{cat}</span>
                                </div>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {editIndex === idx ? (
                                    <>
                                        <button onClick={saveEdit}
                                            className="rounded-md p-1 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600">
                                            <Check className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => setEditIndex(null)}
                                            className="rounded-md p-1 hover:bg-muted text-muted-foreground">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(cat, idx)}
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
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 py-2.5 text-sm font-bold text-white transition-colors">
                        <Check className="h-4 w-4" /> حفظ التصنيفات
                    </button>
                    <button onClick={onClose}
                        className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">
                        إلغاء
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// ─── Main Component ──────────────────────────────────────────

export default function MobilesInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    const [categories, setCategories] = useState<string[]>(() => loadCats('mobiles_main_cats', ['موبايلات', 'تابلت', 'ساعات ذكية']));
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(console.error);
    }, []);

    const mobiles = useInventoryData(getMobiles, ['gx_mobiles_v2']);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [activeFilter, setActiveFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [showFilters, setShowFilters] = useState(true);

    // ── Side Panel Filters ──
    const [filterImei, setFilterImei] = useState('');
    const [filterSupplier, setFilterSupplier] = useState('all');
    const [filterBrand, setFilterBrand] = useState('all');
    const [filterSource, setFilterSource] = useState('all');
    const [filterColor, setFilterColor] = useState('all');
    const [filterModel, setFilterModel] = useState('');
    const [filterCondition, setFilterCondition] = useState<'all' | ProductConditionValue>('all');
    const [filterStock, setFilterStock] = useState<'all' | 'in' | 'out'>('all');
    const [filterMinPrice, setFilterMinPrice] = useState('');
    const [filterMaxPrice, setFilterMaxPrice] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [selectedDetails, setSelectedDetails] = useState<ProductDetailsData | null>(null);
    const [f, setF] = useState(emptyForm);
    const [pricingMode, setPricingMode] = useState<'sale' | 'margin'>('sale');
    const [customStorage, setCustomStorage] = useState(false);
    const [customRam, setCustomRam] = useState(false);

    const [showCatManager, setShowCatManager] = useState(false);
    const [activeBatchesModal, setActiveBatchesModal] = useState<{ id: string; name: string } | null>(null);
    const [showExcelRestore, setShowExcelRestore] = useState(false);
    const [units, setUnits] = useState<UnitEntry[]>([emptyUnit()]);

    useEffect(() => {
        const s = (location.state as { filter?: string })?.filter;
        if (s) setActiveFilter(s);
    }, [location.state]);

    // ── Unified Data ──
    const unifiedProducts = useMemo(() => {
        const list: InventoryViewItem[] = [];
        mobiles.forEach(m => {
            const costPrice = normalizeCostPrice(m.newCostPrice, m.oldCostPrice);
            list.push({
                _raw: m, _type: 'device',
                id: m.id, name: m.name, model: m.model || '', barcode: m.barcode, image: m.image, description: m.description,
                quantity: m.quantity, salePrice: m.salePrice, newCostPrice: m.newCostPrice, oldCostPrice: m.oldCostPrice,
                profitMargin: typeof m.profitMargin === 'number' ? m.profitMargin : calculateProfitAmount(costPrice, m.salePrice),
                category: m.category, condition: m.condition || 'new', categoryName: m.category,
                storage: m.storage, ram: m.ram, color: m.color, brand: m.brand || '', supplier: m.supplier,
                source: m.source || '', serialNumber: m.serialNumber,
                warehouseId: m.warehouseId || ''
            });
        });
        return list;
    }, [mobiles]);

    // ── Extract unique values for filter dropdowns ──
    const uniqueSuppliers = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.supplier) set.add(p.supplier); });
        return Array.from(set).sort();
    }, [unifiedProducts]);
    const uniqueBrands = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.brand) set.add(p.brand); });
        return Array.from(set).sort();
    }, [unifiedProducts]);
    const uniqueSources = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.source) set.add(p.source); });
        return Array.from(set).sort();
    }, [unifiedProducts]);
    const uniqueColors = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.color) set.add(p.color); });
        return Array.from(set).sort();
    }, [unifiedProducts]);
    const uniqueModels = useMemo(() => {
        const set = new Set<string>();
        unifiedProducts.forEach(p => { if (p.model) set.add(p.model); });
        return Array.from(set).sort();
    }, [unifiedProducts]);

    const filteredList = useMemo(() => {
        let res = unifiedProducts;
        if (activeFilter === 'used') res = res.filter(p => p.condition === 'used');
        else if (activeFilter !== 'all') res = res.filter(p => p.category === activeFilter);
        // Text search — expanded
        if (debouncedSearch.trim()) {
            const sl = debouncedSearch.trim().toLowerCase();
            res = res.filter(p => p.name.toLowerCase().includes(sl));
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
        // Brand filter
        if (filterBrand !== 'all') {
            res = res.filter(p => p.brand === filterBrand);
        }
        // Source filter
        if (filterSource !== 'all') {
            res = res.filter(p => p.source === filterSource);
        }
        // Color filter
        if (filterColor !== 'all') {
            res = res.filter(p => p.color === filterColor);
        }
        // Model filter
        if (filterModel.trim()) {
            const modelLower = filterModel.trim().toLowerCase();
            res = res.filter(p => (p.model || '').toLowerCase().includes(modelLower));
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
    }, [unifiedProducts, debouncedSearch, activeFilter, filterImei, filterSupplier, filterBrand, filterSource, filterColor, filterModel, filterCondition, filterStock, filterMinPrice, filterMaxPrice]);

    // ── Pagination ──
    const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage, reset: resetPagination } = usePagination(filteredList, 30);

    const activeFiltersCount = [
        search.trim(),
        filterImei.trim(),
        filterSupplier !== 'all',
        filterBrand !== 'all',
        filterSource !== 'all',
        activeFilter !== 'all',
        filterColor !== 'all',
        filterModel.trim(),
        filterCondition !== 'all',
        filterStock !== 'all',
        filterMinPrice,
        filterMaxPrice,
    ].filter(Boolean).length;

    const filterFields = useMemo<FilterBarField[]>(() => [
        {
            id: 'name',
            label: 'اسم المنتج',
            type: 'text',
            value: search,
            placeholder: 'ابحث باسم المنتج',
            onChange: setSearch,
        },
        {
            id: 'source',
            label: 'المصدر',
            type: 'select',
            value: filterSource,
            options: [{ label: 'كل المصادر', value: 'all' }, ...uniqueSources.map((value) => ({ label: value, value }))],
            onChange: setFilterSource,
        },
        {
            id: 'supplier',
            label: 'المورد',
            type: 'select',
            value: filterSupplier,
            options: [{ label: 'كل الموردين', value: 'all' }, ...uniqueSuppliers.map((value) => ({ label: value, value }))],
            onChange: setFilterSupplier,
        },
        {
            id: 'brand',
            label: 'اسم الشركة',
            type: 'select',
            value: filterBrand,
            options: [{ label: 'كل الشركات', value: 'all' }, ...uniqueBrands.map((value) => ({ label: value, value }))],
            onChange: setFilterBrand,
        },
        {
            id: 'category',
            label: 'التصنيف',
            type: 'select',
            value: activeFilter,
            options: [{ label: 'كل التصنيفات', value: 'all' }, ...categories.map((value) => ({ label: value, value }))],
            onChange: setActiveFilter,
        },
        {
            id: 'color',
            label: 'اللون',
            type: 'select',
            value: filterColor,
            options: [{ label: 'كل الألوان', value: 'all' }, ...uniqueColors.map((value) => ({ label: value, value }))],
            onChange: setFilterColor,
        },
        {
            id: 'model',
            label: 'الموديل',
            type: 'text',
            value: filterModel,
            placeholder: uniqueModels[0] ? `مثال: ${uniqueModels[0]}` : 'ابحث بالموديل',
            onChange: setFilterModel,
        },
        {
            id: 'condition',
            label: 'الحالة',
            type: 'select',
            value: filterCondition,
            options: [
                { label: 'كل الحالات', value: 'all' },
                ...PRODUCT_CONDITION_OPTIONS.map((option) => ({ label: option.label, value: option.value })),
            ],
            onChange: (value) => setFilterCondition(value as 'all' | ProductConditionValue),
        },
        {
            id: 'imei',
            label: 'IMEI',
            type: 'text',
            value: filterImei,
            placeholder: 'بحث برقم IMEI',
            onChange: setFilterImei,
        },
        {
            id: 'stock',
            label: 'حالة المخزون',
            type: 'select',
            value: filterStock,
            options: [
                { label: 'كل الحالات', value: 'all' },
                { label: 'متاح', value: 'in' },
                { label: 'نفد', value: 'out' },
            ],
            onChange: (value) => setFilterStock(value as typeof filterStock),
        },
        {
            id: 'min-price',
            label: 'أقل سعر',
            type: 'number',
            value: filterMinPrice,
            placeholder: '0',
            onChange: setFilterMinPrice,
        },
        {
            id: 'max-price',
            label: 'أعلى سعر',
            type: 'number',
            value: filterMaxPrice,
            placeholder: '0',
            onChange: setFilterMaxPrice,
        },
    ], [
        search,
        filterSource,
        uniqueSources,
        filterSupplier,
        uniqueSuppliers,
        filterBrand,
        uniqueBrands,
        activeFilter,
        categories,
        filterColor,
        uniqueColors,
        filterModel,
        uniqueModels,
        filterCondition,
        filterImei,
        filterStock,
        filterMinPrice,
        filterMaxPrice,
    ]);

    const resetFilters = () => {
        setSearch('');
        setFilterImei('');
        setFilterSupplier('all');
        setFilterBrand('all');
        setFilterSource('all');
        setActiveFilter('all');
        setFilterColor('all');
        setFilterModel('');
        setFilterCondition('all');
        setFilterStock('all');
        setFilterMinPrice('');
        setFilterMaxPrice('');
        resetPagination();
    };

    // ── Stats ──
    const stats = useMemo(() => {
        let totalItems = 0;
        let totalCost = 0;
        let totalSale = 0;

        filteredList.forEach((product) => {
            totalItems += product.quantity;
            totalCost += normalizeCostPrice(getWeightedAvgCost(product.id), product.newCostPrice) * product.quantity;
            totalSale += product.salePrice * product.quantity;
        });

        const totalTypes = filteredList.length;
        return { totalTypes, totalItems, totalCost, totalSale };
    }, [filteredList]);

    // ── Handlers ──
    const refreshData = () => {
        setCategories(loadCats('mobiles_main_cats', ['موبايلات', 'تابلت', 'ساعات ذكية']));
    };

    const handleSaveCats = (updated: string[]) => {
        saveCats('mobiles_main_cats', updated);
        setCategories(updated);
        setShowCatManager(false);
        toast({ title: '✅ تم حفظ التصنيفات', description: `${updated.length} تصنيف` });
    };

    const setSalePriceValue = (value: number) => {
        setPricingMode('sale');
        setF((prev) => {
            const nextSalePrice = Number.isFinite(value) ? value : 0;
            const costPrice = normalizeCostPrice(prev.newCostPrice, prev.oldCostPrice);
            return {
                ...prev,
                salePrice: nextSalePrice,
                profitMargin: calculateProfitAmount(costPrice, nextSalePrice),
            };
        });
    };

    const setProfitMarginValue = (value: number) => {
        setPricingMode('margin');
        setF((prev) => {
            const nextProfitMargin = Number.isFinite(value) ? value : 0;
            const costPrice = normalizeCostPrice(prev.newCostPrice, prev.oldCostPrice);
            return {
                ...prev,
                profitMargin: nextProfitMargin,
                salePrice: calculateSalePriceFromProfit(costPrice, nextProfitMargin),
            };
        });
    };

    const setCostPriceValue = (value: number) => {
        setF((prev) => {
            const nextCostPrice = Number.isFinite(value) ? value : 0;
            const nextProfitMargin = pricingMode === 'margin'
                ? prev.profitMargin
                : calculateProfitAmount(nextCostPrice, prev.salePrice);

            return {
                ...prev,
                oldCostPrice: nextCostPrice,
                newCostPrice: nextCostPrice,
                salePrice: pricingMode === 'margin'
                    ? calculateSalePriceFromProfit(nextCostPrice, prev.profitMargin)
                    : prev.salePrice,
                profitMargin: nextProfitMargin,
            };
        });
    };

    const openDetails = (item: InventoryViewItem) => {
        const costPrice = normalizeCostPrice(getWeightedAvgCost(item.id), item.newCostPrice);

        setSelectedDetails({
            id: item.id,
            name: item.name,
            barcode: item.barcode,
            category: item.category,
            condition: item.condition,
            brand: item.brand,
            supplier: item.supplier,
            source: item.source,
            model: item.model,
            color: item.color,
            storage: item.storage,
            ram: item.ram,
            quantity: item.quantity,
            costPrice,
            oldCostPrice: item.oldCostPrice,
            salePrice: item.salePrice,
            profitMargin: item.profitMargin,
            serialNumber: item.serialNumber,
            imei2: item._raw?.imei2,
            description: item.description,
            notes: item._raw?.notes,
            image: item.image,
            createdAt: item._raw?.createdAt,
            updatedAt: item._raw?.updatedAt,
        });
    };

    const handleFormSubmit = () => {
        if (!f.category) { toast({ title: '⚠️ اختر تصنيفاً', variant: 'destructive' }); return; }
        if (!f.name.trim()) { toast({ title: '⚠️ أدخل اسم المنتج', variant: 'destructive' }); return; }
        
        if (f.newCostPrice < 0 || f.salePrice < 0 || f.profitMargin < 0) { toast({ title: 'âڑ ï¸ڈ ط£ط¯ط®ظ„ ط£ط±ظ‚ط§ظ…ط§ظ‹ طµط­ظٹط­ط©', variant: 'destructive' }); return; }

        if (editId) {
            // ─ تعديل وحدة واحدة ─
            const u = units[0] || emptyUnit();
            updateMobile(editId, {
                name: f.name, barcode: u.barcode || f.barcode, deviceType: 'mobile',
                category: f.category, condition: f.condition, quantity: f.quantity,
                storage: f.storage, ram: f.ram, color: u.color || f.color, model: f.model, brand: f.brand, supplier: f.supplier,
                oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice, salePrice: f.salePrice, profitMargin: f.profitMargin,
                serialNumber: u.imei1 || f.serialNumber, imei2: u.imei2 || f.imei2,
                boxNumber: f.boxNumber, source: f.source, taxExcluded: f.taxExcluded,
                notes: '', description: f.description, image: f.image, warehouseId: f.warehouseId,
            });
            toast({ title: '✅ تم تعديل المنتج' });
        } else {
            // ─ إضافة: سجل منفصل لكل وحدة ─
            const validUnits = units.filter(u => u.imei1.trim());
            if (validUnits.length === 0) {
                toast({ title: '⚠️ أدخل IMEI 1 لوحدة واحدة على الأقل', variant: 'destructive' });
                return;
            }
            validUnits.forEach(u => {
                addMobile({
                    name: f.name, barcode: u.barcode || genBarcode('MOB'),
                    deviceType: 'mobile', category: f.category, condition: f.condition,
                    quantity: 1, storage: f.storage, ram: f.ram, color: u.color || f.color, model: f.model,
                    brand: f.brand, supplier: f.supplier, oldCostPrice: f.oldCostPrice, newCostPrice: f.newCostPrice,
                    salePrice: f.salePrice, profitMargin: f.profitMargin, serialNumber: u.imei1, imei2: u.imei2,
                    boxNumber: f.boxNumber, source: f.source, taxExcluded: f.taxExcluded,
                    notes: '', description: f.description, image: f.image, warehouseId: f.warehouseId || warehouses.find(w => w.isDefault)?.id || '',
                });
            });
            toast({ title: `✅ تم إضافة ${validUnits.length} وحدة` });
        }
        
        closeForm();
        refreshData();
    };

    const handleStrictFormSubmit = () => {
        const category = f.category.trim();
        const name = f.name.trim();
        const baseBarcode = f.barcode.trim();
        const baseColor = f.color.trim();
        const baseModel = f.model.trim();
        const baseBrand = f.brand.trim();
        const baseSupplier = f.supplier.trim();
        const baseSource = f.source.trim();
        const baseStorage = f.storage.trim();
        const baseRam = f.ram.trim();
        const baseBoxNumber = f.boxNumber.trim();
        const baseDescription = f.description.trim();
        const baseWarehouseId = f.warehouseId.trim();
        const normalizedQuantity = Math.max(0, Math.round(Number(f.quantity) || 0));

        if (!category) { toast({ title: '⚠️ اختر تصنيفاً', variant: 'destructive' }); return; }
        if (!name) { toast({ title: '⚠️ أدخل اسم المنتج', variant: 'destructive' }); return; }
        if ([f.newCostPrice, f.salePrice, f.profitMargin, normalizedQuantity].some((value) => !Number.isFinite(value) || value < 0)) {
            toast({ title: '⚠️ القيم الرقمية لا يمكن أن تكون سالبة', variant: 'destructive' });
            return;
        }

        const normalizedUnits = units.map((unit) => ({
            imei1: normalizeIdentifier(unit.imei1),
            imei2: normalizeIdentifier(unit.imei2),
            color: unit.color.trim(),
            barcode: unit.barcode.trim(),
        }));

        if (editId) {
            const unit = normalizedUnits[0] || { imei1: '', imei2: '', color: '', barcode: '' };
            const serialNumber = unit.imei1 || normalizeIdentifier(f.serialNumber);
            const barcode = unit.barcode || baseBarcode;

            if (!serialNumber) {
                toast({ title: '⚠️ أدخل IMEI 1 للوحدة', variant: 'destructive' });
                return;
            }

            if (mobiles.some((item) => item.id !== editId && normalizeIdentifier(item.serialNumber) === serialNumber)) {
                toast({ title: '⚠️ رقم IMEI مستخدم بالفعل', variant: 'destructive' });
                return;
            }

            if (barcode && isBarcodeDuplicate(barcode, editId)) {
                toast({ title: '⚠️ الباركود مستخدم بالفعل', variant: 'destructive' });
                return;
            }

            updateMobile(editId, {
                name,
                barcode: barcode || undefined,
                deviceType: 'mobile',
                category,
                condition: f.condition,
                quantity: normalizedQuantity,
                storage: baseStorage,
                ram: baseRam,
                color: unit.color || baseColor,
                model: baseModel || undefined,
                brand: baseBrand || undefined,
                supplier: baseSupplier,
                oldCostPrice: f.oldCostPrice,
                newCostPrice: f.newCostPrice,
                salePrice: f.salePrice,
                profitMargin: f.profitMargin,
                serialNumber,
                imei2: unit.imei2 || undefined,
                boxNumber: baseBoxNumber || undefined,
                source: baseSource || undefined,
                taxExcluded: f.taxExcluded,
                notes: '',
                description: baseDescription,
                image: f.image,
                warehouseId: baseWarehouseId || undefined,
            });
            toast({ title: '✅ تم تعديل المنتج' });
        } else {
            const validUnits = normalizedUnits.filter((unit) => unit.imei1);
            if (validUnits.length === 0) {
                toast({ title: '⚠️ أدخل IMEI 1 لوحدة واحدة على الأقل', variant: 'destructive' });
                return;
            }

            const seenImeis = new Set<string>();
            for (const unit of validUnits) {
                if (seenImeis.has(unit.imei1)) {
                    toast({ title: '⚠️ يوجد IMEI مكرر داخل نفس العملية', variant: 'destructive' });
                    return;
                }
                seenImeis.add(unit.imei1);
            }

            const seenBarcodes = new Set<string>();
            for (const unit of validUnits) {
                if (!unit.barcode) continue;
                if (seenBarcodes.has(unit.barcode)) {
                    toast({ title: '⚠️ يوجد باركود مكرر داخل نفس العملية', variant: 'destructive' });
                    return;
                }
                seenBarcodes.add(unit.barcode);
            }

            if (validUnits.some((unit) => mobiles.some((item) => normalizeIdentifier(item.serialNumber) === unit.imei1))) {
                toast({ title: '⚠️ أحد أرقام IMEI مسجل بالفعل', variant: 'destructive' });
                return;
            }

            if (validUnits.some((unit) => unit.barcode && isBarcodeDuplicate(unit.barcode))) {
                toast({ title: '⚠️ أحد الباركودات مستخدم بالفعل', variant: 'destructive' });
                return;
            }

            validUnits.forEach((unit, index) => {
                addMobile({
                    name,
                    barcode: unit.barcode || genBarcode('MOB'),
                    deviceType: 'mobile',
                    category,
                    condition: f.condition,
                    quantity: 1,
                    storage: baseStorage,
                    ram: baseRam,
                    color: unit.color || baseColor,
                    model: baseModel || undefined,
                    brand: baseBrand || undefined,
                    supplier: baseSupplier,
                    oldCostPrice: f.oldCostPrice,
                    newCostPrice: f.newCostPrice,
                    salePrice: f.salePrice,
                    profitMargin: f.profitMargin,
                    serialNumber: unit.imei1,
                    imei2: unit.imei2 || undefined,
                    boxNumber: baseBoxNumber || undefined,
                    source: baseSource || undefined,
                    taxExcluded: f.taxExcluded,
                    notes: '',
                    description: baseDescription,
                    image: f.image,
                    warehouseId: baseWarehouseId || warehouses.find((warehouse) => warehouse.isDefault)?.id || '',
                });
            });
            toast({ title: `✅ تم إضافة ${validUnits.length} وحدة` });
        }

        closeForm();
        refreshData();
    };

    const openAdd = () => {
        setEditId(null);
        setSelectedDetails(null);
        setF(emptyForm);
        setPricingMode('sale');
        setCustomStorage(false);
        setCustomRam(false);
        setUnits([emptyUnit()]);
        setShowForm(true);
    };
    const openEdit = (item: InventoryViewItem) => {
        setEditId(item.id);
        setF({
            name: item.name, barcode: item.barcode || '', category: item.category,
            condition: item.condition, quantity: item.quantity,
            oldCostPrice: item.oldCostPrice, newCostPrice: item.newCostPrice, salePrice: item.salePrice, profitMargin: item.profitMargin,
            storage: item.storage || '', ram: item.ram || '', color: item.color || '',
            brand: item.brand || '', supplier: item.supplier || '', serialNumber: item.serialNumber || '',
            imei2: item._raw?.imei2 || '', model: item.model || '', description: item.description || '', image: item.image || '',
            boxNumber: item._raw?.boxNumber || '', source: item.source || '', taxExcluded: item._raw?.taxExcluded || false,
            notes: '', subcategory: '', warehouseId: item.warehouseId || '',
        });
        setUnits([{ imei1: item.serialNumber || '', imei2: item._raw?.imei2 || '', color: item.color || '', barcode: item.barcode || '' }]);
        setPricingMode('sale');
        setCustomStorage(!!item.storage && !STORAGE_OPTIONS.includes(item.storage));
        setCustomRam(!!item.ram && !RAM_OPTIONS.includes(item.ram));
        setShowForm(true);
    };
    const closeForm = () => {
        setShowForm(false);
        setPricingMode('sale');
    };

    const handleDelete = async (item: InventoryViewItem) => {
        const ok = await confirm({
            title: 'حذف منتج',
            message: `هل أنت متأكد من حذف "${item.name}"؟ لا يمكن التراجع.`,
            confirmLabel: 'حذف',
            danger: true,
        });
        if (!ok) return;
        deleteMobile(item.id);
        toast({ title: '🗑️ تم حذف المنتج' });
    };

    // ── Render ──
    return (
        <div className="animate-fade-in" dir="rtl">

            {/* ═══ Section Navigation ═══ */}
            <div className="flex gap-2 flex-wrap mb-4">
                <button onClick={() => navigate('/mobiles')}
                    className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-cyan-300 ring-offset-1">
                    <Smartphone className="h-4 w-4" /> الموبيلات
                </button>
                <button onClick={() => navigate('/mobiles/accessories')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-cyan-500 hover:text-white transition-all shadow-sm">
                    <Headphones className="h-4 w-4" /> الإكسسورات
                </button>
                <button onClick={() => navigate('/mobiles/spare-parts')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-orange-600 hover:text-white transition-all shadow-sm">
                    <Wrench className="h-4 w-4" /> قطع الغيار
                </button>
            </div>

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
                        <span className="text-blue-600 text-sm">📋</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">الأصناف المعروضة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{stats.totalTypes}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center shrink-0">
                        <span className="text-purple-600 text-sm">📦</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">إجمالي القطع</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{stats.totalItems}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-500/15 border border-amber-200 flex items-center justify-center shrink-0">
                        <span className="text-amber-600 text-sm">💰</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">إجمالي التكلفة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{fmt(stats.totalCost)}</p>
                    </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                        <span className="text-emerald-600 text-sm">💎</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold">قيمة البيع المتوقعة</p>
                        <p className="text-xl font-black text-foreground tabular-nums">{fmt(stats.totalSale)}</p>
                    </div>
                </div>
            </div>

            {/* ─── Action Buttons Row ─── */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button data-testid="mobiles-create-product" onClick={openAdd}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
                    <Plus className="h-3.5 w-3.5" /> إضافة منتج
                </button>
                <button onClick={() => setShowExcelRestore(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all shadow-sm">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> استرداد Excel
                </button>
                <button onClick={() => exportToExcel({ data: prepareConditionForExport(mobiles), columns: MOBILE_COLUMNS, fileName: 'الموبايلات' })}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all shadow-sm">
                    <Download className="h-3.5 w-3.5" /> تصدير Excel
                </button>
                <button onClick={() => setShowCatManager(true)}
                    className="flex items-center gap-1.5 rounded-xl border border-dashed border-primary/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5 transition-all">
                    <Tag className="h-3.5 w-3.5" /> التصنيفات ({categories.length})
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
            {showFilters && (
                <div className="mb-4 lg:hidden">
                    <FilterBar
                        fields={filterFields}
                        onReset={resetFilters}
                        activeCount={activeFiltersCount}
                    />
                </div>
            )}

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

                            {/* Brand */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <Smartphone className="h-3 w-3 text-primary" /> الشركة (البراند)
                                </label>
                                <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className={`${IC} text-xs`}>
                                    <option value="all">عرض الكل</option>
                                    {uniqueBrands.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Supplier */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <Package className="h-3 w-3 text-primary" /> المورد
                                </label>
                                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className={`${IC} text-xs`}>
                                    <option value="all">عرض الكل</option>
                                    {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Source */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    📍 المصدر
                                </label>
                                <select value={filterSource} onChange={e => setFilterSource(e.target.value)} className={`${IC} text-xs`}>
                                    <option value="all">عرض الكل</option>
                                    {uniqueSources.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>

                            {/* Condition */}
                            <div>
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground mb-1">
                                    <SlidersHorizontal className="h-3 w-3 text-primary" /> حالة الجهاز
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {[{ v: 'all' as const, l: 'الكل' }, { v: 'new' as const, l: 'جديد' }, { v: 'like_new' as const, l: 'مثل الجديد' }, { v: 'used' as const, l: 'مستعمل' }, { v: 'broken' as const, l: 'معطل' }].map(opt => (
                                        <button key={opt.v} onClick={() => setFilterCondition(opt.v)}
                                            className={`flex-auto px-2 min-w-[30%] py-1.5 text-[11px] font-bold rounded-lg border transition-all ${filterCondition === opt.v
                                                ? opt.v === 'used' || opt.v === 'broken' ? 'bg-orange-100 text-orange-700 border-orange-300' : opt.v === 'new' || opt.v === 'like_new' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-primary/10 text-primary border-primary/30'
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
                                <select value={filterStock} onChange={e => setFilterStock(e.target.value as typeof filterStock)} className={`${IC} text-xs`}>
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
                    <p className="sm:hidden text-[11px] text-muted-foreground mb-2">اسحب أفقياً لعرض بقية التصنيفات.</p>
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
                        {categories.map((c, i) => (
                            <button key={i} onClick={() => setActiveFilter(c)}
                                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold border transition-all flex items-center gap-2 ${activeFilter === c ? 'bg-cyan-50 text-cyan-700 border-cyan-300 shadow-sm' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'}`}>
                                <Smartphone className="h-4 w-4 opacity-70" />
                                {c}
                            </button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="ابحث باسم المنتج"
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
                            ) : paginatedItems.map(item => (
                                <InventoryProductCard key={item.id} item={item}
                                    onDetails={() => openDetails(item)}
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
                                            <th className="px-3 py-3 text-right">سعر البيع</th>
                                            <th className="px-3 py-3 text-right">هامش الربح</th>
                                            <th className="px-3 py-3 text-left">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredList.length === 0 ? (
                                            <tr><td colSpan={11} className="py-14 text-center text-muted-foreground">لا توجد منتجات</td></tr>
                                        ) : paginatedItems.map((item, i) => {
                                            const avgCost = normalizeCostPrice(getWeightedAvgCost(item.id), item.newCostPrice);
                                            const profit = typeof item.profitMargin === 'number' ? item.profitMargin : calculateProfitAmount(avgCost, item.salePrice);
                                            const margin = calculateMarginPercent(avgCost, item.salePrice);
                                            const details = item._type === 'device'
                                                ? [item.storage, item.ram, item.color].filter(Boolean).join(' · ')
                                                : [item.model, item.color].filter(Boolean).join(' · ');
                                            return (
                                                <tr key={item.id} onClick={() => openDetails(item)} className={`border-b border-border/40 cursor-pointer transition-colors hover:bg-muted/20 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
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
                                                    <td className="px-3 py-2 text-xs font-semibold text-primary">{item.category || '—'}</td>
                                                    <td className="px-3 py-2">
                                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getProductConditionBadgeClass(item.condition)}`}>
                                                            {getProductConditionLabel(item.condition)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono">
                                                        <div>{item.serialNumber || '—'}</div>
                                                        {item._raw?.imei2 && <div className="text-muted-foreground/60">{item._raw.imei2}</div>}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${item.quantity === 0 ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-muted text-foreground'}`}>{item.quantity}</span>
                                                    </td>
                                                    <td className="px-3 py-2 text-sm font-bold text-foreground tabular-nums">{item.salePrice.toLocaleString('ar-EG')}</td>
                                                    <td className="px-3 py-2 text-xs font-bold tabular-nums">
                                                        <span className={getMarginTone(margin)}>
                                                            {profit.toLocaleString('ar-EG')} ج.م • {margin.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-left">
                                                        <div className="flex justify-end gap-1">
                                                            <button onClick={(event) => { event.stopPropagation(); openDetails(item); }} className="rounded-lg p-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-600 transition-colors" title="تفاصيل"><Info className="h-3.5 w-3.5" /></button>
                                                            <button onClick={(event) => { event.stopPropagation(); setActiveBatchesModal({ id: item.id, name: item.name }); }} className="rounded-lg p-1.5 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 text-cyan-600 transition-colors" title="عرض الدفعات"><List className="h-3.5 w-3.5" /></button>
                                                            <button onClick={(event) => { event.stopPropagation(); openEdit(item); }} className="rounded-lg p-1.5 hover:bg-primary/10 text-primary transition-colors" title="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
                                                            <button onClick={(event) => { event.stopPropagation(); handleDelete(item); }} className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive transition-colors" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
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

                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPrev={prevPage}
                        onNext={nextPage}
                        onPage={setPage}
                    />

                </div>{/* end main content */}

            </div>{/* end flex layout */}

            {/* ─── Product Form Modal ─── */}
            {showForm && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/72 p-4 sm:p-6" onClick={closeForm}>
                    <div data-testid="mobiles-form-modal" className="my-2 w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in sm:my-4" onClick={e => e.stopPropagation()}>
                        <div className="flex-none flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
                            <h2 className="text-base font-bold text-foreground">
                                {editId ? '✏️ تعديل المنتج' : '➕ إضافة منتج'}
                            </h2>
                            <button onClick={closeForm} className="rounded-xl p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <ImageUpload value={f.image ?? ''} onChange={v => setF(p => ({ ...p, image: v ?? '' }))} />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">التصنيف *</label>
                                    <select data-testid="mobiles-category" value={f.category} onChange={e => setF(p => ({ ...p, category: e.target.value }))} className={IC}>
                                        <option value="">-- اختر --</option>
                                        {categories.map((c, i) => <option key={i} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <div className="flex flex-wrap gap-2 h-auto text-center mt-1">
                                                        {PRODUCT_CONDITION_OPTIONS.map((cond) => (
                                                            <button key={cond.value} type="button" onClick={() => setF(p => ({ ...p, condition: cond.value }))} className={`flex-1 py-1.5 rounded-xl border text-[13px] font-semibold transition-all ${f.condition === cond.value ? 'bg-primary/10 border-primary text-primary' : 'bg-transparent border-input text-muted-foreground'}`}>{cond.label}</button>
                                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            {editId && (
                                <div className="grid grid-cols-1">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">المخزن *</label>
                                        <select data-testid="mobiles-warehouse" value={f.warehouseId} onChange={e => setF(p => ({ ...p, warehouseId: e.target.value }))} className={IC}>
                                            <option value="">-- الافتراضي --</option>
                                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-border/50" />

                            <div className="grid grid-cols-2 gap-3">
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">اسم المنتج *</label><input data-testid="mobiles-name" data-validation="text-only" value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} className={IC} autoFocus /></div>
                                <div><label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الباركود</label><input data-testid="mobiles-barcode" value={f.barcode} onChange={e => setF(p => ({ ...p, barcode: e.target.value }))} placeholder="اتركه فارغاً للتوليد التلقائي" className={`${IC} font-mono`} /></div>
                            </div>

                            <div className="border-t border-border/50" />

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3 rounded-xl border border-border/40">
                                        <div className="col-span-full mb-1"><span className="text-xs font-bold text-primary flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> مواصفات الجهاز</span></div>
                                        {/* التخزين */}
                                        <div>
                                            <label className="mb-1 block text-xs text-muted-foreground">التخزين</label>
                                            <select data-testid="mobiles-storage" value={customStorage ? '__other__' : f.storage} onChange={e => { const v = e.target.value; if (v === '__other__') { setCustomStorage(true); setF(p => ({ ...p, storage: '' })); } else { setCustomStorage(false); setF(p => ({ ...p, storage: v })); } }} className={IC}>
                                                <option value="">-- اختر --</option>
                                                {STORAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                <option value="__other__">أخرى...</option>
                                            </select>
                                            {customStorage && (
                                                <input value={f.storage} onChange={e => setF(p => ({ ...p, storage: e.target.value }))} placeholder="أدخل الحجم..." className={`${IC} mt-1.5`} autoFocus />
                                            )}
                                        </div>
                                        {/* الرام */}
                                        <div>
                                            <label className="mb-1 block text-xs text-muted-foreground">الرام</label>
                                            <select data-testid="mobiles-ram" value={customRam ? '__other__' : f.ram} onChange={e => { const v = e.target.value; if (v === '__other__') { setCustomRam(true); setF(p => ({ ...p, ram: '' })); } else { setCustomRam(false); setF(p => ({ ...p, ram: v })); } }} className={IC}>
                                                <option value="">-- اختر --</option>
                                                {RAM_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                                <option value="__other__">أخرى...</option>
                                            </select>
                                            {customRam && (
                                                <input value={f.ram} onChange={e => setF(p => ({ ...p, ram: e.target.value }))} placeholder="أدخل الرام..." className={`${IC} mt-1.5`} autoFocus />
                                            )}
                                        </div>
                                        {/* اللون */}
                                        <div><label className="mb-1 block text-xs text-muted-foreground">اللون</label><input data-validation="text-only" value={f.color} onChange={e => setF(p => ({ ...p, color: e.target.value }))} className={IC} /></div>
                                        <div><label className="mb-1 block text-xs text-muted-foreground">الموديل</label><input data-testid="mobiles-model" value={f.model} onChange={e => setF(p => ({ ...p, model: e.target.value }))} className={IC} /></div>
                                        {/* الشركة (البراند) — يدوي + datalist */}
                                        <div>
                                            <label className="mb-1 block text-xs text-muted-foreground">الشركة (البراند)</label>
                                            <input value={f.brand} onChange={e => setF(p => ({ ...p, brand: e.target.value }))} list="brand-list" placeholder="اكتب أو اختر..." className={IC} />
                                            <datalist id="brand-list">
                                                {BRAND_OPTIONS.map(b => <option key={b} value={b} />)}
                                                {uniqueBrands.filter(b => !BRAND_OPTIONS.includes(b)).map(b => <option key={b} value={b} />)}
                                            </datalist>
                                        </div>
                                        {/* المورد */}
                                        <div>
                                            <label className="mb-1 block text-xs text-muted-foreground">المورد</label>
                                            <input value={f.supplier} onChange={e => setF(p => ({ ...p, supplier: e.target.value }))} list="supplier-list" placeholder="اسم المورد..." className={IC} />
                                            <datalist id="supplier-list">
                                                {uniqueSuppliers.map(s => <option key={s} value={s} />)}
                                            </datalist>
                                        </div>
                                        {/* رقم الكرتونة */}
                                        <div><label className="mb-1 block text-xs text-muted-foreground">رقم الكرتونة</label><input value={f.boxNumber} onChange={e => setF(p => ({ ...p, boxNumber: e.target.value }))} className={IC} /></div>
                                        {/* المصدر */}
                                        <div>
                                            <label className="mb-1 block text-xs text-muted-foreground">المصدر</label>
                                            <input value={f.source} onChange={e => setF(p => ({ ...p, source: e.target.value }))} list="source-list" placeholder="اكتب أو اختر..." className={IC} />
                                            <datalist id="source-list">
                                                {uniqueSources.map(s => <option key={s} value={s} />)}
                                            </datalist>
                                        </div>
                                        {/* الضريبة */}
                                        <div className="col-span-1 flex items-end pb-3">
                                            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                                                <input type="checkbox" checked={f.taxExcluded} onChange={e => setF(p => ({ ...p, taxExcluded: e.target.checked }))} className="rounded border-border text-primary focus:ring-primary w-4 h-4" />
                                                الضريبة غير شاملة
                                            </label>
                                        </div>
                                    </div>
                                    {/* ─── جدول الوحدات (IMEI) ─── */}
                                    <div className="bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/20 dark:border-primary/30 p-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-primary flex items-center gap-1">📱 بيانات الوحدات ({units.length})</span>
                                            {!editId && (
                                                <button type="button" onClick={() => setUnits(u => [...u, emptyUnit()])}
                                                    className="flex items-center gap-1 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary px-2.5 py-1 text-[10px] font-bold hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors">
                                                    <Plus className="h-3 w-3" /> وحدة جديدة
                                                </button>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto rounded-lg border border-border bg-card">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-muted/30 border-b border-border">
                                                        <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground w-6">#</th>
                                                        <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">IMEI 1 *</th>
                                                        <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">IMEI 2</th>
                                                        <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">اللون</th>
                                                        <th className="px-2 py-1.5 text-right font-semibold text-muted-foreground">الباركود</th>
                                                        {!editId && units.length > 1 && <th className="px-1 py-1.5 w-8"></th>}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {units.map((u, idx) => (
                                                        <tr key={idx} className="border-b border-border/40 last:border-0">
                                                            <td className="px-2 py-1 text-center font-bold text-muted-foreground">{idx + 1}</td>
                                                            <td className="px-1 py-1"><input data-testid={`mobiles-unit-imei1-${idx}`} value={u.imei1} onChange={e => { const v = e.target.value; setUnits(us => us.map((uu, i) => i === idx ? { ...uu, imei1: v } : uu)); }} placeholder="IMEI 1" className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" /></td>
                                                            <td className="px-1 py-1"><input value={u.imei2} onChange={e => { const v = e.target.value; setUnits(us => us.map((uu, i) => i === idx ? { ...uu, imei2: v } : uu)); }} placeholder="اختياري" className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" /></td>
                                                            <td className="px-1 py-1"><input value={u.color} onChange={e => { const v = e.target.value; setUnits(us => us.map((uu, i) => i === idx ? { ...uu, color: v } : uu)); }} placeholder="اللون" className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" /></td>
                                                            <td className="px-1 py-1"><input value={u.barcode} onChange={e => { const v = e.target.value; setUnits(us => us.map((uu, i) => i === idx ? { ...uu, barcode: v } : uu)); }} placeholder="تلقائي" className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" /></td>
                                                            {!editId && units.length > 1 && (
                                                                <td className="px-1 py-1 text-center">
                                                                    <button type="button" onClick={() => setUnits(us => us.filter((_, i) => i !== idx))}
                                                                        className="rounded-md p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors">
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                </td>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">💡 كل وحدة تُسجَّل كسجل منفصل في المخزون بـ IMEI خاص بها</p>
                                    </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1"><AlignLeft className="h-3 w-3" /> ملاحظات / تفاصيل</label>
                                <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} rows={2} className={`${IC} resize-none`} />
                            </div>

                            <div className={`grid gap-3 ${editId ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
                                {editId && (
                                    <div>
                                        <label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">الكمية</label>
                                        <input type="number" min={0} value={f.quantity} onChange={e => setF(p => ({ ...p, quantity: +e.target.value }))} className={IC} />
                                    </div>
                                )}
                                <div><label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">سعر الشراء</label><input data-testid="mobiles-cost" type="number" min={0} value={f.newCostPrice} onChange={e => setCostPriceValue(+e.target.value)} className={IC} /></div>
                                <div><label className="mb-1 block text-xs font-bold text-primary uppercase">سعر البيع</label><input data-testid="mobiles-sale" type="number" min={0} value={f.salePrice} onChange={e => setSalePriceValue(+e.target.value)} className={`${IC} border-primary/40 focus:ring-primary`} /></div>
                                <div><label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">هامش الربح</label><input type="number" min={0} value={f.profitMargin} onChange={e => setProfitMarginValue(+e.target.value)} className={IC} /></div>
                            </div>
                            {/* هامش الربح المحسوب */}
                            {(() => {
                                const cost = f.newCostPrice || 0;
                                const profit = f.salePrice - cost;
                                const margin = f.salePrice > 0 ? (profit / f.salePrice) * 100 : 0;
                                return f.salePrice > 0 ? (
                                    <div className="col-span-full p-3 rounded-lg bg-muted/50 mt-2 flex justify-between items-center">
                                        <div className="text-right">
                                            <span className="block text-sm font-bold text-muted-foreground">هامش الربح</span>
                                            {margin < 10 && (
                                                <span className="block text-xs text-amber-600 mt-1">تحذير: الهامش أقل من 10%</span>
                                            )}
                                        </div>
                                        <span className={`text-lg font-black tabular-nums ${margin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : margin >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-500'}`}>
                                            {margin.toFixed(1)}%
                                        </span>
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        <div className="flex-none flex gap-2 px-4 py-4 border-t border-border bg-muted/10 rounded-b-2xl">
                            <button data-testid="mobiles-save" onClick={handleStrictFormSubmit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-md">
                                <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                            </button>
                            <button onClick={closeForm}
                                className="flex-none rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors bg-card">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {selectedDetails && (
                <ProductDetailsModal
                    product={selectedDetails}
                    onClose={() => setSelectedDetails(null)}
                />
            )}

            {/* Categories Manager Modal */}
            {showCatManager && (
                <MobilesCategoriesManager
                    cats={categories}
                    onSave={handleSaveCats}
                    onClose={() => setShowCatManager(false)}
                />
            )}

            {/* Product Batches Modal */}
            {
                activeBatchesModal && (
                    <ProductBatchesModal
                        productId={activeBatchesModal.id}
                        productName={activeBatchesModal.name}
                        onClose={() => setActiveBatchesModal(null)}
                    />
                )
            }

            {/* Excel Restore */}
            <ExcelColumnMappingDialog
                open={showExcelRestore}
                onOpenChange={setShowExcelRestore}
                inventoryType="mobile"
                onSuccess={() => undefined}
                onDataSave={(data) => {
                    data.forEach(row => {
                        const mobile: Omit<MobileItem, 'id' | 'createdAt' | 'updatedAt'> = {
                            name: row.name || '', barcode: row.barcode || '', deviceType: row.deviceType || 'mobile',
                            category: row.category || '', condition: row.condition || 'new',
                            quantity: Number(row.quantity) || 0, storage: row.storage || '', ram: row.ram || '',
                            color: row.color || '', model: row.model || '', supplier: row.supplier || '',
                            oldCostPrice: Number(row.oldCostPrice) || 0, newCostPrice: Number(row.newCostPrice) || 0,
                            salePrice: Number(row.salePrice) || 0, profitMargin: Number(row.profitMargin) || 0, serialNumber: row.serialNumber || '',
                            boxNumber: row.boxNumber || '', source: row.source || '', taxExcluded: row.taxExcluded === 'true' || row.taxExcluded === true,
                            notes: row.notes || '', description: row.description || '',
                        };
                        addMobile(mobile);
                    });
                }}
            />
        </div >
    );
}
