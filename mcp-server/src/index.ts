#!/usr/bin/env node
// ============================================================
// ElAhmed Retail Suite — MCP Server
// سيرفر MCP يوفر للذكاء الاصطناعي وصول منظم لبيانات المحل
// ============================================================

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
    loadBackupFile,
    isLoaded,
    getAllProducts,
    getMobiles,
    getMobileAccessories,
    getDevices,
    getDeviceAccessories,
    getComputers,
    getComputerAccessories,
    getUsedDevices,
    getCars,
    getWarehouse,
    getSales,
    getCustomers,
    getSuppliers,
    getInstallments,
    getExpenses,
    getOtherRevenue,
    getMaintenance,
    getDamagedItems,
    getEmployees,
    getReturns,
    getWallets,
    getWalletTransactions,
    getPurchaseInvoices,
    getInventoryValue,
    getTotalProductCount,
    getTotalStockUnits,
    getBackupKeys,
    getRawData,
    getBatches,
} from './dataLoader.js';

// ─── Create MCP Server ──────────────────────────────────────
const server = new McpServer({
    name: 'elahmed-retail-suite',
    version: '1.0.0',
});

// ─── Helper: Check data loaded ──────────────────────────────
function ensureData(): string | null {
    if (!isLoaded()) {
        return '❌ لم يتم تحميل بيانات. تأكد من وجود ملف باك أب وحدد المسار عبر BACKUP_FILE_PATH أو BACKUP_DIR';
    }
    return null;
}

// ─── Helper: Filter by date range ───────────────────────────
function filterByDateRange(items: any[], startDate?: string, endDate?: string, dateField = 'date'): any[] {
    let result = items;
    if (startDate) {
        const start = new Date(startDate).getTime();
        result = result.filter(i => new Date(i[dateField] || i.createdAt).getTime() >= start);
    }
    if (endDate) {
        const end = new Date(endDate).getTime() + 86400000; // include end day
        result = result.filter(i => new Date(i[dateField] || i.createdAt).getTime() < end);
    }
    return result;
}

// ════════════════════════════════════════════════════════════
// TOOLS
// ════════════════════════════════════════════════════════════

// ─── 1. Dashboard Summary ────────────────────────────────────
server.tool(
    'get_dashboard_summary',
    'ملخص شامل للمحل: عدد المنتجات، المبيعات، المصروفات، الأرباح، والمخزون',
    {},
    async () => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const sales = getSales().filter(s => !s.voidedAt);
        const expenses = getExpenses();
        const otherRevenue = getOtherRevenue();
        const returns = getReturns();
        const installments = getInstallments();
        const maintenance = getMaintenance();

        const totalRevenue = sales.reduce((s, sale) => s + (sale.total || 0), 0);
        const totalCost = sales.reduce((s, sale) => s + (sale.totalCost || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const totalOtherRevenue = otherRevenue.reduce((s, r) => s + (r.amount || 0), 0);
        const totalRefunds = returns.reduce((s, r) => s + (r.totalRefund || 0), 0);
        const maintenanceRevenue = maintenance.reduce((s, m) => s + (m.totalSale || 0), 0);
        const maintenanceProfit = maintenance.reduce((s, m) => s + (m.netProfit || 0), 0);

        const grossProfit = totalRevenue - totalCost;
        const netProfit = grossProfit - totalExpenses + totalOtherRevenue + maintenanceProfit - totalRefunds;

        const summary = {
            inventory: {
                totalProducts: getTotalProductCount(),
                totalStockUnits: getTotalStockUnits(),
                inventoryValue: Math.round(getInventoryValue()),
                sections: {
                    mobiles: getMobiles().length,
                    mobileAccessories: getMobileAccessories().length,
                    devices: getDevices().length,
                    deviceAccessories: getDeviceAccessories().length,
                    computers: getComputers().length,
                    computerAccessories: getComputerAccessories().length,
                    usedDevices: getUsedDevices().length,
                    cars: getCars().length,
                    warehouse: getWarehouse().length,
                },
            },
            sales: {
                totalSales: sales.length,
                totalRevenue: Math.round(totalRevenue),
                totalCost: Math.round(totalCost),
                grossProfit: Math.round(grossProfit),
            },
            expenses: {
                totalExpenses: Math.round(totalExpenses),
                count: expenses.length,
            },
            maintenance: {
                totalOrders: maintenance.length,
                revenue: Math.round(maintenanceRevenue),
                profit: Math.round(maintenanceProfit),
            },
            installments: {
                total: installments.length,
                active: installments.filter(i => i.status === 'active').length,
                completed: installments.filter(i => i.status === 'completed').length,
                overdue: installments.filter(i => i.status === 'overdue').length,
            },
            returns: {
                total: returns.length,
                totalRefunds: Math.round(totalRefunds),
            },
            otherRevenue: {
                total: Math.round(totalOtherRevenue),
                count: otherRevenue.length,
            },
            customers: getCustomers().length,
            suppliers: getSuppliers().length,
            employees: getEmployees().length,
            netProfit: Math.round(netProfit),
        };

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify(summary, null, 2),
            }],
        };
    },
);

