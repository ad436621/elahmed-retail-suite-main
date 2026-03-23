// ============================================================
// DevicesInventory — Optimized Version with Professional UI/UX
// ============================================================

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Tv, Plus, Search, Trash2, Pencil, X, Check, LayoutGrid, List, Tag,
    FileSpreadsheet, Download, Upload, ShoppingCart, RefreshCw, Filter,
    CheckCircle, Package, AlertCircle, MoreHorizontal, Headphones, Wrench
} from 'lucide-react';
import { exportToExcel, DEVICE_COLUMNS, prepareConditionForExport } from '@/services/excelService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { ImageUpload } from '@/components/ImageUpload';
import {
    getDevices, addDevice, updateDevice, deleteDevice,
} from '@/data/devicesData';
import { getWarehouses, Warehouse } from '@/data/warehousesData';
import { DeviceItem } from '@/domain/types';
import { loadCats, saveCats } from '@/data/categoriesData';
import { getWeightedAvgCost } from '@/data/batchesData';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { isBarcodeDuplicate } from '@/repositories/productRepository';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import { StatCard } from '@/components/StatCard';

// Types
type ViewMode = 'grid' | 'table' | 'compact';
type ConditionFilter = 'all' | 'new' | 'used';

interface DeviceFormData {
    name: string;
    model: string;
    barcode: string;
    category: string;
    condition: 'new' | 'used';
    color: string;
    quantity: number;
    oldCostPrice: number;
    newCostPrice: number;
    salePrice: number;
    notes: string;
    description: string;
    image?: string;
    warehouseId: string;
}

const emptyForm = (): DeviceFormData => ({
    name: '', model: '', barcode: '', category: '',
    condition: 'new', color: '', quantity: 1,
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    notes: '', description: '', image: undefined, warehouseId: ''
});

// Accent styles for orange theme
const accentStyles = {
    iconBg: 'bg-orange-100 dark:bg-orange-500/15',
    iconText: 'text-orange-600 dark:text-orange-400',
    filterActive: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30',
    categoryActive: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-500/30',
};

