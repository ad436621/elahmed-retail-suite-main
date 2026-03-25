import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Download,
  FileSpreadsheet,
  FolderOpen,
  ImageOff,
  Info,
  Laptop,
  LayoutGrid,
  List,
  Monitor,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { getComputers, addComputer, updateComputer, deleteComputer } from '@/data/computersData';
import { getWeightedAvgCost } from '@/data/batchesData';
import { loadCats, saveCats } from '@/data/categoriesData';
import { getWarehouses, type Warehouse } from '@/data/warehousesData';
import { exportToExcel, COMPUTER_COLUMNS } from '@/services/excelService';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination, PaginationBar } from '@/hooks/usePagination';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { FilterBar, type FilterBarField } from '@/components/FilterBar';
import { InventoryProductCard } from '@/components/InventoryProductCard';
import { ImageUpload } from '@/components/ImageUpload';
import { ProductDetailsModal, type ProductDetailsData } from '@/components/ProductDetailsModal';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import {
  PRODUCT_CONDITION_OPTIONS,
  type ProductConditionValue,
  getProductConditionBadgeClass,
  getProductConditionLabel,
} from '@/domain/productConditions';
import {
  calculateMarginPercent,
  calculateProfitAmount,
  normalizeCostPrice,
} from '@/domain/pricing';
import { isBarcodeDuplicate } from '@/repositories/productRepository';
import { cn } from '@/lib/utils';
import type { ComputerDeviceType, ComputerItem } from '@/domain/types';

type ConditionFilter = 'all' | ProductConditionValue;

interface ComputerFormState {
  name: string;
  barcode: string;
  deviceType: ComputerDeviceType;
  category: string;
  condition: ProductConditionValue;
  quantity: number;
  model: string;
  color: string;
  brand: string;
  supplier: string;
  source: string;
  processor: string;
  ram: string;
  storage: string;
  oldCostPrice: number;
  newCostPrice: number;
  salePrice: number;
  profitMargin: number;
  notes: string;
  description: string;
  image?: string;
  warehouseId: string;
}

interface ComputerViewItem extends ProductDetailsData {
  _raw: ComputerItem;
  costPrice: number;
}

const IC =
  'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60';

const DEFAULT_CATEGORIES = ['لابتوبات', 'كمبيوتر مكتبي', 'شاشات', 'جيمينج', 'ملحقات عرض'];

const emptyForm = (): ComputerFormState => ({
  name: '',
  barcode: '',
  deviceType: 'computer',
  category: '',
  condition: 'new',
  quantity: 1,
  model: '',
  color: '',
  brand: '',
  supplier: '',
  source: '',
  processor: '',
  ram: '',
  storage: '',
  oldCostPrice: 0,
  newCostPrice: 0,
  salePrice: 0,
  profitMargin: 0,
  notes: '',
  description: '',
  image: undefined,
  warehouseId: '',
});

