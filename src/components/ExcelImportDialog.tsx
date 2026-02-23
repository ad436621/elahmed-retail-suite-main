import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Product } from '@/domain/types';
import { saveProduct } from '@/repositories/productRepository';
import { generateBarcode } from '@/domain/product';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExcelImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

interface ParsedRow {
    name: string;
    model: string;
    barcode: string;
    category: string;
    supplier: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    valid: boolean;
    errors: string[];
}

// Map possible Arabic/English column headers to our field names
const COLUMN_MAP: Record<string, keyof Omit<ParsedRow, 'valid' | 'errors'>> = {
    // Arabic
    'اسم المنتج': 'name',
    'الاسم': 'name',
    'المنتج': 'name',
    'الموديل': 'model',
    'موديل': 'model',
    'رقم الموديل': 'model',
    'الباركود': 'barcode',
    'باركود': 'barcode',
    'الفئة': 'category',
    'فئة': 'category',
    'التصنيف': 'category',
    'المورد': 'supplier',
    'مورد': 'supplier',
    'سعر التكلفة': 'costPrice',
    'التكلفة': 'costPrice',
    'سعر الشراء': 'costPrice',
    'سعر البيع': 'sellingPrice',
    'البيع': 'sellingPrice',
    'الكمية': 'quantity',
    'كمية': 'quantity',
    'المخزون': 'quantity',
    // English
    'name': 'name',
    'product name': 'name',
    'product': 'name',
    'model': 'model',
    'barcode': 'barcode',
    'category': 'category',
    'supplier': 'supplier',
    'cost': 'costPrice',
    'cost price': 'costPrice',
    'costprice': 'costPrice',
    'selling': 'sellingPrice',
    'selling price': 'sellingPrice',
    'sellingprice': 'sellingPrice',
    'price': 'sellingPrice',
    'quantity': 'quantity',
    'qty': 'quantity',
    'stock': 'quantity',
};

function mapColumns(headers: string[]): Record<number, keyof Omit<ParsedRow, 'valid' | 'errors'>> {
    const mapping: Record<number, keyof Omit<ParsedRow, 'valid' | 'errors'>> = {};
    headers.forEach((h, i) => {
        const normalized = h.trim().toLowerCase();
        if (COLUMN_MAP[normalized]) {
            mapping[i] = COLUMN_MAP[normalized];
        }
    });
    return mapping;
}

function validateRow(row: Partial<ParsedRow>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!row.name || row.name.trim().length === 0) errors.push('اسم المنتج مطلوب');
    if (row.costPrice !== undefined && row.sellingPrice !== undefined && row.sellingPrice < row.costPrice) {
        errors.push('سعر البيع أقل من التكلفة');
    }
    if (row.quantity !== undefined && row.quantity < 0) errors.push('الكمية سالبة');
    return { valid: errors.length === 0, errors };
}

function downloadTemplate() {
    const templateData = [
        {
            'اسم المنتج': 'Samsung Galaxy A15',
            'الموديل': 'A15-128',
            'الباركود': '',
            'الفئة': 'Phones',
            'المورد': 'Samsung',
            'سعر التكلفة': 3500,
            'سعر البيع': 4200,
            'الكمية': 10,
        },
        {
            'اسم المنتج': 'كابل شحن Type-C',
            'الموديل': 'TC-1M',
            'الباركود': '',
            'الفئة': 'Cables',
            'المورد': '',
            'سعر التكلفة': 25,
            'سعر البيع': 50,
            'الكمية': 100,
        },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');

    // Auto-size columns
    const colWidths = Object.keys(templateData[0]).map(k => ({ wch: Math.max(k.length, 15) }));
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, 'product_import_template.xlsx');
}