// ─── 2. Search Products ──────────────────────────────────────
server.tool(
    'search_products',
    'البحث عن منتجات بالاسم أو الباركود في كل أقسام المخزون',
    {
        query: z.string().describe('نص البحث (اسم المنتج أو الباركود)'),
        source: z.string().optional().describe('فلتر القسم: mobile, device, computer, car, warehouse, used_device, أو الكل'),
        limit: z.number().optional().describe('عدد النتائج الأقصى (افتراضي 20)'),
    },
    async ({ query, source, limit }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const maxResults = limit || 20;
        const q = query.toLowerCase();

        let products = getAllProducts();
        if (source) {
            products = products.filter(p => p._source === source);
        }

        const results = products
            .filter(p => {
                const name = (p.name || '').toLowerCase();
                const model = (p.model || '').toLowerCase();
                const barcode = (p.barcode || '').toLowerCase();
                const serial = (p.serialNumber || '').toLowerCase();
                return name.includes(q) || model.includes(q) || barcode.includes(q) || serial.includes(q);
            })
            .slice(0, maxResults)
            .map(p => ({
                id: p.id,
                name: p.name,
                model: p.model || '',
                barcode: p.barcode || '',
                source: p._source,
                quantity: p.quantity || p.remainingQty || 0,
                costPrice: p.newCostPrice || p.costPrice || p.purchasePrice || 0,
                salePrice: p.salePrice || p.sellingPrice || 0,
                condition: p.condition || 'new',
            }));

        return {
            content: [{
                type: 'text' as const,
                text: results.length > 0
                    ? JSON.stringify(results, null, 2)
                    : `لم يتم العثور على منتجات تطابق "${query}"`,
            }],
        };
    },
);

// ─── 3. Product Details ──────────────────────────────────────
server.tool(
    'get_product_details',
    'عرض كل تفاصيل منتج معين بالـ ID',
    {
        productId: z.string().describe('معرف المنتج (ID)'),
    },
    async ({ productId }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const product = getAllProducts().find(p => p.id === productId);
        if (!product) {
            return { content: [{ type: 'text' as const, text: `منتج غير موجود: ${productId}` }] };
        }

        // Find related batches
        const batches = getBatches().filter(b => b.productId === productId);

        // Find sales containing this product
        const relatedSales = getSales()
            .filter(s => s.items?.some((item: any) => item.productId === productId))
            .slice(0, 10)
            .map(s => ({
                invoiceNumber: s.invoiceNumber,
                date: s.date,
                total: s.total,
                voided: !!s.voidedAt,
            }));

        const result = {
            ...product,
            _batches: batches.length > 0 ? batches : undefined,
            _recentSales: relatedSales.length > 0 ? relatedSales : undefined,
        };

        // Remove image data to save tokens
        delete result.image;

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
            }],
        };
    },
);

