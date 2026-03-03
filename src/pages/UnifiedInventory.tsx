// ============================================================
// ELAHMED RETAIL OS — Unified Inventory Page
// Single page for all inventory types with category from URL
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { STORAGE_KEYS } from '@/config';

// Category configuration
const CATEGORIES = {
    mobiles: {
        slug: 'mobiles',
        name: 'Mobiles',
        nameAr: 'الهواتف المحمولة',
        endpoint: 'mobiles',
    },
    computers: {
        slug: 'computers',
        name: 'Computers',
        nameAr: 'الكمبيوترات',
        endpoint: 'computers',
    },
    devices: {
        slug: 'devices',
        name: 'Devices',
        nameAr: 'الأجهزة',
        endpoint: 'devices',
    },
    cars: {
        slug: 'cars',
        name: 'Cars',
        nameAr: 'السيارات',
        endpoint: 'cars',
    },
    warehouse: {
        slug: 'warehouse',
        name: 'Warehouse',
        nameAr: 'المستودع',
        endpoint: 'warehouse',
    },
    used: {
        slug: 'used',
        name: 'Used Devices',
        nameAr: 'ال-used devices',
        endpoint: 'used',
    },
} as const;

export type CategorySlug = keyof typeof CATEGORIES;

// Product type interface
interface InventoryProduct {
    id: string;
    name: string;
    model?: string;
    barcode: string;
    category: string;
    supplier?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    minimumMarginPct?: number;
    createdAt?: string;
    updatedAt?: string;
}

// Data endpoints based on category
const DATA_ENDPOINTS = {
    mobiles: '/api/mobiles',
    computers: '/api/computers',
    devices: '/api/devices',
    cars: '/api/cars',
    warehouse: '/api/warehouse',
    used: '/api/used',
};

