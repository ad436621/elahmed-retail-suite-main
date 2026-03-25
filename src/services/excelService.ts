// ============================================================
// Excel Import / Export Service
// Centralized utility for all Excel operations
// ============================================================

import * as XLSX from 'xlsx';

// ─── Types ──────────────────────────────────────────────────

export interface ExcelColumn {
    key: string;
    header: string;       // Arabic column header
    width?: number;       // column width in characters
    format?: 'text' | 'number' | 'date' | 'currency';
}

export interface ExportConfig {
    data: Record<string, any>[];
    columns: ExcelColumn[];
    fileName: string;        // without extension
    sheetName?: string;
}

export interface TemplateConfig {
    columns: ExcelColumn[];
    sampleRows?: Record<string, any>[];
    fileName: string;
    sheetName?: string;
}

// ─── Export Function ────────────────────────────────────────

export function exportToExcel({ data, columns, fileName, sheetName = 'البيانات' }: ExportConfig): void {
    // Map data to only include specified columns with Arabic headers
    const exportData = data.map(row => {
        const mapped: Record<string, any> = {};
        columns.forEach(col => {
            let value = row[col.key];
            if (col.format === 'currency' && typeof value === 'number') {
                value = value; // keep as number for Excel formatting
            } else if (col.format === 'date' && value) {
                // Format ISO date to readable date
                try { value = new Date(value).toLocaleDateString('ar-EG'); } catch { /* keep as-is */ }
            }
            mapped[col.header] = value ?? '';
        });
        return mapped;
    });

    // If no data, create sheet with just headers
    const ws = exportData.length > 0
        ? XLSX.utils.json_to_sheet(exportData)
        : XLSX.utils.json_to_sheet([], { header: columns.map(c => c.header) });

    // Set column widths
    ws['!cols'] = columns.map(col => ({ wch: col.width || Math.max(col.header.length * 2, 15) }));

    // RTL direction for Arabic
    ws['!dir'] = 'rtl';

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
}

// ─── Template Download ──────────────────────────────────────

export function downloadTemplate({ columns, sampleRows, fileName, sheetName = 'قالب' }: TemplateConfig): void {
    const templateData = sampleRows && sampleRows.length > 0
        ? sampleRows.map(row => {
            const mapped: Record<string, any> = {};
            columns.forEach(col => { mapped[col.header] = row[col.key] ?? ''; });
            return mapped;
        })
        : [columns.reduce((acc, col) => { acc[col.header] = ''; return acc; }, {} as Record<string, any>)];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = columns.map(col => ({ wch: col.width || Math.max(col.header.length * 2, 15) }));
    ws['!dir'] = 'rtl';

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `${fileName}_قالب.xlsx`);
}

// ─── Multi-Sheet Export ─────────────────────────────────────

