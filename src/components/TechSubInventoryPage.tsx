import { useMemo, useState, type ReactNode } from 'react';
import { generateBarcode as genBarcode } from '@/lib/idGenerator';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  FolderOpen,
  ImageOff,
  Info,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { exportToExcel, type ExcelColumn } from '@/services/excelService';
import { loadCats, saveCats } from '@/data/categoriesData';
import { useInventoryData } from '@/hooks/useInventoryData';
import { useDebounce } from '@/hooks/useDebounce';
import { usePagination, PaginationBar } from '@/hooks/usePagination';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ConfirmDialog';
import { FilterBar, type FilterBarField } from '@/components/FilterBar';
import { ImageUpload } from '@/components/ImageUpload';
import { InventoryProductCard } from '@/components/InventoryProductCard';
import { ProductDetailsModal, type ProductDetailsData } from '@/components/ProductDetailsModal';
import { ExcelColumnMappingDialog } from '@/components/ExcelColumnMappingDialog';
import {
  PRODUCT_CONDITION_OPTIONS,
  type ProductConditionValue,
  getProductConditionBadgeClass,
  getProductConditionLabel,
} from '@/domain/productConditions';
import { calculateMarginPercent, calculateProfitAmount } from '@/domain/pricing';
import { isBarcodeDuplicate } from '@/repositories/productRepository';
import { cn } from '@/lib/utils';

