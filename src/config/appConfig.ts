// ============================================================
// App Configuration — ثوابت التطبيق المركزية
// ============================================================
// كل القواعد والحدود والإعدادات الافتراضية في مكان واحد
// All business rules, limits, and default values in one place

export const APP_CONFIG = {
    // ─── App Identity ───────────────────────────────────────────
    APP_NAME: 'ElAhmed Retail Suite',
    APP_PREFIX: 'gx_',
    VERSION: '1.0.0',

    // ─── API ────────────────────────────────────────────────────
    API_BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',

    // ─── Business Rules ─────────────────────────────────────────
    DEFAULT_CURRENCY: 'EGP',
    CURRENCY_SYMBOL: 'ج.م',
    MAX_DISCOUNT_PCT: 100,
    LOW_STOCK_THRESHOLD: 5,

    // ─── Backup ─────────────────────────────────────────────────
    AUTO_BACKUP_CHECK_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
    DEFAULT_BACKUP_INTERVAL_HOURS: 12,
    BACKUP_FILE_PREFIX: 'GX_Retail_Backup',
    AUTO_BACKUP_FILE_PREFIX: 'GX_AutoBackup',

    // ─── Pagination ─────────────────────────────────────────────
    DEFAULT_PAGE_SIZE: 20,

    // ─── Printer ────────────────────────────────────────────────
    DEFAULT_PRINTER_NAME: '80mm Thermal Printer',
    RECEIPT_WIDTH_MM: 80,

    // ─── Barcode ────────────────────────────────────────────────
    BARCODE_PREFIX: 'GX',

    // ─── Default Company Settings ───────────────────────────────
    DEFAULT_COMPANY_NAME: 'GLEAMEX',
    DEFAULT_COMPANY_SUFFIX: 'ش. ذ. م.م',
    DEFAULT_BRANCH_NAME: 'Main Branch',
    DEFAULT_BRANCH_ADDRESS: 'Cairo, Egypt',
    DEFAULT_LOGO_URL: '/logo.png',

    // ─── Future: Online Sync ────────────────────────────────────
    SYNC_ENABLED: false,
    SYNC_INTERVAL_MS: 30_000, // 30 seconds
} as const;