// ─── 4. Sales ────────────────────────────────────────────────
server.tool(
    'get_sales',
    'عرض المبيعات مع فلتر اختياري بالتاريخ',
    {
        startDate: z.string().optional().describe('من تاريخ (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('إلى تاريخ (YYYY-MM-DD)'),
        limit: z.number().optional().describe('عدد النتائج الأقصى (افتراضي 50)'),
        includeVoided: z.boolean().optional().describe('تضمين المبيعات الملغاة'),
    },
    async ({ startDate, endDate, limit, includeVoided }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        let sales = getSales();
        if (!includeVoided) {
            sales = sales.filter(s => !s.voidedAt);
        }
        sales = filterByDateRange(sales, startDate, endDate);

        const maxResults = limit || 50;
        const result = sales.slice(0, maxResults).map(s => ({
            id: s.id,
            invoiceNumber: s.invoiceNumber,
            date: s.date,
            itemCount: s.items?.length || 0,
            subtotal: s.subtotal,
            discount: s.discount,
            total: s.total,
            totalCost: s.totalCost,
            grossProfit: s.grossProfit,
            paymentMethod: s.paymentMethod,
            employee: s.employee,
            voided: !!s.voidedAt,
        }));

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    total: sales.length,
                    showing: result.length,
                    totalRevenue: Math.round(sales.reduce((s, sale) => s + (sale.total || 0), 0)),
                    sales: result,
                }, null, 2),
            }],
        };
    },
);

// ─── 5. Customers ────────────────────────────────────────────
server.tool(
    'get_customers',
    'عرض كل العملاء',
    {},
    async () => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const customers = getCustomers();
        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({ total: customers.length, customers }, null, 2),
            }],
        };
    },
);

// ─── 6. Installments ─────────────────────────────────────────
server.tool(
    'get_installments',
    'عرض عقود التقسيط مع فلتر بالحالة',
    {
        status: z.enum(['active', 'completed', 'overdue', 'all']).optional().describe('حالة العقد'),
    },
    async ({ status }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        let installments = getInstallments();
        if (status && status !== 'all') {
            installments = installments.filter(i => i.status === status);
        }

        const result = installments.map(i => ({
            id: i.id,
            contractNumber: i.contractNumber,
            contractType: i.contractType || 'product',
            customerName: i.customerName,
            customerPhone: i.customerPhone,
            productName: i.productName,
            cashPrice: i.cashPrice,
            installmentPrice: i.installmentPrice,
            downPayment: i.downPayment,
            months: i.months,
            monthlyInstallment: i.monthlyInstallment,
            paidTotal: i.paidTotal,
            remaining: i.remaining,
            status: i.status,
            createdAt: i.createdAt,
        }));

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    total: result.length,
                    totalRemaining: Math.round(installments.reduce((s, i) => s + (i.remaining || 0), 0)),
                    installments: result,
                }, null, 2),
            }],
        };
    },
);

// ─── 7. Expenses ─────────────────────────────────────────────
server.tool(
    'get_expenses',
    'عرض المصروفات مع فلتر بالتاريخ',
    {
        startDate: z.string().optional().describe('من تاريخ (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('إلى تاريخ (YYYY-MM-DD)'),
    },
    async ({ startDate, endDate }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const expenses = filterByDateRange(getExpenses(), startDate, endDate);
        const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

        // Group by category
        const byCategory: Record<string, number> = {};
        expenses.forEach(e => {
            const cat = e.category || 'other';
            byCategory[cat] = (byCategory[cat] || 0) + (e.amount || 0);
        });

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    total: expenses.length,
                    totalAmount: Math.round(total),
                    byCategory,
                    expenses,
                }, null, 2),
            }],
        };
    },
);

// ─── 8. Maintenance Orders ───────────────────────────────────
server.tool(
    'get_maintenance_orders',
    'عرض أوامر الصيانة والإصلاح',
    {
        status: z.enum(['pending', 'in_progress', 'done', 'delivered', 'all']).optional().describe('حالة الأمر'),
    },
    async ({ status }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        let orders = getMaintenance();
        if (status && status !== 'all') {
            orders = orders.filter(o => o.status === status);
        }

        const result = orders.map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            customerPhone: o.customerPhone,
            deviceName: o.deviceName,
            deviceCategory: o.deviceCategory,
            issueDescription: o.issueDescription,
            totalCost: o.totalCost,
            totalSale: o.totalSale,
            netProfit: o.netProfit,
            status: o.status,
            date: o.date,
        }));

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({ total: result.length, orders: result }, null, 2),
            }],
        };
    },
);

// ─── 9. Suppliers ────────────────────────────────────────────
server.tool(
    'get_suppliers',
    'عرض كل الموردين',
    {},
    async () => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const suppliers = getSuppliers();
        const transactions = getSupplierTransactions();
        const invoices = getPurchaseInvoices();

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    totalSuppliers: suppliers.length,
                    totalTransactions: transactions.length,
                    totalInvoices: invoices.length,
                    suppliers,
                }, null, 2),
            }],
        };
    },
);