export interface TechSubItem {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  model?: string;
  color?: string;
  quantity: number;
  costPrice: number;
  salePrice: number;
  profitMargin?: number;
  minStock?: number;
  barcode?: string;
  supplier?: string;
  source?: string;
  condition?: ProductConditionValue;
  notes?: string;
  description?: string;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface TechNavButton {
  label: string;
  path: string;
  icon: ReactNode;
  color: string;
  hoverColor: string;
  isActive: boolean;
}

interface CompanySourceConfig {
  getItems: () => Array<{ brand?: string }>;
  storageKeys: string[];
}

export interface TechSubInventoryConfig {
  section: 'accessories' | 'spare-parts';
  title: string;
  managerTitle: string;
  formTitle: string;
  icon: ReactNode;
  iconBg: string;
  iconText: string;
  addBtnClass: string;
  categories: string[];
  categoryStorageKey: string;
  storageKey: string;
  navButtons: TechNavButton[];
  companySource?: CompanySourceConfig;
  getItems: () => TechSubItem[];
  addItem: (item: Omit<TechSubItem, 'id' | 'createdAt' | 'updatedAt'>) => TechSubItem;
  updateItem: (id: string, updates: Partial<TechSubItem>) => void;
  deleteItem: (id: string) => void;
  exportColumns?: ExcelColumn[];
  exportFileName?: string;
  excelInventoryType?: string;
  barcodePrefix?: string;
}

interface TechSubInventoryViewItem extends ProductDetailsData {
  _raw: TechSubItem;
  costPrice: number;
}

interface TechFormState {
  name: string;
  brand: string;
  category: string;
  model: string;
  color: string;
  barcode: string;
  supplier: string;
  source: string;
  condition: ProductConditionValue;
  quantity: number;
  costPrice: number;
  salePrice: number;
  profitMargin: number;
  minStock: number;
  notes: string;
  description: string;
  image?: string;
}

type ConditionFilter = 'all' | ProductConditionValue;

const IC =
  'w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60';

const emptyForm = (): TechFormState => ({
  name: '',
  brand: '',
  category: '',
  model: '',
  color: '',
  barcode: '',
  supplier: '',
  source: '',
  condition: 'new',
  quantity: 0,
  costPrice: 0,
  salePrice: 0,
  profitMargin: 0,
  minStock: 2,
  notes: '',
  description: '',
  image: undefined,
});

function normalizeCondition(input: unknown): ProductConditionValue {
  const value = String(input ?? '').trim().toLowerCase();
  if (value === 'like new' || value === 'like_new' || value === 'مثل الجديد' || value === 'كالجديد') return 'like_new';
  if (value === 'used' || value === 'مستعمل') return 'used';
  if (value === 'broken' || value === 'defective' || value === 'معطل' || value === 'عاطل') return 'broken';
  return 'new';
}

function buildImportedItem(row: Record<string, unknown>, barcodePrefix: string): Omit<TechSubItem, 'id' | 'createdAt' | 'updatedAt'> {
  const costPrice = Number(row.costPrice ?? row.newCostPrice ?? row.oldCostPrice ?? 0) || 0;
  const salePrice = Number(row.salePrice ?? 0) || 0;

  return {
    name: String(row.name ?? '').trim(),
    brand: String(row.brand ?? '').trim() || undefined,
    category: String(row.category ?? '').trim() || undefined,
    model: String(row.model ?? '').trim() || undefined,
    color: String(row.color ?? '').trim() || undefined,
    barcode: String(row.barcode ?? '').trim() || genBarcode(barcodePrefix),
    supplier: String(row.supplier ?? '').trim() || undefined,
    source: String(row.source ?? '').trim() || undefined,
    condition: normalizeCondition(row.condition),
    quantity: Number(row.quantity ?? 0) || 0,
    costPrice,
    salePrice,
    profitMargin: Number(row.profitMargin ?? calculateProfitAmount(costPrice, salePrice)) || 0,
    minStock: Number(row.minStock ?? 0) || 0,
    notes: String(row.notes ?? '').trim(),
    description: String(row.description ?? '').trim(),
    image: typeof row.image === 'string' ? row.image : undefined,
  };
}

function CategoryManager({
  title,
  categories,
  onClose,
  onSave,
}: {
  title: string;
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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">{title}</h2>
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
              placeholder="أضف تصنيفاً جديداً"
              className={IC}
              autoFocus
            />
            <button onClick={addCategory} className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {list.map((category, index) => (
              <div key={`${category}-${index}`} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
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

export default function TechSubInventoryPage({ config }: { config: TechSubInventoryConfig }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { confirm } = useConfirm();

  const items = useInventoryData(config.getItems, [config.storageKey]);
  const relatedCompanies = useInventoryData(config.companySource?.getItems ?? (() => []), config.companySource?.storageKeys ?? []);
  const [categories, setCategories] = useState<string[]>(() => loadCats(config.categoryStorageKey, config.categories));

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('all');
  const [conditionFilter, setConditionFilter] = useState<ConditionFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showFilters, setShowFilters] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showExcelRestore, setShowExcelRestore] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TechFormState>(emptyForm());
  const [selectedDetails, setSelectedDetails] = useState<TechSubInventoryViewItem | null>(null);

  const debouncedSearch = useDebounce(search, 250);
  const debouncedModel = useDebounce(modelFilter, 250);

  const unifiedItems = useMemo<TechSubInventoryViewItem[]>(
    () =>
      items.map((item) => ({
        _raw: item,
        id: item.id,
        name: item.name,
        barcode: item.barcode,
        category: item.category,
        condition: item.condition || 'new',
        brand: item.brand,
        supplier: item.supplier,
        source: item.source,
        model: item.model,
        color: item.color,
        quantity: item.quantity,
        costPrice: item.costPrice || 0,
        salePrice: item.salePrice || 0,
        profitMargin: typeof item.profitMargin === 'number' ? item.profitMargin : calculateProfitAmount(item.costPrice || 0, item.salePrice || 0),
        minStock: item.minStock,
        description: typeof item.description === 'string' ? item.description : '',
        notes: item.notes,
        image: item.image,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    [items],
  );

  const uniqueCategories = useMemo(
    () =>
      Array.from(new Set([...categories, ...(items.map((item) => item.category).filter(Boolean) as string[])]))
        .filter(Boolean)
        .sort(),
    [categories, items],
  );

  const uniqueBrands = useMemo(() => {
    const values = new Set<string>();
    relatedCompanies.forEach((item) => {
      if (item.brand) values.add(item.brand);
    });
    items.forEach((item) => {
      if (item.brand) values.add(item.brand);
    });
    return Array.from(values).sort();
  }, [items, relatedCompanies]);

  const uniqueSuppliers = useMemo(() => Array.from(new Set(items.map((item) => item.supplier).filter(Boolean) as string[])).sort(), [items]);
  const uniqueSources = useMemo(() => Array.from(new Set(items.map((item) => item.source).filter(Boolean) as string[])).sort(), [items]);
  const ownerOptions = useMemo(() => Array.from(new Set([...uniqueSuppliers, ...uniqueSources])).sort(), [uniqueSources, uniqueSuppliers]);

  const filterFields = useMemo<FilterBarField[]>(() => {
    if (config.section === 'accessories') {
      return [
        { id: 'name', label: 'اسم المنتج', type: 'text', placeholder: 'ابحث باسم المنتج', value: search, onChange: setSearch },
        {
          id: 'category',
          label: 'التصنيف',
          type: 'select',
          value: categoryFilter,
          options: [{ label: 'كل التصنيفات', value: 'all' }, ...uniqueCategories.map((value) => ({ label: value, value }))],
          onChange: setCategoryFilter,
        },
        { id: 'model', label: 'الموديل', type: 'text', placeholder: 'ابحث بالموديل', value: modelFilter, onChange: setModelFilter },
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
          id: 'owner',
          label: 'المورد أو المصدر',
          type: 'select',
          value: ownerFilter,
          options: [{ label: 'الكل', value: 'all' }, ...ownerOptions.map((value) => ({ label: value, value }))],
          onChange: setOwnerFilter,
        },
      ];
    }

    return [
      {
        id: 'category',
        label: 'التصنيف',
        type: 'select',
        value: categoryFilter,
        options: [{ label: 'كل التصنيفات', value: 'all' }, ...uniqueCategories.map((value) => ({ label: value, value }))],
        onChange: setCategoryFilter,
      },
      {
        id: 'condition',
        label: 'الحالة',
        type: 'select',
        value: conditionFilter,
        options: [{ label: 'كل الحالات', value: 'all' }, ...PRODUCT_CONDITION_OPTIONS.map((option) => ({ label: option.label, value: option.value }))],
        onChange: (value) => setConditionFilter(value as ConditionFilter),
      },
      { id: 'model', label: 'الموديل', type: 'text', placeholder: 'ابحث بالموديل', value: modelFilter, onChange: setModelFilter },
      {
        id: 'brand',
        label: 'الشركة',
        type: 'select',
        value: brandFilter,
        options: [{ label: 'كل الشركات', value: 'all' }, ...uniqueBrands.map((value) => ({ label: value, value }))],
        onChange: setBrandFilter,
      },
      {
        id: 'source',
        label: 'المصدر',
        type: 'select',
        value: sourceFilter,
        options: [{ label: 'كل المصادر', value: 'all' }, ...uniqueSources.map((value) => ({ label: value, value }))],
        onChange: setSourceFilter,
      },
    ];
  }, [brandFilter, categoryFilter, conditionFilter, config.section, modelFilter, ownerFilter, ownerOptions, search, sourceFilter, uniqueBrands, uniqueCategories, uniqueSources]);

  const activeFiltersCount = useMemo(
    () =>
      [
        config.section === 'accessories' && search.trim(),
        categoryFilter !== 'all',
        modelFilter.trim(),
        brandFilter !== 'all',
        conditionFilter !== 'all',
        config.section === 'accessories' && ownerFilter !== 'all',
        config.section === 'spare-parts' && sourceFilter !== 'all',
      ].filter(Boolean).length,
    [brandFilter, categoryFilter, conditionFilter, config.section, modelFilter, ownerFilter, search, sourceFilter],
  );

  const filteredItems = useMemo(() => {
    const searchValue = debouncedSearch.trim().toLowerCase();
    const modelValue = debouncedModel.trim().toLowerCase();

    return unifiedItems.filter((item) => {
      const matchesName = config.section !== 'accessories' || !searchValue || item.name.toLowerCase().includes(searchValue);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesModel = !modelValue || (item.model || '').toLowerCase().includes(modelValue);
      const matchesBrand = brandFilter === 'all' || item.brand === brandFilter;
      const matchesCondition = conditionFilter === 'all' || item.condition === conditionFilter;
      const matchesOwner = config.section !== 'accessories' || ownerFilter === 'all' || item.supplier === ownerFilter || item.source === ownerFilter;
      const matchesSource = config.section !== 'spare-parts' || sourceFilter === 'all' || item.source === sourceFilter;
      return matchesName && matchesCategory && matchesModel && matchesBrand && matchesCondition && matchesOwner && matchesSource;
    });
  }, [brandFilter, categoryFilter, conditionFilter, config.section, debouncedModel, debouncedSearch, ownerFilter, sourceFilter, unifiedItems]);

  const stats = useMemo(() => {
    const totalTypes = filteredItems.length;
    const totalQuantity = filteredItems.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const totalCost = filteredItems.reduce((sum, item) => sum + item.costPrice * (item.quantity ?? 0), 0);
    const totalSale = filteredItems.reduce((sum, item) => sum + (item.salePrice ?? 0) * (item.quantity ?? 0), 0);
    return { totalTypes, totalQuantity, totalCost, totalSale };
  }, [filteredItems]);

  const { paginatedItems, page, totalPages, totalItems, pageSize, nextPage, prevPage, setPage, reset } = usePagination(filteredItems, 24);

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setModelFilter('');
    setBrandFilter('all');
    setConditionFilter('all');
    setOwnerFilter('all');
    setSourceFilter('all');
    reset();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm());
  };

  const setCostPriceValue = (value: number) => {
    const costPrice = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => ({ ...current, costPrice, salePrice: costPrice + (current.profitMargin || 0) }));
  };

  const setSalePriceValue = (value: number) => {
    const salePrice = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => ({ ...current, salePrice, profitMargin: calculateProfitAmount(current.costPrice, salePrice) }));
  };

  const setProfitMarginValue = (value: number) => {
    const profitMargin = Number.isFinite(value) ? Math.max(0, value) : 0;
    setForm((current) => ({ ...current, profitMargin, salePrice: current.costPrice + profitMargin }));
  };

  const openAdd = () => {
    const next = emptyForm();
    next.category = uniqueCategories[0] || '';
    setForm(next);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (item: TechSubInventoryViewItem) => {
    setForm({
      name: item.name,
      brand: item.brand || '',
      category: item.category || '',
      model: item.model || '',
      color: item.color || '',
      barcode: item.barcode || '',
      supplier: item.supplier || '',
      source: item.source || '',
      condition: normalizeCondition(item.condition),
      quantity: item.quantity ?? 0,
      costPrice: item.costPrice,
      salePrice: item.salePrice ?? 0,
      profitMargin: typeof item.profitMargin === 'number' ? item.profitMargin : calculateProfitAmount(item.costPrice, item.salePrice ?? 0),
      minStock: item.minStock || 0,
      notes: item.notes || '',
      description: typeof item.description === 'string' ? item.description : '',
      image: item.image,
    });
    setEditId(item.id);
    setShowForm(true);
  };

  const openDetails = (item: TechSubInventoryViewItem) => setSelectedDetails(item);

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

    const payload: Omit<TechSubItem, 'id' | 'createdAt' | 'updatedAt'> = {
      name: form.name.trim(),
      brand: form.brand.trim() || undefined,
      category: form.category,
      model: form.model.trim() || undefined,
      color: form.color.trim() || undefined,
      barcode: form.barcode.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      source: form.source.trim() || undefined,
      condition: form.condition,
      quantity: Math.max(0, form.quantity),
      costPrice: Math.max(0, form.costPrice),
      salePrice: Math.max(0, form.salePrice),
      profitMargin: calculateProfitAmount(form.costPrice, form.salePrice),
      minStock: Math.max(0, form.minStock),
      notes: form.notes.trim(),
      description: form.description.trim(),
      image: form.image,
    };

    if (editId) {
      config.updateItem(editId, payload);
      toast({ title: 'تم تحديث المنتج', description: form.name });
    } else {
      const barcode = payload.barcode || genBarcode(config.barcodePrefix || 'TECH-');
      config.addItem({ ...payload, barcode });
      toast({ title: 'تمت إضافة المنتج', description: form.name });
    }

    closeForm();
  };

  const handleDelete = async (item: TechSubInventoryViewItem) => {
    const ok = await confirm({
      title: 'حذف منتج',
      message: `سيتم حذف "${item.name}" من ${config.title}. هل تريد المتابعة؟`,
      confirmLabel: 'حذف',
      danger: true,
    });
    if (!ok) return;

    config.deleteItem(item.id);
    toast({ title: 'تم حذف المنتج', description: item.name });
  };

  return (
    <div className="space-y-5 animate-fade-in" dir="rtl">
      <div className="flex flex-wrap gap-2">
        {config.navButtons.map((button) => (
          <button
            key={button.path}
            onClick={() => navigate(button.path)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all',
              button.isActive ? `${button.color} text-white ring-2 ring-white/20 ring-offset-1` : `bg-muted text-muted-foreground ${button.hoverColor} hover:text-white`,
            )}
          >
            {button.icon}
            {button.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm', config.iconBg)}>
            <span className={config.iconText}>{config.icon}</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
            <p className="text-xs text-muted-foreground">{unifiedItems.length} منتج مسجل</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', viewMode === 'grid' ? 'border border-border bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground')}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              شبكة
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all', viewMode === 'table' ? 'border border-border bg-card text-primary shadow' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="h-3.5 w-3.5" />
              جدول
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
            <SlidersHorizontal className="h-4 w-4" />
            الفلاتر
            {activeFiltersCount > 0 && (
              <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-black text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button onClick={() => setShowCategoryManager(true)} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
            <FolderOpen className="h-4 w-4" />
            التصنيفات ({uniqueCategories.length})
          </button>

          <button onClick={() => setShowExcelRestore(true)} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <FileSpreadsheet className="h-4 w-4" />
            استرداد Excel
          </button>

          {config.exportColumns && config.exportFileName && (
            <button
              onClick={() => exportToExcel({ data: items, columns: config.exportColumns!, fileName: config.exportFileName! })}
              className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            >
              <Download className="h-4 w-4" />
              تصدير Excel
            </button>
          )}

          <button onClick={openAdd} className={cn('flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors', config.addBtnClass)}>
            <Plus className="h-4 w-4" />
            إضافة منتج
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">الأصناف الظاهرة</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{stats.totalTypes}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي الكمية</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{stats.totalQuantity.toLocaleString('ar-EG')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي التكلفة</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{stats.totalCost.toLocaleString('ar-EG')}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold text-muted-foreground">إجمالي البيع المتوقع</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{stats.totalSale.toLocaleString('ar-EG')}</p>
        </div>
      </div>

      {showFilters && <FilterBar fields={filterFields} onReset={resetFilters} activeCount={activeFiltersCount} />}

      {!showFilters && activeFiltersCount > 0 && <p className="text-xs font-medium text-muted-foreground">الفلاتر مخفية لكنها ما زالت مطبقة على النتائج الحالية.</p>}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {paginatedItems.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card py-20 text-center text-muted-foreground">لا توجد منتجات مطابقة للفلاتر الحالية</div>
          ) : (
            paginatedItems.map((item) => (
              <InventoryProductCard
                key={item.id}
                item={{ ...item, _type: config.section === 'accessories' ? 'accessory' : 'spare-part', quantity: item.quantity ?? 0, salePrice: item.salePrice ?? 0, newCostPrice: item.costPrice, oldCostPrice: item.costPrice, brand: item.brand, model: item.model, color: item.color, minStock: item.minStock }}
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
                  <th className="px-3 py-3 text-right">{config.section === 'accessories' ? 'المورد / المصدر' : 'المصدر'}</th>
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
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">لا توجد منتجات مطابقة للفلاتر الحالية</td>
                  </tr>
                ) : (
                  paginatedItems.map((item, index) => {
                    const marginPercent = calculateMarginPercent(item.costPrice, item.salePrice ?? 0);
                    const isLowStock = typeof item.minStock === 'number' && (item.quantity ?? 0) <= item.minStock;
                    return (
                      <tr key={item.id} className={cn('border-b border-border/40 transition-colors hover:bg-muted/20', index % 2 !== 0 && 'bg-muted/10')} onClick={() => openDetails(item)}>
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
                          <div className="text-[11px] text-muted-foreground">{[item.model, item.color].filter(Boolean).join(' • ') || '—'}</div>
                        </td>
                        <td className="px-3 py-2 text-xs font-semibold text-primary">{item.category || '—'}</td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{item.brand || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', getProductConditionBadgeClass(item.condition))}>{getProductConditionLabel(item.condition)}</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{config.section === 'accessories' ? item.supplier || item.source || '—' : item.source || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', isLowStock ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400' : 'bg-muted text-foreground')}>
                            {item.quantity ?? 0}
                            {isLowStock && <AlertTriangle className="h-3 w-3" />}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">{item.costPrice.toLocaleString('ar-EG')}</td>
                        <td className="px-3 py-2 text-sm font-bold tabular-nums text-foreground">{(item.salePrice ?? 0).toLocaleString('ar-EG')}</td>
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
                                void handleDelete(item);
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

      {showCategoryManager && (
        <CategoryManager
          title={config.managerTitle}
          categories={uniqueCategories}
          onClose={() => setShowCategoryManager(false)}
          onSave={(nextCategories) => {
            saveCats(config.categoryStorageKey, nextCategories);
            setCategories(nextCategories);
            setShowCategoryManager(false);
            toast({ title: 'تم حفظ التصنيفات', description: `${nextCategories.length} تصنيف` });
          }}
        />
      )}

      {showForm &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-4 backdrop-blur-sm" onClick={closeForm}>
            <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-border px-4 pb-3 pt-4">
                <h2 className="text-base font-bold text-foreground">{editId ? 'تعديل المنتج' : 'إضافة منتج'}</h2>
                <button onClick={closeForm} className="rounded-xl p-2 transition-colors hover:bg-muted">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-4 p-4">
                <ImageUpload value={form.image} onChange={(value) => setForm((current) => ({ ...current, image: value }))} />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">التصنيف</label>
                    <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={IC}>
                      <option value="" disabled>-- اختر تصنيفاً --</option>
                      {uniqueCategories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">الحالة</label>
                    <select value={form.condition} onChange={(event) => setForm((current) => ({ ...current, condition: event.target.value as ProductConditionValue }))} className={IC}>
                      {PRODUCT_CONDITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">اسم المنتج</label>
                    <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={IC} autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">الباركود</label>
                    <input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} className={IC} placeholder="يتم توليده تلقائياً عند تركه فارغاً" />
                  </div>
                </div>

                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <div className="mb-3 text-xs font-bold text-primary">{config.formTitle}</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">الموديل</label>
                      <input value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} className={IC} placeholder="موديل القطعة أو الجهاز" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">الشركة</label>
                      <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} className={IC} list="tech-sub-brands" placeholder="اكتب أو اختر" />
                      <datalist id="tech-sub-brands">
                        {uniqueBrands.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">اللون</label>
                      <input value={form.color} onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))} className={IC} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">المورد</label>
                      <input value={form.supplier} onChange={(event) => setForm((current) => ({ ...current, supplier: event.target.value }))} className={IC} list="tech-sub-suppliers" placeholder="اكتب أو اختر" />
                      <datalist id="tech-sub-suppliers">
                        {uniqueSuppliers.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-foreground">المصدر</label>
                      <input value={form.source} onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))} className={IC} list="tech-sub-sources" placeholder="اكتب أو اختر" />
                      <datalist id="tech-sub-sources">
                        {uniqueSources.map((value) => (
                          <option key={value} value={value} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">الوصف</label>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={2} className={cn(IC, 'resize-none')} />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">ملاحظات</label>
                  <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={2} className={cn(IC, 'resize-none')} />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">الكمية</label>
                    <input type="number" min={0} value={form.quantity} onChange={(event) => setForm((current) => ({ ...current, quantity: Number(event.target.value) || 0 }))} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">تكلفة الشراء</label>
                    <input type="number" min={0} value={form.costPrice} onChange={(event) => setCostPriceValue(Number(event.target.value) || 0)} className={IC} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-primary">سعر البيع</label>
                    <input type="number" min={0} value={form.salePrice} onChange={(event) => setSalePriceValue(Number(event.target.value) || 0)} className={cn(IC, 'border-primary/40 focus:ring-primary')} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-emerald-600">هامش الربح</label>
                    <input type="number" min={0} value={form.profitMargin} onChange={(event) => setProfitMarginValue(Number(event.target.value) || 0)} className={cn(IC, 'border-emerald-400/40 focus:ring-emerald-500/20')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold uppercase text-amber-600">حد التنبيه</label>
                    <input type="number" min={0} value={form.minStock} onChange={(event) => setForm((current) => ({ ...current, minStock: Number(event.target.value) || 0 }))} className={cn(IC, 'border-amber-400/40 focus:ring-amber-500/20')} />
                  </div>
                </div>

                {form.salePrice > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">هامش الربح الحالي</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{form.profitMargin.toLocaleString('ar-EG')} ج.م • {calculateMarginPercent(form.costPrice, form.salePrice).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 border-t border-border px-4 pb-4 pt-3">
                <button onClick={handleSave} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                  <Check className="h-4 w-4" />
                  {editId ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </button>
                <button onClick={closeForm} className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted">إلغاء</button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {selectedDetails && <ProductDetailsModal product={selectedDetails} onClose={() => setSelectedDetails(null)} />}

      <ExcelColumnMappingDialog
        open={showExcelRestore}
        onOpenChange={setShowExcelRestore}
        inventoryType={config.excelInventoryType || 'accessory'}
        onSuccess={() => undefined}
        onDataSave={(rows) => {
          rows.forEach((row) => {
            const nextItem = buildImportedItem(row, config.barcodePrefix || 'TECH-');
            if (nextItem.name) config.addItem(nextItem);
          });
        }}
      />
    </div>
  );
}