export default function UnifiedInventory() {
    const { category } = useParams<{ category: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Get category config
    const categoryConfig = CATEGORIES[category as CategorySlug] || CATEGORIES.mobiles;

    // State
    const [products, setProducts] = useState<InventoryProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<InventoryProduct | null>(null);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isBatchesOpen, setIsBatchesOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);

    const debouncedSearch = useDebounce(searchTerm, 300);

    // Filter products based on search
    const filteredProducts = useMemo(() => {
        if (!debouncedSearch) return products;

        const search = debouncedSearch.toLowerCase();
        return products.filter(p =>
            p.name.toLowerCase().includes(search) ||
            p.barcode.toLowerCase().includes(search) ||
            p.model?.toLowerCase().includes(search) ||
            p.supplier?.toLowerCase().includes(search)
        );
    }, [products, debouncedSearch]);

    // Load data based on category
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const endpoint = DATA_ENDPOINTS[category as CategorySlug] || DATA_ENDPOINTS.mobiles;
                const response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setProducts(data.items || data || []);
                }
            } catch (error) {
                console.error('Failed to load products:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load products',
                    variant: 'destructive'
                });
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [category, toast]);

    // Calculate totals
    const totals = useMemo(() => {
        return {
            count: filteredProducts.length,
            totalQuantity: filteredProducts.reduce((sum, p) => sum + p.quantity, 0),
            totalValue: filteredProducts.reduce((sum, p) => sum + (p.costPrice * p.quantity), 0),
            totalProfit: filteredProducts.reduce((sum, p) => sum + ((p.sellingPrice - p.costPrice) * p.quantity), 0),
        };
    }, [filteredProducts]);

    // Handlers
    const handleAddProduct = async (product: Partial<InventoryProduct>) => {
        try {
            const endpoint = DATA_ENDPOINTS[category as CategorySlug] || DATA_ENDPOINTS.mobiles;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
                },
                body: JSON.stringify(product),
            });

            if (response.ok) {
                const newProduct = await response.json();
                setProducts(prev => [...prev, newProduct]);
                setIsAddDialogOpen(false);
                toast({ title: 'Success', description: 'Product added successfully' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to add product', variant: 'destructive' });
        }
    };

    const handleUpdateProduct = async (id: string, product: Partial<InventoryProduct>) => {
        try {
            const endpoint = DATA_ENDPOINTS[category as CategorySlug] || DATA_ENDPOINTS.mobiles;
            const response = await fetch(`${endpoint}/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
                },
                body: JSON.stringify(product),
            });

            if (response.ok) {
                const updated = await response.json();
                setProducts(prev => prev.map(p => p.id === id ? updated : p));
                setIsEditDialogOpen(false);
                setSelectedProduct(null);
                toast({ title: 'Success', description: 'Product updated successfully' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update product', variant: 'destructive' });
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return;

        try {
            const endpoint = DATA_ENDPOINTS[category as CategorySlug] || DATA_ENDPOINTS.mobiles;
            const response = await fetch(`${endpoint}/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)}`
                }
            });

            if (response.ok) {
                setProducts(prev => prev.filter(p => p.id !== id));
                toast({ title: 'Success', description: 'Product deleted successfully' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete product', variant: 'destructive' });
        }
    };

    const handleImportProducts = (imported: Partial<InventoryProduct>[]) => {
        const newProducts = imported.map(p => ({
            ...p,
            id: crypto.randomUUID(),
            category: categoryConfig.slug,
        })) as InventoryProduct[];

        setProducts(prev => [...prev, ...newProducts]);
        setIsImportOpen(false);
        toast({ title: 'Success', description: `${newProducts.length} products imported` });
    };

    return (
        <div className="space-y-6" dir="rtl">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">{categoryConfig.name}</h1>
                    <p className="text-muted-foreground">{categoryConfig.nameAr}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsImportOpen(true)}>
                        <Upload className="ml-2 h-4 w-4" />
                        استيراد
                    </Button>
                    <Button variant="outline">
                        <Download className="ml-2 h-4 w-4" />
                        تصدير
                    </Button>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="ml-2 h-4 w-4" />
                        إضافة منتج
                    </Button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{totals.count}</div>
                        <p className="text-sm text-muted-foreground">عدد المنتجات</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{totals.totalQuantity.toLocaleString()}</div>
                        <p className="text-sm text-muted-foreground">إجمالي الكمية</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold">{totals.totalValue.toLocaleString()} ج.م</div>
                        <p className="text-sm text-muted-foreground">قيمة المخزون</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-green-600">{totals.totalProfit.toLocaleString()} ج.م</div>
                        <p className="text-sm text-muted-foreground">إجمالي الربح</p>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="بحث..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pr-10"
                    />
                </div>
            </div>

            {/* Products Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>اسم المنتج</TableHead>
                                <TableHead>باركود</TableHead>
                                <TableHead>الموديل</TableHead>
                                <TableHead>المورد</TableHead>
                                <TableHead className="text-left">سعر التكلفة</TableHead>
                                <TableHead className="text-left">سعر البيع</TableHead>
                                <TableHead className="text-left">الكمية</TableHead>
                                <TableHead className="text-left">الربح</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8">
                                        جاري التحميل...
                                    </TableCell>
                                </TableRow>
                            ) : filteredProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8">
                                        لا توجد منتجات
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredProducts.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell className="font-medium">{product.name}</TableCell>
                                        <TableCell>
                                            <div className="w-24">
                                                <BarcodeSVG value={product.barcode} />
                                            </div>
                                        </TableCell>
                                        <TableCell>{product.model || '-'}</TableCell>
                                        <TableCell>{product.supplier || '-'}</TableCell>
                                        <TableCell className="text-left">{product.costPrice.toLocaleString()}</TableCell>
                                        <TableCell className="text-left">{product.sellingPrice.toLocaleString()}</TableCell>
                                        <TableCell className="text-left">
                                            <Badge variant={product.quantity < 5 ? 'destructive' : 'default'}>
                                                {product.quantity}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-left text-green-600">
                                            {((product.sellingPrice - product.costPrice) * product.quantity).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsEditDialogOpen(true);
                                                    }}>
                                                        <Edit className="ml-2 h-4 w-4" />
                                                        تعديل
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setSelectedProduct(product);
                                                        setIsBatchesOpen(true);
                                                    }}>
                                                        <Package className="ml-2 h-4 w-4" />
                                                        الدفعات
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() => handleDeleteProduct(product.id)}
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
                open={isAddDialogOpen || isEditDialogOpen}
                onOpenChange={(open) => {
                    setIsAddDialogOpen(open);
                    setIsEditDialogOpen(open);
                    if (!open) setSelectedProduct(null);
                }}
                product={selectedProduct}
                onSubmit={(product) => {
                    if (selectedProduct) {
                        handleUpdateProduct(selectedProduct.id, product);
                    } else {
                        handleAddProduct(product);
                    }
                }}
            />

            {/* Batches Modal */}
            {selectedProduct && (
                <ProductBatchesModal
                    open={isBatchesOpen}
                    onOpenChange={setIsBatchesOpen}
                    product={selectedProduct}
                />
            )}

            {/* Import Dialog */}
            <ExcelImportDialog
                open={isImportOpen}
                onOpenChange={setIsImportOpen}
                onImport={handleImportProducts}
                expectedColumns={['name', 'barcode', 'model', 'costPrice', 'sellingPrice', 'quantity', 'supplier']}
            />
        </div>
    );
}