export function exportMultiSheetExcel(
    sheets: { sheetName: string; data: Record<string, any>[]; columns: ExcelColumn[] }[],
    fileName: string
): void {
    const wb = XLSX.utils.book_new();

    sheets.forEach(({ sheetName, data, columns }) => {
        const exportData = data.map(row => {
            const mapped: Record<string, any> = {};
            columns.forEach(col => {
                let value = row[col.key];
                if (col.format === 'date' && value) {
                    try { value = new Date(value).toLocaleDateString('ar-EG'); } catch { /* keep as-is */ }
                }
                mapped[col.header] = value ?? '';
            });
            return mapped;
        });

        const ws = XLSX.utils.json_to_sheet(exportData.length > 0 ? exportData : [{}]);
        ws['!cols'] = columns.map(col => ({ wch: col.width || Math.max(col.header.length * 2, 15) }));
        ws['!dir'] = 'rtl';
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${fileName}_${dateStr}.xlsx`);
}

// ============================================================
// COLUMN DEFINITIONS — Per Section
// ============================================================

// ─── 1. Mobiles ─────────────────────────────────────────────

export const MOBILE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المنتج', width: 25 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'deviceType', header: 'نوع الجهاز', width: 12 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'brand', header: 'الشركة', width: 16 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'storage', header: 'التخزين', width: 12 },
    { key: 'ram', header: 'الرام', width: 10 },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'supplier', header: 'المورد', width: 18 },
    { key: 'source', header: 'المصدر', width: 15 },
    { key: 'serialNumber', header: 'IMEI 1', width: 20 },
    { key: 'imei2', header: 'IMEI 2', width: 20 },
    { key: 'boxNumber', header: 'رقم الكرتونة', width: 15 },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'profitMargin', header: 'هامش الربح', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 2. Mobile Accessories ──────────────────────────────────

export const MOBILE_ACCESSORY_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المنتج', width: 25 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'subcategory', header: 'الفئة الفرعية', width: 15 },
    { key: 'brand', header: 'الشركة', width: 16 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'supplier', header: 'المورد', width: 18 },
    { key: 'source', header: 'المصدر', width: 15 },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'profitMargin', header: 'هامش الربح', width: 15, format: 'currency' },
    { key: 'minStock', header: 'حد التنبيه', width: 14, format: 'number' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 3. Mobile Spare Parts (same as accessories) ────────────

export const MOBILE_SPARE_COLUMNS: ExcelColumn[] = [...MOBILE_ACCESSORY_COLUMNS];

// ─── 4. Computers ───────────────────────────────────────────

export const COMPUTER_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المنتج', width: 25 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'deviceType', header: 'نوع الجهاز', width: 14 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'brand', header: 'الشركة', width: 16 },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'ram', header: 'الرام', width: 10 },
    { key: 'storage', header: 'التخزين', width: 12 },
    { key: 'processor', header: 'المعالج', width: 15 },
    { key: 'supplier', header: 'المورد', width: 18 },
    { key: 'source', header: 'المصدر', width: 15 },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'profitMargin', header: 'هامش الربح', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 5. Computer Accessories ────────────────────────────────

export const COMPUTER_ACCESSORY_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المنتج', width: 25 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'subcategory', header: 'الفئة الفرعية', width: 15 },
    { key: 'brand', header: 'الشركة', width: 16 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'supplier', header: 'المورد', width: 18 },
    { key: 'source', header: 'المصدر', width: 15 },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'profitMargin', header: 'هامش الربح', width: 15, format: 'currency' },
    { key: 'minStock', header: 'حد التنبيه', width: 14, format: 'number' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 6. Computer Spare Parts ────────────────────────────────

export const COMPUTER_SPARE_COLUMNS: ExcelColumn[] = [...COMPUTER_ACCESSORY_COLUMNS];

// ─── 7. Devices ─────────────────────────────────────────────

export const DEVICE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم الجهاز', width: 25 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'brand', header: 'الشركة', width: 16 },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'supplier', header: 'المورد', width: 18 },
    { key: 'source', header: 'المصدر', width: 15 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'profitMargin', header: 'هامش الربح', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 8. Device Accessories ──────────────────────────────────

export const DEVICE_ACCESSORY_COLUMNS: ExcelColumn[] = [...COMPUTER_ACCESSORY_COLUMNS];

// ─── 9. Device Spare Parts ──────────────────────────────────

export const DEVICE_SPARE_COLUMNS: ExcelColumn[] = [...COMPUTER_ACCESSORY_COLUMNS];

// ─── 10. Cars ───────────────────────────────────────────────

export const CAR_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم السيارة', width: 22 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'year', header: 'سنة الصنع', width: 12, format: 'number' },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'plateNumber', header: 'رقم اللوحة', width: 15 },
    { key: 'licenseExpiry', header: 'انتهاء الرخصة', width: 15, format: 'date' },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'category', header: 'التصنيف', width: 15 },
    { key: 'purchasePrice', header: 'سعر الشراء', width: 15, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 11. Car Spare Parts (uses SubSection generic) ──────────

export const CAR_SPARE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم القطعة', width: 25 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'barcode', header: 'الباركود', width: 18 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'subcategory', header: 'الفئة الفرعية', width: 15 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'oldCostPrice', header: 'سعر التكلفة القديم', width: 18, format: 'currency' },
    { key: 'newCostPrice', header: 'سعر التكلفة الجديد', width: 18, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 12. Car Oils ───────────────────────────────────────────

export const CAR_OIL_COLUMNS: ExcelColumn[] = [...CAR_SPARE_COLUMNS];

// ─── 13. Used Devices ───────────────────────────────────────

export const USED_DEVICE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم الجهاز', width: 22 },
    { key: 'model', header: 'الموديل', width: 15 },
    { key: 'deviceType', header: 'نوع الجهاز', width: 14 },
    { key: 'serialNumber', header: 'الرقم التسلسلي', width: 20 },
    { key: 'color', header: 'اللون', width: 12 },
    { key: 'storage', header: 'التخزين', width: 12 },
    { key: 'ram', header: 'الرام', width: 10 },
    { key: 'condition', header: 'الحالة', width: 12 },
    { key: 'purchasePrice', header: 'سعر الشراء', width: 15, format: 'currency' },
    { key: 'salePrice', header: 'سعر البيع', width: 15, format: 'currency' },
    { key: 'description', header: 'الوصف', width: 25 },
];

// ─── 14. Warehouse ──────────────────────────────────────────

export const WAREHOUSE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المنتج', width: 25 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'costPrice', header: 'سعر التكلفة', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 15. Sales ──────────────────────────────────────────────

export const SALES_COLUMNS: ExcelColumn[] = [
    { key: 'invoiceNumber', header: 'رقم الفاتورة', width: 18 },
    { key: 'date', header: 'التاريخ', width: 15, format: 'date' },
    { key: 'itemsSummary', header: 'المنتجات', width: 40 },
    { key: 'subtotal', header: 'المجموع الفرعي', width: 15, format: 'currency' },
    { key: 'discount', header: 'الخصم', width: 12, format: 'currency' },
    { key: 'total', header: 'الإجمالي', width: 15, format: 'currency' },
    { key: 'totalCost', header: 'التكلفة', width: 15, format: 'currency' },
    { key: 'grossProfit', header: 'الربح', width: 15, format: 'currency' },
    { key: 'paymentMethod', header: 'طريقة الدفع', width: 14 },
    { key: 'employee', header: 'الموظف', width: 15 },
];

// ─── 16. Installments ───────────────────────────────────────

export const INSTALLMENT_COLUMNS: ExcelColumn[] = [
    { key: 'contractNumber', header: 'رقم العقد', width: 15 },
    { key: 'contractType', header: 'نوع العقد', width: 14 },
    { key: 'customerName', header: 'اسم العميل', width: 20 },
    { key: 'customerIdCard', header: 'رقم الهوية', width: 18 },
    { key: 'customerPhone', header: 'الهاتف', width: 15 },
    { key: 'productName', header: 'المنتج', width: 22 },
    { key: 'cashPrice', header: 'السعر نقداً', width: 15, format: 'currency' },
    { key: 'installmentPrice', header: 'سعر التقسيط', width: 15, format: 'currency' },
    { key: 'downPayment', header: 'المقدم', width: 15, format: 'currency' },
    { key: 'months', header: 'عدد الأشهر', width: 12, format: 'number' },
    { key: 'monthlyInstallment', header: 'القسط الشهري', width: 15, format: 'currency' },
    { key: 'paidTotal', header: 'المدفوع', width: 15, format: 'currency' },
    { key: 'remaining', header: 'المتبقي', width: 15, format: 'currency' },
    { key: 'status', header: 'الحالة', width: 12 },
    { key: 'createdAt', header: 'تاريخ الإنشاء', width: 15, format: 'date' },
];

// ─── 17. Returns ────────────────────────────────────────────

export const RETURN_COLUMNS: ExcelColumn[] = [
    { key: 'returnNumber', header: 'رقم المرتجع', width: 18 },
    { key: 'originalInvoiceNumber', header: 'رقم الفاتورة الأصلية', width: 20 },
    { key: 'date', header: 'التاريخ', width: 15, format: 'date' },
    { key: 'itemsSummary', header: 'المنتجات المرتجعة', width: 40 },
    { key: 'totalRefund', header: 'المبلغ المسترجع', width: 18, format: 'currency' },
];

// ─── 18. Expenses ───────────────────────────────────────────

export const EXPENSE_COLUMNS: ExcelColumn[] = [
    { key: 'date', header: 'التاريخ', width: 15, format: 'date' },
    { key: 'description', header: 'الوصف', width: 30 },
    { key: 'amount', header: 'المبلغ', width: 15, format: 'currency' },
    { key: 'categoryLabel', header: 'الفئة', width: 15 },
    { key: 'addedBy', header: 'بواسطة', width: 15 },
];

// ─── 19. Damaged / Loss ─────────────────────────────────────

export const DAMAGED_COLUMNS: ExcelColumn[] = [
    { key: 'date', header: 'التاريخ', width: 15, format: 'date' },
    { key: 'productName', header: 'اسم المنتج', width: 25 },
    { key: 'quantity', header: 'الكمية', width: 10, format: 'number' },
    { key: 'costPrice', header: 'سعر التكلفة', width: 15, format: 'currency' },
    { key: 'totalLoss', header: 'إجمالي الخسارة', width: 15, format: 'currency' },
    { key: 'reason', header: 'السبب', width: 25 },
    { key: 'category', header: 'الفئة', width: 15 },
    { key: 'addedBy', header: 'بواسطة', width: 15 },
];

// ─── 20. Employees ──────────────────────────────────────────

export const EMPLOYEE_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم الموظف', width: 22 },
    { key: 'phone', header: 'الهاتف', width: 15 },
    { key: 'position', header: 'المنصب', width: 15 },
    { key: 'baseSalary', header: 'الراتب الأساسي', width: 15, format: 'currency' },
    { key: 'hireDate', header: 'تاريخ التعيين', width: 15, format: 'date' },
    { key: 'isActive', header: 'الحالة', width: 12 },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 21. Salary Records ─────────────────────────────────────

export const SALARY_COLUMNS: ExcelColumn[] = [
    { key: 'employeeName', header: 'اسم الموظف', width: 22 },
    { key: 'month', header: 'الشهر', width: 12 },
    { key: 'baseSalary', header: 'الراتب الأساسي', width: 15, format: 'currency' },
    { key: 'bonus', header: 'المكافأة', width: 12, format: 'currency' },
    { key: 'deduction', header: 'الخصم', width: 12, format: 'currency' },
    { key: 'advanceDeducted', header: 'السلف المخصومة', width: 15, format: 'currency' },
    { key: 'netSalary', header: 'صافي الراتب', width: 15, format: 'currency' },
    { key: 'paidAt', header: 'تاريخ الدفع', width: 15, format: 'date' },
];

// ─── 22. Suppliers ──────────────────────────────────────────

export const SUPPLIER_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم المورد', width: 22 },
    { key: 'phone', header: 'الهاتف', width: 15 },
    { key: 'address', header: 'العنوان', width: 25 },
    { key: 'balance', header: 'الرصيد', width: 15, format: 'currency' },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ─── 23. Customers ──────────────────────────────────────────

export const CUSTOMER_COLUMNS: ExcelColumn[] = [
    { key: 'name', header: 'اسم العميل', width: 22 },
    { key: 'phone', header: 'الهاتف', width: 15 },
    { key: 'address', header: 'العنوان', width: 25 },
    { key: 'email', header: 'البريد الإلكتروني', width: 22 },
    { key: 'notes', header: 'ملاحظات', width: 25 },
];

// ============================================================
// Helper Mappers — prepare data for export
// ============================================================

const PAYMENT_METHOD_MAP: Record<string, string> = {
    cash: 'نقدي',
    card: 'بطاقة',
    split: 'مختلط',
};

const EXPENSE_CATEGORY_MAP: Record<string, string> = {
    rent: 'إيجار',
    utilities: 'مرافق',
    salaries: 'رواتب',
    supplies: 'مستلزمات',
    maintenance: 'صيانة',
    transport: 'نقل',
    other: 'أخرى',
};

const CONTRACT_TYPE_MAP: Record<string, string> = {
    product: 'منتج',
    transfer: 'تحويل',
    car: 'سيارة',
};

const INSTALLMENT_STATUS_MAP: Record<string, string> = {
    active: 'نشط',
    completed: 'مكتمل',
    overdue: 'متأخر',
};

const CONDITION_MAP: Record<string, string> = {
    new: 'جديد',
    like_new: 'مثل الجديد',
    used: 'مستعمل',
    broken: 'معطل',
};

/** Prepare Sale[] for export (flatten items into summary) */
export function prepareSalesForExport(sales: any[]): Record<string, any>[] {
    return sales.map(sale => ({
        ...sale,
        itemsSummary: sale.items?.map((i: any) => `${i.name} ×${i.qty}`).join(' | ') || '',
        paymentMethod: PAYMENT_METHOD_MAP[sale.paymentMethod] || sale.paymentMethod,
    }));
}

/** Prepare ReturnRecord[] for export */
export function prepareReturnsForExport(returns: any[]): Record<string, any>[] {
    return returns.map(r => ({
        ...r,
        itemsSummary: r.items?.map((i: any) => `${i.name} ×${i.qty} (${i.reason})`).join(' | ') || '',
    }));
}

/** Prepare Expense[] for export */
export function prepareExpensesForExport(expenses: any[]): Record<string, any>[] {
    return expenses.map(e => ({
        ...e,
        categoryLabel: EXPENSE_CATEGORY_MAP[e.category] || e.category,
    }));
}

/** Prepare InstallmentContract[] for export */
export function prepareInstallmentsForExport(contracts: any[]): Record<string, any>[] {
    return contracts.map(c => ({
        ...c,
        contractType: CONTRACT_TYPE_MAP[c.contractType] || c.contractType || '',
        status: INSTALLMENT_STATUS_MAP[c.status] || c.status,
    }));
}

/** Prepare Employee[] for export */
export function prepareEmployeesForExport(employees: any[]): Record<string, any>[] {
    return employees.map(e => ({
        ...e,
        isActive: e.isActive ? 'نشط' : 'غير نشط',
    }));
}

/** Prepare items with condition field for export */
export function prepareConditionForExport(items: any[]): Record<string, any>[] {
    return items.map(item => ({
        ...item,
        condition: CONDITION_MAP[item.condition] || item.condition || '',
    }));
}

const DAMAGED_CATEGORY_MAP: Record<string, string> = {
    mobile: 'موبايل',
    accessory: 'إكسسوار',
    device: 'جهاز',
    computer: 'كمبيوتر',
    cable: 'كابل',
    other: 'أخرى',
};

/** Prepare DamagedItem[] for export */
export function prepareDamagedForExport(items: any[]): Record<string, any>[] {
    return items.map(item => ({
        ...item,
        category: DAMAGED_CATEGORY_MAP[item.category] || item.category || '',
    }));
}

/** Prepare Supplier[] for export */
export function prepareSuppliersForExport(suppliers: any[]): Record<string, any>[] {
    return suppliers.map(s => ({
        ...s,
    }));
}

/** Prepare Customer[] for export */
export function prepareCustomersForExport(customers: any[]): Record<string, any>[] {
    return customers.map(c => ({
        ...c,
    }));
}