// ─── 10. Inventory Summary ───────────────────────────────────
server.tool(
    'get_inventory_summary',
    'ملخص المخزون في كل الأقسام: الكميات والقيم',
    {},
    async () => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        function sectionSummary(items: any[], name: string) {
            const totalQty = items.reduce((s, p) => s + (p.quantity || p.remainingQty || 0), 0);
            const totalCost = items.reduce((s, p) => {
                const cost = p.newCostPrice || p.costPrice || p.purchasePrice || 0;
                const qty = p.quantity || p.remainingQty || 0;
                return s + cost * qty;
            }, 0);
            const totalSale = items.reduce((s, p) => {
                const price = p.salePrice || p.sellingPrice || 0;
                const qty = p.quantity || p.remainingQty || 0;
                return s + price * qty;
            }, 0);
            return {
                section: name,
                productCount: items.length,
                totalQuantity: totalQty,
                totalCostValue: Math.round(totalCost),
                totalSaleValue: Math.round(totalSale),
                potentialProfit: Math.round(totalSale - totalCost),
            };
        }

        const sections = [
            sectionSummary(getMobiles(), 'الموبايلات'),
            sectionSummary(getMobileAccessories(), 'اكسسوارات الموبايل'),
            sectionSummary(getDevices(), 'الأجهزة'),
            sectionSummary(getDeviceAccessories(), 'اكسسوارات الأجهزة'),
            sectionSummary(getComputers(), 'الكمبيوترات'),
            sectionSummary(getComputerAccessories(), 'اكسسوارات الكمبيوتر'),
            sectionSummary(getUsedDevices(), 'أجهزة مستعملة'),
            sectionSummary(getCars(), 'السيارات'),
            sectionSummary(getWarehouse(), 'المخزن'),
        ];

        const totals = {
            totalProducts: sections.reduce((s, sec) => s + sec.productCount, 0),
            totalQuantity: sections.reduce((s, sec) => s + sec.totalQuantity, 0),
            totalCostValue: sections.reduce((s, sec) => s + sec.totalCostValue, 0),
            totalSaleValue: sections.reduce((s, sec) => s + sec.totalSaleValue, 0),
            totalPotentialProfit: sections.reduce((s, sec) => s + sec.potentialProfit, 0),
        };

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({ sections, totals }, null, 2),
            }],
        };
    },
);

// ─── 11. Low Stock Alerts ────────────────────────────────────
server.tool(
    'get_low_stock_alerts',
    'المنتجات اللي كميتها قليلة (أقل من الحد المحدد)',
    {
        threshold: z.number().optional().describe('الحد الأدنى للكمية (افتراضي 3)'),
    },
    async ({ threshold }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const minQty = threshold ?? 3;
        const lowStock = getAllProducts()
            .filter(p => (p.quantity || p.remainingQty || 0) <= minQty && (p.quantity || p.remainingQty || 0) >= 0)
            .map(p => ({
                id: p.id,
                name: p.name,
                model: p.model || '',
                source: p._source,
                quantity: p.quantity || p.remainingQty || 0,
                salePrice: p.salePrice || p.sellingPrice || 0,
            }))
            .sort((a, b) => a.quantity - b.quantity);

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    threshold: minQty,
                    alertCount: lowStock.length,
                    outOfStock: lowStock.filter(p => p.quantity === 0).length,
                    products: lowStock,
                }, null, 2),
            }],
        };
    },
);

