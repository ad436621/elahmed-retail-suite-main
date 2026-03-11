// ============================================================
// ELAHMED RETAIL OS — Generic Inventory Page Component
// Replaces 3 duplicate inventory pages (Mobiles, Computers, Devices)
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Plus, Search, Download, Upload, Printer, MoreHorizontal,
    Edit, Trash2, Eye, Package, Filter, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogDescription, DialogHeader,
    DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { ProductFormDialog } from '@/components/ProductFormDialog';
import { ExcelImportDialog } from '@/components/ExcelImportDialog';
import { ProductBatchesModal } from '@/components/ProductBatchesModal';
import { BarcodeSVG } from '@/components/BarcodeSVG';
import { useConfirm } from '@/components/ConfirmDialog';

// Product type interface
export interface InventoryProduct {
    id: string;
    name: string;
    model: string;
    barcode: string;
    category: string;
    supplier?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    minimumMarginPct?: number;
    createdAt?: string;
    updatedAt?: string;
    deletedAt?: string | null;
}

export interface InventoryCategory {
    id: string;
    name: string;
    nameAr: string;
    slug: string;
}

interface GenericInventoryPageProps {
    title: string;
    titleAr: string;
    categorySlug: string;
    products: InventoryProduct[];
    categories: InventoryCategory[];
    onAddProduct: (product: Partial<InventoryProduct>) => void;
    onUpdateProduct: (id: string, product: Partial<InventoryProduct>) => void;
    onDeleteProduct: (id: string) => void;
    onImportProducts: (products: Partial<InventoryProduct>[]) => void;
}

