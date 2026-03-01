import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, CheckCircle2, X, ArrowRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Field types that can be mapped
type FieldType = 'text' | 'number' | 'date';

// Definition of fields available for mapping
interface FieldDefinition {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
}

// Inventory type definitions with their fields
const INVENTORY_FIELD_DEFINITIONS: Record<string, FieldDefinition[]> = {
    mobile: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'barcode', label: 'الباركود', type: 'text' },
        { key: 'deviceType', label: 'نوع الجهاز', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'condition', label: 'الحالة', type: 'text' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'storage', label: 'التخزين', type: 'text' },
        { key: 'ram', label: 'الرام', type: 'text' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'supplier', label: 'المورد', type: 'text' },
        { key: 'oldCostPrice', label: 'سعر التكلفة القديم', type: 'number' },
        { key: 'newCostPrice', label: 'سعر التكلفة الجديد', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'serialNumber', label: 'الرقم التسلسلي', type: 'text' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
        { key: 'description', label: 'الوصف', type: 'text' },
    ],
    computer: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'barcode', label: 'الباركود', type: 'text' },
        { key: 'deviceType', label: 'نوع الجهاز', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'condition', label: 'الحالة', type: 'text' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'processor', label: 'المعالج', type: 'text' },
        { key: 'oldCostPrice', label: 'سعر التكلفة القديم', type: 'number' },
        { key: 'newCostPrice', label: 'سعر التكلفة الجديد', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
        { key: 'description', label: 'الوصف', type: 'text' },
    ],
    device: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'barcode', label: 'الباركود', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'condition', label: 'الحالة', type: 'text' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'oldCostPrice', label: 'سعر التكلفة القديم', type: 'number' },
        { key: 'newCostPrice', label: 'سعر التكلفة الجديد', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
        { key: 'description', label: 'الوصف', type: 'text' },
    ],
    used_device: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'deviceType', label: 'نوع الجهاز', type: 'text' },
        { key: 'serialNumber', label: 'الرقم التسلسلي', type: 'text' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'storage', label: 'التخزين', type: 'text' },
        { key: 'ram', label: 'الرام', type: 'text' },
        { key: 'condition', label: 'الحالة', type: 'text' },
        { key: 'purchasePrice', label: 'سعر الشراء', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'description', label: 'الوصف', type: 'text' },
    ],
    car: [
        { key: 'name', label: 'اسم السيارة', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'year', label: 'سنة الصنع', type: 'number' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'plateNumber', label: 'رقم اللوحة', type: 'text' },
        { key: 'licenseExpiry', label: 'تاريخ انتهاء الرخصة', type: 'date' },
        { key: 'condition', label: 'الحالة', type: 'text' },
        { key: 'purchasePrice', label: 'سعر الشراء', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
    ],
    warehouse: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'costPrice', label: 'سعر التكلفة', type: 'number' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
    ],
    accessory: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'barcode', label: 'الباركود', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'subcategory', label: 'الفئة الفرعية', type: 'text' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'color', label: 'اللون', type: 'text' },
        { key: 'oldCostPrice', label: 'سعر التكلفة القديم', type: 'number' },
        { key: 'newCostPrice', label: 'سعر التكلفة الجديد', type: 'number' },
        { key: 'salePrice', label: 'سعر البيع', type: 'number' },
        { key: 'notes', label: 'ملاحظات', type: 'text' },
        { key: 'description', label: 'الوصف', type: 'text' },
    ],
    damaged: [
        { key: 'date', label: 'التاريخ', type: 'date' },
        { key: 'productName', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'quantity', label: 'الكمية', type: 'number' },
        { key: 'costPrice', label: 'سعر التكلفة', type: 'number' },
        { key: 'totalLoss', label: 'إجمالي الخسارة', type: 'number' },
        { key: 'reason', label: 'السبب', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
    ],
    product: [
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true },
        { key: 'model', label: 'الموديل', type: 'text' },
        { key: 'barcode', label: 'الباركود', type: 'text' },
        { key: 'category', label: 'الفئة', type: 'text' },
        { key: 'supplier', label: 'المورد', type: 'text' },
        { key: 'costPrice', label: 'سعر التكلفة', type: 'number' },
        { key: 'sellingPrice', label: 'سعر البيع', type: 'number' },
        { key: 'quantity', label: 'الكمية', type: 'number' },
    ],
};