// ─── 12. Financial Report ────────────────────────────────────
server.tool(
    'get_financial_report',
    'تقرير مالي شامل: الإيرادات، التكاليف، المصروفات، والأرباح لفترة محددة',
    {
        startDate: z.string().optional().describe('من تاريخ (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('إلى تاريخ (YYYY-MM-DD)'),
    },
    async ({ startDate, endDate }) => {
        const err = ensureData();
        if (err) return { content: [{ type: 'text' as const, text: err }] };

        const sales = filterByDateRange(getSales().filter(s => !s.voidedAt), startDate, endDate);
        const expenses = filterByDateRange(getExpenses(), startDate, endDate);
        const otherRev = filterByDateRange(getOtherRevenue(), startDate, endDate);
        const returns = filterByDateRange(getReturns(), startDate, endDate);
        const maintenance = filterByDateRange(getMaintenance(), startDate, endDate, 'createdAt');
        const damaged = filterByDateRange(getDamagedItems(), startDate, endDate);

        const revenue = sales.reduce((s, sale) => s + (sale.total || 0), 0);
        const costOfGoods = sales.reduce((s, sale) => s + (sale.totalCost || 0), 0);
        const grossProfit = revenue - costOfGoods;
        const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
        const totalOtherRev = otherRev.reduce((s, r) => s + (r.amount || 0), 0);
        const totalRefunds = returns.reduce((s, r) => s + (r.totalRefund || 0), 0);
        const maintenanceProfit = maintenance.reduce((s, m) => s + (m.netProfit || 0), 0);
        const damagedLoss = damaged.reduce((s, d) => s + (d.totalLoss || 0), 0);

        const netProfit = grossProfit - totalExpenses + totalOtherRev + maintenanceProfit - totalRefunds - damagedLoss;
        const marginPct = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0';

        // Expense breakdown
        const expenseBreakdown: Record<string, number> = {};
        expenses.forEach(e => {
            const cat = e.category || 'other';
            expenseBreakdown[cat] = (expenseBreakdown[cat] || 0) + (e.amount || 0);
        });

        // Daily revenue trend
        const dailyRevenue: Record<string, number> = {};
        sales.forEach(s => {
            const day = (s.date || '').split('T')[0];
            if (day) dailyRevenue[day] = (dailyRevenue[day] || 0) + (s.total || 0);
        });

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    period: {
                        from: startDate || 'بداية البيانات',
                        to: endDate || 'نهاية البيانات',
                    },
                    salesCount: sales.length,
                    revenue: Math.round(revenue),
                    costOfGoods: Math.round(costOfGoods),
                    grossProfit: Math.round(grossProfit),
                    grossMargin: `${marginPct}%`,
                    expenses: Math.round(totalExpenses),
                    expenseBreakdown,
                    otherRevenue: Math.round(totalOtherRev),
                    maintenanceProfit: Math.round(maintenanceProfit),
                    refunds: Math.round(totalRefunds),
                    damagedLoss: Math.round(damagedLoss),
                    netProfit: Math.round(netProfit),
                    dailyRevenue,
                }, null, 2),
            }],
        };
    },
);

// ════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════

server.resource(
    'overview',
    'retail://overview',
    { description: 'نظرة عامة على بيانات المحل' },
    async () => {
        const loaded = isLoaded();
        const text = loaded
            ? JSON.stringify({
                loaded: true,
                totalProducts: getTotalProductCount(),
                totalStockUnits: getTotalStockUnits(),
                inventoryValue: Math.round(getInventoryValue()),
                salesCount: getSales().length,
                customersCount: getCustomers().length,
                suppliersCount: getSuppliers().length,
                employeesCount: getEmployees().length,
                backupKeys: getBackupKeys().length,
            }, null, 2)
            : '{"loaded": false, "message": "لم يتم تحميل بيانات بعد"}';

        return {
            contents: [{
                uri: 'retail://overview',
                mimeType: 'application/json',
                text,
            }],
        };
    },
);

server.resource(
    'storage-keys',
    'retail://storage-keys',
    { description: 'قائمة كل مفاتيح التخزين المتاحة في الباك أب' },
    async () => {
        const keys = getBackupKeys();
        return {
            contents: [{
                uri: 'retail://storage-keys',
                mimeType: 'application/json',
                text: JSON.stringify(keys, null, 2),
            }],
        };
    },
);

// ════════════════════════════════════════════════════════════
// START SERVER
// ════════════════════════════════════════════════════════════

async function main() {
    // Load backup data
    const loadResult = loadBackupFile();
    if (loadResult.success) {
        console.error(`✅ تم تحميل بيانات الباك أب من: ${loadResult.path}`);
    } else {
        console.error(`⚠️ ${loadResult.error}`);
        console.error('السيرفر هيشتغل بدون بيانات. حدد ملف الباك أب عبر:');
        console.error('  BACKUP_FILE_PATH=path/to/backup.json');
        console.error('  أو BACKUP_DIR=path/to/backups/folder');
    }

    // Connect via stdio
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 ElAhmed Retail MCP Server running on stdio');
}

main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
});