export function ExcelImportDialog({ open, onOpenChange, onSuccess }: ExcelImportDialogProps) {
    const { toast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
    const [importResult, setImportResult] = useState({ success: 0, failed: 0 });

    const resetState = useCallback(() => {
        setFileName(null);
        setParsedRows([]);
        setStep('upload');
        setImportResult({ success: 0, failed: 0 });
        if (fileRef.current) fileRef.current.value = '';
    }, []);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 });

                if (jsonData.length < 2) {
                    toast({ title: 'خطأ', description: 'الملف فارغ أو لا يحتوي على بيانات', variant: 'destructive' });
                    return;
                }

                // First row = headers
                const headers = (jsonData[0] as any[]).map(h => String(h || ''));
                const colMap = mapColumns(headers);

                if (Object.keys(colMap).length === 0) {
                    toast({ title: 'خطأ', description: 'لم يتم التعرف على أعمدة الملف. استخدم القالب.', variant: 'destructive' });
                    return;
                }

                const rows: ParsedRow[] = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i] as any[];
                    if (!rowData || rowData.every(cell => cell === undefined || cell === null || cell === '')) continue;

                    const row: Partial<ParsedRow> = {
                        name: '',
                        model: '',
                        barcode: '',
                        category: '',
                        supplier: '',
                        costPrice: 0,
                        sellingPrice: 0,
                        quantity: 0,
                    };

                    Object.entries(colMap).forEach(([colIdx, field]) => {
                        const val = rowData[Number(colIdx)];
                        if (val === undefined || val === null) return;
                        if (['costPrice', 'sellingPrice', 'quantity'].includes(field)) {
                            (row as any)[field] = Number(val) || 0;
                        } else {
                            (row as any)[field] = String(val).trim();
                        }
                    });

                    const validation = validateRow(row);
                    rows.push({
                        ...(row as ParsedRow),
                        valid: validation.valid,
                        errors: validation.errors,
                    });
                }

                if (rows.length === 0) {
                    toast({ title: 'خطأ', description: 'لا توجد صفوف صالحة في الملف', variant: 'destructive' });
                    return;
                }

                setParsedRows(rows);
                setStep('preview');
            } catch (err) {
                toast({ title: 'خطأ في قراءة الملف', description: 'تأكد من أن الملف بصيغة Excel صحيحة', variant: 'destructive' });
            }
        };
        reader.readAsArrayBuffer(file);
    }, [toast]);

    const handleImport = useCallback(() => {
        setImporting(true);
        const now = new Date().toISOString();
        let success = 0;
        let failed = 0;

        parsedRows.forEach(row => {
            if (!row.valid) {
                failed++;
                return;
            }
            try {
                const product: Product = {
                    id: crypto.randomUUID(),
                    name: row.name,
                    model: row.model || '',
                    barcode: row.barcode || generateBarcode(),
                    category: row.category || 'Uncategorized',
                    supplier: row.supplier || '',
                    costPrice: row.costPrice || 0,
                    sellingPrice: row.sellingPrice || 0,
                    quantity: row.quantity || 0,
                    minimumMarginPct: 10,
                    createdAt: now,
                    updatedAt: now,
                    deletedAt: null,
                };
                saveProduct(product);
                success++;
            } catch (_e) {
                failed++;
            }
        });

        setImportResult({ success, failed });
        setStep('done');
        setImporting(false);

        if (success > 0) {
            onSuccess();
            toast({
                title: `تم استيراد ${success} منتج بنجاح`,
                description: failed > 0 ? `${failed} منتج فشل` : undefined,
            });
        }
    }, [parsedRows, onSuccess, toast]);

    const validCount = parsedRows.filter(r => r.valid).length;
    const invalidCount = parsedRows.filter(r => !r.valid).length;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        استيراد منتجات من Excel
                    </DialogTitle>
                </DialogHeader>

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="space-y-6 py-4">
                        <div
                            onClick={() => fileRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/30 p-12 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all"
                        >
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                                <Upload className="h-8 w-8 text-primary" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-semibold text-card-foreground">اضغط هنا لاختيار ملف Excel</p>
                                <p className="text-xs text-muted-foreground mt-1">يدعم ملفات .xlsx و .xls</p>
                            </div>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                            <p className="text-xs text-muted-foreground">
                                محتاج قالب؟ حمّل قالب Excel جاهز بالأعمدة المطلوبة
                            </p>
                            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                تحميل القالب
                            </Button>
                        </div>

                        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                            <h3 className="text-xs font-semibold text-card-foreground">الأعمدة المدعومة:</h3>
                            <div className="flex flex-wrap gap-1.5">
                                {['اسم المنتج *', 'الموديل', 'الباركود', 'الفئة', 'المورد', 'سعر التكلفة', 'سعر البيع', 'الكمية'].map(col => (
                                    <span key={col} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                        {col}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-card-foreground font-medium">
                                    <FileSpreadsheet className="inline h-4 w-4 me-1" />
                                    {fileName}
                                </span>
                                <span className="rounded-full bg-chart-3/10 px-2.5 py-0.5 text-xs font-medium text-chart-3">
                                    {validCount} صالح
                                </span>
                                {invalidCount > 0 && (
                                    <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                                        {invalidCount} خطأ
                                    </span>
                                )}
                            </div>
                            <Button variant="ghost" size="sm" onClick={resetState}>
                                <X className="h-4 w-4 me-1" />
                                تغيير الملف
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto rounded-lg border border-border">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50 sticky top-0">
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground w-8">#</th>
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">الاسم</th>
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">الموديل</th>
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">الفئة</th>
                                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">التكلفة</th>
                                        <th className="px-3 py-2 text-end font-medium text-muted-foreground">البيع</th>
                                        <th className="px-3 py-2 text-center font-medium text-muted-foreground">الكمية</th>
                                        <th className="px-3 py-2 text-center font-medium text-muted-foreground">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {parsedRows.map((row, i) => (
                                        <tr key={i} className={cn(
                                            'border-b border-border last:border-0',
                                            !row.valid && 'bg-destructive/5'
                                        )}>
                                            <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                                            <td className="px-3 py-2 font-medium text-card-foreground">{row.name || '—'}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.model || '—'}</td>
                                            <td className="px-3 py-2 text-muted-foreground">{row.category || '—'}</td>
                                            <td className="px-3 py-2 text-end text-muted-foreground">{row.costPrice}</td>
                                            <td className="px-3 py-2 text-end text-card-foreground font-medium">{row.sellingPrice}</td>
                                            <td className="px-3 py-2 text-center">{row.quantity}</td>
                                            <td className="px-3 py-2 text-center">
                                                {row.valid ? (
                                                    <CheckCircle2 className="inline h-4 w-4 text-chart-3" />
                                                ) : (
                                                    <span className="text-destructive" title={row.errors.join(', ')}>
                                                        <AlertTriangle className="inline h-4 w-4" />
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
                                إلغاء
                            </Button>
                            <Button
                                onClick={handleImport}
                                disabled={importing || validCount === 0}
                                className="gap-1.5"
                            >
                                {importing ? 'جاري الاستيراد...' : `استيراد ${validCount} منتج`}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Done */}
                {step === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/10">
                            <CheckCircle2 className="h-8 w-8 text-chart-3" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-lg font-bold text-card-foreground">تم الاستيراد بنجاح!</p>
                            <p className="text-sm text-muted-foreground">
                                {importResult.success} منتج تم استيراده
                                {importResult.failed > 0 && ` · ${importResult.failed} فشل`}
                            </p>
                        </div>
                        <Button onClick={() => { resetState(); onOpenChange(false); }}>
                            إغلاق
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
