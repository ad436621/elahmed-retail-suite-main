// ============================================================
// DevicesInventory — Optimized Version with Professional UI/UX
// ============================================================

import { useState, useMemo, useCallback, memo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Tv, Plus, Search, Trash2, Pencil, X, Check, LayoutGrid, List,
    FileSpreadsheet, Download, Upload, ShoppingCart, RefreshCw, Filter,
    CheckCircle, Package, AlertCircle, MoreHorizontal, Headphones, Wrench
} from 'lucide-react';
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
    getDeviceAccessories, addDeviceAccessory, updateDeviceAccessory, deleteDeviceAccessory,
    DeviceItem, DeviceAccessory
} from '@/data/devicesData';
import { getCategoriesBySection, addCategory, DynamicCategory } from '@/data/categoriesData';
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
}

const emptyForm = (): DeviceFormData => ({
    name: '', model: '', barcode: '', category: '',
    condition: 'new', color: '', quantity: 1,
    oldCostPrice: 0, newCostPrice: 0, salePrice: 0,
    notes: '', description: '', image: undefined
});

// Accent styles for orange theme
const accentStyles = {
    iconBg: 'bg-orange-100',
    iconText: 'text-orange-600',
    filterActive: 'bg-orange-50 text-orange-700 border-orange-300',
    categoryActive: 'bg-orange-50 text-orange-700 border-orange-300',
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
                    className={item.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}>
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
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-extrabold text-orange-600">
                            {item.salePrice.toLocaleString('ar-EG')}
                            <span className="text-xs font-medium text-muted-foreground mr-1">ج.م</span>
                        </span>
                        <span className={`text-xs font-bold ${margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                            {margin.toFixed(1)}%
                        </span>
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
                        <Button size="sm" variant="ghost" className="h-8 px-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={onDelete}>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
});

// Main Component
export default function DevicesInventory() {
    const { toast } = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    // Data
    const devices = getDevices();
    const accessories = getDeviceAccessories();
    const categories = getCategoriesBySection('device');

    // State
    const [search, setSearch] = useState('');
    const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [activeTab, setActiveTab] = useState('devices');

    // Read navigation state from Dashboard
    useEffect(() => {
        const s = (location.state as { filter?: string } | null);
        if (!s?.filter) return;
        if (s.filter === 'accessory') { setActiveTab('accessories'); }
        else if (s.filter === 'used') { setActiveTab('devices'); setConditionFilter('used'); }
        else { setActiveTab('devices'); setConditionFilter('all'); }
    }, [location.state]);

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
        accessories: accessories.length,
    }), [devices, accessories]);

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

            <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${accentStyles.iconBg}`}>
                                <Tv className={`h-6 w-6 ${accentStyles.iconText}`} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-foreground">الأجهزة والمنزلات</h1>
                                <p className="text-sm text-muted-foreground">إدارة مخزون الأجهزة وإكسسواراتها</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setIsExcelOpen(true)}>
                                <FileSpreadsheet className="h-4 w-4 mr-2" />
                                Excel
                            </Button>
                            <Button onClick={() => handleOpenForm()}>
                                <Plus className="h-4 w-4 mr-2" />
                                إضافة جهاز
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        title="إجمالي الأجهزة"
                        value={stats.total.toString()}
                        icon={Tv}
                        iconGradient="from-orange-500/20 to-amber-500/20"
                        iconColor="text-orange-500"
                    />
                    <StatCard
                        title="متاح للبيع"
                        value={stats.available.toString()}
                        icon={CheckCircle}
                        iconGradient="from-emerald-500/20 to-green-500/20"
                        iconColor="text-emerald-500"
                    />
                    <StatCard
                        title="مستعمل"
                        value={stats.used.toString()}
                        icon={RefreshCw}
                        iconGradient="from-purple-500/20 to-pink-500/20"
                        iconColor="text-purple-500"
                    />
                    <StatCard
                        title="إكسسوارات"
                        value={stats.accessories.toString()}
                        icon={Package}
                        iconGradient="from-blue-500/20 to-indigo-500/20"
                        iconColor="text-blue-500"
                    />
                </div>

                {/* Tabs & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                        <TabsList>
                            <TabsTrigger value="devices">الأجهزة</TabsTrigger>
                            <TabsTrigger value="accessories">الإكسسوارات</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex flex-wrap gap-2 items-center">
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
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
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
                {activeTab === 'devices' && (
                    <>
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
                                                            className={device.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}>
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
                    </>
                )}

                {activeTab === 'accessories' && (
                    <div className="text-center py-12">
                        <Package className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                        <h3 className="text-lg font-semibold text-muted-foreground">الإكسسوارات</h3>
                        <p className="text-sm text-muted-foreground/60">قسم الإكسسوارات قيد التطوير</p>
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
                                    {categories.map(cat => (
                                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
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
                onImport={(items) => {
                    items.forEach(row => {
                        addDevice({
                            name: row.name || '',
                            model: row.model || '',
                            barcode: row.barcode || crypto.randomUUID().slice(0, 8).toUpperCase(),
                            category: row.category || '',
                            condition: row.condition || 'new',
                            color: row.color || '',
                            quantity: Number(row.quantity) || 0,
                            oldCostPrice: Number(row.oldCostPrice) || 0,
                            newCostPrice: Number(row.newCostPrice) || 0,
                            salePrice: Number(row.salePrice) || 0,
                            notes: row.notes || '',
                            description: row.description || '',
                        });
                    });
                    toast({ title: '✅ تم الاستيراد', description: `تم استيراد ${items.length} جهاز` });
                    window.location.reload();
                }}
            />
        </div>
    );
}

