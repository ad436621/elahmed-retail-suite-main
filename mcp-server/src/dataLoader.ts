// ============================================================
// MCP Server — Data Loader
// يقرأ ملف الباك أب JSON ويوفر البيانات للأدوات
// ============================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// ─── Storage Keys (mirrored from frontend config) ───────────
const STORAGE_KEYS = {
    USERS: 'gx_users',
    MOBILES: 'gx_mobiles_v2',
    MOBILE_ACCESSORIES: 'gx_mobile_accessories',
    DEVICES: 'gx_devices_v2',
    DEVICE_ACCESSORIES: 'gx_device_accessories',
    COMPUTERS: 'gx_computers_v2',
    COMPUTER_ACCESSORIES: 'gx_computer_accessories',
    USED_DEVICES: 'gx_used_devices',
    CARS: 'gx_cars',
    WAREHOUSE: 'gx_warehouse',
    BATCHES: 'gx_product_batches_v1',
    CATEGORIES: 'gx_categories_v1',
    PRODUCTS: 'elahmed-products',
    SALES_LEGACY: 'elahmed_sales',
    AUDIT_LOGS: 'elahmed_audit_logs',
    INVOICE_COUNTER: 'gx_invoice_counter',
    RETURNS: 'gx_returns_v2',
    EXPENSES: 'gx_expenses',
    OTHER_REVENUE: 'gx_other_revenue',
    INSTALLMENTS: 'gx_installments_v2',
    WALLETS: 'gx_wallets',
    WALLET_TRANSACTIONS: 'gx_wallet_transactions',
    CUSTOMERS: 'gx_customers',
    EMPLOYEES: 'gx_employees',
    SALARY_RECORDS: 'gx_salary_records',
    ADVANCES: 'gx_advances',
    DAMAGED_ITEMS: 'gx_damaged_items',
    MAINTENANCE: 'gx_maintenance_v2',
    BLACKLIST: 'gx_blacklist',
    REMINDERS: 'gx_reminders',
    SHIFT_CLOSINGS: 'gx_shift_closings',
    SUPPLIERS: 'gx_suppliers',
    SUPPLIER_TRANSACTIONS: 'gx_supplier_transactions',
    PURCHASE_INVOICES: 'gx_purchase_invoices',
    APP_SETTINGS: 'app_settings',
} as const;

// ─── Raw backup data store ──────────────────────────────────
let backupData: Record<string, string> = {};
let dataLoaded = false;

/**
 * Find the most recent backup file in a directory
 */