export function GenericInventoryPage({
    title,
    titleAr,
    categorySlug,
    products,
    categories,
    onAddProduct,
    onUpdateProduct,
    onDeleteProduct,
    onImportProducts,
}: GenericInventoryPageProps) {
    const { toast } = useToast();
    const { confirm } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();

    // State
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(
        searchParams.get('category') || null
    );
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [isBatchesOpen, setIsBatchesOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
    const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);

    // Debounced search
    const debouncedSearch = useDebounce(search, 300);

    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            const matchesSearch = !debouncedSearch ||
                product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                product.barcode.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                product.model?.toLowerCase().includes(debouncedSearch.toLowerCase());

            const matchesCategory = !selectedCategory || product.category === selectedCategory;

            return matchesSearch && matchesCategory;
        });
    }, [products, debouncedSearch, selectedCategory]);

    // Stats
    const stats = useMemo(() => {
        const totalItems = filteredProducts.length;
        const totalQuantity = filteredProducts.reduce((sum, p) => sum + p.quantity, 0);
        const totalValue = filteredProducts.reduce(
            (sum, p) => sum + (p.sellingPrice * p.quantity), 0
        );
        const lowStock = filteredProducts.filter(p => p.quantity < 5).length;

        return { totalItems, totalQuantity, totalValue, lowStock };
    }, [filteredProducts]);

    // Handlers
    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        if (value) {
            setSearchParams({ search: value, category: selectedCategory || '' });
        } else {
            setSearchParams({ category: selectedCategory || '' });
        }
    }, [selectedCategory, setSearchParams]);

    const handleCategoryChange = useCallback((category: string | null) => {
        setSelectedCategory(category);
        if (category) {
            setSearchParams({ search, category });
        } else {
            setSearchParams({ search });
        }
    }, [search, setSearchParams]);

    const handleAdd = useCallback((product: Partial<InventoryProduct>) => {
        onAddProduct(product);
        setIsAddDialogOpen(false);
        toast({ title: 'تمت إضافة المنتج', description: product.name });
    }, [onAddProduct, toast]);

    const handleUpdate = useCallback((product: Partial<InventoryProduct>) => {
        if (editingProduct) {
            onUpdateProduct(editingProduct.id, product);
            setEditingProduct(null);
            toast({ title: 'تم تحديث المنتج', description: product.name });
        }
    }, [editingProduct, onUpdateProduct, toast]);

    const handleDelete = useCallback(async (product: InventoryProduct) => {
        const ok = await confirm({ title: 'حذف منتج', message: `هل أنت متأكد من حذف "${product.name}"؟`, confirmLabel: 'حذف', danger: true });
        if (!ok) return;
        onDeleteProduct(product.id);
        toast({ title: 'تم حذف المنتج', description: product.name });
    }, [onDeleteProduct, toast, confirm]);

    const handlePrintBarcode = useCallback((product: InventoryProduct) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(`
        <html>
          <head><title>باركود - ${product.name}</title></head>
          <body style="text-align:center;padding:20px;font-family:Arial;">
            <h2>${product.name}</h2>
            <svg id="barcode"></svg>
            <p>${product.barcode}</p>
            <p>${product.sellingPrice} ج.م</p>
          </body>
        </html>
      `);
            printWindow.document.close();
        }
    }, []);

    // Sync URL params on mount
    useEffect(() => {
        const urlSearch = searchParams.get('search');
        const urlCategory = searchParams.get('category');
        if (urlSearch) setSearch(urlSearch);
        if (urlCategory) setSelectedCategory(urlCategory);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{title}</h1>
                    <p className="text-muted-foreground">{titleAr}</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 ml-2" />
                        استيراد
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setIsAddDialogOpen(true)}
                    >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة منتج
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي المنتجات</CardDescription>
                        <CardTitle className="text-2xl">{stats.totalItems}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>إجمالي الكمية</CardDescription>
                        <CardTitle className="text-2xl">{stats.totalQuantity}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>القيمة الإجمالية</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats.totalValue.toLocaleString()} ج.م
                        </CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>مخزون منخفض</CardDescription>
                        <CardTitle className="text-2xl text-destructive">
                            {stats.lowStock}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="البحث بالاسم أو الباركود..."
                        value={search}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="pr-10"
                    />
                    {search && (
                        <button
                            onClick={() => handleSearchChange('')}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                            <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                    )}
                </div>
                <select
                    value={selectedCategory || ''}
                    onChange={(e) => handleCategoryChange(e.target.value || null)}
                    className="h-10 px-3 rounded-md border border-input bg-background"
                >
                    <option value="">كل الفئات</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.slug}>{cat.nameAr}</option>
                    ))}
                </select>
            </div>

            {/* Products Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>المنتج</TableHead>
                                <TableHead>باركود</TableHead>
                                <TableHead>المورد</TableHead>
                                <TableHead className="text-left">التكلفة</TableHead>
                                <TableHead className="text-left">السعر</TableHead>
                                <TableHead className="text-left">الكمية</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">
                                        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                        <p className="text-muted-foreground">لا توجد منتجات</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map(product => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{product.name}</p>
                                                {product.model && (
                                                    <p className="text-sm text-muted-foreground">{product.model}</p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">{product.barcode}</TableCell>
                                        <TableCell>{product.supplier || '-'}</TableCell>
                                        <TableCell className="text-left">
                                            {product.costPrice.toLocaleString()} ج.م
                                        </TableCell>
                                        <TableCell className="text-left">
                                            {product.sellingPrice.toLocaleString()} ج.م
                                        </TableCell>
                                        <TableCell className="text-left">
                                            <Badge variant={product.quantity < 5 ? 'destructive' : 'default'}>
                                                {product.quantity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsBatchesOpen(true);
                                                    }}>
                                                        <Eye className="ml-2 h-4 w-4" />
                                                        تفاصيل الدفعات
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setEditingProduct(product)}>
                                                        <Edit className="ml-2 h-4 w-4" />
                                                        تعديل
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handlePrintBarcode(product)}>
                                                        <Printer className="ml-2 h-4 w-4" />
                                                        طباعة الباركود
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(product)}
                                                        className="text-destructive"
                                                    >
                                                        <Trash2 className="ml-2 h-4 w-4" />
                                                        حذف
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Add/Edit Dialog */}
            <ProductFormDialog
                open={isAddDialogOpen || !!editingProduct}
                onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    if (!open) setEditingProduct(null);
                }}
                product={editingProduct}
                onSubmit={editingProduct ? handleUpdate : handleAdd}
            />

            {/* Import Dialog */}
            <ExcelImportDialog
                open={isImportDialogOpen}
                onOpenChange={setIsImportDialogOpen}
                onSuccess={() => {
                    setIsImportDialogOpen(false);
                    onImportProducts([]); // trigger parent refresh if necessary
                }}
            />

            {/* Batches Modal */}
            {selectedProduct && isBatchesOpen && (
                <ProductBatchesModal
                    productId={selectedProduct.id}
                    productName={selectedProduct.name}
                    onClose={() => setIsBatchesOpen(false)}
                />
            )}
        </div>
    );
}
