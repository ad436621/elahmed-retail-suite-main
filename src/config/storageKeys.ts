// ============================================================
// Centralized localStorage Keys — مفاتيح التخزين المركزية
// ============================================================
// غيّر أي مفتاح هنا وهيتغير في المشروع كله تلقائياً
// Change any key here and it updates everywhere automatically

export const STORAGE_KEYS = {
    // ─── Auth & Session ─────────────────────────────────────────
    AUTH_TOKEN: 'gx_auth_token',
    AUTH_USER: 'gx_auth_user',
    SESSION: 'gx_session',
    RECOVERY_CODE: 'gx_recovery_code',

    // ─── Users ──────────────────────────────────────────────────
    USERS: 'gx_users',

    // ─── Inventory: Mobiles ─────────────────────────────────────
    MOBILES: 'gx_mobiles_v2',
    MOBILE_ACCESSORIES: 'gx_mobile_accessories',

    // ─── Inventory: Devices ─────────────────────────────────────
    DEVICES: 'gx_devices_v2',
    DEVICE_ACCESSORIES: 'gx_device_accessories',

    // ─── Inventory: Computers ───────────────────────────────────
    COMPUTERS: 'gx_computers_v2',
    COMPUTER_ACCESSORIES: 'gx_computer_accessories',

    // ─── Inventory: Used Devices ────────────────────────────────
    USED_DEVICES: 'gx_used_devices',

    // ─── Inventory: Cars ────────────────────────────────────────
    CARS: 'gx_cars',

    // ─── Inventory: Warehouse ───────────────────────────────────
    WAREHOUSE: 'gx_warehouse',

    // ─── Product Batches (FIFO) ─────────────────────────────────
    BATCHES: 'gx_product_batches_v1',

    // ─── Categories ─────────────────────────────────────────────
    CATEGORIES: 'gx_categories_v1',
    LEGACY_CATEGORIES: 'elahmed-categories',

    // ─── Legacy Products & Repositories ─────────────────────────
    PRODUCTS: 'elahmed-products',
    SALES_LEGACY: 'elahmed_sales',
    AUDIT_LOGS: 'elahmed_audit_logs',

    // ─── Sales & Finance ────────────────────────────────────────
    INVOICE_COUNTER: 'gx_invoice_counter',
    RETURNS: 'gx_returns_v2',
    EXPENSES: 'gx_expenses',
    OTHER_REVENUE: 'gx_other_revenue',
    INSTALLMENTS: 'gx_installments_v2',

    // ─── Wallets ────────────────────────────────────────────────
    WALLETS: 'gx_wallets',
    WALLET_TRANSACTIONS: 'gx_wallet_transactions',

    // ─── People ─────────────────────────────────────────────────
    CUSTOMERS: 'gx_customers',
    EMPLOYEES: 'gx_employees',
    SALARY_RECORDS: 'gx_salary_records',
    ADVANCES: 'gx_advances',

    // ─── Operations ─────────────────────────────────────────────
    DAMAGED_ITEMS: 'gx_damaged_items',
    MAINTENANCE: 'gx_maintenance_v2',

    // ─── Settings & System ──────────────────────────────────────
    APP_SETTINGS: 'app_settings',
    BACKUP_SETTINGS: 'gx_backup_settings',
    MONTHLY_RESET_SETTINGS: 'gx_monthly_reset_settings',
    MONTHLY_ARCHIVE: 'gx_monthly_archive',

    // ─── POS / Settings Page Specific ───────────────────────────
    HELD_INVOICES: 'elos_held_invoices',
    TRANSFERS: 'elos_transfers',
    WALLETS_SETTINGS: 'elos_wallets',
    INVOICE_SETTINGS: 'elos_invoice_settings',
    TRANSFER_SETTINGS: 'elos_transfer_settings',
    NOTIFICATIONS_SETTINGS: 'elos_notifications_settings',

    // ─── Migration Flags ────────────────────────────────────────
    MIGRATION_BATCHES_DONE: 'gx_batches_migrated_v1',
    MIGRATION_USED_MERGE_DONE: 'gx_used_merge_migrated_v1',

    // ─── UI / App Preferences ───────────────────────────────────
    THEME: 'elahmed-theme',
    LANGUAGE: 'elahmed-lang',
    FONT_SIZE: 'elos_font_size',
    MACHINE_ID: 'elahmed-machine-id',

    // ─── Payment Gateway Transactions ──────────────────────────
    FAWRY_TRANSACTIONS: 'fawry_transactions',
    ACCEPT_TRANSACTIONS: 'accept_transactions',
    CASH_TRANSACTIONS: 'cash_transactions',
    PAYMENT_PROVIDER: 'payment_provider',
    PAYMENT_CONFIG: 'payment_config',

    // ─── Notification Queues & Config ───────────────────────────
    EMAIL_QUEUE: 'email_queue',
    SMS_QUEUE: 'sms_queue',
    WHATSAPP_QUEUE: 'whatsapp_queue',
    PRINT_HISTORY: 'print_history',
    SMS_PROVIDER: 'sms_provider',
    SMS_CONFIG: 'sms_config',
    EMAIL_PROVIDER: 'email_provider',
    EMAIL_CONFIG: 'email_config',
    BUSINESS_INFO: 'business_info',

    // ─── Settings Page — Wallet split keys ─────────────────────
    WALLETS_E: 'elos_wallets_e',
    WALLETS_B: 'elos_wallets_b',

    // ─── IndexedDB Names ───────────────────────────────────────
    BACKUP_DB_NAME: 'gx_backup_db',
} as const;

// Type helper: gets the value type of any storage key
export type StorageKeyValue = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