function findLatestBackup(dir: string): string | null {
    if (!existsSync(dir)) return null;
    const files = readdirSync(dir)
        .filter(f => f.endsWith('.json') && (f.includes('Backup') || f.includes('backup')))
        .map(f => ({
            name: f,
            path: join(dir, f),
            mtime: statSync(join(dir, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);
    return files.length > 0 ? files[0].path : null;
}

/**
 * Load backup data from a JSON file
 */
export function loadBackupFile(filePath?: string): { success: boolean; path: string; error?: string } {
    // Priority: explicit path > env var > auto-detect in project
    const resolvedPath = filePath
        || process.env.BACKUP_FILE_PATH
        || findLatestBackup(process.env.BACKUP_DIR || '.')
        || findLatestBackup(resolve('..'));

    if (!resolvedPath) {
        return {
            success: false,
            path: '',
            error: 'لا يوجد ملف باك أب. قم بتصدير نسخة احتياطية من التطبيق أو حدد المسار عبر BACKUP_FILE_PATH',
        };
    }

    try {
        const raw = readFileSync(resolvedPath, 'utf-8');
        const parsed = JSON.parse(raw);

        if (typeof parsed !== 'object' || parsed === null) {
            return { success: false, path: resolvedPath, error: 'ملف الباك أب فارغ أو غير صالح' };
        }

        backupData = parsed;
        dataLoaded = true;
        return { success: true, path: resolvedPath };
    } catch (err: any) {
        return { success: false, path: resolvedPath, error: err.message };
    }
}

// ─── Generic getter ─────────────────────────────────────────
function getData<T>(key: string, fallback: T): T {
    if (!dataLoaded) return fallback;
    const raw = backupData[key];
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

// ─── Public Data Accessors ──────────────────────────────────

export function isLoaded(): boolean { return dataLoaded; }

export function getUsers(): any[] { return getData(STORAGE_KEYS.USERS, []); }
export function getMobiles(): any[] { return getData(STORAGE_KEYS.MOBILES, []); }
export function getMobileAccessories(): any[] { return getData(STORAGE_KEYS.MOBILE_ACCESSORIES, []); }
export function getDevices(): any[] { return getData(STORAGE_KEYS.DEVICES, []); }
export function getDeviceAccessories(): any[] { return getData(STORAGE_KEYS.DEVICE_ACCESSORIES, []); }
export function getComputers(): any[] { return getData(STORAGE_KEYS.COMPUTERS, []); }
export function getComputerAccessories(): any[] { return getData(STORAGE_KEYS.COMPUTER_ACCESSORIES, []); }
export function getUsedDevices(): any[] { return getData(STORAGE_KEYS.USED_DEVICES, []); }
export function getCars(): any[] { return getData(STORAGE_KEYS.CARS, []); }
export function getWarehouse(): any[] { return getData(STORAGE_KEYS.WAREHOUSE, []); }
export function getBatches(): any[] { return getData(STORAGE_KEYS.BATCHES, []); }
export function getCategories(): any[] { return getData(STORAGE_KEYS.CATEGORIES, []); }
export function getLegacyProducts(): any[] { return getData(STORAGE_KEYS.PRODUCTS, []); }
export function getSales(): any[] { return getData(STORAGE_KEYS.SALES_LEGACY, []); }
export function getReturns(): any[] { return getData(STORAGE_KEYS.RETURNS, []); }
export function getExpenses(): any[] { return getData(STORAGE_KEYS.EXPENSES, []); }
export function getOtherRevenue(): any[] { return getData(STORAGE_KEYS.OTHER_REVENUE, []); }
export function getInstallments(): any[] { return getData(STORAGE_KEYS.INSTALLMENTS, []); }
export function getWallets(): any[] { return getData(STORAGE_KEYS.WALLETS, []); }
export function getWalletTransactions(): any[] { return getData(STORAGE_KEYS.WALLET_TRANSACTIONS, []); }
export function getCustomers(): any[] { return getData(STORAGE_KEYS.CUSTOMERS, []); }
export function getEmployees(): any[] { return getData(STORAGE_KEYS.EMPLOYEES, []); }
export function getSalaryRecords(): any[] { return getData(STORAGE_KEYS.SALARY_RECORDS, []); }
export function getAdvances(): any[] { return getData(STORAGE_KEYS.ADVANCES, []); }
export function getDamagedItems(): any[] { return getData(STORAGE_KEYS.DAMAGED_ITEMS, []); }
export function getMaintenance(): any[] { return getData(STORAGE_KEYS.MAINTENANCE, []); }
export function getBlacklist(): any[] { return getData(STORAGE_KEYS.BLACKLIST, []); }
export function getReminders(): any[] { return getData(STORAGE_KEYS.REMINDERS, []); }
export function getShiftClosings(): any[] { return getData(STORAGE_KEYS.SHIFT_CLOSINGS, []); }
export function getSuppliers(): any[] { return getData(STORAGE_KEYS.SUPPLIERS, []); }
export function getSupplierTransactions(): any[] { return getData(STORAGE_KEYS.SUPPLIER_TRANSACTIONS, []); }
export function getPurchaseInvoices(): any[] { return getData(STORAGE_KEYS.PURCHASE_INVOICES, []); }
export function getAuditLogs(): any[] { return getData(STORAGE_KEYS.AUDIT_LOGS, []); }
export function getAppSettings(): any { return getData(STORAGE_KEYS.APP_SETTINGS, {}); }

// ─── Composite Helpers ──────────────────────────────────────

/** Get ALL products merged from all inventory sections */
export function getAllProducts(): any[] {
    return [
        ...getMobiles().map(p => ({ ...p, _source: 'mobile' })),
        ...getMobileAccessories().map(p => ({ ...p, _source: 'mobile_accessory' })),
        ...getDevices().map(p => ({ ...p, _source: 'device' })),
        ...getDeviceAccessories().map(p => ({ ...p, _source: 'device_accessory' })),
        ...getComputers().map(p => ({ ...p, _source: 'computer' })),
        ...getComputerAccessories().map(p => ({ ...p, _source: 'computer_accessory' })),
        ...getUsedDevices().map(p => ({ ...p, _source: 'used_device' })),
        ...getCars().map(p => ({ ...p, _source: 'car' })),
        ...getWarehouse().map(p => ({ ...p, _source: 'warehouse' })),
    ];
}

/** Get total inventory value (cost-based) */
export function getInventoryValue(): number {
    const products = getAllProducts();
    return products.reduce((sum, p) => {
        const cost = p.newCostPrice || p.costPrice || p.purchasePrice || 0;
        const qty = p.quantity || p.remainingQty || 1;
        return sum + cost * qty;
    }, 0);
}

/** Get total inventory count */
export function getTotalProductCount(): number {
    return getAllProducts().length;
}

/** Get total stock units */
export function getTotalStockUnits(): number {
    return getAllProducts().reduce((sum, p) => sum + (p.quantity || p.remainingQty || 0), 0);
}

/** Get all available storage keys in the backup */
export function getBackupKeys(): string[] {
    return Object.keys(backupData);
}

/** Get raw value for any key */
export function getRawData(key: string): any {
    const raw = backupData[key];
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
}
