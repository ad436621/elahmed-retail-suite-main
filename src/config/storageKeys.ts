// ======================================================
// GX GLEAMEX — Unified Storage Keys
// المفاتيح الموحدة لـ localStorage
// ======================================================

export const STORAGE_KEYS = {
  // ─── Auth & Users ───────────────────────────────────
  AUTH_USER:          'gx_auth_user',
  AUTH_TOKEN:         'gx_auth_token',
  USERS:              'gx_users',
  RECOVERY_CODE:      'gx_recovery_code_v1',

  // ─── Products / Inventory ──────────────────────────
  MOBILES:            'gx_mobiles_v2',
  DEVICES:            'gx_devices_v2',
  COMPUTERS:          'gx_computers_v2',
  CARS:               'gx_cars',
  CAR_OILS:           'gx_car_oils',
  CAR_SPARE_PARTS:    'gx_car_spare_parts',
  USED_DEVICES:       'gx_used_devices_v1',
  CATEGORIES:         'gx_categories_v1',
  LEGACY_CATEGORIES:  'gx_legacy_categories',
  BATCHES:            'gx_product_batches_v1',
  WAREHOUSE:          'gx_warehouse_items',
  MOBILE_ACCESSORIES: 'gx_mobile_accessories_v1',
  COMPUTER_ACCESSORIES: 'gx_computer_accessories_v1',
  COMPUTER_ACCESSORIES_SA: 'gx_computer_accessories_v1',
  DEVICE_ACCESSORIES: 'gx_device_accessories_v1',
  DEVICE_ACCESSORIES_SA: 'gx_device_accessories_v1',
  MOBILE_SPARE_PARTS: 'gx_mobile_spare_parts_v1',
  COMPUTER_SPARE_PARTS: 'gx_computer_spare_parts_v1',
  DEVICE_SPARE_PARTS: 'gx_device_spare_parts_v1',
  PRODUCTS:           'gx_products',

  // ─── Sales & Transactions ──────────────────────────
  SALES:              'gx_sales_v2',           // ✅ مُهاجَر من elahmed_sales
  SALES_LEGACY:       'elahmed_sales',
  RETURNS:            'gx_returns_v2',
  INVOICE_COUNTER:    'gx_invoice_counter',
  TRANSFERS:          'gx_transfers_v2',        // ✅ يستخدمه POS.tsx أيضاً
  HELD_INVOICES:      'gx_held_invoices',

  // ─── Cart ──────────────────────────────────────────
  CURRENT_CART:       'gx_current_cart',        // ✅ مضاف

  // ─── Finance ───────────────────────────────────────
  EXPENSES:           'gx_expenses_v1',
  OTHER_REVENUE:      'gx_other_revenue_v1',
  DAMAGED:            'gx_damaged_items_v1',
  WALLETS:            'gx_wallets',

  // ─── Maintenance & Service ─────────────────────────
  MAINTENANCE:        'gx_maintenance_orders_v1',
  INSTALLMENTS:       'gx_installments_v1',

  // ─── CRM ───────────────────────────────────────────
  CUSTOMERS:          'gx_customers',
  SUPPLIERS:          'gx_suppliers',           // ✅ مضاف
  SUPPLIER_TRANSACTIONS: 'gx_supplier_transactions', // ✅ مضاف
  EMPLOYEES:          'gx_employees',
  PARTNERS:           'gx_partners',            // ✅ مضاف
  BLACKLIST:          'gx_blacklist',           // ✅ مضاف
  REMINDERS:          'gx_reminders',           // ✅ مضاف

  // ─── Shift & Operations ───────────────────────────
  SHIFT_CLOSINGS:     'gx_shift_closings',      // ✅ مضاف
  PURCHASE_INVOICES:  'gx_purchase_invoices',   // ✅ مضاف

  // ─── Stock ─────────────────────────────────────────
  STOCK_MOVEMENTS:    'gx_stock_movements_v2',  // ✅ مُهاجَر
  AUDIT_LOGS:         'gx_audit_logs_v2',       // ✅ مُهاجَر من elahmed_audit_logs
  STOCKTAKE:          'gx_stocktake_sessions',  // ✅ مضاف

  // ─── Settings & App ───────────────────────────────
  APP_SETTINGS:       'app_settings',
  THEME:              'elahmed-theme',
  LANGUAGE:           'elahmed-lang',
  BACKUP_SETTINGS:    'gx_backup_settings',
  BACKUP_DB:          'gx_backup_db',
  FONT_SIZE:          'gx_font_size',
  INVOICE_SETTINGS:   'gx_invoice_settings',
  NOTIFICATIONS_SETTINGS: 'gx_notif_settings',
  TRANSFER_SETTINGS:  'gx_transfer_settings',

  // ─── AI Notifications ───────────────────────────────
  AI_NOTIFICATIONS:       'gx_ai_notifications',
  AI_NOTIFICATIONS_META: 'gx_ai_notifications_meta',

  // ─── Migration flags ───────────────────────────────
  MIGRATION_V1:       'gx_migration_v1_done',
  MIGRATION_V2:       'gx_migration_v2_done',
  PASSWORDS_MIGRATED: 'gx_passwords_migrated_v1',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