function CategoriesManager({
  categories,
  onClose,
  onSave,
}: {
  categories: string[];
  onClose: () => void;
  onSave: (categories: string[]) => void;
}) {
  const [list, setList] = useState<string[]>([...categories]);
  const [newName, setNewName] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const addCategory = () => {
    const value = newName.trim();
    if (!value || list.includes(value)) return;
    setList((current) => [...current, value]);
    setNewName('');
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const value = editingValue.trim();
    if (!value) return;
    if (list.some((item, index) => index !== editingIndex && item === value)) return;
    setList((current) => current.map((item, index) => (index === editingIndex ? value : item)));
    setEditingIndex(null);
    setEditingValue('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-scale-in"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">إدارة تصنيفات الكمبيوتر</h2>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 transition-colors hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addCategory()}
              placeholder="أضف تصنيفًا جديدًا"
              className={IC}
              autoFocus
            />
            <button onClick={addCategory} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {list.map((category, index) => (
              <div key={category} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                {editingIndex === index ? (
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveEdit();
                      if (event.key === 'Escape') {
                        setEditingIndex(null);
                        setEditingValue('');
                      }
                    }}
                    className={cn(IC, 'h-9 py-0')}
                    autoFocus
                  />
                ) : (
                  <span className="flex-1 text-sm font-semibold text-foreground">{category}</span>
                )}
                {editingIndex === index ? (
                  <>
                    <button onClick={saveEdit} className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50">
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingIndex(null);
                        setEditingValue('');
                      }}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingIndex(index);
                        setEditingValue(category);
                      }}
                      className="rounded-lg p-2 text-primary transition-colors hover:bg-primary/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setList((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      className="rounded-lg p-2 text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 border-t border-border px-5 py-4">
          <button onClick={() => onSave(list)} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">
            حفظ التصنيفات
          </button>
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold hover:bg-muted">
            إلغاء
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function ComputersInventory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const computers = useInventoryData(getComputers, ['gx_computers_v2']);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [categories, setCategories] = useState<string[]>(() => loadCats('computers_cats', DEFAULT_CATEGORIES));

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showFilters, setShowFilters] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showCatManager, setShowCatManager] = useState(false);
  const [showExcelRestore, setShowExcelRestore] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ComputerFormState>(emptyForm());
  const [selectedDetails, setSelectedDetails] = useState<ComputerViewItem | null>(null);
  const [activeBatchesModal, setActiveBatchesModal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    getWarehouses().then(setWarehouses).catch(console.error);
  }, []);

  const items = useMemo<ComputerViewItem[]>(
    () =>
      computers.map((computer) => {
        const costPrice = normalizeCostPrice(getWeightedAvgCost(computer.id), computer.newCostPrice || computer.oldCostPrice);
        const profitMargin =
          typeof computer.profitMargin === 'number'
            ? computer.profitMargin
            : calculateProfitAmount(costPrice, computer.salePrice);

        return {
          _raw: computer,
          id: computer.id,
          name: computer.name,
          barcode: computer.barcode,
          category: computer.category,
          condition: computer.condition || 'new',
          brand: computer.brand,
          supplier: computer.supplier,
          source: computer.source,
          model: computer.model,
          color: computer.color,
          storage: computer.storage,
          ram: computer.ram,
          processor: computer.processor,
          quantity: computer.quantity,
          costPrice,
          oldCostPrice: computer.oldCostPrice,
          salePrice: computer.salePrice,
          profitMargin,
          description: computer.description,
          notes: computer.notes,
          image: computer.image,
          createdAt: computer.createdAt,
          updatedAt: computer.updatedAt,
        };
      }),
    [computers],
  );

  const uniqueCategories = useMemo(() => {
    const values = Array.from(new Set([...categories, ...computers.map((item) => item.category).filter(Boolean)])).filter(Boolean) as string[];
    return values.sort();
  }, [categories, computers]);

  const uniqueBrands = useMemo(
    () => Array.from(new Set(computers.map((item) => item.brand).filter(Boolean) as string[])).sort(),
    [computers],
  );
  const uniqueSuppliers = useMemo(
    () => Array.from(new Set(computers.map((item) => item.supplier).filter(Boolean) as string[])).sort(),
    [computers],
  );
  const uniqueSources = useMemo(
    () => Array.from(new Set(computers.map((item) => item.source).filter(Boolean) as string[])).sort(),
    [computers],
  );

  const filterFields = useMemo<FilterBarField[]>(
    () => [
      {
        id: 'name',
        label: 'اسم المنتج',
        type: 'text',
        placeholder: 'ابحث باسم الكمبيوتر',
        value: search,
        onChange: setSearch,
      },
      {
        id: 'category',
        label: 'التصنيف',
        type: 'select',
        value: categoryFilter,
        options: [{ label: 'كل التصنيفات', value: 'all' }, ...uniqueCategories.map((value) => ({ label: value, value }))],
        onChange: setCategoryFilter,
      },
      {
        id: 'brand',
        label: 'الشركة',
        type: 'select',
        value: brandFilter,
        options: [{ label: 'كل الشركات', value: 'all' }, ...uniqueBrands.map((value) => ({ label: value, value }))],
        onChange: setBrandFilter,
      },
      {
        id: 'condition',
        label: 'الحالة',
        type: 'select',
        value: conditionFilter,
        options: [{ label: 'كل الحالات', value: 'all' }, ...PRODUCT_CONDITION_OPTIONS.map((option) => ({ label: option.label, value: option.value }))],
        onChange: (value) => setConditionFilter(value as ConditionFilter),
      },
      {
        id: 'source',
        label: 'المصدر',
        type: 'select',
        value: sourceFilter,
        options: [{ label: 'كل المصادر', value: 'all' }, ...uniqueSources.map((value) => ({ label: value, value }))],
        onChange: setSourceFilter,
      },
      {
        id: 'supplier',
        label: 'المورد',
        type: 'select',
        value: supplierFilter,
        options: [{ label: 'كل الموردين', value: 'all' }, ...uniqueSuppliers.map((value) => ({ label: value, value }))],
        onChange: setSupplierFilter,
      },
    ],
    [brandFilter, categoryFilter, conditionFilter, search, sourceFilter, supplierFilter, uniqueBrands, uniqueCategories, uniqueSources, uniqueSuppliers],
  );

  const activeFiltersCount = useMemo(
    () =>
      [
        search.trim(),
        categoryFilter !== 'all',
        brandFilter !== 'all',
        supplierFilter !== 'all',
        sourceFilter !== 'all',
        conditionFilter !== 'all',
      ].filter(Boolean).length,
    [brandFilter, categoryFilter, conditionFilter, search, sourceFilter, supplierFilter],
  );

  const filteredItems = useMemo(() => {
    const searchValue = debouncedSearch.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch = !searchValue || item.name.toLowerCase().includes(searchValue);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
      const matchesSupplier = supplierFilter === 'all' || item.supplier === supplierFilter;
      const matchesSource = sourceFilter === 'all' || item.source === sourceFilter;
      const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter;
      return matchesSearch && matchesCategory && matchesBrand && matchesSupplier && matchesSource && matchesCondition;
    });
  }, [brandFilter, categoryFilter, conditionFilter, debouncedSearch, items, sourceFilter, supplierFilter]);

  const stats = useMemo(() => {
    const totalTypes = filteredItems.length;
    const totalQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalCost = filteredItems.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
    const totalSale = filteredItems.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
    return { totalTypes, totalQuantity, totalCost, totalSale };
  }, [filteredItems]);

  const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage, reset } = usePagination(filteredItems, 24);

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setBrandFilter('all');
    setSupplierFilter('all');
    setSourceFilter('all');
    setConditionFilter('all');
    reset();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  };

  const setCostPriceValue = (value: number) => {
    const costPrice = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => ({
      ...current,
      oldCostPrice: costPrice,
      newCostPrice: costPrice,
      salePrice: costPrice + (current.profitMargin || 0),
    }));
  };

  const setSalePriceValue = (value: number) => {
    const salePrice = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => ({
      ...current,
      salePrice,
      profitMargin: calculateProfitAmount(normalizeCostPrice(current.newCostPrice, current.oldCostPrice), salePrice),
    }));
  };

  const setProfitMarginValue = (value: number) => {
    const profitMargin = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => {
      const costPrice = normalizeCostPrice(current.newCostPrice, current.oldCostPrice);
      return {
        ...current,
        profitMargin,
        salePrice: costPrice + profitMargin,
      };
    });
  };

  const openAdd = () => {
    const nextForm = emptyForm();
    nextForm.category = uniqueCategories[0] || '';
    nextForm.warehouseId = warehouses.find((warehouse) => warehouse.isDefault)?.id || '';
    setForm(nextForm);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (item: ComputerViewItem) => {
    setForm({
      name: item.name,
      barcode: item.barcode || '',
      deviceType: item._raw.deviceType || 'computer',
      category: item.category || '',
      condition: (item.condition as ProductConditionValue) || 'new',
      quantity: item.quantity,
      model: item.model || '',
      color: item.color || '',
      brand: item.brand || '',
      supplier: item.supplier || '',
      source: item.source || '',
      processor: item.processor || '',
      ram: item.ram || '',
      storage: item.storage || '',
      oldCostPrice: normalizeCostPrice(item._raw.newCostPrice, item._raw.oldCostPrice),
      newCostPrice: normalizeCostPrice(item._raw.newCostPrice, item._raw.oldCostPrice),
      salePrice: item.salePrice || 0,
      profitMargin:
        typeof item.profitMargin === 'number'
          ? item.profitMargin
          : calculateProfitAmount(normalizeCostPrice(item._raw.newCostPrice, item._raw.oldCostPrice), item.salePrice || 0),
      notes: item.notes || '',
      description: item.description || '',
      image: item.image,
      warehouseId: item._raw.warehouseId || '',
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const openDetails = (item: ComputerViewItem) => setSelectedDetails(item);

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: 'خطأ', description: 'اسم المنتج مطلوب', variant: 'destructive' });
      return;
    }
    if (!form.category) {
      toast({ title: 'خطأ', description: 'التصنيف مطلوب', variant: 'destructive' });
      return;
    }
    if (form.barcode && isBarcodeDuplicate(form.barcode, editId || undefined)) {
      toast({ title: 'خطأ', description: 'الباركود مستخدم بالفعل', variant: 'destructive' });
      return;
    }
    if ([form.quantity, form.newCostPrice, form.salePrice, form.profitMargin].some((value) => value < 0)) {
      toast({ title: 'خطأ', description: 'القيم الرقمية لا يمكن أن تكون سالبة', variant: 'destructive' });
      return;
    }

    const costPrice = normalizeCostPrice(form.newCostPrice, form.oldCostPrice);
    const payload: Omit<ComputerItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(),
      barcode: form.barcode.trim() || undefined,
      deviceType: form.deviceType,
      category: form.category,
      condition: form.condition,
      color: form.color.trim(),
      brand: form.brand.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      source: form.source.trim() || undefined,
      quantity: form.quantity,
      processor: form.processor.trim() || undefined,
      ram: form.ram.trim() || undefined,
      storage: form.storage.trim() || undefined,
      oldCostPrice: costPrice,
      newCostPrice: costPrice,
      salePrice: form.salePrice,
      profitMargin: calculateProfitAmount(costPrice, form.salePrice),
      notes: form.notes.trim(),
      description: form.description.trim(),
      image: form.image,
      warehouseId: form.warehouseId || undefined,
      model: form.model.trim(),
    };

    if (editId) {
      updateComputer(editId, payload);
      toast({ title: 'تم تحديث الكمبيوتر', description: form.name });
    } else {
      addComputer(payload);
      toast({ title: 'تمت إضافة الكمبيوتر', description: form.name });
    }

    closeForm();
  };

  const handleDelete = async (item: ComputerViewItem) => {
    const ok = await confirm({
      title: 'حذف منتج',
      message: `سيتم أرشفة "${item.name}" من قائمة الكمبيوتر. هل تريد المتابعة؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;

    deleteComputer(item.id);
    toast({ title: 'تم حذف الكمبيوتر', description: item.name });
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => navigate('/computers')}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-md ring-2 ring-indigo-300 ring-offset-1"
        >
          <Laptop className="h-4 w-4" /> الكمبيوتر
        </button>
        <button
          onClick={() => navigate('/computers/accessories')}
          className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-indigo-500 hover:text-white transition-all shadow-sm"
        >
          <Monitor className="h-4 w-4" /> اكسسوارات الكمبيوتر
        </button>
        <button
          onClick={() => navigate('/computers/spare-parts')}
          className="flex items-center gap-2 rounded-xl bg-muted px-5 py-2.5 text-sm font-bold text-muted-foreground hover:bg-orange-600 hover:text-white transition-all shadow-sm"
        >
          <Wrench className="h-4 w-4" /> قطع الغيار
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-100 shadow-sm dark:border-indigo-500/20 dark:bg-indigo-500/15">
            <Laptop className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">مخزون الكمبيوتر</h1>
            <p className="text-xs text-muted-foreground">{items.length} منتج مسجل</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'grid' ? 'border border-border bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> شبكة
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
                viewMode === 'table' ? 'border border-border bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <List className="h-3.5 w-3.5" /> جدول
            </button>
          </div>

          <button
            onClick={() => setShowFilters((current) => !current)}
            aria-expanded={showFilters}
            className={cn(
              'relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all',
              showFilters ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" /> الفلاتر
            {activeFiltersCount > 0 && (
              <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button onClick={() => setShowCatManager(true)} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <FolderOpen className="h-4 w-4" /> التصنيفات ({uniqueCategories.length})
          </button>

          <button onClick={() => setShowExcelRestore(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <FileSpreadsheet className="h-4 w-4" /> استرداد Excel
          </button>

          <button
            onClick={() => exportToExcel({ data: computers, columns: COMPUTER_COLUMNS, fileName: 'الكمبيوتر' })}
            className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
          >
            <Download className="h-4 w-4" /> تصدير Excel
          </button>

          <button onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> إضافة كمبيوتر
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">الأصناف الظاهرة</p>
          <p className="mt-1 text-2xl font-black text-foreground tabular-nums">{stats.totalTypes}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي الكمية</p>
          <p className="mt-1 text-2xl font-black text-foreground tabular-nums">{stats.totalQuantity.toLocaleString('ar-EG')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي التكلفة</p>
          <p className="mt-1 text-2xl font-black text-foreground tabular-nums">{stats.totalCost.toLocaleString('ar-EG')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي البيع المتوقع</p>
          <p className="mt-1 text-2xl font-black text-foreground tabular-nums">{stats.totalSale.toLocaleString('ar-EG')}</p>
        </div>
      </div>

      {showFilters && <FilterBar fields={filterFields} onReset={resetFilters} activeCount={activeFiltersCount} />}

      {!showFilters && activeFiltersCount > 0 && <p className="text-xs font-medium text-muted-foreground">الفلاتر مخفية لكنها ما زالت مطبقة على النتائج الحالية.</p>}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {paginatedItems.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card py-20 text-center text-muted-foreground">
              لا توجد أجهزة مطابقة للفلاتر الحالية
            </div>
          ) : (
            paginatedItems.map((item) => (
              <InventoryProductCard
                key={item.id}
                item={{
                  ...item,
                  newCostPrice: item.costPrice,
                  oldCostPrice: item.costPrice,
                  brand: item.brand,
                  color: item.color,
                  processor: item.processor,
                  storage: item.storage,
                  ram: item.ram,
                }}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item)}
                onDetails={() => openDetails(item)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground">
                  <th className="px-3 py-3 text-right">صورة</th>
                  <th className="px-3 py-3 text-right">المنتج</th>
                  <th className="px-3 py-3 text-right">التصنيف</th>
                  <th className="px-3 py-3 text-right">الشركة</th>
                  <th className="px-3 py-3 text-right">الحالة</th>
                  <th className="px-3 py-3 text-right">المورد</th>
                  <th className="px-3 py-3 text-right">المصدر</th>
                  <th className="px-3 py-3 text-center">الكمية</th>
                  <th className="px-3 py-3 text-right">التكلفة</th>
                  <th className="px-3 py-3 text-right">البيع</th>
                  <th className="px-3 py-3 text-right">هامش الربح</th>
                  <th className="px-3 py-3 text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-16 text-center text-muted-foreground">
                      لا توجد أجهزة مطابقة للفلاتر الحالية
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item, index) => {
                    const marginPercent = calculateMarginPercent(item.costPrice, item.salePrice || 0);
                    const details = [item.model, item.processor, item.ram, item.storage].filter(Boolean).join(' • ');
                    return (
                      <tr
                        key={item.id}
                        className={cn('border-b border-border/40 transition-colors hover:bg-muted/20', index % 2 !== 0 && 'bg-muted/10')}
                        onClick={() => openDetails(item)}
                      >
                        <td className="w-14 px-3 py-2">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="h-10 w-10 rounded-xl border border-border object-cover shadow-sm" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60">
                              <ImageOff className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-foreground">{item.name}</div>
                          <div className="text-[11px] text-muted-foreground">{details || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-primary">{item.category || '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.brand || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', getProductConditionBadgeClass(item.condition))}>
                            {getProductConditionLabel(item.condition)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.supplier || '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.source || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', item.quantity === 0 ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-muted text-foreground')}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveBatchesModal({ id: item.id, name: item.name });
                            }}
                            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-primary"
                          >
                            {item.costPrice.toLocaleString('ar-EG')}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm font-bold tabular-nums text-foreground">{item.salePrice?.toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 text-xs font-bold tabular-nums">
                          <span className={cn(marginPercent >= 20 ? 'text-emerald-600' : marginPercent >= 10 ? 'text-amber-600' : 'text-red-500')}>
                            {(item.profitMargin || 0).toLocaleString('ar-EG')} ج.م • {marginPercent.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-left">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openDetails(item);
                              }}
                              className="rounded-lg p-1.5 text-cyan-600 transition-colors hover:bg-cyan-50 dark:hover:bg-cyan-500/10"
                              title="تفاصيل"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(item);
                              }}
                              className="rounded-lg p-1.5 text-primary transition-colors hover:bg-primary/10"
                              title="تعديل"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(item);
                              }}
                              className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
                              title="حذف"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPrev={prevPage} onNext={nextPage} onPage={setPage} />

      {showCatManager && (
        <CategoriesManager
          categories={uniqueCategories}
          onClose={() => setShowCatManager(false)}
          onSave={(nextCategories) => {
            saveCats('computers_cats', nextCategories);
            setCategories(nextCategories);
            setShowCatManager(false);
            toast({ title: 'تم حفظ التصنيفات', description: `${nextCategories.length} تصنيف` });
          }}
        />
      )}

      {showForm &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-4 backdrop-blur-sm" onClick={closeForm}>
            <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-4">
                <h2 className="text-base font-bold text-foreground">{editId ? 'تعديل الكمبيوتر' : 'إضافة كمبيوتر'}</h2>
                <button onClick={closeForm} className="rounded-xl p-2 transition-colors hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <ImageUpload value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">التصنيف</label>
                    <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={IC}>
                      <option value="" disabled>
                        -- اختر تصنيفًا --
                      </option>
                      {uniqueCategories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">نوع الجهاز</label>
                    <select value={form.deviceType} onChange={(event) => setForm((current) => ({ ...current, deviceType: event.target.value as ComputerDeviceType }))} className={IC}>
                      <option value="computer">كمبيوتر</option>
                      <option value="laptop">لابتوب</option>
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الحالة</label>
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_CONDITION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, condition: option.value }))}
                          className={cn(
                            'flex-1 rounded-xl border py-2 text-sm font-semibold transition-all',
                            form.condition === option.value ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-transparent text-muted-foreground',
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">المخزن</label>
                  <select value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))} className={IC}>
                    <option value="">-- الافتراضي --</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">اسم المنتج</label>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={IC} autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الباركود</label>
                    <input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} className={IC} placeholder="تلقائي عند الترك فارغًا" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/40 bg-muted/20 p-3 sm:grid-cols-3">
                  <div className="col-span-full mb-1 text-xs font-bold text-primary">مواصفات الكمبيوتر</div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">الموديل</label>
                    <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">المعالج</label>
                    <input value={form.processor} onChange={(event) => setForm((current) => ({ ...current, processor: event.target.value }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">اللون</label>
                    <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">الرام</label>
                    <input value={form.ram} onChange={(event) => setForm((current) => ({ ...current, ram: event.target.value }))} className={IC} placeholder="8GB" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">التخزين</label>
                    <input value={form.storage} onChange={(event) => setForm((current) => ({ ...current, storage: event.target.value }))} className={IC} placeholder="512GB SSD" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">الشركة</label>
                    <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className={IC} list="computers-brand-list" placeholder="اكتب أو اختر" />
                    <datalist id="computers-brand-list">
                      {uniqueBrands.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">المورد</label>
                    <input value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} className={IC} list="computers-supplier-list" placeholder="اكتب أو اختر" />
                    <datalist id="computers-supplier-list">
                      {uniqueSuppliers.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">المصدر</label>
                    <input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} className={IC} list="computers-source-list" placeholder="اكتب أو اختر" />
                    <datalist id="computers-source-list">
                      {uniqueSources.map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">الوصف</label>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={2} className={cn(IC, 'resize-none')} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted-foreground uppercase">ملاحظات</label>
                  <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} className={cn(IC, 'resize-none')} />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">الكمية</label>
                    <input type="number" min={0} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) || 0 }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-muted-foreground uppercase">تكلفة الشراء</label>
                    <input type="number" min={0} value={normalizeCostPrice(form.newCostPrice, form.oldCostPrice)} onChange={(event) => setCostPriceValue(Number(event.target.value) || 0)} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-primary uppercase">سعر البيع</label>
                    <input type="number" min={0} value={form.salePrice} onChange={(event) => setSalePriceValue(Number(event.target.value) || 0)} className={cn(IC, 'border-primary/40 focus:ring-primary')} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-emerald-600 uppercase">هامش الربح</label>
                    <input type="number" min={0} value={form.profitMargin} onChange={(event) => setProfitMarginValue(Number(event.target.value) || 0)} className={cn(IC, 'border-emerald-400/40 focus:ring-emerald-500/20')} />
                  </div>
                </div>

                {form.salePrice > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">هامش الربح الحالي</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {form.profitMargin.toLocaleString('ar-EG')} ج.م • {calculateMarginPercent(normalizeCostPrice(form.newCostPrice, form.oldCostPrice), form.salePrice).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-border px-4 pb-4 pt-3">
                <button onClick={handleSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                  <Check className="h-4 w-4" /> {editId ? 'حفظ التعديلات' : 'إضافة الكمبيوتر'}
                </button>
                <button onClick={closeForm} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">
                  إلغاء
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedDetails && <ProductDetailsModal product={selectedDetails} onClose={() => setSelectedDetails(null)} />}

      {activeBatchesModal && (
        <ProductBatchesModal productId={activeBatchesModal.id} productName={activeBatchesModal.name} onClose={() => setActiveBatchesModal(null)} />
      )}

      <ExcelColumnMappingDialog
        open={showExcelRestore}
        onOpenChange={setShowExcelRestore}
        inventoryType="computer"
        onSuccess={() => undefined}
        onDataSave={(rows) => {
          rows.forEach((row) => {
            const costPrice = normalizeCostPrice(Number(row.newCostPrice) || 0, Number(row.oldCostPrice) || 0);
            addComputer({
              name: (row.name as string) || '',
              model: (row.model as string) || '',
              barcode: (row.barcode as string) || undefined,
              deviceType: (row.deviceType as ComputerDeviceType) || 'computer',
              category: (row.category as string) || '',
              condition: PRODUCT_CONDITION_OPTIONS.some((option) => option.value === row.condition) ? (row.condition as ProductConditionValue) : 'new',
              color: (row.color as string) || '',
              brand: (row.brand as string) || undefined,
              supplier: (row.supplier as string) || undefined,
              source: (row.source as string) || undefined,
              quantity: Number(row.quantity) || 0,
              processor: (row.processor as string) || undefined,
              ram: (row.ram as string) || undefined,
              storage: (row.storage as string) || undefined,
              oldCostPrice: costPrice,
              newCostPrice: costPrice,
              salePrice: Number(row.salePrice) || 0,
              profitMargin: typeof row.profitMargin === 'number' ? row.profitMargin : calculateProfitAmount(costPrice, Number(row.salePrice) || 0),
              notes: (row.notes as string) || '',
              description: (row.description as string) || '',
              image: (row.image as string) || undefined,
              warehouseId: (row.warehouseId as string) || undefined,
            });
          });
        }}
      />
    </div>
  );
}