// Optimized Device Card with memo
const DeviceCard = memo(function DeviceCard({
    item,
    onEdit,
    onDelete,
    onAddToCart,
    onShowBatches
}: {
    item: DeviceItem;
    onEdit: () => void;
    onDelete: () => void;
    onAddToCart: () => void;
    onShowBatches: () => void;
}) {
    const avgCost = getWeightedAvgCost(item.id);
    const profit = item.salePrice - (item.condition === 'used' ? item.oldCostPrice : avgCost);
    const margin = item.salePrice > 0 ? ((profit / item.salePrice) * 100) : 0;

    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative">
            {/* Top-left badges */}
            <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
                <Badge variant={item.condition === 'used' ? 'secondary' : 'default'}
                    className={item.condition === 'used' ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}>
                    {item.condition === 'used' ? 'مستعمل' : 'جديد'}
                </Badge>
                <Badge variant="outline" className="bg-white/80 backdrop-blur text-xs truncate max-w-[80px]">
                    {item.category || 'بدون'}
                </Badge>
            </div>

            {/* Image area */}
            <div className="relative h-40 w-full bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
                {item.image ? (
                    <img src={item.image} alt={item.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <Tv className="h-12 w-12 text-muted-foreground/20" />
                    </div>
                )}
                {/* Stock badge */}
                <Badge className={`absolute top-2 right-2 ${item.quantity === 0 ? 'bg-red-500' : 'bg-orange-500'}`}>
                    {item.quantity === 0 ? 'نفد' : `${item.quantity} وحدة`}
                </Badge>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 p-4 gap-2">
                <div>
                    <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2">{item.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{item.model}</p>
                </div>

                {/* Price row */}
                <div className="mt-auto pt-3 border-t border-border/40">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-l from-orange-600 to-amber-500">
                            {item.salePrice.toLocaleString('ar-EG')}
                            <span className="text-xs font-bold text-muted-foreground mr-1">ج.م</span>
                        </span>
                        <Badge variant="outline" className={`text-xs font-bold border-0 shadow-sm ${margin >= 20 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : margin >= 10 ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : 'bg-red-50 text-red-500 dark:bg-red-500/10'}`}>
                            الربح {margin.toFixed(1)}%
                        </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="flex-1 h-8" onClick={onAddToCart}>
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            إضافة
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onEdit}>
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            onClick={onDelete}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// ─── Device Categories Manager Modal ─────────────────────────

function DeviceCategoriesManager({
    cats, onSave, onClose,
}: {
    cats: string[];
    onSave: (cats: string[]) => void;
    onClose: () => void;
}) {
    const [list, setList] = useState<string[]>([...cats]);
    const [newName, setNewName] = useState('');
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [editVal, setEditVal] = useState('');

    const addCat = () => {
        const n = newName.trim();
        if (!n || list.includes(n)) return;
        setList(l => [...l, n]);
        setNewName('');
    };
    const deleteCat = (idx: number) => { 
        setList(l => l.filter((_, i) => i !== idx));
        if (editIndex === idx) setEditIndex(null); 
    };
    const startEdit = (idx: number, val: string) => { setEditIndex(idx); setEditVal(val); };
    const saveEdit = () => {
        if (editIndex === null) return;
        const n = editVal.trim();
        if (!n || (list.includes(n) && list.indexOf(n) !== editIndex)) return;
        setList(l => l.map((c, i) => i === editIndex ? n : c));
        setEditIndex(null);
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Tag className="h-5 w-5 text-orange-500" />
                        <h3 className="text-base font-bold">إدارة تصنيفات الأجهزة</h3>
                        <span className="rounded-full bg-orange-100 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5">{list.length}</span>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div className="px-5 pt-4 pb-3 space-y-2.5">
                    <div className="flex gap-2">
                        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCat()}
                            placeholder="اسم التصنيف الجديد..." className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30" autoFocus />
                        <button onClick={addCat} className="flex items-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 px-4 py-2 text-sm font-bold text-white transition-colors">
                            <Plus className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="px-5 pb-4 space-y-1.5 max-h-72 overflow-y-auto">
                    {list.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تصنيفات بعد</p>}
                    {list.map((cat, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 group hover:border-orange-300 dark:hover:border-orange-500/30 transition-colors">
                            {editIndex === idx ? (
                                <div className="flex-1 space-y-1.5">
                                    <input value={editVal} onChange={e => setEditVal(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditIndex(null); }}
                                        className="w-full rounded-lg border border-orange-400 px-2 py-1 text-sm focus:outline-none bg-background" autoFocus />
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center gap-2">
                                    <span className={`shrink-0 h-5 w-5 rounded-full flex items-center justify-center bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400`}>
                                        <Tv className="h-3 w-3" />
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-foreground">{cat}</span>
                                </div>
                            )}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {editIndex === idx ? (
                                    <>
                                        <button onClick={saveEdit} className="rounded-md p-1 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600"><Check className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => setEditIndex(null)} className="rounded-md p-1 hover:bg-muted text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                                    </>
                                ) : (
                                    <>
                                        <button onClick={() => startEdit(idx, cat)} className="rounded-md p-1 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-orange-600"><Pencil className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => deleteCat(idx)} className="rounded-md p-1 hover:bg-red-50 dark:hover:bg-red-500/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 px-5 pb-5">
                    <button onClick={() => onSave(list)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-600 hover:bg-orange-700 py-2.5 text-sm font-bold text-white transition-colors">
                        <Check className="h-4 w-4" /> حفظ التصنيفات
                    </button>
                    <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted transition-colors">إلغاء</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

// Main Component
export default function DevicesInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    // Data
    const devices = getDevices();
    const [categories, setCategories] = useState<string[]>(() => loadCats('devices_cats', ['شاشات', 'ريسيفرات', 'راوترات']));
    const [showCatManager, setShowCatManager] = useState(false);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(console.error);
    }, []);

    const handleSaveCats = useCallback((updated: string[]) => {
        saveCats('devices_cats', updated);
        setCategories(updated);
        setShowCatManager(false);
        toast({ title: '✅ تم حفظ التصنيفات', description: `${updated.length} تصنيف` });
    }, [toast]);

    // State
    const [search, setSearch] = useState('');
    const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    // Dialogs
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isExcelOpen, setIsExcelOpen] = useState(false);
    const [isBatchesOpen, setIsBatchesOpen] = useState(false);

    // Form
    const [form, setForm] = useState<DeviceFormData>(emptyForm());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<DeviceItem | null>(null);

    // Debounce
    const debouncedSearch = useDebounce(search, 300);

    // Computed values
    const filteredDevices = useMemo(() => {
        return devices.filter(d => {
            const matchesSearch = !debouncedSearch ||
                d.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                d.model?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                d.barcode?.includes(debouncedSearch);

            const matchesCondition = conditionFilter === 'all' ||
                (conditionFilter === 'used' ? d.condition === 'used' : d.condition === 'new');

            const matchesCategory = categoryFilter === 'all' || d.category === categoryFilter;

            return matchesSearch && matchesCondition && matchesCategory;
        });
    }, [devices, debouncedSearch, conditionFilter, categoryFilter]);

    const stats = useMemo(() => ({
        total: devices.length,
        available: devices.filter(d => d.quantity > 0).length,
        used: devices.filter(d => d.condition === 'used').length,
    }), [devices]);

    // Handlers
    const handleOpenForm = useCallback((item?: DeviceItem) => {
        if (item) {
            setEditingId(item.id);
            setForm({
                name: item.name,
                model: item.model || '',
                barcode: item.barcode,
                category: item.category,
                condition: item.condition || 'new',
                color: item.color || '',
                quantity: item.quantity,
                oldCostPrice: item.oldCostPrice || 0,
                newCostPrice: item.newCostPrice || 0,
                salePrice: item.salePrice,
                notes: item.notes || '',
                description: item.description || '',
                image: item.image,
                warehouseId: item.warehouseId || '',
            });
        } else {
            setEditingId(null);
            setForm({
                ...emptyForm(),
                barcode: crypto.randomUUID().slice(0, 8).toUpperCase(),
            });
        }
        setIsFormOpen(true);
    }, []);

    const handleSave = useCallback(() => {
        if (!form.name || !form.category) {
            toast({ title: 'خطأ', description: 'الاسم والفئة مطلوبة', variant: 'destructive' });
            return;
        }

        if (isBarcodeDuplicate(form.barcode, editingId || '')) {
            toast({ title: 'خطأ', description: 'الباركود مستخدم من قبل', variant: 'destructive' });
            return;
        }

        const payload = {
            name: form.name,
            model: form.model,
            barcode: form.barcode,
            category: form.category,
            condition: form.condition,
            color: form.color,
            quantity: form.quantity,
            oldCostPrice: form.condition === 'used' ? form.oldCostPrice : 0,
            newCostPrice: form.condition === 'used' ? 0 : form.newCostPrice,
            salePrice: form.salePrice,
            notes: form.notes,
            description: form.description,
            image: form.image,
            warehouseId: form.warehouseId || warehouses.find(w => w.isDefault)?.id || '',
        };

        if (editingId) {
            updateDevice(editingId, payload);
            toast({ title: '✅ تم التحديث', description: 'تم تعديل الجهاز بنجاح' });
        } else {
            addDevice(payload);
            toast({ title: '✅ تم الإضافة', description: 'تم إضافة الجهاز بنجاح' });
        }

        setIsFormOpen(false);
        window.location.reload();
    }, [form, editingId, toast]);

    const handleDelete = useCallback(() => {
        if (selectedProduct) {
            deleteDevice(selectedProduct.id);
            toast({ title: '✅ تم الحذف', description: 'تم حذف الجهاز بنجاح' });
            setIsDeleteOpen(false);
            setSelectedProduct(null);
            window.location.reload();
        }
    }, [selectedProduct, toast]);

    const handleAddToCart = useCallback((item: DeviceItem) => {
        // TODO: Add to cart using CartContext
        toast({ title: '🛒 تمت الإضافة', description: `تم إضافة ${item.name} للسلة` });
    }, [toast]);

    const handleShowBatches = useCallback((item: DeviceItem) => {
        setSelectedProduct(item);
        setIsBatchesOpen(true);
    }, []);

    // Profit calculation for form
    const profitMargin = useMemo(() => {
        const cost = form.condition === 'used' ? form.oldCostPrice : form.newCostPrice;
        if (form.salePrice <= 0) return 0;
        return ((form.salePrice - cost) / form.salePrice) * 100;
    }, [form.salePrice, form.newCostPrice, form.oldCostPrice, form.condition]);

    return (
        <div className="min-h-screen bg-background" dir="rtl">

            {/* ═══ Sub-section Navigation ═══ */}
            <div className="flex gap-2 flex-wrap px-4 pt-4">
                <button onClick={() => navigate('/devices')}
                    className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-orange-300 ring-offset-1">
                    <Tv className="h-4 w-4" /> الأجهزة والمنزلية
                </button>
                <button onClick={() => navigate('/devices/accessories')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-orange-500 hover:text-white transition-all shadow-sm">
                    <Headphones className="h-4 w-4" /> الإكسسورات
                </button>
                <button onClick={() => navigate('/devices/spare-parts')}
                    className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-red-600 hover:text-white transition-all shadow-sm">
                    <Wrench className="h-4 w-4" /> قطع الغيار
                </button>
            </div>

            <div className="border-b dark:border-white/5 bg-background/60 dark:bg-background/40 backdrop-blur-xl sticky top-0 z-40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 group">
                            <div className={`p-3 rounded-2xl ${accentStyles.iconBg} shadow-inner transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3`}>
                                <Tv className={`h-7 w-7 ${accentStyles.iconText}`} />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-l from-orange-600 to-amber-400 drop-shadow-sm tracking-tight">الأجهزة والمنزلية</h1>
                                <p className="text-sm font-medium text-muted-foreground mt-0.5">إدارة مخزون الأجهزة بفاعلية وتقنيات حديثة</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsExcelOpen(true)}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Excel
                            </Button>
                            <Button variant="outline" onClick={() => exportToExcel({ data: prepareConditionForExport(devices), columns: DEVICE_COLUMNS, fileName: 'الأجهزة' })} className="border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                                <Download className="h-4 w-4 mr-2" />
                                تصدير Excel
                            </Button>
                            <Button onClick={() => handleOpenForm()}>
                                <Plus className="h-4 w-4 mr-2" />
                                إضافة جهاز
                            </Button>
                            <Button variant="outline" onClick={() => setShowCatManager(true)}>
                                <Filter className="h-4 w-4 mr-2" />
                                التصنيفات ({categories.length})
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard
                        title="إجمالي الأجهزة"
                        value={stats.total.toString()}
                        icon={Tv}
                        variant="amber"
                    />
                    <StatCard
                        title="متاح للبيع"
                        value={stats.available.toString()}
                        icon={CheckCircle}
                        variant="green"
                    />
                    <StatCard
                        title="مستعمل"
                        value={stats.used.toString()}
                        icon={RefreshCw}
                        variant="purple"
                    />
                </div>

                {/* Tabs & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-end">                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="بحث..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-48 pr-9"
                            />
                        </div>

                        {/* Condition Filter */}
                        <Select value={conditionFilter} onValueChange={(v) => setConditionFilter(v as ConditionFilter)}>
                            <SelectTrigger className="w-32">
                                <SelectValue placeholder="الحالة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">الكل</SelectItem>
                                <SelectItem value="new">جديد</SelectItem>
                                <SelectItem value="used">مستعمل</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Category Filter */}
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                            <SelectTrigger className="w-40">
                                <SelectValue placeholder="الفئة" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">كل الفئات</SelectItem>
                                {categories.map((cat, i) => (
                                    <SelectItem key={i} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* View Mode Toggle */}
                        <div className="flex border border-border rounded-lg p-1">
                            <Button
                                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'table' ? 'default' : 'ghost'}
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => setViewMode('table')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Results count */}
                <div className="text-sm text-muted-foreground">
                    عرض {filteredDevices.length} من {devices.length} جهاز
                </div>

                {/* Content */}
                        {filteredDevices.length === 0 ? (
                            <div className="text-center py-12">
                                <Tv className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                                <h3 className="text-lg font-semibold text-muted-foreground">لا توجد أجهزة</h3>
                                <p className="text-sm text-muted-foreground/60">أضف جهاز جديد للبدء</p>
                            </div>
                        ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                {filteredDevices.map(device => (
                                    <DeviceCard
                                        key={device.id}
                                        item={device}
                                        onEdit={() => handleOpenForm(device)}
                                        onDelete={() => { setSelectedProduct(device); setIsDeleteOpen(true); }}
                                        onAddToCart={() => handleAddToCart(device)}
                                        onShowBatches={() => handleShowBatches(device)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-xl border border-border overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="text-right">الاسم</TableHead>
                                            <TableHead className="text-right">الموديل</TableHead>
                                            <TableHead className="text-right">الفئة</TableHead>
                                            <TableHead className="text-right">الحالة</TableHead>
                                            <TableHead className="text-right">الكمية</TableHead>
                                            <TableHead className="text-right">التكلفة</TableHead>
                                            <TableHead className="text-right">السعر</TableHead>
                                            <TableHead className="text-right">الربح</TableHead>
                                            <TableHead className="text-center">إجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredDevices.map(device => {
                                            const cost = device.condition === 'used' ? device.oldCostPrice : getWeightedAvgCost(device.id);
                                            const profit = device.salePrice - cost;
                                            const margin = device.salePrice > 0 ? (profit / device.salePrice) * 100 : 0;
                                            return (
                                                <TableRow key={device.id} className="hover:bg-muted/30">
                                                    <TableCell className="font-medium">{device.name}</TableCell>
                                                    <TableCell>{device.model}</TableCell>
                                                    <TableCell>{device.category}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={device.condition === 'used' ? 'secondary' : 'default'}
                                                            className={device.condition === 'used' ? 'bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'}>
                                                            {device.condition === 'used' ? 'مستعمل' : 'جديد'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={device.quantity === 0 ? 'text-red-500' : ''}>
                                                            {device.quantity}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{cost.toLocaleString('ar-EG')}</TableCell>
                                                    <TableCell className="font-bold">{device.salePrice.toLocaleString('ar-EG')}</TableCell>
                                                    <TableCell>
                                                        <span className={margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-500'}>
                                                            {margin.toFixed(1)}%
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex gap-1 justify-center">
                                                            <Button size="sm" variant="ghost" onClick={() => handleOpenForm(device)}>
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button size="sm" variant="ghost"
                                                                className="text-red-500 hover:text-red-600"
                                                                onClick={() => { setSelectedProduct(device); setIsDeleteOpen(true); }}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
            </div>

            {/* Add/Edit Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingId ? 'تعديل جهاز' : 'إضافة جهاز جديد'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="col-span-2">
                            <label className="text-sm font-medium mb-1.5 block">اسم الجهاز *</label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="مثل: تلفزيون سامسونج 55 بوصة"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">الموديل</label>
                            <Input
                                value={form.model}
                                onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                                placeholder="مثل: UA55TU8000"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">الباركود</label>
                            <div className="flex gap-2">
                                <Input
                                    value={form.barcode}
                                    onChange={(e) => setForm(f => ({ ...f, barcode: e.target.value }))}
                                    placeholder=" barcode"
                                />
                                <Button variant="outline" onClick={() => setForm(f => ({ ...f, barcode: crypto.randomUUID().slice(0, 8).toUpperCase() }))}>
                                    توليد
                                </Button>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">الفئة *</label>
                            <Select value={form.category} onValueChange={(v) => setForm(f => ({ ...f, category: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="اختر الفئة" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat, i) => (
                                        <SelectItem key={i} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">المخزن *</label>
                            <Select value={form.warehouseId} onValueChange={(v) => setForm(f => ({ ...f, warehouseId: v }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="-- الافتراضي --" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">الحالة</label>
                            <Select value={form.condition} onValueChange={(v) => setForm(f => ({ ...f, condition: v as 'new' | 'used' }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">جديد</SelectItem>
                                    <SelectItem value="used">مستعمل</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">اللون</label>
                            <Input
                                value={form.color}
                                onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                                placeholder="مثل: أسود"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">الكمية *</label>
                            <Input
                                type="number"
                                min="0"
                                value={form.quantity}
                                onChange={(e) => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))}
                            />
                        </div>

                        {form.condition === 'used' ? (
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">سعر التكلفة (مستعمل)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.oldCostPrice}
                                    onChange={(e) => setForm(f => ({ ...f, oldCostPrice: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">سعر التكلفة (جديد)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={form.newCostPrice}
                                    onChange={(e) => setForm(f => ({ ...f, newCostPrice: parseFloat(e.target.value) || 0 }))}
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-sm font-medium mb-1.5 block">سعر البيع *</label>
                            <Input
                                type="number"
                                min="0"
                                value={form.salePrice}
                                onChange={(e) => setForm(f => ({ ...f, salePrice: parseFloat(e.target.value) || 0 }))}
                            />
                        </div>

                        {/* Profit margin indicator */}
                        <div className="col-span-2 p-3 rounded-lg bg-muted/50">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">هامش الربح</span>
                                <span className={`font-bold ${profitMargin >= 20 ? 'text-emerald-600' : profitMargin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                                    {profitMargin.toFixed(1)}%
                                </span>
                            </div>
                            {profitMargin < 10 && (
                                <p className="text-xs text-amber-600 mt-1">تحذير: الهامش أقل من 10%</p>
                            )}
                        </div>

                        <div className="col-span-2">
                            <label className="text-sm font-medium mb-1.5 block">ملاحظات</label>
                            <Input
                                value={form.notes}
                                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="ملاحظات اختيارية"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="text-sm font-medium mb-1.5 block">الصورة</label>
                            <ImageUpload
                                value={form.image}
                                onChange={(img) => setForm(f => ({ ...f, image: img }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)}>إلغاء</Button>
                        <Button onClick={handleSave}>
                            {editingId ? 'حفظ التغييرات' : 'إضافة'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>حذف جهاز</DialogTitle>
                    </DialogHeader>
                    <p>هل أنت متأكد من حذف "{selectedProduct?.name}"؟ لا يمكن التراجع عن هذا الإجراء.</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>إلغاء</Button>
                        <Button variant="destructive" onClick={handleDelete}>حذف</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batches Modal */}
            <ProductBatchesModal
                open={isBatchesOpen}
                onOpenChange={setIsBatchesOpen}
                productId={selectedProduct?.id || ''}
                productName={selectedProduct?.name || ''}
            />

            {/* Excel Import Dialog */}
            <ExcelColumnMappingDialog
                open={isExcelOpen}
                onOpenChange={setIsExcelOpen}
                inventoryType="device"
                onSuccess={(count: number) => {
                    toast({ title: '✅ تم الاستيراد', description: `تم استيراد ${count} جهاز` });
                    window.location.reload();
                }}
                onDataSave={(items: Record<string, unknown>[]) => {
                    items.forEach((row: Record<string, unknown>) => {
                        addDevice({
                            name: typeof row.name === 'string' ? row.name : '',
                            model: typeof row.model === 'string' ? row.model : '',
                            barcode: typeof row.barcode === 'string' && row.barcode ? row.barcode : crypto.randomUUID().slice(0, 8).toUpperCase(),
                            category: typeof row.category === 'string' ? row.category : '',
                            condition: row.condition === 'used' ? 'used' : 'new',
                            color: typeof row.color === 'string' ? row.color : '',
                            quantity: Number(row.quantity) || 0,
                            oldCostPrice: Number(row.oldCostPrice) || 0,
                            newCostPrice: Number(row.newCostPrice) || 0,
                            salePrice: Number(row.salePrice) || 0,
                            notes: typeof row.notes === 'string' ? row.notes : '',
                            description: typeof row.description === 'string' ? row.description : '',
                        });
                    });
                }}
            />

            {/* Device Categories Manager Modal */}
            {showCatManager && (
                <DeviceCategoriesManager
                    cats={categories}
                    onSave={handleSaveCats}
                    onClose={() => setShowCatManager(false)}
                />
            )}
        </div>
    );
}