interface ExcelColumnMappingDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inventoryType: string;
    onSuccess: (count: number) => void;
    onDataSave: (data: Record<string, any>[]) => void;
}

interface ParsedExcelRow {
    _rowIndex: number;
    [key: string]: any;
}

export function ExcelColumnMappingDialog({
    open,
    onOpenChange,
    inventoryType,
    onSuccess,
    onDataSave
}: ExcelColumnMappingDialogProps) {
    const { toast } = useToast();
    const fileRef = useRef<HTMLInputElement>(null);

    const [fileName, setFileName] = useState<string | null>(null);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [excelData, setExcelData] = useState<ParsedExcelRow[]>([]);
    const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
    const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'done'>('upload');
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] });

    const fieldDefinitions = INVENTORY_FIELD_DEFINITIONS[inventoryType] || INVENTORY_FIELD_DEFINITIONS.product;

    const resetState = useCallback(() => {
        setFileName(null);
        setExcelHeaders([]);
        setExcelData([]);
        setColumnMapping({});
        setStep('upload');
        setImportResult({ success: 0, failed: 0, errors: [] });
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

                // Read all data with headers
                const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
                    header: 1,
                    defval: ''
                });

                if (jsonData.length < 2) {
                    toast({ title: 'خطأ', description: 'الملف فارغ أو لا يحتوي على بيانات', variant: 'destructive' });
                    return;
                }

                // Extract headers from first row
                const headers = (jsonData[0] as any[]).map((h, i) => {
                    const headerValue = String(h || '').trim();
                    return headerValue || `عمود ${i + 1}`;
                });

                setExcelHeaders(headers);

                // Parse data rows
                const rows: ParsedExcelRow[] = [];
                for (let i = 1; i < jsonData.length; i++) {
                    const rowData = jsonData[i] as any[];
                    if (!rowData || rowData.every(cell => cell === undefined || cell === null || cell === '')) continue;

                    const row: ParsedExcelRow = { _rowIndex: i + 1 };
                    headers.forEach((header, colIndex) => {
                        row[header] = rowData[colIndex];
                    });
                    rows.push(row);
                }

                if (rows.length === 0) {
                    toast({ title: 'خطأ', description: 'لا توجد صفوف صالحة في الملف', variant: 'destructive' });
                    return;
                }

                setExcelData(rows);

                // Auto-map columns based on similarity
                const autoMapping: Record<string, string> = {};
                headers.forEach(header => {
                    const normalized = header.toLowerCase().trim();

                    // Try to find matching field
                    fieldDefinitions.forEach(field => {
                        const fieldNormalized = field.key.toLowerCase();
                        const fieldLabelNormalized = field.label.toLowerCase();

                        if (normalized === fieldNormalized ||
                            normalized === fieldLabelNormalized ||
                            normalized.includes(fieldNormalized) ||
                            fieldNormalized.includes(normalized) ||
                            normalized === fieldLabelNormalized ||
                            normalized.includes(fieldLabelNormalized) ||
                            fieldLabelNormalized.includes(normalized)) {
                            autoMapping[header] = field.key;
                        }
                    });
                });

                setColumnMapping(autoMapping);
                setStep('mapping');
            } catch (err) {
                console.error(err);
                toast({ title: 'خطأ في قراءة الملف', description: 'تأكد من أن الملف بصيغة Excel صحيحة', variant: 'destructive' });
            }
        };
        reader.readAsArrayBuffer(file);
    }, [toast, fieldDefinitions]);

    const handleMappingChange = (excelColumn: string, fieldKey: string) => {
        setColumnMapping(prev => ({
            ...prev,
            [excelColumn]: fieldKey
        }));
    };

    const getMappedData = useCallback(() => {
        return excelData.map(row => {
            const mappedRow: Record<string, any> = {};

            Object.entries(columnMapping).forEach(([excelColumn, fieldKey]) => {
                if (fieldKey && fieldKey !== 'ignore') {
                    let value = row[excelColumn];

                    // Find field definition
                    const fieldDef = fieldDefinitions.find(f => f.key === fieldKey);

                    if (fieldDef) {
                        // Convert value based on field type
                        if (fieldDef.type === 'number') {
                            value = parseFloat(value) || 0;
                        } else if (fieldDef.type === 'date') {
                            // Try to parse date
                            if (value instanceof Date) {
                                value = value.toISOString();
                            } else if (typeof value === 'string') {
                                const date = new Date(value);
                                if (!isNaN(date.getTime())) {
                                    value = date.toISOString();
                                }
                            }
                        } else {
                            value = String(value || '');
                        }
                    }

                    mappedRow[fieldKey] = value;
                }
            });

            return mappedRow;
        });
    }, [excelData, columnMapping, fieldDefinitions]);

    const validateMappedData = useCallback(() => {
        const mappedData = getMappedData();
        const errors: string[] = [];
        let validCount = 0;

        mappedData.forEach((row, index) => {
            // Check required fields
            const requiredFields = fieldDefinitions.filter(f => f.required);
            const missingFields = requiredFields.filter(f => !row[f.key] || row[f.key] === '');

            if (missingFields.length > 0) {
                errors.push(`صف ${index + 1}: مفقود حقول مطلوبة - ${missingFields.map(f => f.label).join(', ')}`);
            } else {
                validCount++;
            }
        });

        return { validCount, errors, mappedData };
    }, [getMappedData, fieldDefinitions]);

    const handleProceedToPreview = useCallback(() => {
        const { validCount, errors } = validateMappedData();

        if (validCount === 0) {
            toast({
                title: 'خطأ في البيانات',
                description: errors.length > 0 ? errors.slice(0, 3).join('\n') : 'لا توجد بيانات صالحة',
                variant: 'destructive'
            });
            return;
        }

        setStep('preview');
    }, [validateMappedData, toast]);

    const handleImport = useCallback(() => {
        setImporting(true);

        const { mappedData } = validateMappedData();

        // Save data
        try {
            onDataSave(mappedData);
            setImportResult({
                success: mappedData.length,
                failed: 0,
                errors: []
            });
            setStep('done');
            onSuccess(mappedData.length);
            toast({
                title: 'تم الاسترداد بنجاح',
                description: `تم استيراد ${mappedData.length} سجل بنجاح`,
            });
        } catch (err) {
            setImportResult({
                success: 0,
                failed: mappedData.length,
                errors: ['حدث خطأ أثناء الحفظ']
            });
            toast({
                title: 'خطأ في الحفظ',
                description: 'حدث خطأ أثناء حفظ البيانات',
                variant: 'destructive'
            });
        }

        setImporting(false);
    }, [validateMappedData, onDataSave, onSuccess, toast]);

    const mappedData = step === 'preview' ? getMappedData() : [];
    const { validCount, errors } = step === 'mapping' ? validateMappedData() : { validCount: 0, errors: [] as string[] };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-primary" />
                        استرداد بيانات من Excel - {inventoryType === 'product' ? 'المنتجات' :
                            inventoryType === 'mobile' ? 'الموبايلات' :
                                inventoryType === 'computer' ? 'الكمبيوتر' :
                                    inventoryType === 'device' ? 'الأجهزة' :
                                        inventoryType === 'used_device' ? 'الجهاز المستخدم' :
                                            inventoryType === 'car' ? 'السيارات' :
                                                inventoryType === 'warehouse' ? 'المستودع' :
                                                    inventoryType === 'damaged' ? 'الهنات' : 'الملحقات'}
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
                                <p className="text-xs text-muted-foreground mt-1">يدعم ملفات .xlsx و .xls و .csv</p>
                            </div>
                        </div>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileChange}
                            className="hidden"
                        />

                        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                            <h3 className="text-xs font-semibold text-card-foreground">الحقول المتاحة للتعيين:</h3>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {fieldDefinitions.map(field => (
                                    <span key={field.key} className={cn(
                                        "rounded-full px-2.5 py-1 text-[11px] font-medium",
                                        field.required ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                    )}>
                                        {field.label} {field.required && '*'}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Column Mapping */}
                {step === 'mapping' && (
                    <div className="flex-1 overflow-hidden flex flex-col gap-4 py-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-card-foreground font-medium">
                                    <FileSpreadsheet className="inline h-4 w-4 me-1" />
                                    {fileName}
                                </span>
                                <span className="rounded-full bg-chart-3/10 px-2.5 py-0.5 text-xs font-medium text-chart-3">
                                    {excelData.length} صف
                                </span>
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
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">عمود Excel</th>
                                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-8"></th>
                                        <th className="px-3 py-2 text-start font-medium text-muted-foreground">تعيين إلى حقل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {excelHeaders.map((header, idx) => (
                                        <tr key={idx} className="border-b border-border last:border-0">
                                            <td className="px-3 py-2 font-medium text-card-foreground">{header}</td>
                                            <td className="px-3 py-2 text-center">
                                                <ArrowRight className="h-4 w-4 text-muted-foreground inline" />
                                            </td>
                                            <td className="px-3 py-2">
                                                <Select
                                                    value={columnMapping[header] || ''}
                                                    onValueChange={(value) => handleMappingChange(header, value)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="اختر الحقل..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="ignore">-- تجاهل هذا العمود --</SelectItem>
                                                        {fieldDefinitions.map(field => (
                                                            <SelectItem key={field.key} value={field.key}>
                                                                {field.label} {field.required && '*'}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {errors.length > 0 && (
                            <div className="rounded-lg bg-destructive/10 p-3">
                                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                                    <AlertCircle className="h-4 w-4" />
                                    تحذيرات:
                                </div>
                                <ul className="mt-1 text-xs text-destructive/80 space-y-1">
                                    {errors.slice(0, 3).map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                    {errors.length > 3 && <li>و {errors.length - 3} المزيد...</li>}
                                </ul>
                            </div>
                        )}

                        <div className="flex justify-between items-center">
                            <p className="text-xs text-muted-foreground">
                                {Object.keys(columnMapping).filter(k => columnMapping[k]).length} عمود تم تعيينه
                            </p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { resetState(); onOpenChange(false); }}>
                                    إلغاء
                                </Button>
                                <Button onClick={handleProceedToPreview}>
                                    متابعة للمعاينة
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Preview */}
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
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setStep('mapping')}>
                                <ArrowRight className="h-4 w-4 me-1" />
                                العودة للتعيين
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto rounded-lg border border-border">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50 sticky top-0">
                                        <th className="px-2 py-2 text-center font-medium text-muted-foreground w-8">#</th>
                                        {fieldDefinitions.filter(f => mappedData[0]?.[f.key] !== undefined).slice(0, 6).map(field => (
                                            <th key={field.key} className="px-2 py-2 text-start font-medium text-muted-foreground">
                                                {field.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {mappedData.slice(0, 50).map((row, i) => (
                                        <tr key={i} className="border-b border-border last:border-0">
                                            <td className="px-2 py-2 text-center text-muted-foreground">{i + 1}</td>
                                            {fieldDefinitions.filter(f => mappedData[0]?.[f.key] !== undefined).slice(0, 6).map(field => (
                                                <td key={field.key} className="px-2 py-2 text-card-foreground">
                                                    {field.type === 'number'
                                                        ? Number(row[field.key]).toLocaleString()
                                                        : String(row[field.key] || '—')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {mappedData.length > 50 && (
                                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                                    ... و {mappedData.length - 50} صف إضافي
                                </div>
                            )}
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
                                {importing ? 'جاري الاسترداد...' : `استرداد ${validCount} سجل`}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 4: Done */}
                {step === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-8">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/10">
                            <CheckCircle2 className="h-8 w-8 text-chart-3" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-lg font-bold text-card-foreground">تم الاسترداد بنجاح!</p>
                            <p className="text-sm text-muted-foreground">
                                {importResult.success} سجل تم استيراده
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
