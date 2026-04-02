"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");
const Database = require("better-sqlite3");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function tableExists$1(db2, table) {
  const row = db2.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row == null ? void 0 : row.name);
}
function getTableColumns$1(db2, table) {
  if (!tableExists$1(db2, table)) {
    return [];
  }
  const validTables = /* @__PURE__ */ new Set([
    "products",
    "sales",
    "sale_items",
    "customers",
    "installments",
    "installment_schedules",
    "installment_payments",
    "wallets",
    "safe_transactions",
    "expenses",
    "employees",
    "employee_salaries",
    "employee_advances",
    "suppliers",
    "supplier_transactions",
    "product_batches",
    "blacklist",
    "damaged_items",
    "other_revenue",
    "reminders",
    "repair_tickets",
    "repair_parts",
    "used_devices",
    "settings",
    "inventory_items"
  ]);
  if (!validTables.has(table)) {
    return [];
  }
  return db2.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name);
}
function createIndexIfColumnsExist(db2, indexName, table, columns) {
  const tableColumns = new Set(getTableColumns$1(db2, table));
  if (!columns.every((column) => tableColumns.has(column))) {
    return;
  }
  db2.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${columns.join(", ")})`);
}
function ensureSchemaIndexes(db2) {
  createIndexIfColumnsExist(db2, "idx_products_barcode", "products", ["barcode"]);
  createIndexIfColumnsExist(db2, "idx_expenses_date", "expenses", ["date"]);
  createIndexIfColumnsExist(db2, "idx_employee_salaries_employee_month", "employee_salaries", ["employeeId", "month"]);
  createIndexIfColumnsExist(db2, "idx_employee_advances_employee_date", "employee_advances", ["employeeId", "date"]);
  createIndexIfColumnsExist(db2, "idx_product_batches_productId", "product_batches", ["productId"]);
  createIndexIfColumnsExist(db2, "idx_sale_items_saleId", "sale_items", ["saleId"]);
  createIndexIfColumnsExist(db2, "idx_customers_phone", "customers", ["phone"]);
  createIndexIfColumnsExist(db2, "idx_customers_nationalId", "customers", ["nationalId"]);
  createIndexIfColumnsExist(db2, "idx_blacklist_imei_status", "blacklist", ["imei", "status"]);
  createIndexIfColumnsExist(db2, "idx_damaged_items_date", "damaged_items", ["date"]);
  createIndexIfColumnsExist(db2, "idx_installments_customerId", "installments", ["customerId"]);
  createIndexIfColumnsExist(db2, "idx_installments_productId", "installments", ["productId"]);
  createIndexIfColumnsExist(db2, "idx_installments_status", "installments", ["status"]);
  createIndexIfColumnsExist(db2, "idx_installments_createdAt", "installments", ["createdAt"]);
  createIndexIfColumnsExist(db2, "idx_installment_schedules_contract_month", "installment_schedules", ["contractId", "monthNumber"]);
  createIndexIfColumnsExist(db2, "idx_installment_schedules_due_paid", "installment_schedules", ["dueDate", "paid"]);
  createIndexIfColumnsExist(db2, "idx_installment_payments_contract_date", "installment_payments", ["contractId", "date"]);
  createIndexIfColumnsExist(db2, "idx_installment_allocations_payment", "installment_payment_allocations", ["paymentId"]);
  createIndexIfColumnsExist(db2, "idx_installment_allocations_schedule", "installment_payment_allocations", ["scheduleItemId"]);
  createIndexIfColumnsExist(db2, "idx_supplier_transactions_supplier_created", "supplier_transactions", ["supplierId", "createdAt"]);
  createIndexIfColumnsExist(db2, "idx_other_revenue_date", "other_revenue", ["date"]);
  createIndexIfColumnsExist(db2, "idx_reminders_due_status", "reminders", ["dueDate", "status", "completed"]);
  createIndexIfColumnsExist(db2, "idx_safe_transactions_wallet_created", "safe_transactions", ["walletId", "createdAt"]);
  createIndexIfColumnsExist(db2, "idx_repair_tickets_status_created", "repair_tickets", ["status", "createdAt"]);
  createIndexIfColumnsExist(db2, "idx_used_devices_serial_status", "used_devices", ["serialNumber", "status"]);
}
function initializeDatabase() {
  const isDev = !electron.app.isPackaged;
  const userDataPath = electron.app.getPath("userData");
  const dbPath = path.join(userDataPath, isDev ? "retail_dev.sqlite" : "retail_prod.sqlite");
  console.log(`Initializing SQLite database at: ${dbPath}`);
  const db2 = new Database(dbPath, {
    verbose: isDev ? console.log : void 0
  });
  db2.pragma("journal_mode = WAL");
  db2.pragma("foreign_keys = ON");
  db2.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL,
      permissions TEXT, -- JSON
      active INTEGER DEFAULT 1,
      passwordHash TEXT,
      salt TEXT,
      mustChangePassword INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      inventoryType TEXT NOT NULL,
      UNIQUE(name, inventoryType)
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      barcode TEXT,
      quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      costPrice REAL NOT NULL DEFAULT 0,
      salePrice REAL NOT NULL DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      warehouseId TEXT,
      isArchived INTEGER DEFAULT 0,
      deletedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT,
      barcode TEXT,
      deviceType TEXT,
      category TEXT,
      condition TEXT,
      storage TEXT,
      ram TEXT,
      color TEXT,
      brand TEXT,
      description TEXT,
      boxNumber TEXT,
      taxExcluded INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 0,
      oldCostPrice REAL DEFAULT 0,
      newCostPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      profitMargin REAL DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      supplier TEXT,
      source TEXT, -- 'mobile', 'computer', 'used', etc.
      warehouseId TEXT,
      serialNumber TEXT,
      imei2 TEXT,
      processor TEXT,
      isArchived INTEGER DEFAULT 0,
      notes TEXT,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      deletedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      inventoryType TEXT,
      productName TEXT,
      costPrice REAL NOT NULL,
      salePrice REAL NOT NULL,
      quantity INTEGER NOT NULL,
      remainingQty INTEGER NOT NULL,
      purchaseDate TEXT NOT NULL,
      supplier TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      productId TEXT NOT NULL,
      type TEXT NOT NULL,
      quantityChange REAL NOT NULL,
      previousQuantity REAL NOT NULL,
      newQuantity REAL NOT NULL,
      reason TEXT,
      referenceId TEXT,
      userId TEXT,
      timestamp TEXT NOT NULL,
      warehouseId TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      beforeStateJson TEXT,
      afterStateJson TEXT,
      machineId TEXT,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      total REAL NOT NULL,
      totalCost REAL NOT NULL,
      grossProfit REAL NOT NULL,
      marginPct REAL NOT NULL,
      paymentMethod TEXT NOT NULL,
      employee TEXT NOT NULL,
      idempotencyKey TEXT UNIQUE,
      voidedAt TEXT,
      voidReason TEXT,
      voidedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id TEXT PRIMARY KEY,
      saleId TEXT NOT NULL,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price REAL NOT NULL,
      cost REAL NOT NULL,
      lineDiscount REAL DEFAULT 0,
      warehouseId TEXT,
      batches TEXT, -- JSON array of batch deductions
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS return_records (
      id TEXT PRIMARY KEY,
      returnNumber TEXT UNIQUE NOT NULL,
      originalInvoiceNumber TEXT NOT NULL,
      originalSaleId TEXT,
      date TEXT NOT NULL,
      totalRefund REAL NOT NULL DEFAULT 0 CHECK (totalRefund >= 0),
      reason TEXT,
      processedBy TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (originalSaleId) REFERENCES sales(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      returnId TEXT NOT NULL,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      qty REAL NOT NULL CHECK (qty > 0),
      price REAL NOT NULL CHECK (price >= 0),
      reason TEXT,
      FOREIGN KEY (returnId) REFERENCES return_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customer_accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      balance REAL DEFAULT 0,
      lastUpdated TEXT
    );
    
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      contractNumber TEXT UNIQUE NOT NULL,
      contractType TEXT NOT NULL DEFAULT 'product',
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      customerAddress TEXT,
      customerIdCard TEXT,
      guarantorName TEXT,
      guarantorIdCard TEXT,
      guarantorPhone TEXT,
      guarantorAddress TEXT,
      productId TEXT,
      productName TEXT NOT NULL,
      transferType TEXT,
      cashPrice REAL NOT NULL DEFAULT 0,
      installmentPrice REAL NOT NULL DEFAULT 0,
      downPayment REAL NOT NULL DEFAULT 0,
      months INTEGER NOT NULL CHECK (months >= 1),
      monthlyInstallment REAL NOT NULL DEFAULT 0,
      paidTotal REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      firstInstallmentDate TEXT,
      notes TEXT,
      customFieldsJson TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      settledEarly INTEGER DEFAULT 0,
      settlementDiscount REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS installment_schedules (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      monthNumber INTEGER NOT NULL CHECK (monthNumber >= 1),
      dueDate TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
      paidAmount REAL DEFAULT 0 CHECK (paidAmount >= 0),
      penalty REAL DEFAULT 0 CHECK (penalty >= 0),
      paid INTEGER DEFAULT 0,
      remainingAfter REAL,
      note TEXT,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installment_payments (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      date TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installment_payment_allocations (
      id TEXT PRIMARY KEY,
      paymentId TEXT NOT NULL,
      scheduleItemId TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      FOREIGN KEY (paymentId) REFERENCES installment_payments(id) ON DELETE CASCADE,
      FOREIGN KEY (scheduleItemId) REFERENCES installment_schedules(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- NEW RELATIONAL TABLES (ELOS MIGRATION)
    -- ==========================================

    CREATE TABLE IF NOT EXISTS warehouses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      location TEXT,
      isDefault INTEGER DEFAULT 0,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS warehouse_items (
      id TEXT PRIMARY KEY,
      warehouseId TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      costPrice REAL NOT NULL DEFAULT 0,
      notes TEXT,
      addedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cars_inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      color TEXT,
      plateNumber TEXT,
      licenseExpiry TEXT,
      condition TEXT NOT NULL DEFAULT 'used',
      category TEXT,
      purchasePrice REAL NOT NULL DEFAULT 0,
      salePrice REAL NOT NULL DEFAULT 0,
      notes TEXT,
      image TEXT,
      warehouseId TEXT,
      isArchived INTEGER DEFAULT 0,
      deletedAt TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS accessories (
      id TEXT PRIMARY KEY,
      warehouseId TEXT,
      inventoryType TEXT NOT NULL, -- 'mobile_accessory', 'computer_spare_part', etc.
      name TEXT NOT NULL,
      category TEXT,
      subcategory TEXT,
      model TEXT,
      barcode TEXT,
      quantity INTEGER DEFAULT 0,
      oldCostPrice REAL DEFAULT 0,
      newCostPrice REAL DEFAULT 0,
      costPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      profitMargin REAL DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      condition TEXT DEFAULT 'new',
      brand TEXT,
      supplier TEXT,
      source TEXT,
      boxNumber TEXT,
      taxExcluded INTEGER DEFAULT 0,
      color TEXT,
      description TEXT,
      isArchived INTEGER DEFAULT 0,
      deletedAt TEXT,
      notes TEXT,
      image TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
    );

    CREATE TABLE IF NOT EXISTS partners (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      partnershipType TEXT NOT NULL, -- 'investor', 'franchise', etc.
      sharePercent REAL DEFAULT 0,
      profitShareDevices REAL DEFAULT 0,
      profitShareAccessories REAL DEFAULT 0,
      capitalAmount REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_transactions (
      id TEXT PRIMARY KEY,
      partnerId TEXT NOT NULL,
      type TEXT NOT NULL, -- 'investment', 'withdrawal', 'profit_distribution'
      amount REAL NOT NULL,
      description TEXT,
      createdAt TEXT,
      FOREIGN KEY (partnerId) REFERENCES partners(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS safe_transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL, -- link to wallet UUID
      type TEXT NOT NULL, -- 'deposit', 'withdrawal', 'transfer_in', 'transfer_out'
      subType TEXT, -- 'opening_balance', 'partner_investment', 'expense', 'sale', 'purchase'
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      paymentMethod TEXT,
      affectsCapital INTEGER DEFAULT 0,
      affectsProfit INTEGER DEFAULT 0,
      createdBy TEXT,
      relatedId TEXT, -- invoiceId, expenseId, etc.
      createdAt TEXT,
      FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE RESTRICT
    );

    -- ==========================================
    -- EXPENSES
    -- ==========================================

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      employee TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- EMPLOYEES
    -- ==========================================

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT,
      salary REAL DEFAULT 0,
      commissionRate REAL DEFAULT 0,
      hireDate TEXT,
      active INTEGER DEFAULT 1,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS employee_salaries (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT,
      month TEXT NOT NULL,
      baseSalary REAL NOT NULL,
      commission REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      advanceDeducted REAL DEFAULT 0,
      netSalary REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      paidAt TEXT,
      walletId TEXT,
      notes TEXT,
      createdAt TEXT,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employee_advances (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      deductedMonth TEXT,
      notes TEXT,
      createdAt TEXT,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- CUSTOMERS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      nationalId TEXT,
      notes TEXT,
      totalPurchases REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- SUPPLIERS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      category TEXT,
      balance REAL DEFAULT 0,
      notes TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY,
      supplierId TEXT NOT NULL,
      supplierName TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balanceBefore REAL DEFAULT 0,
      balanceAfter REAL DEFAULT 0,
      notes TEXT,
      createdBy TEXT,
      createdAt TEXT,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- REMINDERS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT NOT NULL,
      reminderTime TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      completed INTEGER DEFAULT 0,
      completedAt TEXT,
      recurring TEXT,
      category TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- BLACKLIST
    -- ==========================================

    CREATE TABLE IF NOT EXISTS blacklist (
      id TEXT PRIMARY KEY,
      imei TEXT,
      deviceName TEXT NOT NULL,
      ownerName TEXT,
      ownerPhone TEXT,
      phone TEXT,
      status TEXT DEFAULT 'active',
      reportedDate TEXT,
      nationalId TEXT,
      reason TEXT NOT NULL,
      notes TEXT,
      addedBy TEXT,
      createdBy TEXT,
      name TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- DAMAGED ITEMS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS damaged_items (
      id TEXT PRIMARY KEY,
      productName TEXT NOT NULL,
      productId TEXT,
      inventoryType TEXT,
      quantity REAL DEFAULT 1,
      costPrice REAL DEFAULT 0,
      reason TEXT,
      estimatedLoss REAL DEFAULT 0,
      reportedBy TEXT,
      date TEXT NOT NULL,
      notes TEXT,
      createdAt TEXT
    );

    -- ==========================================
    -- OTHER REVENUE
    -- ==========================================

    CREATE TABLE IF NOT EXISTS other_revenue (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      description TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      paymentMethod TEXT DEFAULT 'cash',
      addedBy TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- WALLETS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS wallets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'cash',
      balance REAL DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      icon TEXT,
      color TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- PURCHASE INVOICES
    -- ==========================================

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      supplierId TEXT,
      supplierName TEXT NOT NULL,
      invoiceDate TEXT NOT NULL,
      totalAmount REAL NOT NULL DEFAULT 0 CHECK (totalAmount >= 0),
      paidAmount REAL NOT NULL DEFAULT 0 CHECK (paidAmount >= 0),
      remaining REAL NOT NULL DEFAULT 0 CHECK (remaining >= 0),
      paymentMethod TEXT NOT NULL DEFAULT 'cash',
      status TEXT NOT NULL DEFAULT 'confirmed',
      notes TEXT,
      createdBy TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      productName TEXT NOT NULL,
      category TEXT,
      quantity REAL NOT NULL CHECK (quantity > 0),
      unitPrice REAL NOT NULL CHECK (unitPrice >= 0),
      totalPrice REAL NOT NULL CHECK (totalPrice >= 0),
      notes TEXT,
      FOREIGN KEY (invoiceId) REFERENCES purchase_invoices(id) ON DELETE CASCADE
    );

    -- ==========================================
    -- USED DEVICES
    -- ==========================================

    CREATE TABLE IF NOT EXISTS used_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT,
      deviceType TEXT,
      category TEXT,
      condition TEXT DEFAULT 'good',
      purchasePrice REAL DEFAULT 0,
      sellingPrice REAL DEFAULT 0,
      status TEXT DEFAULT 'in_stock',
      serialNumber TEXT,
      color TEXT,
      storage TEXT,
      ram TEXT,
      description TEXT,
      notes TEXT,
      image TEXT,
      soldAt TEXT,
      purchasedFrom TEXT,
      soldTo TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- SHIFT RECORDS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS shift_records (
      id TEXT PRIMARY KEY,
      openedAt TEXT NOT NULL,
      closedAt TEXT,
      openingBalance REAL DEFAULT 0,
      closingBalance REAL DEFAULT 0,
      totalSales REAL DEFAULT 0,
      totalExpenses REAL DEFAULT 0,
      openedBy TEXT,
      closedBy TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS shift_closings (
      id TEXT PRIMARY KEY,
      shiftDate TEXT NOT NULL,
      closedAt TEXT NOT NULL,
      closedBy TEXT NOT NULL,
      salesCount INTEGER NOT NULL DEFAULT 0,
      salesCash REAL NOT NULL DEFAULT 0,
      salesCard REAL NOT NULL DEFAULT 0,
      salesTransfer REAL NOT NULL DEFAULT 0,
      salesTotal REAL NOT NULL DEFAULT 0,
      expectedCash REAL NOT NULL DEFAULT 0,
      actualCash REAL NOT NULL DEFAULT 0,
      cashDifference REAL NOT NULL DEFAULT 0,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    -- ==========================================
    -- REPAIRS & MAINTENANCE SYSTEM (ELOS PORT)
    -- ==========================================

    CREATE TABLE IF NOT EXISTS repair_tickets (
      id TEXT PRIMARY KEY,
      ticket_no TEXT UNIQUE NOT NULL,
      client_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      device_category TEXT NOT NULL,
      device_brand TEXT,
      device_model TEXT,
      imei_or_serial TEXT,
      issue_description TEXT NOT NULL,
      accessories_received TEXT,
      device_passcode TEXT,
      status TEXT NOT NULL DEFAULT 'received',
      package_price REAL,
      final_cost REAL DEFAULT 0,
      warranty_days INTEGER,
      assigned_tech_name TEXT,
      tech_bonus_type TEXT,
      tech_bonus_value REAL,
      createdAt TEXT,
      createdBy TEXT,
      updatedAt TEXT,
      updatedBy TEXT
    );

    CREATE TABLE IF NOT EXISTS repair_status_history (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      createdAt TEXT,
      createdBy TEXT,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repair_payments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      amount REAL NOT NULL,
      wallet_type TEXT NOT NULL DEFAULT 'cash',
      note TEXT,
      createdAt TEXT,
      createdBy TEXT,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repair_events (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      createdBy TEXT,
      createdAt TEXT,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repair_parts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      sku TEXT,
      brand TEXT,
      compatible_models TEXT,
      unit_cost REAL NOT NULL DEFAULT 0,
      selling_price REAL NOT NULL DEFAULT 0,
      qty REAL NOT NULL DEFAULT 0,
      min_qty REAL NOT NULL DEFAULT 0,
      barcode TEXT,
      color TEXT,
      location TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS repair_ticket_parts (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      part_id TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'reserved',
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE,
      FOREIGN KEY(part_id) REFERENCES repair_parts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repair_parts_movements (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL,
      ticket_id TEXT,
      type TEXT NOT NULL,
      qty REAL NOT NULL,
      unit_cost REAL NOT NULL DEFAULT 0,
      note TEXT,
      createdAt TEXT,
      FOREIGN KEY(part_id) REFERENCES repair_parts(id) ON DELETE CASCADE,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS repair_invoices (
      id TEXT PRIMARY KEY,
      invoice_no TEXT NOT NULL UNIQUE,
      ticket_id TEXT NOT NULL,
      createdAt TEXT,
      deliveredAt TEXT,
      subtotal_labor REAL NOT NULL DEFAULT 0,
      subtotal_parts REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid_total REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      payment_summary_json TEXT,
      createdBy TEXT,
      FOREIGN KEY(ticket_id) REFERENCES repair_tickets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS repair_invoice_items (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      type TEXT NOT NULL,
      ref_id TEXT,
      name TEXT NOT NULL,
      qty REAL NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY(invoice_id) REFERENCES repair_invoices(id) ON DELETE CASCADE
    );

  `);
  ensureSchemaIndexes(db2);
  return db2;
}
function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.max(0, parsed) * 100) / 100;
}
function asInteger(value, fallback = 0, minimum = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(minimum, fallback);
  return Math.max(minimum, Math.round(parsed));
}
function asText(value, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function asNullableText(value) {
  const text = asText(value).trim();
  return text ? text : null;
}
function asBooleanInt(value) {
  return value ? 1 : 0;
}
function normalizeStatus(value) {
  if (value === "completed" || value === "overdue" || value === "cancelled") return value;
  return "active";
}
function parseJsonArray$1(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function serializeJson(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return JSON.stringify(value);
}
function ensureCustomerRecord(db2, contract) {
  const explicitCustomerId = asNullableText(contract.customerId);
  if (explicitCustomerId) {
    const existing = db2.prepare("SELECT id FROM customers WHERE id = ?").get(explicitCustomerId);
    if (existing) return existing.id;
  }
  const customerName = asText(contract.customerName).trim();
  if (!customerName) return null;
  const customerPhone = asNullableText(contract.customerPhone);
  const customerAddress = asNullableText(contract.customerAddress);
  const customerNationalId = asNullableText(contract.customerIdCard);
  const byPhone = customerPhone ? db2.prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1").get(customerPhone) : void 0;
  if (byPhone) {
    db2.prepare(`
      UPDATE customers
      SET name = ?, address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(customerName, customerAddress, customerNationalId, (/* @__PURE__ */ new Date()).toISOString(), byPhone.id);
    return byPhone.id;
  }
  const byName = db2.prepare("SELECT id FROM customers WHERE name = ? LIMIT 1").get(customerName);
  if (byName) {
    db2.prepare(`
      UPDATE customers
      SET phone = COALESCE(?, phone), address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(customerPhone, customerAddress, customerNationalId, (/* @__PURE__ */ new Date()).toISOString(), byName.id);
    return byName.id;
  }
  const id = explicitCustomerId || crypto.randomUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db2.prepare(`
    INSERT INTO customers (id, name, phone, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(id, customerName, customerPhone, customerAddress, customerNationalId, "Auto-created from installment contract", now, now);
  return id;
}
function ensureProductRecord(db2, contract) {
  const productId = asNullableText(contract.productId);
  if (!productId) return null;
  const existing = db2.prepare("SELECT id FROM products WHERE id = ?").get(productId);
  if (existing) return existing.id;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db2.prepare(`
    INSERT INTO products (
      id, name, barcode, category, condition, quantity,
      oldCostPrice, newCostPrice, salePrice, supplier, source,
      notes, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?, ?, NULL)
  `).run(
    productId,
    asText(contract.productName, "Installment Product"),
    productId,
    asNullableText(contract.contractType) || "installment",
    "new",
    asNumber(contract.installmentPrice),
    "installment_snapshot",
    "Auto-created from installment contract",
    now,
    now
  );
  return productId;
}
function hydrateSchedules(db2) {
  const rows = db2.prepare(`
    SELECT id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    FROM installment_schedules
    ORDER BY contractId ASC, monthNumber ASC, dueDate ASC
  `).all();
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const items = grouped.get(row.contractId) || [];
    items.push({
      id: row.id,
      month: row.monthNumber,
      dueDate: row.dueDate,
      amount: asNumber(row.amount),
      paidAmount: asNumber(row.paidAmount),
      penalty: asNumber(row.penalty),
      paid: Boolean(row.paid),
      remainingAfter: row.remainingAfter === null ? void 0 : asNumber(row.remainingAfter),
      note: row.note || ""
    });
    grouped.set(row.contractId, items);
  }
  return grouped;
}
function hydratePayments(db2) {
  const allocations = db2.prepare(`
    SELECT paymentId, scheduleItemId, amount
    FROM installment_payment_allocations
    ORDER BY paymentId ASC
  `).all();
  const allocationsByPayment = /* @__PURE__ */ new Map();
  for (const allocation of allocations) {
    const items = allocationsByPayment.get(allocation.paymentId) || [];
    items.push({
      scheduleItemId: allocation.scheduleItemId,
      amount: asNumber(allocation.amount)
    });
    allocationsByPayment.set(allocation.paymentId, items);
  }
  const paymentRows = db2.prepare(`
    SELECT id, contractId, amount, date, note, createdAt
    FROM installment_payments
    ORDER BY contractId ASC, date ASC, createdAt ASC
  `).all();
  const grouped = /* @__PURE__ */ new Map();
  for (const row of paymentRows) {
    const items = grouped.get(row.contractId) || [];
    items.push({
      id: row.id,
      amount: asNumber(row.amount),
      date: row.date,
      note: row.note || "",
      allocations: allocationsByPayment.get(row.id) || []
    });
    grouped.set(row.contractId, items);
  }
  return grouped;
}
function readInstallmentContracts(db2) {
  const schedulesByContract = hydrateSchedules(db2);
  const paymentsByContract = hydratePayments(db2);
  const rows = db2.prepare(`
    SELECT
      id,
      contractNumber,
      contractType,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      customerIdCard,
      guarantorName,
      guarantorIdCard,
      guarantorPhone,
      guarantorAddress,
      productId,
      productName,
      transferType,
      cashPrice,
      installmentPrice,
      downPayment,
      months,
      monthlyInstallment,
      paidTotal,
      remaining,
      firstInstallmentDate,
      notes,
      customFieldsJson,
      status,
      settledEarly,
      settlementDiscount,
      createdAt,
      updatedAt
    FROM installments
    ORDER BY createdAt DESC, contractNumber DESC
  `).all();
  return rows.map((row) => ({
    id: row.id,
    contractNumber: row.contractNumber,
    contractType: row.contractType || "product",
    customerId: row.customerId || void 0,
    customerName: row.customerName,
    customerIdCard: row.customerIdCard || "",
    guarantorName: row.guarantorName || "",
    guarantorIdCard: row.guarantorIdCard || "",
    guarantorPhone: row.guarantorPhone || "",
    guarantorAddress: row.guarantorAddress || "",
    customerPhone: row.customerPhone || "",
    customerAddress: row.customerAddress || "",
    productName: row.productName,
    productId: row.productId || void 0,
    transferType: row.transferType || void 0,
    cashPrice: asNumber(row.cashPrice),
    installmentPrice: asNumber(row.installmentPrice),
    downPayment: asNumber(row.downPayment),
    months: asInteger(row.months, 1, 1),
    monthlyInstallment: asNumber(row.monthlyInstallment),
    firstInstallmentDate: asText(row.firstInstallmentDate),
    schedule: schedulesByContract.get(asText(row.id)) || [],
    payments: paymentsByContract.get(asText(row.id)) || [],
    paidTotal: asNumber(row.paidTotal),
    remaining: asNumber(row.remaining),
    notes: row.notes || "",
    customFields: parseJsonArray$1(row.customFieldsJson),
    status: normalizeStatus(row.status),
    settledEarly: Boolean(row.settledEarly),
    settlementDiscount: asNumber(row.settlementDiscount),
    createdAt: asText(row.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
    updatedAt: asText(row.updatedAt, asText(row.createdAt, (/* @__PURE__ */ new Date()).toISOString()))
  }));
}
function replaceInstallmentContracts(db2, contracts) {
  const insertContract = db2.prepare(`
    INSERT INTO installments (
      id, contractNumber, contractType, customerId, customerName, customerPhone, customerAddress,
      customerIdCard, guarantorName, guarantorIdCard, guarantorPhone, guarantorAddress,
      productId, productName, transferType, cashPrice, installmentPrice, downPayment,
      months, monthlyInstallment, paidTotal, remaining, firstInstallmentDate, notes,
      customFieldsJson, status, settledEarly, settlementDiscount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSchedule = db2.prepare(`
    INSERT INTO installment_schedules (
      id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPayment = db2.prepare(`
    INSERT INTO installment_payments (id, contractId, amount, date, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAllocation = db2.prepare(`
    INSERT INTO installment_payment_allocations (id, paymentId, scheduleItemId, amount)
    VALUES (?, ?, ?, ?)
  `);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  db2.transaction((records) => {
    db2.prepare("DELETE FROM installment_payment_allocations").run();
    db2.prepare("DELETE FROM installment_payments").run();
    db2.prepare("DELETE FROM installment_schedules").run();
    db2.prepare("DELETE FROM installments").run();
    for (const contract of records) {
      const contractId = asText(contract.id, crypto.randomUUID());
      const customerId = ensureCustomerRecord(db2, contract);
      const productId = ensureProductRecord(db2, contract);
      const schedule = Array.isArray(contract.schedule) ? contract.schedule : [];
      const payments = Array.isArray(contract.payments) ? contract.payments : [];
      const createdAt = asText(contract.createdAt, now);
      const updatedAt = asText(contract.updatedAt, createdAt);
      insertContract.run(
        contractId,
        asText(contract.contractNumber, `INS-${Date.now()}`),
        asText(contract.contractType, "product"),
        customerId,
        asText(contract.customerName),
        asNullableText(contract.customerPhone),
        asNullableText(contract.customerAddress),
        asNullableText(contract.customerIdCard),
        asNullableText(contract.guarantorName),
        asNullableText(contract.guarantorIdCard),
        asNullableText(contract.guarantorPhone),
        asNullableText(contract.guarantorAddress),
        productId,
        asText(contract.productName),
        asNullableText(contract.transferType),
        asNumber(contract.cashPrice),
        asNumber(contract.installmentPrice),
        asNumber(contract.downPayment),
        asInteger(contract.months, schedule.length || 1, 1),
        asNumber(contract.monthlyInstallment),
        asNumber(contract.paidTotal),
        asNumber(contract.remaining),
        asNullableText(contract.firstInstallmentDate),
        asNullableText(contract.notes),
        serializeJson(contract.customFields),
        normalizeStatus(contract.status),
        asBooleanInt(contract.settledEarly),
        asNumber(contract.settlementDiscount),
        createdAt,
        updatedAt
      );
      schedule.slice().sort((left, right) => asInteger(left.month, 0, 0) - asInteger(right.month, 0, 0) || asText(left.dueDate).localeCompare(asText(right.dueDate))).forEach((item, index) => {
        const scheduleItemId = asText(item.id, crypto.randomUUID());
        insertSchedule.run(
          scheduleItemId,
          contractId,
          asInteger(item.month, index + 1, 1),
          asText(item.dueDate),
          asNumber(item.amount),
          asNumber(item.paidAmount),
          asNumber(item.penalty),
          asBooleanInt(item.paid),
          item.remainingAfter === void 0 ? null : asNumber(item.remainingAfter),
          asNullableText(item.note)
        );
      });
      for (const payment of payments) {
        const paymentId = asText(payment.id, crypto.randomUUID());
        insertPayment.run(
          paymentId,
          contractId,
          asNumber(payment.amount),
          asText(payment.date, createdAt.slice(0, 10)),
          asNullableText(payment.note),
          createdAt
        );
        const allocations = Array.isArray(payment.allocations) ? payment.allocations : [];
        for (const allocation of allocations) {
          const scheduleItemId = asNullableText(allocation.scheduleItemId);
          if (!scheduleItemId) continue;
          insertAllocation.run(
            crypto.randomUUID(),
            paymentId,
            scheduleItemId,
            asNumber(allocation.amount)
          );
        }
      }
    }
  })(contracts);
  return readInstallmentContracts(db2);
}
function getSettingsJson(db2, key) {
  const row = db2.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function tableExists(db2, table) {
  const row = db2.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  return Boolean(row == null ? void 0 : row.name);
}
function tableIsEmpty(db2, table) {
  if (!tableExists(db2, table)) return true;
  const row = db2.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
  return row.c === 0;
}
function getTableColumns(db2, table) {
  if (!tableExists(db2, table)) return [];
  return db2.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}
function tableHasColumns(db2, table, columns) {
  const tableColumns = new Set(getTableColumns(db2, table));
  return columns.every((column) => tableColumns.has(column));
}
function ensureColumn(db2, table, column, definition) {
  if (!tableExists(db2, table)) return;
  const columns = new Set(getTableColumns(db2, table));
  if (columns.has(column)) return;
  db2.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function firstText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(Math.max(0, parsed) * 100) / 100;
    }
  }
  return 0;
}
function toBoolean(value) {
  return Boolean(value);
}
function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function extractPrefixedSequence$1(value, prefix) {
  if (typeof value !== "string") return 0;
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
function derivePurchaseInvoiceStatus$1(totalAmount, paidAmount) {
  if (paidAmount <= 0) return "confirmed";
  if (paidAmount >= totalAmount) return "paid";
  return "partial";
}
const DEFAULT_OWNER_PERMISSIONS = [
  "dashboard",
  "pos",
  "sales",
  "inventory",
  "mobiles",
  "computers",
  "devices",
  "used",
  "cars",
  "warehouse",
  "maintenance",
  "installments",
  "expenses",
  "damaged",
  "otherRevenue",
  "returns",
  "settings",
  "users",
  "customers",
  "wallets",
  "employees",
  "suppliers",
  "blacklist",
  "reminders",
  "shiftClosing",
  "purchaseInvoices"
];
function createInstallmentsTables(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      contractNumber TEXT UNIQUE NOT NULL,
      contractType TEXT NOT NULL DEFAULT 'product',
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      customerAddress TEXT,
      customerIdCard TEXT,
      guarantorName TEXT,
      guarantorIdCard TEXT,
      guarantorPhone TEXT,
      guarantorAddress TEXT,
      productId TEXT,
      productName TEXT NOT NULL,
      transferType TEXT,
      cashPrice REAL NOT NULL DEFAULT 0,
      installmentPrice REAL NOT NULL DEFAULT 0,
      downPayment REAL NOT NULL DEFAULT 0,
      months INTEGER NOT NULL CHECK (months >= 1),
      monthlyInstallment REAL NOT NULL DEFAULT 0,
      paidTotal REAL NOT NULL DEFAULT 0,
      remaining REAL NOT NULL DEFAULT 0,
      firstInstallmentDate TEXT,
      notes TEXT,
      customFieldsJson TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      settledEarly INTEGER DEFAULT 0,
      settlementDiscount REAL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS installment_schedules (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      monthNumber INTEGER NOT NULL CHECK (monthNumber >= 1),
      dueDate TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0 CHECK (amount >= 0),
      paidAmount REAL DEFAULT 0 CHECK (paidAmount >= 0),
      penalty REAL DEFAULT 0 CHECK (penalty >= 0),
      paid INTEGER DEFAULT 0,
      remainingAfter REAL,
      note TEXT,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installment_payments (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      date TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS installment_payment_allocations (
      id TEXT PRIMARY KEY,
      paymentId TEXT NOT NULL,
      scheduleItemId TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      FOREIGN KEY (paymentId) REFERENCES installment_payments(id) ON DELETE CASCADE,
      FOREIGN KEY (scheduleItemId) REFERENCES installment_schedules(id) ON DELETE CASCADE
    );
  `);
}
function buildWalletDirectory(db2) {
  const directory = /* @__PURE__ */ new Map();
  const sources = [getSettingsJson(db2, "gx_wallets"), getSettingsJson(db2, "retail_wallets")];
  for (const source of sources) {
    for (const wallet of source || []) {
      const walletId = firstText(wallet.id);
      if (!walletId) continue;
      directory.set(walletId, wallet);
    }
  }
  return directory;
}
function ensureWalletRecord$1(db2, walletDirectory, walletId) {
  if (!walletId) return;
  const existing = db2.prepare("SELECT id FROM wallets WHERE id = ?").get(walletId);
  if (existing) return;
  const metadata = walletDirectory.get(walletId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const walletType = firstText(metadata == null ? void 0 : metadata.type, "cash");
  const walletIcon = firstText(
    metadata == null ? void 0 : metadata.icon,
    walletType === "bank" ? "🏦" : walletType === "card" ? "💳" : walletType === "transfer" ? "📲" : "💵"
  );
  const fallbackName = walletId === "wallet_cash" ? "الصندوق" : `Wallet ${walletId.slice(0, 8)}`;
  db2.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    walletId,
    firstText(metadata == null ? void 0 : metadata.name, fallbackName),
    walletType,
    toBoolean(metadata == null ? void 0 : metadata.isDefault) ? 1 : 0,
    walletIcon || null,
    firstText(metadata == null ? void 0 : metadata.color) || null,
    firstText(metadata == null ? void 0 : metadata.notes, "Auto-created to repair wallet references"),
    firstText(metadata == null ? void 0 : metadata.createdAt, now),
    firstText(metadata == null ? void 0 : metadata.updatedAt, now)
  );
}
function createSafeTransactionsTable(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS safe_transactions (
      id TEXT PRIMARY KEY,
      walletId TEXT NOT NULL,
      type TEXT NOT NULL,
      subType TEXT,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      paymentMethod TEXT,
      affectsCapital INTEGER DEFAULT 0,
      affectsProfit INTEGER DEFAULT 0,
      createdBy TEXT,
      relatedId TEXT,
      createdAt TEXT,
      FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE RESTRICT
    );
  `);
}
function readLegacyInstallmentContracts(db2) {
  if (!tableExists(db2, "installments")) return [];
  const contractRows = db2.prepare("SELECT * FROM installments").all();
  if (contractRows.length === 0) return [];
  const scheduleRows = tableExists(db2, "installment_schedules") ? db2.prepare("SELECT * FROM installment_schedules").all() : [];
  const paymentRows = tableExists(db2, "installment_payments") ? db2.prepare("SELECT * FROM installment_payments").all() : [];
  const allocationRows = tableExists(db2, "installment_payment_allocations") ? db2.prepare("SELECT * FROM installment_payment_allocations").all() : [];
  const schedulesByContract = /* @__PURE__ */ new Map();
  for (const row of scheduleRows) {
    const contractId = firstText(row.contractId);
    if (!contractId) continue;
    const entries = schedulesByContract.get(contractId) || [];
    entries.push(row);
    schedulesByContract.set(contractId, entries);
  }
  const allocationsByPayment = /* @__PURE__ */ new Map();
  for (const row of allocationRows) {
    const paymentId = firstText(row.paymentId);
    if (!paymentId) continue;
    const entries = allocationsByPayment.get(paymentId) || [];
    entries.push(row);
    allocationsByPayment.set(paymentId, entries);
  }
  const paymentsByContract = /* @__PURE__ */ new Map();
  for (const row of paymentRows) {
    const contractId = firstText(row.contractId);
    if (!contractId) continue;
    const entries = paymentsByContract.get(contractId) || [];
    entries.push(row);
    paymentsByContract.set(contractId, entries);
  }
  return contractRows.map((row) => {
    var _a;
    const contractId = firstText(row.id, crypto.randomUUID());
    const rawSchedule = (schedulesByContract.get(contractId) || []).slice().sort((left, right) => firstNumber(left.monthNumber) - firstNumber(right.monthNumber) || firstText(left.dueDate).localeCompare(firstText(right.dueDate)));
    const schedule = rawSchedule.map((item, index) => {
      const amount = firstNumber(item.amount);
      const penalty = firstNumber(item.penalty);
      const paidAmount = firstNumber(item.paidAmount);
      const totalDue = amount + penalty;
      return {
        id: firstText(item.id, crypto.randomUUID()),
        month: Math.max(1, Math.round(firstNumber(item.monthNumber, index + 1))),
        dueDate: firstText(item.dueDate),
        amount,
        paidAmount,
        penalty,
        paid: toBoolean(item.paid) || totalDue > 0 && paidAmount >= totalDue,
        remainingAfter: item.remainingAfter === void 0 || item.remainingAfter === null ? void 0 : firstNumber(item.remainingAfter),
        note: firstText(item.note)
      };
    });
    const rawPayments = paymentsByContract.get(contractId) || [];
    const payments = rawPayments.length > 0 ? rawPayments.slice().sort((left, right) => firstText(left.date).localeCompare(firstText(right.date)) || firstText(left.createdAt).localeCompare(firstText(right.createdAt))).map((payment) => ({
      id: firstText(payment.id, crypto.randomUUID()),
      amount: firstNumber(payment.amount),
      date: firstText(payment.date),
      note: firstText(payment.note),
      allocations: (allocationsByPayment.get(firstText(payment.id)) || []).map((allocation) => ({
        scheduleItemId: firstText(allocation.scheduleItemId),
        amount: firstNumber(allocation.amount)
      }))
    })) : schedule.filter((item) => firstNumber(item.paidAmount) > 0).map((item) => {
      var _a2;
      return {
        id: `legacy-payment-${firstText(item.id, crypto.randomUUID())}`,
        amount: firstNumber(item.paidAmount),
        date: firstText(
          (_a2 = rawSchedule.find((rawItem) => firstText(rawItem.id) === firstText(item.id))) == null ? void 0 : _a2.paymentDate,
          item.dueDate,
          firstText(row.createdAt).slice(0, 10)
        ),
        note: "Migrated from legacy schedule data",
        allocations: [{ scheduleItemId: firstText(item.id), amount: firstNumber(item.paidAmount) }]
      };
    });
    const scheduleTotal = schedule.reduce((sum, item) => sum + firstNumber(item.amount) + firstNumber(item.penalty), 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + firstNumber(payment.amount), 0);
    const downPayment = firstNumber(row.downPayment);
    const createdAt = firstText(row.createdAt, (/* @__PURE__ */ new Date()).toISOString());
    const remaining = row.remaining !== void 0 || row.remainingAmount !== void 0 ? firstNumber(row.remaining, row.remainingAmount) : Math.max(0, Math.round((scheduleTotal - paymentsTotal) * 100) / 100);
    return {
      id: contractId,
      contractNumber: firstText(row.contractNumber, `INS-${Date.now()}`),
      contractType: firstText(row.contractType, "product"),
      customerId: firstText(row.customerId) || void 0,
      customerName: firstText(row.customerName),
      customerPhone: firstText(row.customerPhone),
      customerAddress: firstText(row.customerAddress),
      customerIdCard: firstText(row.customerIdCard, row.customerNationalId),
      guarantorName: firstText(row.guarantorName),
      guarantorIdCard: firstText(row.guarantorIdCard),
      guarantorPhone: firstText(row.guarantorPhone),
      guarantorAddress: firstText(row.guarantorAddress),
      productId: firstText(row.productId) || void 0,
      productName: firstText(row.productName),
      transferType: firstText(row.transferType) || void 0,
      cashPrice: firstNumber(row.cashPrice, row.totalAmount),
      installmentPrice: firstNumber(row.installmentPrice, row.totalAmount),
      downPayment,
      months: Math.max(1, Math.round(firstNumber(row.months, schedule.length || 1))),
      monthlyInstallment: firstNumber(row.monthlyInstallment, row.monthlyPayment, schedule.length > 0 ? scheduleTotal / schedule.length : 0),
      paidTotal: row.paidTotal !== void 0 ? firstNumber(row.paidTotal) : Math.round((downPayment + paymentsTotal) * 100) / 100,
      remaining,
      firstInstallmentDate: firstText(row.firstInstallmentDate, row.startDate, (_a = schedule[0]) == null ? void 0 : _a.dueDate),
      schedule,
      payments,
      notes: firstText(row.notes),
      customFields: parseJsonArray(row.customFieldsJson),
      status: firstText(row.status, remaining === 0 ? "completed" : "active"),
      settledEarly: toBoolean(row.settledEarly),
      settlementDiscount: firstNumber(row.settlementDiscount),
      createdAt,
      updatedAt: firstText(row.updatedAt, createdAt)
    };
  });
}
function needsInstallmentSchemaRepair(db2) {
  if (!tableHasColumns(db2, "installments", ["id", "contractNumber"])) return true;
  if (!tableHasColumns(db2, "installments", [
    "contractType",
    "customerIdCard",
    "guarantorIdCard",
    "transferType",
    "cashPrice",
    "installmentPrice",
    "paidTotal",
    "remaining",
    "customFieldsJson",
    "updatedAt"
  ])) {
    return true;
  }
  if (tableHasColumns(db2, "installments", ["totalAmount", "remainingAmount", "monthlyPayment", "startDate", "customerNationalId"])) {
    return true;
  }
  if (!tableHasColumns(db2, "installment_schedules", [
    "id",
    "contractId",
    "monthNumber",
    "dueDate",
    "amount",
    "paidAmount",
    "penalty",
    "paid",
    "remainingAfter",
    "note"
  ])) {
    return true;
  }
  if (!tableHasColumns(db2, "installment_payments", ["id", "contractId", "amount", "date", "createdAt"])) return true;
  if (!tableHasColumns(db2, "installment_payment_allocations", ["id", "paymentId", "scheduleItemId", "amount"])) return true;
  return false;
}
function repairInstallmentsSchema(db2) {
  const legacyContracts = readLegacyInstallmentContracts(db2);
  if (!needsInstallmentSchemaRepair(db2)) return legacyContracts;
  db2.transaction(() => {
    db2.prepare("DROP TABLE IF EXISTS installment_payment_allocations").run();
    db2.prepare("DROP TABLE IF EXISTS installment_payments").run();
    db2.prepare("DROP TABLE IF EXISTS installment_schedules").run();
    db2.prepare("DROP TABLE IF EXISTS installments").run();
    createInstallmentsTables(db2);
  })();
  console.log("[migration] Installments schema repaired.");
  return legacyContracts;
}
function migrateInstallments(db2, legacyContracts) {
  if (!tableExists(db2, "installments") || !tableIsEmpty(db2, "installments")) return;
  const settingsContracts = getSettingsJson(db2, "gx_installments_v2") || [];
  const sources = [
    { label: "settings", data: settingsContracts },
    { label: "legacy tables", data: legacyContracts }
  ];
  for (const source of sources) {
    if (!source.data.length) continue;
    try {
      replaceInstallmentContracts(db2, source.data);
      console.log(`[migration] Installments: ${source.data.length} contracts migrated from ${source.label}.`);
      return;
    } catch (error) {
      console.error(`[migration] Installments migration from ${source.label} failed:`, error);
    }
  }
}
function needsSafeTransactionsRepair(db2) {
  if (!tableHasColumns(db2, "safe_transactions", ["id", "walletId", "type", "amount", "createdAt"])) return true;
  const foreignKeys = tableExists(db2, "safe_transactions") ? db2.prepare("PRAGMA foreign_key_list(safe_transactions)").all() : [];
  return !foreignKeys.some((foreignKey) => foreignKey.from === "walletId" && foreignKey.table === "wallets");
}
function repairSafeTransactionsSchema(db2) {
  const safeTransactions = tableExists(db2, "safe_transactions") ? db2.prepare("SELECT * FROM safe_transactions").all() : [];
  const walletDirectory = buildWalletDirectory(db2);
  const shouldRebuild = needsSafeTransactionsRepair(db2);
  if (shouldRebuild) {
    db2.transaction(() => {
      db2.prepare("DROP TABLE IF EXISTS safe_transactions").run();
      createSafeTransactionsTable(db2);
    })();
    console.log("[migration] Safe transactions schema repaired.");
  }
  const distinctWalletIds = [...new Set(safeTransactions.map((row) => firstText(row.walletId)).filter(Boolean))];
  for (const walletId of distinctWalletIds) {
    ensureWalletRecord$1(db2, walletDirectory, walletId);
  }
  if (!shouldRebuild || safeTransactions.length === 0 || !tableIsEmpty(db2, "safe_transactions")) return;
  const insertTransaction = db2.prepare(`
    INSERT OR IGNORE INTO safe_transactions (
      id, walletId, type, subType, amount, category, description, paymentMethod,
      affectsCapital, affectsProfit, createdBy, relatedId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const transaction of safeTransactions) {
      insertTransaction.run(
        firstText(transaction.id, crypto.randomUUID()),
        firstText(transaction.walletId),
        firstText(transaction.type),
        firstText(transaction.subType) || null,
        firstNumber(transaction.amount),
        firstText(transaction.category) || null,
        firstText(transaction.description) || null,
        firstText(transaction.paymentMethod) || null,
        toBoolean(transaction.affectsCapital) ? 1 : 0,
        toBoolean(transaction.affectsProfit) ? 1 : 0,
        firstText(transaction.createdBy) || null,
        firstText(transaction.relatedId) || null,
        firstText(transaction.createdAt, (/* @__PURE__ */ new Date()).toISOString())
      );
    }
  })();
}
function normalizeCategoryInventoryType(sectionValue, typeValue, fallbackValue) {
  const fallback = firstText(fallbackValue);
  if (fallback) return fallback;
  const section = firstText(sectionValue, "mobile");
  const type = firstText(typeValue, "device");
  return `${section}_${type}`;
}
function categoriesSchemaNeedsRepair(db2) {
  if (!tableHasColumns(db2, "categories", ["id", "name", "inventoryType"])) return true;
  const row = db2.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get();
  const sql = String((row == null ? void 0 : row.sql) ?? "").toLowerCase().replace(/\s+/g, " ");
  return sql.includes("name text unique") || !sql.includes("unique(name, inventorytype)");
}
function repairCategoriesSchema(db2) {
  if (!tableExists(db2, "categories") || !categoriesSchemaNeedsRepair(db2)) return;
  const existing = db2.prepare("SELECT * FROM categories").all();
  const deduped = /* @__PURE__ */ new Map();
  for (const row of existing) {
    const name = firstText(row.name);
    const inventoryType = normalizeCategoryInventoryType(row.section, row.type, row.inventoryType);
    if (!name || !inventoryType) continue;
    const key = `${inventoryType}::${name.toLowerCase()}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      id: firstText(row.id, crypto.randomUUID()),
      name,
      inventoryType
    });
  }
  db2.transaction(() => {
    db2.prepare("DROP TABLE IF EXISTS categories").run();
    db2.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        inventoryType TEXT NOT NULL,
        UNIQUE(name, inventoryType)
      );
    `);
    const stmt = db2.prepare(`
      INSERT OR IGNORE INTO categories (id, name, inventoryType)
      VALUES (?, ?, ?)
    `);
    for (const category of deduped.values()) {
      stmt.run(category.id, category.name, category.inventoryType);
    }
  })();
  console.log("[migration] Categories schema repaired.");
}
function productBatchesSchemaNeedsRepair(db2) {
  if (!tableHasColumns(db2, "product_batches", [
    "id",
    "productId",
    "inventoryType",
    "productName",
    "costPrice",
    "salePrice",
    "quantity",
    "remainingQty",
    "purchaseDate",
    "supplier",
    "notes",
    "createdAt",
    "updatedAt"
  ])) {
    return true;
  }
  const foreignKeys = tableExists(db2, "product_batches") ? db2.prepare("PRAGMA foreign_key_list(product_batches)").all() : [];
  return foreignKeys.some((foreignKey) => foreignKey.from === "productId" && foreignKey.table === "products");
}
function repairProductBatchesSchema(db2) {
  if (!tableExists(db2, "product_batches") || !productBatchesSchemaNeedsRepair(db2)) return;
  const existing = db2.prepare("SELECT * FROM product_batches").all();
  db2.transaction(() => {
    db2.prepare("DROP TABLE IF EXISTS product_batches").run();
    db2.exec(`
      CREATE TABLE IF NOT EXISTS product_batches (
        id TEXT PRIMARY KEY,
        productId TEXT NOT NULL,
        inventoryType TEXT,
        productName TEXT,
        costPrice REAL NOT NULL,
        salePrice REAL NOT NULL,
        quantity INTEGER NOT NULL,
        remainingQty INTEGER NOT NULL,
        purchaseDate TEXT NOT NULL,
        supplier TEXT,
        notes TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );
    `);
    const stmt = db2.prepare(`
      INSERT OR IGNORE INTO product_batches (
        id, productId, inventoryType, productName, costPrice, salePrice,
        quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const batch of existing) {
      const productId = firstText(batch.productId);
      if (!productId) continue;
      const purchaseDate = firstText(batch.purchaseDate, batch.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      const createdAt = firstText(batch.createdAt, purchaseDate);
      stmt.run(
        firstText(batch.id, crypto.randomUUID()),
        productId,
        firstText(batch.inventoryType, "mobile"),
        firstText(batch.productName, "Unknown product"),
        firstNumber(batch.costPrice),
        firstNumber(batch.salePrice),
        Math.max(0, Math.round(firstNumber(batch.quantity))),
        Math.max(0, Math.round(firstNumber(batch.remainingQty, batch.quantity))),
        purchaseDate,
        firstText(batch.supplier) || null,
        firstText(batch.notes) || null,
        createdAt,
        firstText(batch.updatedAt, createdAt)
      );
    }
  })();
  console.log("[migration] Product batches schema repaired.");
}
function repairOperationalSchemas(db2) {
  if (tableExists(db2, "repair_tickets")) {
    ensureColumn(db2, "repair_tickets", "final_cost", "REAL DEFAULT 0");
  }
  if (tableExists(db2, "blacklist")) {
    ensureColumn(db2, "blacklist", "imei", "TEXT");
    ensureColumn(db2, "blacklist", "deviceName", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db2, "blacklist", "ownerName", "TEXT");
    ensureColumn(db2, "blacklist", "ownerPhone", "TEXT");
    ensureColumn(db2, "blacklist", "status", "TEXT DEFAULT 'active'");
    ensureColumn(db2, "blacklist", "reportedDate", "TEXT");
    ensureColumn(db2, "blacklist", "createdBy", "TEXT");
    ensureColumn(db2, "blacklist", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE blacklist
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE blacklist
      SET imei = COALESCE(NULLIF(imei, ''), NULLIF(nationalId, ''))
      WHERE COALESCE(imei, '') = '';

      UPDATE blacklist
      SET deviceName = COALESCE(NULLIF(deviceName, ''), NULLIF(name, ''), 'Unknown device')
      WHERE COALESCE(deviceName, '') = '';

      UPDATE blacklist
      SET ownerPhone = COALESCE(NULLIF(ownerPhone, ''), NULLIF(phone, ''))
      WHERE COALESCE(ownerPhone, '') = '';

      UPDATE blacklist
      SET status = COALESCE(NULLIF(status, ''), 'active')
      WHERE COALESCE(status, '') = '';

      UPDATE blacklist
      SET reportedDate = COALESCE(NULLIF(reportedDate, ''), substr(COALESCE(createdAt, CURRENT_TIMESTAMP), 1, 10))
      WHERE COALESCE(reportedDate, '') = '';

      UPDATE blacklist
      SET createdBy = COALESCE(NULLIF(createdBy, ''), NULLIF(addedBy, ''), 'system')
      WHERE COALESCE(createdBy, '') = '';

      UPDATE blacklist
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE blacklist
      SET name = COALESCE(NULLIF(name, ''), deviceName)
      WHERE COALESCE(name, '') = '';

      UPDATE blacklist
      SET phone = COALESCE(NULLIF(phone, ''), ownerPhone)
      WHERE COALESCE(phone, '') = '';

      UPDATE blacklist
      SET nationalId = COALESCE(NULLIF(nationalId, ''), imei)
      WHERE COALESCE(nationalId, '') = '';

      UPDATE blacklist
      SET addedBy = COALESCE(NULLIF(addedBy, ''), createdBy)
      WHERE COALESCE(addedBy, '') = '';
    `);
  }
  if (tableExists(db2, "damaged_items")) {
    ensureColumn(db2, "damaged_items", "costPrice", "REAL DEFAULT 0");
    db2.exec(`
      UPDATE damaged_items
      SET costPrice = CASE
        WHEN COALESCE(costPrice, 0) > 0 THEN costPrice
        WHEN COALESCE(quantity, 0) > 0 THEN ROUND(COALESCE(estimatedLoss, 0) / quantity, 2)
        ELSE 0
      END
      WHERE COALESCE(costPrice, 0) = 0;
    `);
  }
  if (tableExists(db2, "other_revenue")) {
    ensureColumn(db2, "other_revenue", "addedBy", "TEXT");
    ensureColumn(db2, "other_revenue", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE other_revenue
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE other_revenue
      SET addedBy = COALESCE(NULLIF(addedBy, ''), 'system')
      WHERE COALESCE(addedBy, '') = '';

      UPDATE other_revenue
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }
  if (tableExists(db2, "wallets")) {
    ensureColumn(db2, "wallets", "icon", "TEXT");
    db2.exec(`
      UPDATE wallets
      SET icon = CASE
        WHEN COALESCE(NULLIF(icon, ''), '') <> '' THEN icon
        WHEN type = 'bank' THEN '🏦'
        WHEN type = 'card' THEN '💳'
        WHEN type = 'mobile_wallet' THEN '📱'
        ELSE '💵'
      END
      WHERE COALESCE(icon, '') = '';
    `);
  }
  if (tableExists(db2, "customers")) {
    ensureColumn(db2, "customers", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "customers", "deletedAt", "TEXT");
  }
  if (tableExists(db2, "suppliers")) {
    ensureColumn(db2, "suppliers", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "suppliers", "deletedAt", "TEXT");
  }
  if (tableExists(db2, "employees")) {
    ensureColumn(db2, "employees", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "employees", "deletedAt", "TEXT");
  }
  if (tableExists(db2, "used_devices")) {
    ensureColumn(db2, "used_devices", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "used_devices", "deletedAt", "TEXT");
    ensureColumn(db2, "used_devices", "warehouseId", "TEXT");
  }
  if (tableExists(db2, "employee_salaries")) {
    ensureColumn(db2, "employee_salaries", "employeeName", "TEXT");
    ensureColumn(db2, "employee_salaries", "advanceDeducted", "REAL DEFAULT 0");
    ensureColumn(db2, "employee_salaries", "walletId", "TEXT");
    db2.exec(`
      UPDATE employee_salaries
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(paidAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `);
  }
  db2.exec(`
    CREATE TABLE IF NOT EXISTS employee_advances (
      id TEXT PRIMARY KEY,
      employeeId TEXT NOT NULL,
      employeeName TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      deductedMonth TEXT,
      notes TEXT,
      createdAt TEXT,
      FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY,
      supplierId TEXT NOT NULL,
      supplierName TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balanceBefore REAL DEFAULT 0,
      balanceAfter REAL DEFAULT 0,
      notes TEXT,
      createdBy TEXT,
      createdAt TEXT,
      FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warehouse_items (
      id TEXT PRIMARY KEY,
      warehouseId TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      costPrice REAL NOT NULL DEFAULT 0,
      notes TEXT,
      addedBy TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS cars_inventory (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      color TEXT,
      plateNumber TEXT,
      licenseExpiry TEXT,
      condition TEXT NOT NULL DEFAULT 'used',
      category TEXT,
      purchasePrice REAL NOT NULL DEFAULT 0,
      salePrice REAL NOT NULL DEFAULT 0,
      notes TEXT,
      image TEXT,
      warehouseId TEXT,
      isArchived INTEGER DEFAULT 0,
      deletedAt TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
    );
  `);
  if (tableExists(db2, "used_devices")) {
    ensureColumn(db2, "used_devices", "model", "TEXT");
    ensureColumn(db2, "used_devices", "deviceType", "TEXT");
    ensureColumn(db2, "used_devices", "ram", "TEXT");
    ensureColumn(db2, "used_devices", "description", "TEXT");
    db2.exec(`
      UPDATE used_devices
      SET deviceType = COALESCE(NULLIF(deviceType, ''), NULLIF(category, ''), 'mobile')
      WHERE COALESCE(deviceType, '') = '';

      UPDATE used_devices
      SET description = COALESCE(NULLIF(description, ''), NULLIF(notes, ''), '')
      WHERE COALESCE(description, '') = '';

      UPDATE used_devices
      SET model = COALESCE(NULLIF(model, ''), '')
      WHERE model IS NULL;

      UPDATE used_devices
      SET ram = COALESCE(NULLIF(ram, ''), '')
      WHERE ram IS NULL;
    `);
  }
  if (tableExists(db2, "warehouse_items")) {
    ensureColumn(db2, "warehouse_items", "warehouseId", "TEXT");
    ensureColumn(db2, "warehouse_items", "notes", "TEXT");
    ensureColumn(db2, "warehouse_items", "addedBy", "TEXT");
    ensureColumn(db2, "warehouse_items", "createdAt", "TEXT");
    ensureColumn(db2, "warehouse_items", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE warehouse_items
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE warehouse_items
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }
  if (tableExists(db2, "cars_inventory")) {
    ensureColumn(db2, "cars_inventory", "warehouseId", "TEXT");
    ensureColumn(db2, "cars_inventory", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "cars_inventory", "deletedAt", "TEXT");
    ensureColumn(db2, "cars_inventory", "createdAt", "TEXT");
    ensureColumn(db2, "cars_inventory", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE cars_inventory
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE cars_inventory
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE cars_inventory
      SET isArchived = COALESCE(isArchived, 0)
      WHERE isArchived IS NULL;
    `);
  }
  if (tableExists(db2, "products")) {
    ensureColumn(db2, "products", "brand", "TEXT");
    ensureColumn(db2, "products", "description", "TEXT");
    ensureColumn(db2, "products", "boxNumber", "TEXT");
    ensureColumn(db2, "products", "taxExcluded", "INTEGER DEFAULT 0");
    ensureColumn(db2, "products", "profitMargin", "REAL DEFAULT 0");
    ensureColumn(db2, "products", "minStock", "INTEGER DEFAULT 0");
    ensureColumn(db2, "products", "warehouseId", "TEXT");
    ensureColumn(db2, "products", "serialNumber", "TEXT");
    ensureColumn(db2, "products", "imei2", "TEXT");
    ensureColumn(db2, "products", "processor", "TEXT");
    ensureColumn(db2, "products", "isArchived", "INTEGER DEFAULT 0");
    db2.exec(`
      UPDATE products
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE products
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE products
      SET isArchived = COALESCE(isArchived, 0)
      WHERE isArchived IS NULL;

      UPDATE products
      SET taxExcluded = COALESCE(taxExcluded, 0)
      WHERE taxExcluded IS NULL;

      UPDATE products
      SET profitMargin = COALESCE(profitMargin, ROUND((COALESCE(salePrice, 0) - COALESCE(newCostPrice, oldCostPrice, 0)) * 100) / 100)
      WHERE profitMargin IS NULL;

      UPDATE products
      SET minStock = COALESCE(minStock, 0)
      WHERE minStock IS NULL;
    `);
  }
  if (tableExists(db2, "reminders")) {
    ensureColumn(db2, "reminders", "reminderTime", "TEXT");
    ensureColumn(db2, "reminders", "status", "TEXT DEFAULT 'pending'");
    ensureColumn(db2, "reminders", "notes", "TEXT");
    db2.exec(`
      UPDATE reminders
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE reminders
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE reminders
      SET dueDate = COALESCE(NULLIF(dueDate, ''), substr(COALESCE(createdAt, CURRENT_TIMESTAMP), 1, 10))
      WHERE COALESCE(dueDate, '') = '';

      UPDATE reminders
      SET status = CASE
        WHEN COALESCE(NULLIF(status, ''), '') <> '' THEN status
        WHEN completed = 1 THEN 'done'
        ELSE 'pending'
      END
      WHERE COALESCE(status, '') = '';
    `);
  }
  if (tableExists(db2, "product_batches")) {
    ensureColumn(db2, "product_batches", "inventoryType", "TEXT");
    ensureColumn(db2, "product_batches", "productName", "TEXT");
    ensureColumn(db2, "product_batches", "supplier", "TEXT");
    ensureColumn(db2, "product_batches", "notes", "TEXT");
    ensureColumn(db2, "product_batches", "createdAt", "TEXT");
    ensureColumn(db2, "product_batches", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE product_batches
      SET productName = COALESCE(NULLIF(productName, ''), 'Unknown product')
      WHERE COALESCE(productName, '') = '';

      UPDATE product_batches
      SET inventoryType = COALESCE(NULLIF(inventoryType, ''), 'mobile')
      WHERE COALESCE(inventoryType, '') = '';

      UPDATE product_batches
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(purchaseDate, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';

      UPDATE product_batches
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }
  if (tableExists(db2, "accessories")) {
    ensureColumn(db2, "accessories", "oldCostPrice", "REAL DEFAULT 0");
    ensureColumn(db2, "accessories", "newCostPrice", "REAL DEFAULT 0");
    ensureColumn(db2, "accessories", "profitMargin", "REAL DEFAULT 0");
    ensureColumn(db2, "accessories", "brand", "TEXT");
    ensureColumn(db2, "accessories", "source", "TEXT");
    ensureColumn(db2, "accessories", "boxNumber", "TEXT");
    ensureColumn(db2, "accessories", "taxExcluded", "INTEGER DEFAULT 0");
    ensureColumn(db2, "accessories", "description", "TEXT");
    ensureColumn(db2, "accessories", "isArchived", "INTEGER DEFAULT 0");
    ensureColumn(db2, "accessories", "deletedAt", "TEXT");
    db2.exec(`
      UPDATE accessories
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE accessories
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE accessories
      SET oldCostPrice = COALESCE(oldCostPrice, costPrice, newCostPrice, 0)
      WHERE oldCostPrice IS NULL;

      UPDATE accessories
      SET newCostPrice = COALESCE(newCostPrice, costPrice, oldCostPrice, 0)
      WHERE newCostPrice IS NULL;

      UPDATE accessories
      SET profitMargin = COALESCE(profitMargin, ROUND((COALESCE(salePrice, 0) - COALESCE(newCostPrice, costPrice, oldCostPrice, 0)) * 100) / 100)
      WHERE profitMargin IS NULL;

      UPDATE accessories
      SET taxExcluded = COALESCE(taxExcluded, 0)
      WHERE taxExcluded IS NULL;

      UPDATE accessories
      SET isArchived = COALESCE(isArchived, 0)
      WHERE isArchived IS NULL;
    `);
  }
  if (tableExists(db2, "users")) {
    ensureColumn(db2, "users", "salt", "TEXT");
    ensureColumn(db2, "users", "mustChangePassword", "INTEGER DEFAULT 0");
    ensureColumn(db2, "users", "createdAt", "TEXT");
    ensureColumn(db2, "users", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE users
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE users
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }
  if (tableExists(db2, "sales")) {
    ensureColumn(db2, "sales", "voidedAt", "TEXT");
    ensureColumn(db2, "sales", "voidReason", "TEXT");
    ensureColumn(db2, "sales", "voidedBy", "TEXT");
  }
  if (tableExists(db2, "sale_items")) {
    ensureColumn(db2, "sale_items", "name", "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db2, "sale_items", "qty", "INTEGER NOT NULL DEFAULT 0");
    ensureColumn(db2, "sale_items", "price", "REAL NOT NULL DEFAULT 0");
    ensureColumn(db2, "sale_items", "cost", "REAL NOT NULL DEFAULT 0");
    ensureColumn(db2, "sale_items", "lineDiscount", "REAL DEFAULT 0");
    ensureColumn(db2, "sale_items", "warehouseId", "TEXT");
    ensureColumn(db2, "sale_items", "batches", "TEXT");
  }
  if (tableExists(db2, "stock_movements")) {
    ensureColumn(db2, "stock_movements", "warehouseId", "TEXT");
  }
  if (tableExists(db2, "audit_logs")) {
    ensureColumn(db2, "audit_logs", "beforeStateJson", "TEXT");
    ensureColumn(db2, "audit_logs", "afterStateJson", "TEXT");
    ensureColumn(db2, "audit_logs", "machineId", "TEXT");
  }
  if (tableExists(db2, "return_records")) {
    ensureColumn(db2, "return_records", "originalSaleId", "TEXT");
    ensureColumn(db2, "return_records", "reason", "TEXT");
    ensureColumn(db2, "return_records", "processedBy", "TEXT");
    ensureColumn(db2, "return_records", "createdAt", "TEXT");
  }
  if (tableExists(db2, "return_items")) {
    ensureColumn(db2, "return_items", "reason", "TEXT");
  }
  if (tableExists(db2, "purchase_invoices")) {
    ensureColumn(db2, "purchase_invoices", "supplierId", "TEXT");
    ensureColumn(db2, "purchase_invoices", "status", "TEXT NOT NULL DEFAULT 'confirmed'");
    ensureColumn(db2, "purchase_invoices", "notes", "TEXT");
    ensureColumn(db2, "purchase_invoices", "createdBy", "TEXT");
    ensureColumn(db2, "purchase_invoices", "createdAt", "TEXT");
    ensureColumn(db2, "purchase_invoices", "updatedAt", "TEXT");
    db2.exec(`
      UPDATE purchase_invoices
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE purchase_invoices
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE purchase_invoices
      SET remaining = MAX(0, ROUND((COALESCE(totalAmount, 0) - COALESCE(paidAmount, 0)) * 100) / 100)
      WHERE remaining IS NULL OR remaining < 0;

      UPDATE purchase_invoices
      SET status = CASE
        WHEN COALESCE(paidAmount, 0) <= 0 THEN 'confirmed'
        WHEN COALESCE(paidAmount, 0) >= COALESCE(totalAmount, 0) THEN 'paid'
        ELSE 'partial'
      END
      WHERE COALESCE(status, '') = '';
    `);
  }
  if (tableExists(db2, "purchase_invoice_items")) {
    ensureColumn(db2, "purchase_invoice_items", "category", "TEXT");
    ensureColumn(db2, "purchase_invoice_items", "notes", "TEXT");
  }
  if (tableExists(db2, "shift_closings")) {
    ensureColumn(db2, "shift_closings", "notes", "TEXT");
    ensureColumn(db2, "shift_closings", "createdAt", "TEXT");
    db2.exec(`
      UPDATE shift_closings
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(closedAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `);
  }
}
function ensurePerformanceIndexes(db2) {
  db2.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_source_deleted ON products(source, deletedAt, isArchived);
    CREATE INDEX IF NOT EXISTS idx_products_warehouse ON products(warehouseId);
    CREATE INDEX IF NOT EXISTS idx_categories_inventoryType ON categories(inventoryType);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee_month ON employee_salaries(employeeId, month);
    CREATE INDEX IF NOT EXISTS idx_employee_advances_employee_date ON employee_advances(employeeId, date);
    CREATE INDEX IF NOT EXISTS idx_product_batches_productId ON product_batches(productId);
    CREATE INDEX IF NOT EXISTS idx_accessories_inventory_deleted ON accessories(inventoryType, deletedAt, isArchived);
    CREATE INDEX IF NOT EXISTS idx_accessories_warehouse ON accessories(warehouseId);
    CREATE INDEX IF NOT EXISTS idx_sale_items_saleId ON sale_items(saleId);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_nationalId ON customers(nationalId);
    CREATE INDEX IF NOT EXISTS idx_blacklist_imei_status ON blacklist(imei, status);
    CREATE INDEX IF NOT EXISTS idx_damaged_items_date ON damaged_items(date);
    CREATE INDEX IF NOT EXISTS idx_installments_customerId ON installments(customerId);
    CREATE INDEX IF NOT EXISTS idx_installments_productId ON installments(productId);
    CREATE INDEX IF NOT EXISTS idx_installments_status ON installments(status);
    CREATE INDEX IF NOT EXISTS idx_installments_createdAt ON installments(createdAt);
    CREATE INDEX IF NOT EXISTS idx_installment_schedules_contract_month ON installment_schedules(contractId, monthNumber);
    CREATE INDEX IF NOT EXISTS idx_installment_schedules_due_paid ON installment_schedules(dueDate, paid);
    CREATE INDEX IF NOT EXISTS idx_installment_payments_contract_date ON installment_payments(contractId, date);
    CREATE INDEX IF NOT EXISTS idx_installment_allocations_payment ON installment_payment_allocations(paymentId);
    CREATE INDEX IF NOT EXISTS idx_installment_allocations_schedule ON installment_payment_allocations(scheduleItemId);
    CREATE INDEX IF NOT EXISTS idx_sales_date_voided ON sales(date, voidedAt);
    CREATE INDEX IF NOT EXISTS idx_sale_items_productId ON sale_items(productId);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product_timestamp ON stock_movements(productId, timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_timestamp ON audit_logs(entityType, entityId, timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(userId, timestamp);
    CREATE INDEX IF NOT EXISTS idx_warehouse_items_category ON warehouse_items(category);
    CREATE INDEX IF NOT EXISTS idx_warehouse_items_warehouse ON warehouse_items(warehouseId);
    CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_created ON supplier_transactions(supplierId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_other_revenue_date ON other_revenue(date);
    CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier_date ON purchase_invoices(supplierId, invoiceDate);
    CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status_date ON purchase_invoices(status, invoiceDate);
    CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice ON purchase_invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_return_records_sale_date ON return_records(originalSaleId, date);
    CREATE INDEX IF NOT EXISTS idx_return_items_return ON return_items(returnId);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_status ON reminders(dueDate, status, completed);
    CREATE INDEX IF NOT EXISTS idx_safe_transactions_wallet_created ON safe_transactions(walletId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_shift_closings_closedAt ON shift_closings(closedAt);
    CREATE INDEX IF NOT EXISTS idx_repair_tickets_status_created ON repair_tickets(status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_used_devices_serial_status ON used_devices(serialNumber, status);
    CREATE INDEX IF NOT EXISTS idx_cars_inventory_condition ON cars_inventory(condition, isArchived);
    CREATE INDEX IF NOT EXISTS idx_cars_inventory_plate ON cars_inventory(plateNumber);
  `);
}
function runDataMigration(db2) {
  console.log("[migration] Running data migration check...");
  try {
    repairCategoriesSchema(db2);
    repairProductBatchesSchema(db2);
    repairOperationalSchemas(db2);
    migrateCustomers(db2);
    migrateWallets(db2);
    migrateCategories(db2);
    migrateAppUsers(db2);
    const legacyInstallments = repairInstallmentsSchema(db2);
    migrateInstallments(db2, legacyInstallments);
    repairSafeTransactionsSchema(db2);
    ensurePerformanceIndexes(db2);
    migrateProductsInventory(db2);
    migrateAccessories(db2);
    migrateBatches(db2);
    migrateWarehouseItems(db2);
    migrateCars(db2);
    migrateSales(db2);
    migrateReturnRecords(db2);
    migrateShiftClosings(db2);
    migrateStockMovements(db2);
    migrateAuditLogs(db2);
    migrateSuppliers(db2);
    migratePurchaseInvoices(db2);
    migrateEmployees(db2);
    migrateSupplierTransactions(db2);
    migrateSalaryRecords(db2);
    migrateAdvances(db2);
    migrateExpenses(db2);
    migrateBlacklist(db2);
    migrateDamagedItems(db2);
    migrateOtherRevenue(db2);
    migrateUsedDevices(db2);
    migrateReminders(db2);
    migrateRepairs(db2);
    migrateRepairParts(db2);
    migrateUnifiedInventory(db2);
    console.log("[migration] All migrations complete.");
  } catch (err) {
    console.error("[migration] Error:", err);
  }
}
function migrateProductsInventory(db2) {
  const sources = [
    { key: "elahmed-products", source: "legacy" },
    { key: "gx_mobiles_v2", source: "mobile" },
    { key: "gx_computers_v2", source: "computer" },
    { key: "gx_devices_v2", source: "device" }
  ];
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, model, barcode, deviceType, category, condition, storage, ram, color,
      brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
      salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
      imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const target of sources) {
      const items = getSettingsJson(db2, target.key);
      if (!(items == null ? void 0 : items.length)) continue;
      for (const item of items) {
        const source = firstText(item.source, target.source);
        const createdAt = firstText(item.createdAt, (/* @__PURE__ */ new Date()).toISOString());
        const newCostPrice = firstNumber(item.newCostPrice, item.costPrice, item.oldCostPrice);
        stmt.run(
          firstText(item.id, crypto.randomUUID()),
          firstText(item.name, "Unknown product"),
          firstText(item.model) || null,
          firstText(item.barcode) || null,
          firstText(item.deviceType, source === "mobile" ? "mobile" : source === "computer" ? "computer" : source === "device" ? "device" : "") || null,
          firstText(item.category) || null,
          firstText(item.condition, "new") || null,
          firstText(item.storage) || null,
          firstText(item.ram) || null,
          firstText(item.color) || null,
          firstText(item.brand) || null,
          firstText(item.description) || null,
          firstText(item.boxNumber) || null,
          toBoolean(item.taxExcluded) ? 1 : 0,
          Math.max(0, Math.round(firstNumber(item.quantity))),
          firstNumber(item.oldCostPrice, newCostPrice),
          newCostPrice,
          firstNumber(item.salePrice),
          firstNumber(item.profitMargin, firstNumber(item.salePrice) - newCostPrice),
          Math.max(0, Math.round(firstNumber(item.minStock))),
          firstText(item.supplier) || null,
          source,
          firstText(item.warehouseId) || null,
          firstText(item.serialNumber) || null,
          firstText(item.imei2) || null,
          firstText(item.processor) || null,
          toBoolean(item.isArchived) ? 1 : 0,
          firstText(item.notes) || null,
          firstText(item.image) || null,
          createdAt,
          firstText(item.updatedAt, createdAt),
          firstText(item.deletedAt) || null
        );
      }
      console.log(`[migration] Products (${target.source}): migrated ${items.length} records.`);
    }
  })();
}
function migrateAccessories(db2) {
  const keysToMigrate = [
    { key: "gx_mobile_accessories", type: "mobile_accessory" },
    { key: "gx_mobile_spare_parts", type: "mobile_spare_part" },
    { key: "gx_computer_accessories", type: "computer_accessory_legacy" },
    { key: "gx_computer_accessories_sa", type: "computer_accessory" },
    { key: "gx_computer_spare_parts", type: "computer_spare_part" },
    { key: "gx_device_accessories", type: "device_accessory_legacy" },
    { key: "gx_device_accessories_sa", type: "device_accessory" },
    { key: "gx_device_spare_parts", type: "device_spare_part" }
  ];
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO accessories (
      id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
      oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
      brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
      deletedAt, notes, image, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const migrationTarget of keysToMigrate) {
      const items = getSettingsJson(db2, migrationTarget.key);
      if (!(items == null ? void 0 : items.length)) continue;
      for (const item of items) {
        const newCostPrice = firstNumber(item.newCostPrice, item.costPrice, item.oldCostPrice);
        const createdAt = firstText(item.createdAt, (/* @__PURE__ */ new Date()).toISOString());
        stmt.run(
          firstText(item.id, crypto.randomUUID()),
          firstText(item.warehouseId) || null,
          migrationTarget.type,
          firstText(item.name, "Unknown accessory"),
          firstText(item.category) || null,
          firstText(item.subcategory) || null,
          firstText(item.model) || null,
          firstText(item.barcode) || null,
          Math.max(0, Math.round(firstNumber(item.quantity))),
          firstNumber(item.oldCostPrice, newCostPrice),
          newCostPrice,
          firstNumber(item.costPrice, newCostPrice),
          firstNumber(item.salePrice),
          firstNumber(item.profitMargin, firstNumber(item.salePrice) - newCostPrice),
          Math.max(0, Math.round(firstNumber(item.minStock))),
          firstText(item.condition, "new"),
          firstText(item.brand) || null,
          firstText(item.supplier) || null,
          firstText(item.source) || null,
          firstText(item.boxNumber) || null,
          toBoolean(item.taxExcluded) ? 1 : 0,
          firstText(item.color) || null,
          firstText(item.description) || null,
          toBoolean(item.isArchived) ? 1 : 0,
          firstText(item.deletedAt) || null,
          firstText(item.notes) || null,
          firstText(item.image) || null,
          createdAt,
          firstText(item.updatedAt, createdAt)
        );
      }
      console.log(`[migration] Accessories (${migrationTarget.type}): migrated ${items.length} records.`);
    }
  })();
}
function migrateCategories(db2) {
  repairCategoriesSchema(db2);
  if (!tableIsEmpty(db2, "categories")) return;
  const data = getSettingsJson(db2, "gx_categories_v1") || getSettingsJson(db2, "retail_categories");
  if (!(data == null ? void 0 : data.length)) return;
  const uniqueCategories = /* @__PURE__ */ new Map();
  for (const rawCategory of data) {
    const name = firstText(rawCategory.name);
    const inventoryType = normalizeCategoryInventoryType(
      rawCategory.section,
      rawCategory.type,
      rawCategory.inventoryType
    );
    if (!name || !inventoryType) continue;
    const key = `${inventoryType}::${name.toLowerCase()}`;
    if (uniqueCategories.has(key)) continue;
    uniqueCategories.set(key, {
      id: firstText(rawCategory.id, crypto.randomUUID()),
      name,
      inventoryType
    });
  }
  if (uniqueCategories.size === 0) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO categories (id, name, inventoryType)
    VALUES (?, ?, ?)
  `);
  db2.transaction(() => {
    for (const category of uniqueCategories.values()) {
      stmt.run(category.id, category.name, category.inventoryType);
    }
  })();
  console.log(`[migration] Categories: ${uniqueCategories.size} records migrated.`);
}
function migrateAppUsers(db2) {
  if (!tableIsEmpty(db2, "users")) return;
  const data = getSettingsJson(db2, "gx_users") || getSettingsJson(db2, "retail_users");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO users (
      id, username, fullName, role, permissions, active,
      passwordHash, salt, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const records = (data == null ? void 0 : data.length) ? data : [{
    id: "owner-1",
    username: "admin",
    fullName: "صاحب النظام",
    role: "owner",
    permissions: DEFAULT_OWNER_PERMISSIONS,
    active: true,
    password: "admin123",
    salt: null,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now
  }];
  db2.transaction(() => {
    for (const user of records) {
      const role = firstText(user.role, "user");
      const permissions = parseJsonArray(user.permissions);
      const normalizedPermissions = permissions.length > 0 ? permissions : role === "owner" ? DEFAULT_OWNER_PERMISSIONS : [];
      stmt.run(
        firstText(user.id, crypto.randomUUID()),
        firstText(user.username, `user_${Date.now()}`),
        firstText(user.fullName, user.name, "User"),
        role,
        JSON.stringify(normalizedPermissions),
        toBoolean(user.active ?? true) ? 1 : 0,
        firstText(user.passwordHash, user.password),
        firstText(user.salt) || null,
        toBoolean(user.mustChangePassword) ? 1 : 0,
        firstText(user.createdAt, now),
        firstText(user.updatedAt, user.createdAt, now)
      );
    }
  })();
  console.log(`[migration] Users: ${records.length} records migrated.`);
}
function migrateBatches(db2) {
  if (!tableIsEmpty(db2, "product_batches")) return;
  const data = getSettingsJson(db2, "gx_product_batches_v1") || getSettingsJson(db2, "retail_product_batches");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO product_batches (
      id, productId, inventoryType, productName, costPrice, salePrice,
      quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const batch of data) {
      const productId = firstText(batch.productId);
      if (!productId) continue;
      const purchaseDate = firstText(batch.purchaseDate, batch.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      const createdAt = firstText(batch.createdAt, purchaseDate);
      stmt.run(
        firstText(batch.id, crypto.randomUUID()),
        productId,
        firstText(batch.inventoryType, "mobile"),
        firstText(batch.productName, "Unknown product"),
        firstNumber(batch.costPrice),
        firstNumber(batch.salePrice),
        Math.max(0, Math.round(firstNumber(batch.quantity))),
        Math.max(0, Math.round(firstNumber(batch.remainingQty, batch.quantity))),
        purchaseDate,
        firstText(batch.supplier) || null,
        firstText(batch.notes) || null,
        createdAt,
        firstText(batch.updatedAt, createdAt)
      );
    }
  })();
  console.log(`[migration] Product batches: ${data.length} records migrated.`);
}
function migrateWarehouseItems(db2) {
  if (!tableIsEmpty(db2, "warehouse_items")) return;
  const data = getSettingsJson(db2, "gx_warehouse") || getSettingsJson(db2, "retail_warehouse");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO warehouse_items (
      id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const item of data) {
      const createdAt = firstText(item.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      stmt.run(
        firstText(item.id, crypto.randomUUID()),
        firstText(item.warehouseId) || null,
        firstText(item.name, "Unknown item"),
        firstText(item.category, "general"),
        Math.max(0, Math.round(firstNumber(item.quantity))),
        firstNumber(item.costPrice),
        firstText(item.notes) || null,
        firstText(item.addedBy) || null,
        createdAt,
        firstText(item.updatedAt, createdAt)
      );
    }
  })();
  console.log(`[migration] Warehouse items: ${data.length} records migrated.`);
}
function migrateCars(db2) {
  if (!tableIsEmpty(db2, "cars_inventory")) return;
  const data = getSettingsJson(db2, "gx_cars") || getSettingsJson(db2, "retail_cars");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO cars_inventory (
      id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
      purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const car of data) {
      const createdAt = firstText(car.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      stmt.run(
        firstText(car.id, crypto.randomUUID()),
        firstText(car.name, "Unknown car"),
        firstText(car.model, "Unknown model"),
        Math.max(0, Math.round(firstNumber(car.year))),
        firstText(car.color) || null,
        firstText(car.plateNumber) || null,
        firstText(car.licenseExpiry) || null,
        firstText(car.condition, "used"),
        firstText(car.category) || null,
        firstNumber(car.purchasePrice),
        firstNumber(car.salePrice),
        firstText(car.notes) || null,
        firstText(car.image) || null,
        firstText(car.warehouseId) || null,
        toBoolean(car.isArchived) ? 1 : 0,
        firstText(car.deletedAt) || null,
        createdAt,
        firstText(car.updatedAt, createdAt)
      );
    }
  })();
  console.log(`[migration] Cars: ${data.length} records migrated.`);
}
function migrateSales(db2) {
  if (!tableIsEmpty(db2, "sales")) return;
  const data = getSettingsJson(db2, "elahmed_sales") || getSettingsJson(db2, "retail_sales");
  if (!(data == null ? void 0 : data.length)) return;
  const saleStmt = db2.prepare(`
    INSERT OR IGNORE INTO sales (
      id, invoiceNumber, date, subtotal, discount, total, totalCost, grossProfit, marginPct,
      paymentMethod, employee, voidedAt, voidReason, voidedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db2.prepare(`
    INSERT OR IGNORE INTO sale_items (
      id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const sale of data) {
      const saleId = firstText(sale.id, crypto.randomUUID());
      const items = parseJsonArray(sale.items);
      saleStmt.run(
        saleId,
        firstText(sale.invoiceNumber, `INV-LEGACY-${saleId.slice(0, 8)}`),
        firstText(sale.date, sale.createdAt, (/* @__PURE__ */ new Date()).toISOString()),
        firstNumber(sale.subtotal),
        firstNumber(sale.discount),
        firstNumber(sale.total),
        firstNumber(sale.totalCost),
        firstNumber(sale.grossProfit),
        firstNumber(sale.marginPct),
        firstText(sale.paymentMethod, "cash"),
        firstText(sale.employee, "system"),
        firstText(sale.voidedAt) || null,
        firstText(sale.voidReason) || null,
        firstText(sale.voidedBy) || null
      );
      for (const item of items) {
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          saleId,
          firstText(item.productId),
          firstText(item.name, "Unknown item"),
          Math.max(1, Math.round(firstNumber(item.qty, 1))),
          firstNumber(item.price),
          firstNumber(item.cost),
          firstNumber(item.lineDiscount),
          firstText(item.warehouseId) || null,
          item.batches ? JSON.stringify(item.batches) : null
        );
      }
    }
  })();
  console.log(`[migration] Sales: ${data.length} records migrated.`);
}
function migrateReturnRecords(db2) {
  if (!tableIsEmpty(db2, "return_records")) return;
  const data = getSettingsJson(db2, "gx_returns_v2") || getSettingsJson(db2, "retail_returns");
  if (!(data == null ? void 0 : data.length)) return;
  const saleIds = new Set(
    db2.prepare("SELECT id FROM sales").all().map((sale) => sale.id)
  );
  const recordStmt = db2.prepare(`
    INSERT OR IGNORE INTO return_records (
      id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db2.prepare(`
    INSERT OR IGNORE INTO return_items (
      id, returnId, productId, name, qty, price, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let fallbackSequence = 0;
  db2.transaction(() => {
    for (const record of data) {
      const recordId = firstText(record.id, crypto.randomUUID());
      const createdAt = firstText(record.createdAt, record.date, (/* @__PURE__ */ new Date()).toISOString());
      const originalSaleId = firstText(record.originalSaleId);
      const items = parseJsonArray(record.items);
      const existingSequence = extractPrefixedSequence$1(record.returnNumber, "RET");
      fallbackSequence = Math.max(fallbackSequence + 1, existingSequence);
      recordStmt.run(
        recordId,
        firstText(record.returnNumber, `RET-${String(fallbackSequence).padStart(4, "0")}`),
        firstText(record.originalInvoiceNumber, "Unknown invoice"),
        saleIds.has(originalSaleId) ? originalSaleId : null,
        firstText(record.date, createdAt.slice(0, 10)),
        firstNumber(record.totalRefund),
        firstText(record.reason) || null,
        firstText(record.processedBy) || null,
        createdAt
      );
      for (const item of items) {
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          recordId,
          firstText(item.productId),
          firstText(item.name, "Unknown item"),
          firstNumber(item.qty, 1) || 1,
          firstNumber(item.price),
          firstText(item.reason) || null
        );
      }
    }
  })();
  console.log(`[migration] Returns: ${data.length} records migrated.`);
}
function migratePurchaseInvoices(db2) {
  if (!tableIsEmpty(db2, "purchase_invoices")) return;
  const data = getSettingsJson(db2, "gx_purchase_invoices") || getSettingsJson(db2, "retail_purchase_invoices");
  if (!(data == null ? void 0 : data.length)) return;
  const supplierIds = new Set(
    db2.prepare("SELECT id FROM suppliers").all().map((supplier) => supplier.id)
  );
  const invoiceStmt = db2.prepare(`
    INSERT OR IGNORE INTO purchase_invoices (
      id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
      remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db2.prepare(`
    INSERT OR IGNORE INTO purchase_invoice_items (
      id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let fallbackSequence = 0;
  db2.transaction(() => {
    for (const invoice of data) {
      const invoiceId = firstText(invoice.id, crypto.randomUUID());
      const totalAmount = firstNumber(invoice.totalAmount);
      const paidAmount = Math.min(totalAmount, firstNumber(invoice.paidAmount));
      const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
      const createdAt = firstText(invoice.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      const updatedAt = firstText(invoice.updatedAt, createdAt);
      const supplierId = firstText(invoice.supplierId);
      const items = parseJsonArray(invoice.items);
      const existingSequence = extractPrefixedSequence$1(invoice.invoiceNumber, "PI");
      fallbackSequence = Math.max(fallbackSequence + 1, existingSequence);
      invoiceStmt.run(
        invoiceId,
        firstText(invoice.invoiceNumber, `PI-${String(fallbackSequence).padStart(4, "0")}`),
        supplierIds.has(supplierId) ? supplierId : null,
        firstText(invoice.supplierName, "Unknown supplier"),
        firstText(invoice.invoiceDate, createdAt.slice(0, 10)),
        totalAmount,
        paidAmount,
        remaining,
        firstText(invoice.paymentMethod, "cash"),
        firstText(invoice.status, derivePurchaseInvoiceStatus$1(totalAmount, paidAmount)),
        firstText(invoice.notes) || null,
        firstText(invoice.createdBy) || null,
        createdAt,
        updatedAt
      );
      for (const item of items) {
        const quantity = firstNumber(item.quantity, 1) || 1;
        const unitPrice = firstNumber(item.unitPrice);
        const totalPrice = firstNumber(item.totalPrice, quantity * unitPrice);
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          invoiceId,
          firstText(item.productName, "Unknown item"),
          firstText(item.category) || null,
          quantity,
          unitPrice,
          totalPrice,
          firstText(item.notes) || null
        );
      }
    }
  })();
  console.log(`[migration] Purchase invoices: ${data.length} records migrated.`);
}
function migrateShiftClosings(db2) {
  if (!tableIsEmpty(db2, "shift_closings")) return;
  const data = getSettingsJson(db2, "gx_shift_closings") || getSettingsJson(db2, "retail_shift_closings");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO shift_closings (
      id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
      salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const closing of data) {
      const closedAt = firstText(closing.closedAt, closing.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      stmt.run(
        firstText(closing.id, crypto.randomUUID()),
        firstText(closing.shiftDate, closedAt.slice(0, 10)),
        closedAt,
        firstText(closing.closedBy, "system"),
        Math.max(0, Math.round(firstNumber(closing.salesCount))),
        firstNumber(closing.salesCash),
        firstNumber(closing.salesCard),
        firstNumber(closing.salesTransfer),
        firstNumber(closing.salesTotal),
        firstNumber(closing.expectedCash),
        firstNumber(closing.actualCash),
        firstNumber(closing.cashDifference),
        firstText(closing.notes) || null,
        firstText(closing.createdAt, closedAt)
      );
    }
  })();
  console.log(`[migration] Shift closings: ${data.length} records migrated.`);
}
function migrateStockMovements(db2) {
  if (!tableIsEmpty(db2, "stock_movements")) return;
  const data = getSettingsJson(db2, "gx_stock_movements") || getSettingsJson(db2, "retail_stock_movements");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO stock_movements (
      id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
      referenceId, userId, timestamp, warehouseId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const movement of data) {
      stmt.run(
        firstText(movement.id, crypto.randomUUID()),
        firstText(movement.productId),
        firstText(movement.type, "correction"),
        firstNumber(movement.quantityChange),
        firstNumber(movement.previousQuantity),
        firstNumber(movement.newQuantity),
        firstText(movement.reason) || null,
        firstText(movement.referenceId) || null,
        firstText(movement.userId) || null,
        firstText(movement.timestamp, (/* @__PURE__ */ new Date()).toISOString()),
        firstText(movement.warehouseId) || null
      );
    }
  })();
  console.log(`[migration] Stock movements: ${data.length} records migrated.`);
}
function migrateAuditLogs(db2) {
  if (!tableIsEmpty(db2, "audit_logs")) return;
  const data = getSettingsJson(db2, "elahmed_audit_logs") || getSettingsJson(db2, "retail_audit_logs");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const entry of data) {
      stmt.run(
        firstText(entry.id, crypto.randomUUID()),
        firstText(entry.userId, "system"),
        firstText(entry.action, "settings_changed"),
        firstText(entry.entityType, "unknown"),
        firstText(entry.entityId, "unknown"),
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        firstText(entry.machineId) || null,
        firstText(entry.timestamp, (/* @__PURE__ */ new Date()).toISOString())
      );
    }
  })();
  console.log(`[migration] Audit logs: ${data.length} records migrated.`);
}
function migrateCustomers(db2) {
  if (!tableIsEmpty(db2, "customers")) return;
  const data = getSettingsJson(db2, "gx_customers") || getSettingsJson(db2, "retail_customers");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO customers (
      id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const c of data) {
      stmt.run(
        c.id,
        c.name,
        c.phone || null,
        c.email || null,
        c.address || null,
        c.nationalId || null,
        c.notes || null,
        c.totalPurchases || 0,
        c.balance || 0,
        c.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        c.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Customers: ${data.length} records migrated.`);
}
function migrateSuppliers(db2) {
  if (!tableIsEmpty(db2, "suppliers")) return;
  const data = getSettingsJson(db2, "gx_suppliers") || getSettingsJson(db2, "retail_suppliers");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO suppliers (
      id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const s of data) {
      stmt.run(
        s.id,
        s.name,
        s.phone || null,
        s.email || null,
        s.address || null,
        s.category || null,
        s.balance || 0,
        s.notes || null,
        s.active ?? 1,
        s.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        s.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Suppliers: ${data.length} records migrated.`);
}
function migrateEmployees(db2) {
  if (!tableIsEmpty(db2, "employees")) return;
  const data = getSettingsJson(db2, "gx_employees") || getSettingsJson(db2, "retail_employees");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO employees (
      id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const e of data) {
      stmt.run(
        e.id,
        e.name,
        e.phone || null,
        firstText(e.role, e.position) || null,
        firstNumber(e.salary, e.baseSalary),
        firstNumber(e.commissionRate),
        e.hireDate || null,
        toBoolean(e.active ?? e.isActive ?? true) ? 1 : 0,
        e.notes || null,
        e.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        e.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Employees: ${data.length} records migrated.`);
}
function migrateSupplierTransactions(db2) {
  if (!tableIsEmpty(db2, "supplier_transactions")) return;
  const data = getSettingsJson(db2, "gx_supplier_transactions") || getSettingsJson(db2, "retail_supplier_transactions");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO supplier_transactions (
      id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const item of data) {
      stmt.run(
        item.id,
        item.supplierId,
        item.supplierName || null,
        item.type,
        firstNumber(item.amount),
        firstNumber(item.balanceBefore),
        firstNumber(item.balanceAfter),
        item.notes || null,
        item.createdBy || null,
        item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Supplier transactions: ${data.length} records migrated.`);
}
function migrateSalaryRecords(db2) {
  if (!tableIsEmpty(db2, "employee_salaries")) return;
  const data = getSettingsJson(db2, "gx_salary_records") || getSettingsJson(db2, "retail_salary_records");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO employee_salaries (
      id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
      netSalary, paid, paidAt, walletId, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const item of data) {
      const createdAt = firstText(item.createdAt, item.paidAt, (/* @__PURE__ */ new Date()).toISOString());
      stmt.run(
        item.id,
        item.employeeId,
        item.employeeName || null,
        item.month,
        firstNumber(item.baseSalary),
        firstNumber(item.commission),
        firstNumber(item.bonus),
        firstNumber(item.deduction, item.deductions),
        firstNumber(item.advanceDeducted),
        firstNumber(item.netSalary),
        item.paid ?? 1,
        item.paidAt || createdAt,
        item.walletId || null,
        item.notes || null,
        createdAt
      );
    }
  })();
  console.log(`[migration] Employee salaries: ${data.length} records migrated.`);
}
function migrateAdvances(db2) {
  if (!tableIsEmpty(db2, "employee_advances")) return;
  const data = getSettingsJson(db2, "gx_advances") || getSettingsJson(db2, "retail_advances");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO employee_advances (
      id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const item of data) {
      stmt.run(
        item.id,
        item.employeeId,
        item.employeeName || null,
        firstNumber(item.amount),
        item.date,
        item.deductedMonth || null,
        item.notes || null,
        item.createdAt || item.date || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Employee advances: ${data.length} records migrated.`);
}
function migrateExpenses(db2) {
  if (!tableIsEmpty(db2, "expenses")) return;
  const data = getSettingsJson(db2, "gx_expenses") || getSettingsJson(db2, "retail_expenses");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO expenses (
      id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const e of data) {
      stmt.run(
        e.id,
        e.category,
        e.description || null,
        e.amount,
        e.date,
        e.paymentMethod || "cash",
        e.employee || null,
        e.notes || null,
        e.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        e.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Expenses: ${data.length} records migrated.`);
}
function migrateBlacklist(db2) {
  if (!tableIsEmpty(db2, "blacklist")) return;
  const data = getSettingsJson(db2, "gx_blacklist") || getSettingsJson(db2, "retail_blacklist");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO blacklist (
      id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
      nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const b of data) {
      const createdAt = firstText(b.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      const updatedAt = firstText(b.updatedAt, createdAt);
      const imei = firstText(b.imei, b.nationalId);
      const deviceName = firstText(b.deviceName, b.name, "Unknown device");
      const ownerPhone = firstText(b.ownerPhone, b.phone);
      const createdBy = firstText(b.createdBy, b.addedBy, "system");
      stmt.run(
        b.id,
        imei || null,
        deviceName,
        b.ownerName || null,
        ownerPhone || null,
        ownerPhone || null,
        firstText(b.status, "active"),
        firstText(b.reportedDate, createdAt.slice(0, 10)),
        imei || null,
        b.reason,
        b.notes || null,
        createdBy || null,
        createdBy || null,
        deviceName,
        createdAt,
        updatedAt
      );
    }
  })();
  console.log(`[migration] Blacklist: ${data.length} records migrated.`);
}
function migrateDamagedItems(db2) {
  if (!tableIsEmpty(db2, "damaged_items")) return;
  const data = getSettingsJson(db2, "gx_damaged") || getSettingsJson(db2, "retail_damaged");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO damaged_items (
      id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const d of data) {
      const quantity = firstNumber(d.quantity, 1) || 1;
      const estimatedLoss = firstNumber(d.estimatedLoss, d.totalLoss, d.value);
      const costPrice = firstNumber(d.costPrice, quantity > 0 ? estimatedLoss / quantity : 0);
      stmt.run(
        d.id,
        d.productName || d.name,
        d.productId || null,
        d.inventoryType || d.category || null,
        quantity,
        costPrice,
        d.reason || null,
        estimatedLoss,
        d.reportedBy || d.addedBy || null,
        d.date,
        d.notes || null,
        d.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Damaged items: ${data.length} records migrated.`);
}
function migrateOtherRevenue(db2) {
  if (!tableIsEmpty(db2, "other_revenue")) return;
  const data = getSettingsJson(db2, "gx_other_revenue") || getSettingsJson(db2, "retail_other_revenue");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const r of data) {
      const createdAt = firstText(r.createdAt, (/* @__PURE__ */ new Date()).toISOString());
      stmt.run(
        r.id,
        r.source || r.category,
        r.description || null,
        r.amount,
        r.date,
        r.paymentMethod || "cash",
        r.addedBy || null,
        r.notes || null,
        createdAt,
        r.updatedAt || createdAt
      );
    }
  })();
  console.log(`[migration] Other revenue: ${data.length} records migrated.`);
}
function migrateWallets(db2) {
  if (!tableIsEmpty(db2, "wallets")) return;
  const data = getSettingsJson(db2, "gx_wallets") || getSettingsJson(db2, "retail_wallets");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const w of data) {
      const type = firstText(w.type, "cash");
      stmt.run(
        w.id,
        w.name,
        type,
        firstNumber(w.balance),
        toBoolean(w.isDefault) ? 1 : 0,
        firstText(
          w.icon,
          type === "bank" ? "🏦" : type === "card" ? "💳" : type === "transfer" ? "📲" : "💵"
        ) || null,
        w.color || null,
        w.notes || null,
        w.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        w.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Wallets: ${data.length} records migrated.`);
}
function migrateUsedDevices(db2) {
  if (!tableIsEmpty(db2, "used_devices")) return;
  const data = getSettingsJson(db2, "gx_used_devices") || getSettingsJson(db2, "gx_used_inventory") || getSettingsJson(db2, "retail_used_inventory");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO used_devices (
      id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
      ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const u of data) {
      stmt.run(
        u.id,
        u.name,
        firstText(u.model) || null,
        firstText(u.deviceType, u.category, "other") || null,
        firstText(u.category, u.deviceType) || null,
        firstText(u.condition, "good"),
        firstNumber(u.purchasePrice, u.buyPrice),
        firstNumber(u.sellingPrice, u.salePrice),
        firstText(u.status, "in_stock"),
        u.serialNumber || null,
        u.color || null,
        u.storage || null,
        firstText(u.ram) || null,
        firstText(u.description, u.notes) || null,
        firstText(u.notes, u.description) || null,
        u.image || null,
        u.soldAt || null,
        u.purchasedFrom || null,
        u.soldTo || null,
        u.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        u.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Used devices: ${data.length} records migrated.`);
}
function migrateReminders(db2) {
  if (!tableIsEmpty(db2, "reminders")) return;
  const data = getSettingsJson(db2, "gx_reminders") || getSettingsJson(db2, "retail_reminders");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO reminders (
      id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const r of data) {
      const status = firstText(r.status, r.completed ? "done" : "pending");
      stmt.run(
        r.id,
        r.title,
        r.description || null,
        r.dueDate || r.reminderDate,
        r.reminderTime || null,
        r.priority || "medium",
        status,
        status === "done" || !!r.completed ? 1 : 0,
        r.completedAt || null,
        r.recurring || null,
        r.category || null,
        r.notes || null,
        r.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        r.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Reminders: ${data.length} records migrated.`);
}
function migrateRepairs(db2) {
  if (!tableIsEmpty(db2, "repair_tickets")) return;
  const data = getSettingsJson(db2, "gx_maintenance") || getSettingsJson(db2, "maintenance_orders");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO repair_tickets (
      id, ticket_no, customer_name, customer_phone, device_category, device_model,
      issue_description, status, package_price, final_cost, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const r of data) {
      const status = ["received", "diagnosing", "repairing", "waiting_parts", "testing", "ready", "delivered", "cancelled", "pending", "in_progress", "waiting_for_parts", "completed"].includes(r.status) ? r.status : r.status === "done" ? "delivered" : r.status === "in_progress" ? "repairing" : "received";
      stmt.run(
        r.id,
        r.orderNumber || r.ticket_no || `TKT-${Math.random().toString(36).slice(2, 7)}`,
        r.customerName || r.customer_name,
        r.customerPhone || r.customer_phone || null,
        r.deviceCategory || r.device_category || "other",
        r.deviceName || r.device_model || "Unknown",
        r.issueDescription || r.issue_description || r.problem_desc || "",
        status,
        r.totalSale || r.package_price || 0,
        r.final_cost || r.totalSale || r.package_price || 0,
        r.createdAt || r.created_at || (/* @__PURE__ */ new Date()).toISOString(),
        r.updatedAt || r.updated_at || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Repair Tickets: ${data.length} records migrated.`);
}
function migrateRepairParts(db2) {
  if (!tableIsEmpty(db2, "repair_parts")) return;
  const data = getSettingsJson(db2, "gx_repair_parts") || getSettingsJson(db2, "repair_parts_inventory");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
    INSERT OR IGNORE INTO repair_parts (
      id, name, category, sku, unit_cost, selling_price, qty, min_qty, active, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db2.transaction(() => {
    for (const p of data) {
      stmt.run(
        p.id,
        p.name,
        p.category || null,
        p.sku || p.part_no || null,
        p.unit_cost || p.cost_price || 0,
        p.selling_price || 0,
        p.qty || p.current_stock || 0,
        p.min_qty || p.min_stock || 0,
        p.active ?? 1,
        p.createdAt || p.created_at || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Repair Parts: ${data.length} records migrated.`);
}
function buildUpdateSql(data, excludeKeys = ["id", "createdAt"]) {
  const sets = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    if (!excludeKeys.includes(key)) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  return { sets, values };
}
function readSettingsArray(db2, key) {
  const row = db2.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function readSettingJson(db2, key, fallback) {
  const row = db2.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
}
function ensureWalletRecord(db2, walletId) {
  if (!walletId) return;
  const existing = db2.prepare("SELECT id FROM wallets WHERE id = ?").get(walletId);
  if (existing) return;
  const walletMetadata = [...readSettingsArray(db2, "gx_wallets"), ...readSettingsArray(db2, "retail_wallets")].find((wallet) => String(wallet.id ?? "") === walletId);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const walletType = String((walletMetadata == null ? void 0 : walletMetadata.type) ?? "cash");
  const walletIcon = String(
    (walletMetadata == null ? void 0 : walletMetadata.icon) ?? (walletType === "bank" ? "🏦" : walletType === "card" ? "💳" : walletType === "transfer" ? "📲" : "💵")
  );
  db2.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    walletId,
    String((walletMetadata == null ? void 0 : walletMetadata.name) ?? (walletId === "wallet_cash" ? "الصندوق" : `Wallet ${walletId.slice(0, 8)}`)),
    walletType,
    (walletMetadata == null ? void 0 : walletMetadata.isDefault) ? 1 : 0,
    walletIcon,
    (walletMetadata == null ? void 0 : walletMetadata.color) ? String(walletMetadata.color) : null,
    String((walletMetadata == null ? void 0 : walletMetadata.notes) ?? "Auto-created to repair wallet references"),
    (walletMetadata == null ? void 0 : walletMetadata.createdAt) ? String(walletMetadata.createdAt) : now,
    (walletMetadata == null ? void 0 : walletMetadata.updatedAt) ? String(walletMetadata.updatedAt) : now
  );
}
function parseJsonValue(value, fallback) {
  if (value === null || value === void 0 || value === "") return fallback;
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
function extractPrefixedSequence(value, prefix) {
  if (typeof value !== "string") return 0;
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
function derivePurchaseInvoiceStatus(totalAmount, paidAmount) {
  if (paidAmount <= 0) return "confirmed";
  if (paidAmount >= totalAmount) return "paid";
  return "partial";
}
function readProducts(db2, source) {
  const rows = source ? db2.prepare("SELECT * FROM products WHERE source = ? ORDER BY createdAt DESC, id DESC").all(source) : db2.prepare("SELECT * FROM products ORDER BY createdAt DESC, id DESC").all();
  return rows;
}
function readAccessories(db2, inventoryType) {
  const rows = inventoryType ? db2.prepare("SELECT * FROM accessories WHERE inventoryType = ? ORDER BY createdAt DESC, id DESC").all(inventoryType) : db2.prepare("SELECT * FROM accessories ORDER BY createdAt DESC, id DESC").all();
  return rows;
}
function readSales(db2, activeOnly = false) {
  const sales = db2.prepare(`
    SELECT * FROM sales
    ${activeOnly ? "WHERE voidedAt IS NULL" : ""}
    ORDER BY date DESC, invoiceNumber DESC
  `).all();
  const items = db2.prepare("SELECT * FROM sale_items ORDER BY saleId ASC, id ASC").all();
  const itemsBySaleId = /* @__PURE__ */ new Map();
  for (const item of items) {
    const saleId = String(item.saleId ?? "");
    if (!saleId) continue;
    const bucket = itemsBySaleId.get(saleId) || [];
    bucket.push({
      productId: String(item.productId ?? ""),
      name: String(item.name ?? ""),
      qty: Number(item.qty ?? 0),
      price: Number(item.price ?? 0),
      cost: Number(item.cost ?? 0),
      lineDiscount: Number(item.lineDiscount ?? 0),
      warehouseId: item.warehouseId ? String(item.warehouseId) : void 0,
      batches: parseJsonValue(item.batches, [])
    });
    itemsBySaleId.set(saleId, bucket);
  }
  return sales.map((sale) => ({
    id: String(sale.id ?? ""),
    invoiceNumber: String(sale.invoiceNumber ?? ""),
    date: String(sale.date ?? ""),
    items: itemsBySaleId.get(String(sale.id ?? "")) || [],
    subtotal: Number(sale.subtotal ?? 0),
    discount: Number(sale.discount ?? 0),
    total: Number(sale.total ?? 0),
    totalCost: Number(sale.totalCost ?? 0),
    grossProfit: Number(sale.grossProfit ?? 0),
    marginPct: Number(sale.marginPct ?? 0),
    paymentMethod: String(sale.paymentMethod ?? "cash"),
    employee: String(sale.employee ?? "system"),
    voidedAt: sale.voidedAt ? String(sale.voidedAt) : null,
    voidReason: sale.voidReason ? String(sale.voidReason) : null,
    voidedBy: sale.voidedBy ? String(sale.voidedBy) : null
  }));
}
function readPurchaseInvoices(db2) {
  const invoices = db2.prepare("SELECT * FROM purchase_invoices ORDER BY invoiceDate DESC, createdAt DESC").all();
  const items = db2.prepare("SELECT * FROM purchase_invoice_items ORDER BY invoiceId ASC, id ASC").all();
  const itemsByInvoiceId = /* @__PURE__ */ new Map();
  for (const item of items) {
    const invoiceId = String(item.invoiceId ?? "");
    if (!invoiceId) continue;
    const bucket = itemsByInvoiceId.get(invoiceId) || [];
    bucket.push({
      id: String(item.id ?? ""),
      productName: String(item.productName ?? ""),
      category: item.category ? String(item.category) : "",
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      totalPrice: Number(item.totalPrice ?? 0),
      notes: item.notes ? String(item.notes) : ""
    });
    itemsByInvoiceId.set(invoiceId, bucket);
  }
  return invoices.map((invoice) => ({
    id: String(invoice.id ?? ""),
    invoiceNumber: String(invoice.invoiceNumber ?? ""),
    supplierId: invoice.supplierId ? String(invoice.supplierId) : void 0,
    supplierName: String(invoice.supplierName ?? ""),
    invoiceDate: String(invoice.invoiceDate ?? ""),
    totalAmount: Number(invoice.totalAmount ?? 0),
    paidAmount: Number(invoice.paidAmount ?? 0),
    remaining: Number(invoice.remaining ?? 0),
    paymentMethod: String(invoice.paymentMethod ?? "cash"),
    items: itemsByInvoiceId.get(String(invoice.id ?? "")) || [],
    status: String(invoice.status ?? "confirmed"),
    notes: invoice.notes ? String(invoice.notes) : "",
    createdBy: String(invoice.createdBy ?? "system"),
    createdAt: String(invoice.createdAt ?? ""),
    updatedAt: String(invoice.updatedAt ?? "")
  }));
}
function readReturnRecords(db2) {
  const records = db2.prepare("SELECT * FROM return_records ORDER BY date DESC, createdAt DESC").all();
  const items = db2.prepare("SELECT * FROM return_items ORDER BY returnId ASC, id ASC").all();
  const itemsByReturnId = /* @__PURE__ */ new Map();
  for (const item of items) {
    const returnId = String(item.returnId ?? "");
    if (!returnId) continue;
    const bucket = itemsByReturnId.get(returnId) || [];
    bucket.push({
      productId: String(item.productId ?? ""),
      name: String(item.name ?? ""),
      qty: Number(item.qty ?? 0),
      price: Number(item.price ?? 0),
      reason: item.reason ? String(item.reason) : ""
    });
    itemsByReturnId.set(returnId, bucket);
  }
  return records.map((record) => ({
    id: String(record.id ?? ""),
    returnNumber: String(record.returnNumber ?? ""),
    originalInvoiceNumber: String(record.originalInvoiceNumber ?? ""),
    originalSaleId: record.originalSaleId ? String(record.originalSaleId) : "",
    date: String(record.date ?? ""),
    items: itemsByReturnId.get(String(record.id ?? "")) || [],
    totalRefund: Number(record.totalRefund ?? 0),
    reason: record.reason ? String(record.reason) : "",
    processedBy: record.processedBy ? String(record.processedBy) : "",
    createdAt: String(record.createdAt ?? "")
  }));
}
function readShiftClosings(db2) {
  return db2.prepare("SELECT * FROM shift_closings ORDER BY closedAt DESC, createdAt DESC").all();
}
function buildShiftSummary(db2, closedBy, actualCash, notes) {
  const startOfToday = /* @__PURE__ */ new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const lastClose = db2.prepare("SELECT closedAt FROM shift_closings ORDER BY closedAt DESC LIMIT 1").get();
  const fromTimestamp = (lastClose == null ? void 0 : lastClose.closedAt) ? String(lastClose.closedAt) : startOfToday.toISOString();
  const summary = db2.prepare(`
    SELECT
      COUNT(*) as salesCount,
      SUM(CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END) as salesCash,
      SUM(CASE WHEN paymentMethod = 'card' THEN total ELSE 0 END) as salesCard,
      SUM(CASE WHEN paymentMethod NOT IN ('cash', 'card') THEN total ELSE 0 END) as salesTransfer,
      SUM(total) as salesTotal
    FROM sales
    WHERE voidedAt IS NULL AND date >= ?
  `).get(fromTimestamp);
  const now = /* @__PURE__ */ new Date();
  const salesCash = Number(summary.salesCash ?? 0);
  const salesCard = Number(summary.salesCard ?? 0);
  const salesTransfer = Number(summary.salesTransfer ?? 0);
  const salesTotal = Number(summary.salesTotal ?? salesCash + salesCard + salesTransfer);
  return {
    shiftDate: now.toISOString().slice(0, 10),
    closedAt: now.toISOString(),
    closedBy,
    salesCount: Number(summary.salesCount ?? 0),
    salesCash,
    salesCard,
    salesTransfer,
    salesTotal,
    expectedCash: salesCash,
    actualCash,
    cashDifference: actualCash - salesCash,
    notes
  };
}
function replySync(event, label, fallback, action) {
  try {
    event.returnValue = action();
  } catch (error) {
    console.error(`${label} error:`, error);
    event.returnValue = fallback;
  }
}
function setupIpcHandlers(db2) {
  electron.ipcMain.on("db:installments:get", (event) => {
    try {
      event.returnValue = readInstallmentContracts(db2);
    } catch (error) {
      console.error("db:installments:get error:", error);
      event.returnValue = [];
    }
  });
  electron.ipcMain.on("db:installments:replaceAll", (event, contracts) => {
    try {
      const rows = Array.isArray(contracts) ? contracts : [];
      event.returnValue = replaceInstallmentContracts(db2, rows);
    } catch (error) {
      console.error("db:installments:replaceAll error:", error);
      event.returnValue = [];
    }
  });
  electron.ipcMain.on("db-sync:settings:get-json", (event, key) => {
    replySync(event, "db-sync:settings:get-json", null, () => readSettingJson(db2, key, null));
  });
  electron.ipcMain.on("db-sync:settings:set-json", (event, key, value) => {
    replySync(event, "db-sync:settings:set-json", null, () => {
      const serialized = JSON.stringify(value ?? null);
      db2.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, serialized);
      return value ?? null;
    });
  });
  electron.ipcMain.on("db-sync:categories:get", (event) => {
    replySync(event, "db-sync:categories:get", [], () => db2.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all());
  });
  electron.ipcMain.on("db-sync:categories:replaceAll", (event, categories = []) => {
    replySync(event, "db-sync:categories:replaceAll", [], () => {
      const replaceAll = db2.transaction(() => {
        db2.prepare("DELETE FROM categories").run();
        const stmt = db2.prepare(`
          INSERT INTO categories (id, name, inventoryType)
          VALUES (?, ?, ?)
        `);
        for (const category of Array.isArray(categories) ? categories : []) {
          stmt.run(
            category.id ?? crypto.randomUUID(),
            category.name ?? "",
            category.inventoryType ?? "mobile_device"
          );
        }
        return db2.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all();
      });
      return replaceAll();
    });
  });
  electron.ipcMain.on("db-sync:users:get", (event) => {
    replySync(event, "db-sync:users:get", [], () => db2.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all());
  });
  electron.ipcMain.on("db-sync:users:replaceAll", (event, users = []) => {
    replySync(event, "db-sync:users:replaceAll", [], () => {
      const replaceAll = db2.transaction(() => {
        db2.prepare("DELETE FROM users").run();
        const stmt = db2.prepare(`
          INSERT INTO users (
            id, username, fullName, role, permissions, active,
            passwordHash, salt, mustChangePassword, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        for (const user of Array.isArray(users) ? users : []) {
          stmt.run(
            user.id ?? crypto.randomUUID(),
            user.username ?? "",
            user.fullName ?? "",
            user.role ?? "user",
            user.permissions ?? "[]",
            user.active ? 1 : 0,
            user.passwordHash ?? null,
            user.salt ?? null,
            user.mustChangePassword ? 1 : 0,
            user.createdAt ?? now,
            user.updatedAt ?? user.createdAt ?? now
          );
        }
        return db2.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all();
      });
      return replaceAll();
    });
  });
  electron.ipcMain.on("db-sync:product_batches:get", (event) => {
    replySync(event, "db-sync:product_batches:get", [], () => db2.prepare("SELECT * FROM product_batches ORDER BY purchaseDate ASC, createdAt ASC, id ASC").all());
  });
  electron.ipcMain.on("db-sync:product_batches:add", (event, batch) => {
    replySync(event, "db-sync:product_batches:add", null, () => {
      const id = batch.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO product_batches (
          id, productId, inventoryType, productName, costPrice, salePrice,
          quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        batch.productId,
        batch.inventoryType ?? "mobile",
        batch.productName ?? "Unknown product",
        batch.costPrice ?? 0,
        batch.salePrice ?? 0,
        batch.quantity ?? 0,
        batch.remainingQty ?? batch.quantity ?? 0,
        batch.purchaseDate ?? now,
        batch.supplier ?? null,
        batch.notes ?? null,
        batch.createdAt ?? now,
        batch.updatedAt ?? now
      );
      return db2.prepare("SELECT * FROM product_batches WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:product_batches:update", (event, id, data) => {
    replySync(event, "db-sync:product_batches:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM product_batches WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE product_batches SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM product_batches WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:product_batches:delete", (event, id) => {
    replySync(event, "db-sync:product_batches:delete", false, () => db2.prepare("DELETE FROM product_batches WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:products:get", (event, source = null) => {
    replySync(event, "db-sync:products:get", [], () => readProducts(db2, source));
  });
  electron.ipcMain.on("db-sync:products:add", (event, product) => {
    replySync(event, "db-sync:products:add", null, () => {
      const id = product.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO products (
          id, name, model, barcode, deviceType, category, condition, storage, ram, color,
          brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
          salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
          imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        product.name ?? "",
        product.model ?? null,
        product.barcode ?? null,
        product.deviceType ?? null,
        product.category ?? null,
        product.condition ?? null,
        product.storage ?? null,
        product.ram ?? null,
        product.color ?? null,
        product.brand ?? null,
        product.description ?? null,
        product.boxNumber ?? null,
        product.taxExcluded ? 1 : 0,
        product.quantity ?? 0,
        product.oldCostPrice ?? 0,
        product.newCostPrice ?? 0,
        product.salePrice ?? 0,
        product.profitMargin ?? 0,
        product.minStock ?? 0,
        product.supplier ?? null,
        product.source ?? null,
        product.warehouseId ?? null,
        product.serialNumber ?? null,
        product.imei2 ?? null,
        product.processor ?? null,
        product.isArchived ? 1 : 0,
        product.notes ?? null,
        product.image ?? null,
        product.createdAt ?? now,
        product.updatedAt ?? now,
        product.deletedAt ?? null
      );
      return db2.prepare("SELECT * FROM products WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:products:update", (event, id, data) => {
    replySync(event, "db-sync:products:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM products WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM products WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:products:delete", (event, id) => {
    replySync(event, "db-sync:products:delete", false, () => db2.prepare("DELETE FROM products WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:accessories:get", (event, inventoryType = null) => {
    replySync(event, "db-sync:accessories:get", [], () => readAccessories(db2, inventoryType));
  });
  electron.ipcMain.on("db-sync:accessories:add", (event, accessory) => {
    replySync(event, "db-sync:accessories:add", null, () => {
      const id = accessory.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO accessories (
          id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
          oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
          brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
          deletedAt, notes, image, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        accessory.warehouseId ?? null,
        accessory.inventoryType ?? null,
        accessory.name ?? "",
        accessory.category ?? null,
        accessory.subcategory ?? null,
        accessory.model ?? null,
        accessory.barcode ?? null,
        accessory.quantity ?? 0,
        accessory.oldCostPrice ?? 0,
        accessory.newCostPrice ?? accessory.costPrice ?? 0,
        accessory.costPrice ?? accessory.newCostPrice ?? 0,
        accessory.salePrice ?? 0,
        accessory.profitMargin ?? 0,
        accessory.minStock ?? 0,
        accessory.condition ?? "new",
        accessory.brand ?? null,
        accessory.supplier ?? null,
        accessory.source ?? null,
        accessory.boxNumber ?? null,
        accessory.taxExcluded ? 1 : 0,
        accessory.color ?? null,
        accessory.description ?? null,
        accessory.isArchived ? 1 : 0,
        accessory.deletedAt ?? null,
        accessory.notes ?? null,
        accessory.image ?? null,
        accessory.createdAt ?? now,
        accessory.updatedAt ?? now
      );
      return db2.prepare("SELECT * FROM accessories WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:accessories:update", (event, id, data) => {
    replySync(event, "db-sync:accessories:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM accessories WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE accessories SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM accessories WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:accessories:delete", (event, id) => {
    replySync(event, "db-sync:accessories:delete", false, () => db2.prepare("DELETE FROM accessories WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:warehouse_items:get", (event) => {
    replySync(event, "db-sync:warehouse_items:get", [], () => db2.prepare("SELECT * FROM warehouse_items ORDER BY createdAt DESC, id DESC").all());
  });
  electron.ipcMain.on("db-sync:warehouse_items:add", (event, item) => {
    replySync(event, "db-sync:warehouse_items:add", null, () => {
      const id = item.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO warehouse_items (
          id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        item.warehouseId ?? null,
        item.name ?? "",
        item.category ?? "general",
        item.quantity ?? 0,
        item.costPrice ?? 0,
        item.notes ?? null,
        item.addedBy ?? null,
        item.createdAt ?? now,
        item.updatedAt ?? now
      );
      return db2.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:warehouse_items:update", (event, id, data) => {
    replySync(event, "db-sync:warehouse_items:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE warehouse_items SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:warehouse_items:delete", (event, id) => {
    replySync(event, "db-sync:warehouse_items:delete", false, () => db2.prepare("DELETE FROM warehouse_items WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:cars:get", (event) => {
    replySync(event, "db-sync:cars:get", [], () => db2.prepare("SELECT * FROM cars_inventory ORDER BY createdAt DESC, id DESC").all());
  });
  electron.ipcMain.on("db-sync:cars:add", (event, car) => {
    replySync(event, "db-sync:cars:add", null, () => {
      const id = car.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO cars_inventory (
          id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
          purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        car.name ?? "",
        car.model ?? "",
        car.year ?? 0,
        car.color ?? null,
        car.plateNumber ?? null,
        car.licenseExpiry ?? null,
        car.condition ?? "used",
        car.category ?? null,
        car.purchasePrice ?? 0,
        car.salePrice ?? 0,
        car.notes ?? null,
        car.image ?? null,
        car.warehouseId ?? null,
        car.isArchived ? 1 : 0,
        car.deletedAt ?? null,
        car.createdAt ?? now,
        car.updatedAt ?? now
      );
      return db2.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:cars:update", (event, id, data) => {
    replySync(event, "db-sync:cars:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE cars_inventory SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:cars:delete", (event, id) => {
    replySync(event, "db-sync:cars:delete", false, () => db2.prepare("DELETE FROM cars_inventory WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:customers:get", (event) => {
    replySync(event, "db-sync:customers:get", [], () => db2.prepare("SELECT * FROM customers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  electron.ipcMain.on("db-sync:customers:add", (event, customer) => {
    replySync(event, "db-sync:customers:add", null, () => {
      const id = customer.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        customer.name,
        customer.phone ?? null,
        customer.email ?? null,
        customer.address ?? null,
        customer.nationalId ?? null,
        customer.notes ?? null,
        customer.totalPurchases ?? 0,
        customer.balance ?? 0,
        customer.createdAt || now,
        customer.updatedAt || now
      );
      return db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:customers:update", (event, id, data) => {
    replySync(event, "db-sync:customers:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:customers:delete", (event, id) => {
    replySync(event, "db-sync:customers:delete", false, () => db2.prepare("DELETE FROM customers WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:expenses:get", (event) => {
    replySync(event, "db-sync:expenses:get", [], () => db2.prepare("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC").all());
  });
  electron.ipcMain.on("db-sync:expenses:add", (event, expense) => {
    replySync(event, "db-sync:expenses:add", null, () => {
      const id = expense.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        expense.category,
        expense.description ?? null,
        expense.amount ?? 0,
        expense.date,
        expense.paymentMethod ?? "cash",
        expense.employee ?? null,
        expense.notes ?? null,
        expense.createdAt || now,
        expense.updatedAt || now
      );
      return db2.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:expenses:update", (event, id, data) => {
    replySync(event, "db-sync:expenses:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:expenses:delete", (event, id) => {
    replySync(event, "db-sync:expenses:delete", false, () => db2.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:blacklist:get", (event) => {
    replySync(event, "db-sync:blacklist:get", [], () => db2.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC, updatedAt DESC").all());
  });
  electron.ipcMain.on("db-sync:blacklist:add", (event, entry) => {
    replySync(event, "db-sync:blacklist:add", null, () => {
      const id = entry.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO blacklist (
          id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
          nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.imei ?? null,
        entry.deviceName,
        entry.ownerName ?? null,
        entry.ownerPhone ?? null,
        entry.ownerPhone ?? null,
        entry.status ?? "active",
        entry.reportedDate ?? now.slice(0, 10),
        entry.imei ?? null,
        entry.reason,
        entry.notes ?? null,
        entry.createdBy ?? null,
        entry.createdBy ?? null,
        entry.deviceName,
        entry.createdAt || now,
        entry.updatedAt || now
      );
      return db2.prepare("SELECT * FROM blacklist WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:blacklist:update", (event, id, data) => {
    replySync(event, "db-sync:blacklist:update", null, () => {
      const updates = { ...data };
      if (Object.prototype.hasOwnProperty.call(updates, "ownerPhone") && !Object.prototype.hasOwnProperty.call(updates, "phone")) {
        updates.phone = updates.ownerPhone;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "imei") && !Object.prototype.hasOwnProperty.call(updates, "nationalId")) {
        updates.nationalId = updates.imei;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "deviceName") && !Object.prototype.hasOwnProperty.call(updates, "name")) {
        updates.name = updates.deviceName;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "createdBy") && !Object.prototype.hasOwnProperty.call(updates, "addedBy")) {
        updates.addedBy = updates.createdBy;
      }
      const { sets, values } = buildUpdateSql(updates);
      if (!sets.length) return db2.prepare("SELECT * FROM blacklist WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE blacklist SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM blacklist WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:blacklist:delete", (event, id) => {
    replySync(event, "db-sync:blacklist:delete", false, () => db2.prepare("DELETE FROM blacklist WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:damaged_items:get", (event) => {
    replySync(event, "db-sync:damaged_items:get", [], () => db2.prepare("SELECT * FROM damaged_items ORDER BY date DESC, createdAt DESC").all());
  });
  electron.ipcMain.on("db-sync:damaged_items:add", (event, item) => {
    replySync(event, "db-sync:damaged_items:add", null, () => {
      const id = item.id || crypto.randomUUID();
      db2.prepare(`
        INSERT INTO damaged_items (
          id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        item.productName ?? item.name,
        item.productId ?? null,
        item.inventoryType ?? null,
        item.quantity ?? 1,
        item.costPrice ?? 0,
        item.reason ?? null,
        item.estimatedLoss ?? 0,
        item.reportedBy ?? null,
        item.date,
        item.notes ?? null,
        item.createdAt || (/* @__PURE__ */ new Date()).toISOString()
      );
      return db2.prepare("SELECT * FROM damaged_items WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:damaged_items:update", (event, id, data) => {
    replySync(event, "db-sync:damaged_items:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM damaged_items WHERE id = ?").get(id);
      values.push(id);
      db2.prepare(`UPDATE damaged_items SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM damaged_items WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:damaged_items:delete", (event, id) => {
    replySync(event, "db-sync:damaged_items:delete", false, () => db2.prepare("DELETE FROM damaged_items WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:other_revenue:get", (event) => {
    replySync(event, "db-sync:other_revenue:get", [], () => db2.prepare("SELECT * FROM other_revenue ORDER BY date DESC, createdAt DESC").all());
  });
  electron.ipcMain.on("db-sync:other_revenue:add", (event, revenue) => {
    replySync(event, "db-sync:other_revenue:add", null, () => {
      const id = revenue.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        revenue.source,
        revenue.description ?? null,
        revenue.amount ?? 0,
        revenue.date,
        revenue.paymentMethod ?? "cash",
        revenue.addedBy ?? null,
        revenue.notes ?? null,
        revenue.createdAt || now,
        revenue.updatedAt || now
      );
      return db2.prepare("SELECT * FROM other_revenue WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:other_revenue:update", (event, id, data) => {
    replySync(event, "db-sync:other_revenue:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM other_revenue WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE other_revenue SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM other_revenue WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:other_revenue:delete", (event, id) => {
    replySync(event, "db-sync:other_revenue:delete", false, () => db2.prepare("DELETE FROM other_revenue WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:reminders:get", (event) => {
    replySync(event, "db-sync:reminders:get", [], () => db2.prepare("SELECT * FROM reminders ORDER BY dueDate ASC, reminderTime ASC").all());
  });
  electron.ipcMain.on("db-sync:reminders:add", (event, reminder) => {
    replySync(event, "db-sync:reminders:add", null, () => {
      const id = reminder.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO reminders (
          id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        reminder.title,
        reminder.description ?? null,
        reminder.dueDate,
        reminder.reminderTime ?? null,
        reminder.priority ?? "medium",
        reminder.status ?? "pending",
        reminder.completed ?? 0,
        reminder.completedAt ?? null,
        reminder.recurring ?? null,
        reminder.category ?? null,
        reminder.notes ?? null,
        reminder.createdAt || now,
        reminder.updatedAt || now
      );
      return db2.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:reminders:update", (event, id, data) => {
    replySync(event, "db-sync:reminders:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE reminders SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:reminders:delete", (event, id) => {
    replySync(event, "db-sync:reminders:delete", false, () => db2.prepare("DELETE FROM reminders WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:suppliers:get", (event) => {
    replySync(event, "db-sync:suppliers:get", [], () => db2.prepare("SELECT * FROM suppliers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  electron.ipcMain.on("db-sync:suppliers:add", (event, supplier) => {
    replySync(event, "db-sync:suppliers:add", null, () => {
      const id = supplier.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        supplier.name,
        supplier.phone ?? null,
        supplier.email ?? null,
        supplier.address ?? null,
        supplier.category ?? null,
        supplier.balance ?? 0,
        supplier.notes ?? null,
        supplier.active ?? 1,
        supplier.createdAt || now,
        supplier.updatedAt || now
      );
      return db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:suppliers:update", (event, id, data) => {
    replySync(event, "db-sync:suppliers:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE suppliers SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:suppliers:delete", (event, id) => {
    replySync(event, "db-sync:suppliers:delete", false, () => db2.prepare("DELETE FROM suppliers WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:supplier_transactions:get", (event, supplierId) => {
    replySync(event, "db-sync:supplier_transactions:get", [], () => {
      if (supplierId) {
        return db2.prepare("SELECT * FROM supplier_transactions WHERE supplierId = ? ORDER BY createdAt DESC").all(supplierId);
      }
      return db2.prepare("SELECT * FROM supplier_transactions ORDER BY createdAt DESC").all();
    });
  });
  electron.ipcMain.on("db-sync:supplier_transactions:add", (event, transaction) => {
    replySync(event, "db-sync:supplier_transactions:add", null, () => {
      const persistTransaction = db2.transaction(() => {
        const supplier = db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(transaction.supplierId);
        if (!supplier) throw new Error("Supplier not found");
        const id = transaction.id || crypto.randomUUID();
        const now = transaction.createdAt || (/* @__PURE__ */ new Date()).toISOString();
        const amount = Number(transaction.amount ?? 0);
        const balanceBefore = Number(supplier.balance ?? 0);
        const delta = transaction.type === "purchase" ? amount : -amount;
        const balanceAfter = balanceBefore + delta;
        db2.prepare(`
          INSERT INTO supplier_transactions (
            id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          transaction.supplierId,
          transaction.supplierName ?? supplier.name ?? null,
          transaction.type,
          amount,
          balanceBefore,
          balanceAfter,
          transaction.notes ?? null,
          transaction.createdBy ?? null,
          now
        );
        db2.prepare("UPDATE suppliers SET balance = ?, updatedAt = ? WHERE id = ?").run(balanceAfter, (/* @__PURE__ */ new Date()).toISOString(), transaction.supplierId);
        return db2.prepare("SELECT * FROM supplier_transactions WHERE id = ?").get(id);
      });
      return persistTransaction();
    });
  });
  electron.ipcMain.on("db-sync:employees:get", (event) => {
    replySync(event, "db-sync:employees:get", [], () => db2.prepare("SELECT * FROM employees WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  electron.ipcMain.on("db-sync:employees:add", (event, employee) => {
    replySync(event, "db-sync:employees:add", null, () => {
      const id = employee.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        employee.name,
        employee.phone ?? null,
        employee.role ?? null,
        employee.salary ?? 0,
        employee.commissionRate ?? 0,
        employee.hireDate ?? null,
        employee.active ?? 1,
        employee.notes ?? null,
        employee.createdAt || now,
        employee.updatedAt || now
      );
      return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employees:update", (event, id, data) => {
    replySync(event, "db-sync:employees:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employees:delete", (event, id) => {
    replySync(event, "db-sync:employees:delete", false, () => db2.prepare("DELETE FROM employees WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:employee_salaries:get", (event, employeeId) => {
    replySync(event, "db-sync:employee_salaries:get", [], () => {
      if (employeeId) {
        return db2.prepare("SELECT * FROM employee_salaries WHERE employeeId = ? ORDER BY month DESC, paidAt DESC, createdAt DESC").all(employeeId);
      }
      return db2.prepare("SELECT * FROM employee_salaries ORDER BY month DESC, paidAt DESC, createdAt DESC").all();
    });
  });
  electron.ipcMain.on("db-sync:employee_salaries:add", (event, salary) => {
    replySync(event, "db-sync:employee_salaries:add", null, () => {
      const id = salary.id || crypto.randomUUID();
      const createdAt = salary.createdAt || salary.paidAt || (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO employee_salaries (
          id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
          netSalary, paid, paidAt, walletId, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        salary.employeeId,
        salary.employeeName ?? null,
        salary.month,
        salary.baseSalary ?? 0,
        salary.commission ?? 0,
        salary.bonus ?? 0,
        salary.deductions ?? 0,
        salary.advanceDeducted ?? 0,
        salary.netSalary ?? 0,
        salary.paid ?? 1,
        salary.paidAt ?? createdAt,
        salary.walletId ?? null,
        salary.notes ?? null,
        createdAt
      );
      return db2.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employee_salaries:update", (event, id, data) => {
    replySync(event, "db-sync:employee_salaries:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(id);
      values.push(id);
      db2.prepare(`UPDATE employee_salaries SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employee_salaries:delete", (event, id) => {
    replySync(event, "db-sync:employee_salaries:delete", false, () => db2.prepare("DELETE FROM employee_salaries WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:employee_advances:get", (event, employeeId) => {
    replySync(event, "db-sync:employee_advances:get", [], () => {
      if (employeeId) {
        return db2.prepare("SELECT * FROM employee_advances WHERE employeeId = ? ORDER BY date DESC, createdAt DESC").all(employeeId);
      }
      return db2.prepare("SELECT * FROM employee_advances ORDER BY date DESC, createdAt DESC").all();
    });
  });
  electron.ipcMain.on("db-sync:employee_advances:add", (event, advance) => {
    replySync(event, "db-sync:employee_advances:add", null, () => {
      const id = advance.id || crypto.randomUUID();
      const createdAt = advance.createdAt || advance.date || (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO employee_advances (id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        advance.employeeId,
        advance.employeeName ?? null,
        advance.amount ?? 0,
        advance.date,
        advance.deductedMonth ?? null,
        advance.notes ?? null,
        createdAt
      );
      return db2.prepare("SELECT * FROM employee_advances WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employee_advances:update", (event, id, data) => {
    replySync(event, "db-sync:employee_advances:update", null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db2.prepare("SELECT * FROM employee_advances WHERE id = ?").get(id);
      values.push(id);
      db2.prepare(`UPDATE employee_advances SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM employee_advances WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:employee_advances:delete", (event, id) => {
    replySync(event, "db-sync:employee_advances:delete", false, () => db2.prepare("DELETE FROM employee_advances WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:used_devices:get", (event) => {
    replySync(event, "db-sync:used_devices:get", [], () => db2.prepare("SELECT * FROM used_devices WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY createdAt DESC, updatedAt DESC").all());
  });
  electron.ipcMain.on("db-sync:used_devices:add", (event, device) => {
    replySync(event, "db-sync:used_devices:add", null, () => {
      const id = device.id || crypto.randomUUID();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO used_devices (
          id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
          ram, description, notes, image, soldAt, purchasedFrom, soldTo, isArchived, deletedAt, warehouseId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        device.name,
        device.model ?? null,
        device.deviceType ?? null,
        device.category ?? device.deviceType ?? null,
        device.condition ?? "good",
        device.purchasePrice ?? 0,
        device.sellingPrice ?? device.salePrice ?? 0,
        device.status ?? "in_stock",
        device.serialNumber ?? null,
        device.color ?? null,
        device.storage ?? null,
        device.ram ?? null,
        device.description ?? null,
        device.notes ?? device.description ?? null,
        device.image ?? null,
        device.soldAt ?? null,
        device.purchasedFrom ?? null,
        device.soldTo ?? null,
        device.isArchived ? 1 : 0,
        device.deletedAt ?? null,
        device.warehouseId ?? null,
        device.createdAt || now,
        device.updatedAt || now
      );
      return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:used_devices:update", (event, id, data) => {
    replySync(event, "db-sync:used_devices:update", null, () => {
      const updates = { ...data };
      if (Object.prototype.hasOwnProperty.call(updates, "deviceType") && !Object.prototype.hasOwnProperty.call(updates, "category")) {
        updates.category = updates.deviceType;
      }
      if (Object.prototype.hasOwnProperty.call(updates, "description") && !Object.prototype.hasOwnProperty.call(updates, "notes")) {
        updates.notes = updates.description;
      }
      const { sets, values } = buildUpdateSql(updates);
      if (!sets.length) return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
      sets.push("updatedAt = ?");
      values.push((/* @__PURE__ */ new Date()).toISOString(), id);
      db2.prepare(`UPDATE used_devices SET ${sets.join(", ")} WHERE id = ?`).run(...values);
      return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:used_devices:delete", (event, id) => {
    replySync(event, "db-sync:used_devices:delete", false, () => db2.prepare("DELETE FROM used_devices WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:sales:get", (event, activeOnly = false) => {
    replySync(event, "db-sync:sales:get", [], () => readSales(db2, Boolean(activeOnly)));
  });
  electron.ipcMain.on("db-sync:sales:maxInvoiceSequence", (event) => {
    replySync(event, "db-sync:sales:maxInvoiceSequence", 0, () => {
      const rows = db2.prepare("SELECT invoiceNumber FROM sales").all();
      return rows.reduce((max, row) => {
        const match = /^INV-\d{4}-(\d+)$/.exec(String(row.invoiceNumber ?? ""));
        const sequence = match ? Number.parseInt(match[1], 10) : 0;
        return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
      }, 0);
    });
  });
  electron.ipcMain.on("db-sync:sales:upsert", (event, sale) => {
    replySync(event, "db-sync:sales:upsert", null, () => {
      const persistSale = db2.transaction(() => {
        db2.prepare(`
          INSERT INTO sales (
            id, invoiceNumber, date, subtotal, discount, total, totalCost, grossProfit, marginPct,
            paymentMethod, employee, voidedAt, voidReason, voidedBy
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            invoiceNumber = excluded.invoiceNumber,
            date = excluded.date,
            subtotal = excluded.subtotal,
            discount = excluded.discount,
            total = excluded.total,
            totalCost = excluded.totalCost,
            grossProfit = excluded.grossProfit,
            marginPct = excluded.marginPct,
            paymentMethod = excluded.paymentMethod,
            employee = excluded.employee,
            voidedAt = excluded.voidedAt,
            voidReason = excluded.voidReason,
            voidedBy = excluded.voidedBy
        `).run(
          sale.id,
          sale.invoiceNumber,
          sale.date,
          sale.subtotal ?? 0,
          sale.discount ?? 0,
          sale.total ?? 0,
          sale.totalCost ?? 0,
          sale.grossProfit ?? 0,
          sale.marginPct ?? 0,
          sale.paymentMethod ?? "cash",
          sale.employee ?? "system",
          sale.voidedAt ?? null,
          sale.voidReason ?? null,
          sale.voidedBy ?? null
        );
        db2.prepare("DELETE FROM sale_items WHERE saleId = ?").run(sale.id);
        const itemStmt = db2.prepare(`
          INSERT INTO sale_items (id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of Array.isArray(sale.items) ? sale.items : []) {
          itemStmt.run(
            item.id ?? crypto.randomUUID(),
            sale.id,
            item.productId,
            item.name,
            item.qty ?? 0,
            item.price ?? 0,
            item.cost ?? 0,
            item.lineDiscount ?? 0,
            item.warehouseId ?? null,
            item.batches ? JSON.stringify(item.batches) : null
          );
        }
        return readSales(db2).find((row) => row.id === sale.id) ?? null;
      });
      return persistSale();
    });
  });
  electron.ipcMain.on("db-sync:returns:get", (event) => {
    replySync(event, "db-sync:returns:get", [], () => readReturnRecords(db2));
  });
  electron.ipcMain.on("db-sync:returns:add", (event, record) => {
    replySync(event, "db-sync:returns:add", null, () => {
      const persistReturn = db2.transaction(() => {
        const existing = readReturnRecords(db2);
        const maxSequence = existing.reduce((max, item) => Math.max(max, extractPrefixedSequence(item.returnNumber, "RET")), 0);
        const id = record.id || crypto.randomUUID();
        const createdAt = record.createdAt || (/* @__PURE__ */ new Date()).toISOString();
        const returnNumber = record.returnNumber || `RET-${String(maxSequence + 1).padStart(4, "0")}`;
        const originalSaleRow = record.originalSaleId ? db2.prepare("SELECT id FROM sales WHERE id = ?").get(record.originalSaleId) : void 0;
        db2.prepare(`
          INSERT INTO return_records (
            id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          returnNumber,
          record.originalInvoiceNumber,
          (originalSaleRow == null ? void 0 : originalSaleRow.id) ?? null,
          record.date,
          record.totalRefund ?? 0,
          record.reason ?? null,
          record.processedBy ?? null,
          createdAt
        );
        const itemStmt = db2.prepare(`
          INSERT INTO return_items (id, returnId, productId, name, qty, price, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of Array.isArray(record.items) ? record.items : []) {
          itemStmt.run(
            item.id ?? crypto.randomUUID(),
            id,
            item.productId,
            item.name,
            item.qty ?? 0,
            item.price ?? 0,
            item.reason ?? null
          );
        }
        return readReturnRecords(db2).find((row) => row.id === id) ?? null;
      });
      return persistReturn();
    });
  });
  electron.ipcMain.on("db-sync:purchase_invoices:get", (event) => {
    replySync(event, "db-sync:purchase_invoices:get", [], () => readPurchaseInvoices(db2));
  });
  electron.ipcMain.on("db-sync:purchase_invoices:add", (event, invoice) => {
    replySync(event, "db-sync:purchase_invoices:add", null, () => {
      const persistInvoice = db2.transaction(() => {
        var _a;
        const invoices = readPurchaseInvoices(db2);
        const maxSequence = invoices.reduce((max, item) => Math.max(max, extractPrefixedSequence(item.invoiceNumber, "PI")), 0);
        const id = invoice.id || crypto.randomUUID();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const totalAmount = Number(invoice.totalAmount ?? 0);
        const paidAmount = Math.min(totalAmount, Number(invoice.paidAmount ?? 0));
        const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, paidAmount);
        const supplierId = invoice.supplierId ? ((_a = db2.prepare("SELECT id FROM suppliers WHERE id = ?").get(invoice.supplierId)) == null ? void 0 : _a.id) ?? null : null;
        db2.prepare(`
          INSERT INTO purchase_invoices (
            id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
            remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          invoice.invoiceNumber || `PI-${String(maxSequence + 1).padStart(4, "0")}`,
          supplierId,
          invoice.supplierName,
          invoice.invoiceDate,
          totalAmount,
          paidAmount,
          remaining,
          invoice.paymentMethod ?? "cash",
          status,
          invoice.notes ?? null,
          invoice.createdBy ?? "system",
          invoice.createdAt || now,
          invoice.updatedAt || now
        );
        const itemStmt = db2.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of Array.isArray(invoice.items) ? invoice.items : []) {
          const quantity = Number(item.quantity ?? 0);
          const unitPrice = Number(item.unitPrice ?? 0);
          itemStmt.run(
            item.id ?? crypto.randomUUID(),
            id,
            item.productName,
            item.category ?? null,
            quantity,
            unitPrice,
            item.totalPrice ?? quantity * unitPrice,
            item.notes ?? null
          );
        }
        return readPurchaseInvoices(db2).find((row) => row.id === id) ?? null;
      });
      return persistInvoice();
    });
  });
  electron.ipcMain.on("db-sync:purchase_invoices:update", (event, id, data) => {
    replySync(event, "db-sync:purchase_invoices:update", null, () => {
      const persistInvoice = db2.transaction(() => {
        var _a;
        const existing = readPurchaseInvoices(db2).find((invoice) => invoice.id === id);
        if (!existing) return null;
        const merged = {
          ...existing,
          ...data,
          items: Array.isArray(data == null ? void 0 : data.items) ? data.items : existing.items
        };
        const totalAmount = Number(merged.totalAmount ?? 0);
        const paidAmount = Math.min(totalAmount, Number(merged.paidAmount ?? 0));
        const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, paidAmount);
        const supplierId = merged.supplierId ? ((_a = db2.prepare("SELECT id FROM suppliers WHERE id = ?").get(merged.supplierId)) == null ? void 0 : _a.id) ?? null : null;
        db2.prepare(`
          UPDATE purchase_invoices
          SET supplierId = ?, supplierName = ?, invoiceDate = ?, totalAmount = ?, paidAmount = ?, remaining = ?,
              paymentMethod = ?, status = ?, notes = ?, createdBy = ?, updatedAt = ?
          WHERE id = ?
        `).run(
          supplierId,
          merged.supplierName,
          merged.invoiceDate,
          totalAmount,
          paidAmount,
          remaining,
          merged.paymentMethod ?? "cash",
          status,
          merged.notes ?? null,
          merged.createdBy ?? "system",
          (/* @__PURE__ */ new Date()).toISOString(),
          id
        );
        db2.prepare("DELETE FROM purchase_invoice_items WHERE invoiceId = ?").run(id);
        const itemStmt = db2.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of Array.isArray(merged.items) ? merged.items : []) {
          const quantity = Number(item.quantity ?? 0);
          const unitPrice = Number(item.unitPrice ?? 0);
          itemStmt.run(
            item.id ?? crypto.randomUUID(),
            id,
            item.productName,
            item.category ?? null,
            quantity,
            unitPrice,
            item.totalPrice ?? quantity * unitPrice,
            item.notes ?? null
          );
        }
        return readPurchaseInvoices(db2).find((invoice) => invoice.id === id) ?? null;
      });
      return persistInvoice();
    });
  });
  electron.ipcMain.on("db-sync:purchase_invoices:applyPayment", (event, id, amount) => {
    replySync(event, "db-sync:purchase_invoices:applyPayment", null, () => {
      const applyInvoicePayment = db2.transaction(() => {
        const current = db2.prepare("SELECT * FROM purchase_invoices WHERE id = ?").get(id);
        if (!current) return null;
        const totalAmount = Number(current.totalAmount ?? 0);
        const nextPaidAmount = Math.min(totalAmount, Number(current.paidAmount ?? 0) + Math.max(0, Number(amount ?? 0)));
        const remaining = Math.max(0, Math.round((totalAmount - nextPaidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, nextPaidAmount);
        db2.prepare(`
          UPDATE purchase_invoices
          SET paidAmount = ?, remaining = ?, status = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextPaidAmount, remaining, status, (/* @__PURE__ */ new Date()).toISOString(), id);
        return readPurchaseInvoices(db2).find((invoice) => invoice.id === id) ?? null;
      });
      return applyInvoicePayment();
    });
  });
  electron.ipcMain.on("db-sync:purchase_invoices:delete", (event, id) => {
    replySync(event, "db-sync:purchase_invoices:delete", false, () => db2.prepare("DELETE FROM purchase_invoices WHERE id = ?").run(id).changes > 0);
  });
  electron.ipcMain.on("db-sync:shift_closings:get", (event) => {
    replySync(event, "db-sync:shift_closings:get", [], () => readShiftClosings(db2));
  });
  electron.ipcMain.on("db-sync:shift_closings:buildSummary", (event, closedBy, actualCash, notes) => {
    replySync(event, "db-sync:shift_closings:buildSummary", null, () => buildShiftSummary(db2, closedBy, Number(actualCash ?? 0), notes));
  });
  electron.ipcMain.on("db-sync:shift_closings:add", (event, closing) => {
    replySync(event, "db-sync:shift_closings:add", null, () => {
      const id = closing.id || crypto.randomUUID();
      const createdAt = closing.createdAt || closing.closedAt || (/* @__PURE__ */ new Date()).toISOString();
      db2.prepare(`
        INSERT INTO shift_closings (
          id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
          salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        closing.shiftDate,
        closing.closedAt,
        closing.closedBy,
        closing.salesCount ?? 0,
        closing.salesCash ?? 0,
        closing.salesCard ?? 0,
        closing.salesTransfer ?? 0,
        closing.salesTotal ?? 0,
        closing.expectedCash ?? 0,
        closing.actualCash ?? 0,
        closing.cashDifference ?? 0,
        closing.notes ?? null,
        createdAt
      );
      return db2.prepare("SELECT * FROM shift_closings WHERE id = ?").get(id) ?? null;
    });
  });
  electron.ipcMain.on("db-sync:stock_movements:get", (event, productId) => {
    replySync(event, "db-sync:stock_movements:get", [], () => {
      if (productId) {
        return db2.prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY timestamp DESC, id DESC").all(productId);
      }
      return db2.prepare("SELECT * FROM stock_movements ORDER BY timestamp DESC, id DESC").all();
    });
  });
  electron.ipcMain.on("db-sync:stock_movements:add", (event, movement) => {
    replySync(event, "db-sync:stock_movements:add", null, () => {
      const id = movement.id || crypto.randomUUID();
      db2.prepare(`
        INSERT INTO stock_movements (
          id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
          referenceId, userId, timestamp, warehouseId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        movement.productId,
        movement.type,
        movement.quantityChange ?? 0,
        movement.previousQuantity ?? 0,
        movement.newQuantity ?? 0,
        movement.reason ?? null,
        movement.referenceId ?? null,
        movement.userId ?? null,
        movement.timestamp ?? (/* @__PURE__ */ new Date()).toISOString(),
        movement.warehouseId ?? null
      );
      return db2.prepare("SELECT * FROM stock_movements WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:stock_movements:addBulk", (event, movements) => {
    replySync(event, "db-sync:stock_movements:addBulk", [], () => {
      const persistMovements = db2.transaction(() => {
        const stmt = db2.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
            referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertedIds = [];
        for (const movement of Array.isArray(movements) ? movements : []) {
          const id = movement.id || crypto.randomUUID();
          insertedIds.push(id);
          stmt.run(
            id,
            movement.productId,
            movement.type,
            movement.quantityChange ?? 0,
            movement.previousQuantity ?? 0,
            movement.newQuantity ?? 0,
            movement.reason ?? null,
            movement.referenceId ?? null,
            movement.userId ?? null,
            movement.timestamp ?? (/* @__PURE__ */ new Date()).toISOString(),
            movement.warehouseId ?? null
          );
        }
        if (insertedIds.length === 0) return [];
        const placeholders = insertedIds.map(() => "?").join(", ");
        return db2.prepare(`SELECT * FROM stock_movements WHERE id IN (${placeholders}) ORDER BY timestamp DESC, id DESC`).all(...insertedIds);
      });
      return persistMovements();
    });
  });
  electron.ipcMain.on("db-sync:audit_logs:get", (event) => {
    replySync(event, "db-sync:audit_logs:get", [], () => db2.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC").all());
  });
  electron.ipcMain.on("db-sync:audit_logs:add", (event, entry) => {
    replySync(event, "db-sync:audit_logs:add", null, () => {
      const id = entry.id || crypto.randomUUID();
      db2.prepare(`
        INSERT INTO audit_logs (
          id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.userId ?? "system",
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        entry.machineId ?? null,
        entry.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
      );
      return db2.prepare("SELECT * FROM audit_logs WHERE id = ?").get(id);
    });
  });
  electron.ipcMain.on("db-sync:audit_logs:addBulk", (event, entries) => {
    replySync(event, "db-sync:audit_logs:addBulk", [], () => {
      const persistEntries = db2.transaction(() => {
        const stmt = db2.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertedIds = [];
        for (const entry of Array.isArray(entries) ? entries : []) {
          const id = entry.id || crypto.randomUUID();
          insertedIds.push(id);
          stmt.run(
            id,
            entry.userId ?? "system",
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.beforeState ? JSON.stringify(entry.beforeState) : null,
            entry.afterState ? JSON.stringify(entry.afterState) : null,
            entry.machineId ?? null,
            entry.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
          );
        }
        if (insertedIds.length === 0) return [];
        const placeholders = insertedIds.map(() => "?").join(", ");
        return db2.prepare(`SELECT * FROM audit_logs WHERE id IN (${placeholders}) ORDER BY timestamp DESC, id DESC`).all(...insertedIds);
      });
      return persistEntries();
    });
  });
  electron.ipcMain.handle("db:partners:get", () => db2.prepare("SELECT * FROM partners ORDER BY createdAt DESC").all());
  electron.ipcMain.handle("db:partners:add", (_, partner) => {
    const id = partner.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, partner.name, partner.phone, partner.address, partner.partnershipType, partner.sharePercent || 0, partner.profitShareDevices || 0, partner.profitShareAccessories || 0, partner.capitalAmount || 0, partner.active ? 1 : 0, partner.notes, partner.createdAt || now, now);
    return db2.prepare("SELECT * FROM partners WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:partners:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE partners SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM partners WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:partners:delete", (_, id) => db2.prepare("DELETE FROM partners WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:partner_transactions:get", (_, partnerId) => {
    if (partnerId) return db2.prepare("SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC").all(partnerId);
    return db2.prepare("SELECT * FROM partner_transactions ORDER BY createdAt DESC").all();
  });
  electron.ipcMain.handle("db:partner_transactions:add", (_, trx) => {
    const id = trx.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(id, trx.partnerId, trx.type, trx.amount, trx.description, trx.createdAt || (/* @__PURE__ */ new Date()).toISOString());
    return db2.prepare("SELECT * FROM partner_transactions WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:get", () => db2.prepare("SELECT * FROM warehouses ORDER BY name ASC").all());
  electron.ipcMain.handle("db:warehouses:add", (_, w) => {
    const id = w.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO warehouses (id, name, location, isDefault, notes) VALUES (?, ?, ?, ?, ?)`).run(id, w.name, w.location, w.isDefault ? 1 : 0, w.notes);
    return db2.prepare("SELECT * FROM warehouses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    values.push(id);
    db2.prepare(`UPDATE warehouses SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM warehouses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:warehouses:delete", (_, id) => db2.prepare("DELETE FROM warehouses WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:safe_transactions:get", (_, walletId) => {
    if (walletId) return db2.prepare("SELECT * FROM safe_transactions WHERE walletId = ? ORDER BY createdAt DESC").all(walletId);
    return db2.prepare("SELECT * FROM safe_transactions ORDER BY createdAt DESC").all();
  });
  electron.ipcMain.handle("db:safe_transactions:add", (_, trx) => {
    const id = trx.id || crypto.randomUUID();
    ensureWalletRecord(db2, String(trx.walletId ?? ""));
    db2.prepare(`INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, trx.walletId, trx.type, trx.subType, trx.amount, trx.category, trx.description, trx.paymentMethod, trx.affectsCapital ? 1 : 0, trx.affectsProfit ? 1 : 0, trx.createdBy, trx.relatedId, trx.createdAt || (/* @__PURE__ */ new Date()).toISOString());
    return db2.prepare("SELECT * FROM safe_transactions WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:customers:get", () => db2.prepare("SELECT * FROM customers ORDER BY name ASC").all());
  electron.ipcMain.handle("db:customers:add", (_, c) => {
    const id = c.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, c.name, c.phone, c.email, c.address, c.nationalId, c.notes, c.totalPurchases || 0, c.balance || 0, c.createdAt || now, now);
    return db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:customers:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM customers WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:customers:delete", (_, id) => db2.prepare("DELETE FROM customers WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:suppliers:get", () => db2.prepare("SELECT * FROM suppliers ORDER BY name ASC").all());
  electron.ipcMain.handle("db:suppliers:add", (_, s) => {
    const id = s.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, s.name, s.phone, s.email, s.address, s.category, s.balance || 0, s.notes, s.active ?? 1, s.createdAt || now, now);
    return db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:suppliers:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE suppliers SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM suppliers WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:suppliers:delete", (_, id) => db2.prepare("DELETE FROM suppliers WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:employees:get", () => db2.prepare("SELECT * FROM employees ORDER BY name ASC").all());
  electron.ipcMain.handle("db:employees:add", (_, e) => {
    const id = e.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, e.name, e.phone, e.role, e.salary || 0, e.commissionRate || 0, e.hireDate, e.active ?? 1, e.notes, e.createdAt || now, now);
    return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:employees:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE employees SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:employees:delete", (_, id) => db2.prepare("DELETE FROM employees WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:expenses:get", (_, { from, to } = {}) => {
    if (from && to) return db2.prepare("SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC").all(from, to);
    return db2.prepare("SELECT * FROM expenses ORDER BY date DESC").all();
  });
  electron.ipcMain.handle("db:expenses:add", (_, e) => {
    const id = e.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, e.category, e.description, e.amount, e.date, e.paymentMethod || "cash", e.employee, e.notes, e.createdAt || now, now);
    return db2.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:expenses:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE expenses SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:expenses:delete", (_, id) => db2.prepare("DELETE FROM expenses WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:blacklist:get", () => db2.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC").all());
  electron.ipcMain.handle("db:blacklist:add", (_, b) => {
    const id = b.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, b.name, b.phone, b.nationalId, b.reason, b.notes, b.addedBy, b.createdAt || (/* @__PURE__ */ new Date()).toISOString());
    return db2.prepare("SELECT * FROM blacklist WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:blacklist:delete", (_, id) => db2.prepare("DELETE FROM blacklist WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:blacklist:search", (_, query) => {
    const q = `%${query}%`;
    return db2.prepare("SELECT * FROM blacklist WHERE name LIKE ? OR phone LIKE ? OR nationalId LIKE ?").all(q, q, q);
  });
  electron.ipcMain.handle("db:damaged_items:get", () => db2.prepare("SELECT * FROM damaged_items ORDER BY date DESC").all());
  electron.ipcMain.handle("db:damaged_items:add", (_, d) => {
    const id = d.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, d.productName || d.name, d.productId, d.inventoryType, d.quantity || 1, d.reason, d.estimatedLoss || 0, d.reportedBy, d.date, d.notes, d.createdAt || (/* @__PURE__ */ new Date()).toISOString());
    return db2.prepare("SELECT * FROM damaged_items WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:damaged_items:delete", (_, id) => db2.prepare("DELETE FROM damaged_items WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:other_revenue:get", () => db2.prepare("SELECT * FROM other_revenue ORDER BY date DESC").all());
  electron.ipcMain.handle("db:other_revenue:add", (_, r) => {
    const id = r.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, r.source, r.description, r.amount, r.date, r.paymentMethod || "cash", r.notes, r.createdAt || (/* @__PURE__ */ new Date()).toISOString());
    return db2.prepare("SELECT * FROM other_revenue WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:other_revenue:delete", (_, id) => db2.prepare("DELETE FROM other_revenue WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:wallets:get", () => db2.prepare("SELECT * FROM wallets ORDER BY name ASC").all());
  electron.ipcMain.handle("db:wallets:add", (_, w) => {
    const id = w.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, w.name, w.type || "cash", w.balance || 0, w.isDefault ? 1 : 0, w.icon || null, w.color, w.notes, w.createdAt || now, now);
    return db2.prepare("SELECT * FROM wallets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:wallets:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE wallets SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM wallets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:wallets:delete", (_, id) => {
    const deleteWallet = db2.transaction(() => {
      db2.prepare("DELETE FROM safe_transactions WHERE walletId = ?").run(id);
      return db2.prepare("DELETE FROM wallets WHERE id = ?").run(id).changes > 0;
    });
    return deleteWallet();
  });
  electron.ipcMain.handle("db:used_devices:get", () => db2.prepare("SELECT * FROM used_devices ORDER BY createdAt DESC").all());
  electron.ipcMain.handle("db:used_devices:add", (_, d) => {
    const id = d.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO used_devices (
        id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
        ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      d.name,
      d.model ?? null,
      d.deviceType ?? null,
      d.category ?? d.deviceType ?? null,
      d.condition || "good",
      d.purchasePrice || 0,
      d.sellingPrice || 0,
      d.status || "in_stock",
      d.serialNumber,
      d.color,
      d.storage,
      d.ram ?? null,
      d.description ?? null,
      d.notes ?? d.description ?? null,
      d.image,
      d.soldAt,
      d.purchasedFrom,
      d.soldTo,
      d.createdAt || now,
      now
    );
    return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:used_devices:update", (_, id, data) => {
    const updates = { ...data };
    if (Object.prototype.hasOwnProperty.call(updates, "deviceType") && !Object.prototype.hasOwnProperty.call(updates, "category")) {
      updates.category = updates.deviceType;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "description") && !Object.prototype.hasOwnProperty.call(updates, "notes")) {
      updates.notes = updates.description;
    }
    const { sets, values } = buildUpdateSql(updates);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE used_devices SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:used_devices:delete", (_, id) => db2.prepare("DELETE FROM used_devices WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:reminders:get", () => db2.prepare("SELECT * FROM reminders ORDER BY dueDate ASC").all());
  electron.ipcMain.handle("db:reminders:add", (_, r) => {
    const id = r.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, r.title, r.description, r.dueDate, r.priority || "medium", r.completed ? 1 : 0, r.completedAt, r.recurring, r.category, r.createdAt || now, now);
    return db2.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:reminders:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE reminders SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM reminders WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:reminders:delete", (_, id) => db2.prepare("DELETE FROM reminders WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:shifts:get", () => db2.prepare("SELECT * FROM shift_records ORDER BY openedAt DESC").all());
  electron.ipcMain.handle("db:shifts:getActive", () => db2.prepare("SELECT * FROM shift_records WHERE closedAt IS NULL ORDER BY openedAt DESC LIMIT 1").get());
  electron.ipcMain.handle("db:shifts:open", (_, s) => {
    const id = s.id || crypto.randomUUID();
    db2.prepare(`INSERT INTO shift_records (id, openedAt, openingBalance, openedBy, notes) VALUES (?, ?, ?, ?, ?)`).run(id, s.openedAt || (/* @__PURE__ */ new Date()).toISOString(), s.openingBalance || 0, s.openedBy, s.notes);
    return db2.prepare("SELECT * FROM shift_records WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:shifts:close", (_, id, data) => {
    db2.prepare(`UPDATE shift_records SET closedAt = ?, closingBalance = ?, totalSales = ?, totalExpenses = ?, closedBy = ?, notes = ? WHERE id = ?`).run(data.closedAt || (/* @__PURE__ */ new Date()).toISOString(), data.closingBalance || 0, data.totalSales || 0, data.totalExpenses || 0, data.closedBy, data.notes, id);
    return db2.prepare("SELECT * FROM shift_records WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:stats", () => {
    const tables = [
      "products",
      "sales",
      "customers",
      "suppliers",
      "employees",
      "expenses",
      "installments",
      "repair_tickets",
      "repair_parts",
      "wallets",
      "used_devices",
      "reminders",
      "blacklist",
      "damaged_items",
      "other_revenue",
      "partners",
      "warehouses"
    ];
    const result = {};
    for (const t of tables) {
      try {
        const row = db2.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
        result[t] = row.c;
      } catch {
        result[t] = -1;
      }
    }
    return result;
  });
  electron.ipcMain.handle("db:factory-reset", () => {
    try {
      db2.transaction(() => {
        const tablesQuery = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
        const tables = tablesQuery.map((row) => row.name);
        for (const t of tables) {
          if (t === "settings" || t === "users" || t === "sqlite_sequence" || t === "sqlite_stat1") {
            continue;
          }
          try {
            db2.prepare(`DELETE FROM ${t}`).run();
          } catch {
          }
        }
      })();
      return true;
    } catch (e) {
      console.error("Factory reset failed:", e);
      return false;
    }
  });
}
function setupRepairHandlers(db2) {
  const SPARE_PART_TYPES = ["mobile_spare_part", "device_spare_part", "computer_spare_part"];
  const getExpectedInventoryType = (deviceCategory) => {
    switch (deviceCategory) {
      case "mobile":
      case "tablet":
        return "mobile_spare_part";
      case "device":
        return "device_spare_part";
      case "computer":
      case "laptop":
        return "computer_spare_part";
      default:
        return null;
    }
  };
  electron.ipcMain.handle("db:repairs:getTickets", (_, filters = {}) => {
    let query = "SELECT * FROM repair_tickets WHERE 1=1";
    const params = [];
    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }
    if (filters.customerId) {
      query += " AND client_id = ?";
      params.push(filters.customerId);
    }
    if (filters.search) {
      query += " AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ?)";
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }
    query += " ORDER BY createdAt DESC";
    return db2.prepare(query).all(...params);
  });
  electron.ipcMain.handle("db:repairs:getTicket", (_, id) => {
    return db2.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:addTicket", (_, ticket) => {
    const id = ticket.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const ticketNo = ticket.ticket_no || `TKT-${Date.now()}`;
    db2.prepare(`
      INSERT INTO repair_tickets (
        id, ticket_no, client_id, customer_name, customer_phone,
        device_category, device_brand, device_model, imei_or_serial,
        issue_description, accessories_received, device_passcode,
        status, package_price, final_cost, warranty_days,
        assigned_tech_name, tech_bonus_type, tech_bonus_value,
        createdAt, createdBy, updatedAt, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ticketNo,
      ticket.client_id || ticket.customerId || null,
      ticket.customer_name || "عميل نقدي",
      ticket.customer_phone || null,
      ticket.device_category || "mobile",
      ticket.device_brand || ticket.deviceBrand || null,
      ticket.device_model || ticket.deviceModel || null,
      ticket.imei_or_serial || ticket.serial || null,
      ticket.issue_description || ticket.problemDesc || "",
      ticket.accessories_received || ticket.accessories || null,
      ticket.device_passcode || ticket.password || null,
      ticket.status || "received",
      ticket.package_price ?? ticket.expectedCost ?? null,
      ticket.final_cost ?? null,
      ticket.warranty_days ?? null,
      ticket.assigned_tech_name || ticket.techName || null,
      ticket.tech_bonus_type || null,
      ticket.tech_bonus_value ?? null,
      ticket.createdAt || now,
      ticket.createdBy || null,
      now,
      ticket.updatedBy || null
    );
    return db2.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:updateTicket", (_, id, data) => {
    const VALID_COLUMNS = /* @__PURE__ */ new Set([
      "client_id",
      "customer_name",
      "customer_phone",
      "device_category",
      "device_brand",
      "device_model",
      "imei_or_serial",
      "issue_description",
      "accessories_received",
      "device_passcode",
      "status",
      "package_price",
      "final_cost",
      "warranty_days",
      "assigned_tech_name",
      "tech_bonus_type",
      "tech_bonus_value",
      "updatedBy"
    ]);
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (VALID_COLUMNS.has(key)) {
        sets.push(`${key} = ?`);
        values.push(val === void 0 ? null : val);
      }
    }
    if (sets.length === 0) return db2.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(id);
    sets.push("updatedAt = ?");
    values.push((/* @__PURE__ */ new Date()).toISOString());
    values.push(id);
    db2.prepare(`UPDATE repair_tickets SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:deleteTicket", (_, id) => {
    db2.prepare("DELETE FROM repair_ticket_parts WHERE ticket_id = ?").run(id);
    db2.prepare("DELETE FROM repair_events WHERE ticket_id = ?").run(id);
    db2.prepare("DELETE FROM repair_payments WHERE ticket_id = ?").run(id);
    db2.prepare("DELETE FROM repair_status_history WHERE ticket_id = ?").run(id);
    return db2.prepare("DELETE FROM repair_tickets WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("db:repairs:getHistory", (_, ticketId) => {
    return db2.prepare("SELECT * FROM repair_status_history WHERE ticket_id = ? ORDER BY createdAt DESC").all(ticketId);
  });
  electron.ipcMain.handle("db:repairs:addHistory", (_, entry) => {
    const id = entry.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_status_history (id, ticket_id, from_status, to_status, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.ticket_id, entry.from_status || null, entry.to_status, entry.note || null, now, entry.createdBy || null);
    return db2.prepare("SELECT * FROM repair_status_history WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:getEvents", (_, ticketId) => {
    return db2.prepare("SELECT * FROM repair_events WHERE ticket_id = ? ORDER BY createdAt DESC").all(ticketId);
  });
  electron.ipcMain.handle("db:repairs:addEvent", (_, event) => {
    const id = event.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_events (id, ticket_id, event_type, from_status, to_status, note, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.ticket_id,
      event.event_type,
      event.from_status || event.old_status || null,
      event.to_status || event.new_status || null,
      event.note || event.notes || null,
      event.createdBy || event.user_name || null,
      now
    );
    return db2.prepare("SELECT * FROM repair_events WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:getPayments", (_, ticketId) => {
    return db2.prepare("SELECT * FROM repair_payments WHERE ticket_id = ? ORDER BY createdAt DESC").all(ticketId);
  });
  electron.ipcMain.handle("db:repairs:addPayment", (_, payment) => {
    const id = payment.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_payments (id, ticket_id, kind, amount, wallet_type, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      payment.ticket_id,
      payment.kind || "deposit",
      payment.amount,
      payment.wallet_type || "cash",
      payment.note || null,
      now,
      payment.createdBy || null
    );
    return db2.prepare("SELECT * FROM repair_payments WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:getParts", () => {
    return db2.prepare("SELECT * FROM repair_parts ORDER BY name ASC").all();
  });
  electron.ipcMain.handle("db:repairs:getPart", (_, id) => {
    return db2.prepare("SELECT * FROM repair_parts WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:addPart", (_, part) => {
    const id = part.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_parts (
        id, name, category, sku, brand, compatible_models,
        unit_cost, selling_price, qty, min_qty,
        barcode, color, location, active, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      part.name,
      part.category || null,
      part.sku || part.part_no || null,
      part.brand || null,
      part.compatible_models || null,
      part.unit_cost || part.cost_price || 0,
      part.selling_price || 0,
      part.qty || part.current_stock || 0,
      part.min_qty || part.min_stock || 0,
      part.barcode || null,
      part.color || null,
      part.location || null,
      part.active ?? 1,
      part.notes || null,
      now
    );
    return db2.prepare("SELECT * FROM repair_parts WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:updatePart", (_, id, data) => {
    const EXCLUDED = ["id", "createdAt"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (!EXCLUDED.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return db2.prepare("SELECT * FROM repair_parts WHERE id = ?").get(id);
    values.push(id);
    db2.prepare(`UPDATE repair_parts SET ${sets.join(", ")} WHERE id = ?`).run(...values);
    return db2.prepare("SELECT * FROM repair_parts WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:deletePart", (_, id) => {
    return db2.prepare("DELETE FROM repair_parts WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("db:repairs:getTicketParts", (_, ticketId) => {
    return db2.prepare(`
      SELECT tp.*, 
        COALESCE(rp.name, acc.name) as partName,
        COALESCE(rp.unit_cost, acc.costPrice, acc.newCostPrice) as partCostPrice,
        COALESCE(rp.selling_price, acc.salePrice) as partSellingPrice
      FROM repair_ticket_parts tp
      LEFT JOIN repair_parts rp ON tp.part_id = rp.id
      LEFT JOIN accessories acc ON tp.part_id = acc.id
      WHERE tp.ticket_id = ?
    `).all(ticketId);
  });
  electron.ipcMain.handle("db:repairs:addTicketPart", (_, tpart) => {
    const id = tpart.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const qty = Math.max(1, Number(tpart.qty || tpart.quantity || 1));
    const ticket = db2.prepare("SELECT id, ticket_no, device_category FROM repair_tickets WHERE id = ?").get(tpart.ticket_id);
    if (!ticket) {
      throw new Error("طلب الصيانة غير موجود.");
    }
    const expectedInventoryType = getExpectedInventoryType(ticket.device_category);
    const accessoryPart = db2.prepare("SELECT id, name, quantity, inventoryType FROM accessories WHERE id = ?").get(tpart.part_id);
    const repairPart = accessoryPart ? void 0 : db2.prepare("SELECT id, name, qty FROM repair_parts WHERE id = ?").get(tpart.part_id);
    if (accessoryPart) {
      if (!SPARE_PART_TYPES.includes(accessoryPart.inventoryType)) {
        throw new Error("القطعة المختارة ليست من مخزون قطع الغيار.");
      }
      if (expectedInventoryType && accessoryPart.inventoryType !== expectedInventoryType) {
        throw new Error("يجب اختيار قطعة من مخزون نفس نوع الجهاز الجاري إصلاحه.");
      }
      if (Number(accessoryPart.quantity || 0) < qty) {
        throw new Error(`الكمية المتاحة من ${accessoryPart.name} هي ${accessoryPart.quantity} فقط.`);
      }
    } else if (repairPart && Number(repairPart.qty || 0) < qty) {
      throw new Error(`الكمية المتاحة من ${repairPart.name} هي ${repairPart.qty} فقط.`);
    }
    db2.prepare(`
      INSERT INTO repair_ticket_parts (id, ticket_id, part_id, qty, unit_cost, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tpart.ticket_id,
      tpart.part_id,
      qty,
      tpart.unit_cost || tpart.cost_price || 0,
      tpart.status || "used",
      now,
      now
    );
    if (accessoryPart) {
      db2.prepare("UPDATE accessories SET quantity = MAX(0, quantity - ?) WHERE id = ?").run(qty, tpart.part_id);
    } else if (repairPart) {
      db2.prepare("UPDATE repair_parts SET qty = MAX(0, qty - ?) WHERE id = ?").run(qty, tpart.part_id);
    }
    if (accessoryPart || repairPart) {
      db2.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, 'usage', ?, ?, ?, ?)
    `).run(
        crypto.randomUUID(),
        tpart.part_id,
        tpart.ticket_id,
        qty,
        tpart.unit_cost || 0,
        `استخدام في تذكرة ${tpart.ticket_id}`,
        now
      );
    }
    return db2.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:removeTicketPart", (_, id) => {
    const tpart = db2.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(id);
    if (tpart) {
      const accessoryPart = db2.prepare("SELECT id FROM accessories WHERE id = ?").get(tpart.part_id);
      if (accessoryPart) {
        db2.prepare("UPDATE accessories SET quantity = quantity + ? WHERE id = ?").run(tpart.qty, tpart.part_id);
      } else if (db2.prepare("SELECT id FROM repair_parts WHERE id = ?").get(tpart.part_id)) {
        db2.prepare("UPDATE repair_parts SET qty = qty + ? WHERE id = ?").run(tpart.qty, tpart.part_id);
      }
    }
    return db2.prepare("DELETE FROM repair_ticket_parts WHERE id = ?").run(id).changes > 0;
  });
  electron.ipcMain.handle("db:repairs:getInvoices", (_, ticketId) => {
    if (ticketId) return db2.prepare("SELECT * FROM repair_invoices WHERE ticket_id = ? ORDER BY createdAt DESC").all(ticketId);
    return db2.prepare("SELECT * FROM repair_invoices ORDER BY createdAt DESC").all();
  });
  electron.ipcMain.handle("db:repairs:addInvoice", (_, invoice) => {
    const id = invoice.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const invoiceNo = invoice.invoice_no || `INV-${Date.now()}`;
    db2.prepare(`
      INSERT INTO repair_invoices (id, invoice_no, ticket_id, createdAt, deliveredAt,
        subtotal_labor, subtotal_parts, discount, tax, total, paid_total, remaining,
        payment_summary_json, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      invoiceNo,
      invoice.ticket_id,
      now,
      invoice.deliveredAt || null,
      invoice.subtotal_labor || 0,
      invoice.subtotal_parts || 0,
      invoice.discount || 0,
      invoice.tax || 0,
      invoice.total || 0,
      invoice.paid_total || 0,
      invoice.remaining || 0,
      invoice.payment_summary_json ? JSON.stringify(invoice.payment_summary_json) : null,
      invoice.createdBy || null
    );
    if (Array.isArray(invoice.items)) {
      for (const item of invoice.items) {
        db2.prepare(`
          INSERT INTO repair_invoice_items (id, invoice_id, type, ref_id, name, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          id,
          item.type,
          item.ref_id || null,
          item.name,
          item.qty || 1,
          item.unit_price || 0,
          (item.qty || 1) * (item.unit_price || 0)
        );
      }
    }
    return db2.prepare("SELECT * FROM repair_invoices WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:getPartMovements", (_, partId) => {
    return db2.prepare("SELECT * FROM repair_parts_movements WHERE part_id = ? ORDER BY createdAt DESC").all(partId);
  });
  electron.ipcMain.handle("db:repairs:addPartMovement", (_, movement) => {
    const id = movement.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      movement.part_id,
      movement.ticket_id || null,
      movement.type,
      movement.qty,
      movement.unit_cost || 0,
      movement.note || null,
      now
    );
    const delta = ["purchase", "return", "adjustment_add"].includes(movement.type) ? movement.qty : -movement.qty;
    db2.prepare("UPDATE repair_parts SET qty = MAX(0, qty + ?) WHERE id = ?").run(delta, movement.part_id);
    return db2.prepare("SELECT * FROM repair_parts_movements WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:getAccessoryParts", (_, inventoryType) => {
    const query = `
      SELECT * FROM accessories 
      WHERE inventoryType IN ('mobile_spare_part', 'device_spare_part', 'computer_spare_part')
      ${inventoryType ? "AND inventoryType = ?" : ""}
      AND (isArchived IS NULL OR isArchived = 0)
      ORDER BY name ASC
    `;
    return inventoryType ? db2.prepare(query).all(inventoryType) : db2.prepare(query).all();
  });
  electron.ipcMain.handle("db:repairs:stats", () => {
    const statuses = ["received", "diagnosing", "waiting_parts", "repairing", "ready", "delivered", "cancelled"];
    const result = {};
    for (const s of statuses) {
      const row = db2.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status = ?").get(s);
      result[s] = row.c;
    }
    const overdue = db2.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status NOT IN ('delivered','cancelled')").get();
    result["active"] = overdue.c;
    return result;
  });
}
electron.protocol.registerSchemesAsPrivileged([
  { scheme: "local-img", privileges: { secure: true, standard: true, bypassCSP: true } }
]);
const __filename$1 = url.fileURLToPath(typeof document === "undefined" ? require("url").pathToFileURL(__filename).href : _documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === "SCRIPT" && _documentCurrentScript.src || new URL("main.js", document.baseURI).href);
const __dirname$1 = path.dirname(__filename$1);
let db = null;
let mainWindow = null;
function isDevelopmentMode() {
  return !electron.app.isPackaged;
}
function writeStartupLog(message, error) {
  try {
    const logDir = electron.app.isReady() ? electron.app.getPath("userData") : path.join(process.cwd(), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const logPath = path.join(logDir, "startup.log");
    const details = error instanceof Error ? `${error.stack ?? error.message}` : error ? JSON.stringify(error) : "";
    fs.appendFileSync(logPath, `[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}${details ? `
${details}` : ""}
`);
  } catch (logError) {
    console.error("Failed to write startup log", logError);
  }
}
function resolvePreloadPath() {
  const candidates = ["preload.js", "preload.cjs", "preload.mjs"];
  for (const fileName of candidates) {
    const candidate = path.join(__dirname$1, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(__dirname$1, "preload.js");
}
function resolveWindowIconPath() {
  const candidates = isDevelopmentMode() ? [path.join(__dirname$1, "../public/logo.png")] : [path.join(__dirname$1, "../dist/logo.png"), path.join(process.resourcesPath, "app.asar.unpacked/dist/logo.png")];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return void 0;
}
function createWindow() {
  const preloadPath = resolvePreloadPath();
  const iconPath = resolveWindowIconPath();
  let revealFallbackTimer = null;
  writeStartupLog(`Creating main window with preload at ${preloadPath}`);
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath
    }
  });
  const isDev = isDevelopmentMode();
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    writeStartupLog(`Loading renderer URL ${process.env.VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = path.join(__dirname$1, "../dist/index.html");
    writeStartupLog(`Loading renderer file ${rendererPath}`);
    mainWindow.loadFile(rendererPath);
  }
  mainWindow.once("ready-to-show", () => {
    writeStartupLog("Main window emitted ready-to-show");
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer);
      revealFallbackTimer = null;
    }
    mainWindow == null ? void 0 : mainWindow.show();
    mainWindow == null ? void 0 : mainWindow.focus();
  });
  mainWindow.webContents.on("did-finish-load", () => {
    writeStartupLog("Main window emitted did-finish-load");
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer);
      revealFallbackTimer = null;
    }
    if (!(mainWindow == null ? void 0 : mainWindow.isVisible())) {
      mainWindow == null ? void 0 : mainWindow.show();
      mainWindow == null ? void 0 : mainWindow.focus();
    }
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
    writeStartupLog(`Renderer failed to load (${errorCode}) ${validatedURL ?? "unknown url"}: ${errorDescription}`);
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer);
      revealFallbackTimer = null;
    }
    if (!(mainWindow == null ? void 0 : mainWindow.isVisible())) {
      mainWindow == null ? void 0 : mainWindow.show();
    }
  });
  mainWindow.on("closed", () => {
    writeStartupLog("Main window closed");
    if (revealFallbackTimer) {
      clearTimeout(revealFallbackTimer);
      revealFallbackTimer = null;
    }
    mainWindow = null;
  });
  revealFallbackTimer = setTimeout(() => {
    if (!(mainWindow == null ? void 0 : mainWindow.isVisible())) {
      console.warn("Renderer did not trigger ready-to-show in time, revealing window fallback.");
      writeStartupLog("Renderer did not trigger ready-to-show in time, revealing window fallback");
      mainWindow == null ? void 0 : mainWindow.show();
      mainWindow == null ? void 0 : mainWindow.focus();
    }
  }, 3e3);
  mainWindow.setMenuBarVisibility(false);
}
electron.ipcMain.on("store-get", (event, key) => {
  if (!db) {
    event.returnValue = null;
    return;
  }
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    event.returnValue = row ? JSON.parse(row.value) : null;
  } catch (err) {
    console.error("store-get error:", err);
    event.returnValue = null;
  }
});
electron.ipcMain.on("store-set", (event, key, value) => {
  if (!db) {
    event.returnValue = false;
    return;
  }
  try {
    db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, JSON.stringify(value));
    event.returnValue = true;
  } catch (err) {
    console.error("store-set error:", err);
    event.returnValue = false;
  }
});
electron.ipcMain.on("store-delete", (event, key) => {
  if (!db) {
    event.returnValue = false;
    return;
  }
  try {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    event.returnValue = true;
  } catch (err) {
    console.error("store-delete error:", err);
    event.returnValue = false;
  }
});
electron.app.whenReady().then(() => {
  try {
    writeStartupLog("Electron app is ready");
    db = initializeDatabase();
    writeStartupLog("Database initialized");
    runDataMigration(db);
    writeStartupLog("Data migration completed");
    setupIpcHandlers(db);
    writeStartupLog("IPC handlers registered");
    setupRepairHandlers(db);
    writeStartupLog("Repair handlers registered");
    const userDataPath = electron.app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images");
    electron.protocol.handle("local-img", (request) => {
      const fileName = request.url.slice("local-img://".length).split("?")[0];
      const filePath = path.join(imagesDir, decodeURIComponent(fileName));
      return electron.net.fetch(`file://${filePath}`);
    });
    writeStartupLog("local-img protocol handler registered");
    createWindow();
    electron.app.on("activate", () => {
      if (electron.BrowserWindow.getAllWindows().length === 0) {
        writeStartupLog("App activated with no windows, recreating main window");
        createWindow();
      }
    });
  } catch (error) {
    writeStartupLog("Fatal startup error", error);
    electron.dialog.showErrorBox(
      "تعذر تشغيل البرنامج",
      error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء تشغيل البرنامج."
    );
    electron.app.quit();
  }
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
process.on("uncaughtException", (error) => {
  writeStartupLog("Uncaught exception", error);
  electron.dialog.showErrorBox("خطأ غير متوقع", error.message);
});
process.on("unhandledRejection", (reason) => {
  writeStartupLog("Unhandled rejection", reason);
});
electron.ipcMain.handle("ping", () => "pong");
electron.ipcMain.handle("save-image", async (event, base64Data) => {
  try {
    const userDataPath = electron.app.getPath("userData");
    const imagesDir = path.join(userDataPath, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    const matches = base64Data.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: "Invalid base64 format" };
    }
    const ext = matches[1].split("/")[1] || "png";
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = `img_${Date.now()}.${ext}`;
    const filePath = path.join(imagesDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: `local-img://${fileName}` };
  } catch (error) {
    console.error("Error saving image:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
});
electron.ipcMain.handle("db:backup", async () => {
  try {
    const userDataPath = electron.app.getPath("userData");
    const isDev = isDevelopmentMode();
    const dbFile = path.join(userDataPath, isDev ? "retail_dev.sqlite" : "retail_prod.sqlite");
    const { canceled, filePath: savePath } = await electron.dialog.showSaveDialog({
      title: "حفظ نسخة احتياطية من قاعدة البيانات",
      defaultPath: path.join(electron.app.getPath("downloads"), `backup_${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.sqlite`),
      filters: [{ name: "SQLite Database", extensions: ["sqlite"] }]
    });
    if (canceled || !savePath) return { success: false, reason: "canceled" };
    fs.copyFileSync(dbFile, savePath);
    return { success: true, path: savePath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
});
electron.ipcMain.handle("db:restore", async () => {
  try {
    const { canceled, filePaths } = await electron.dialog.showOpenDialog({
      title: "استعادة قاعدة البيانات من نسخة احتياطية",
      filters: [{ name: "SQLite Database", extensions: ["sqlite"] }],
      properties: ["openFile"]
    });
    if (canceled || !filePaths.length) return { success: false, reason: "canceled" };
    const userDataPath = electron.app.getPath("userData");
    const isDev = isDevelopmentMode();
    const dbFile = path.join(userDataPath, isDev ? "retail_dev.sqlite" : "retail_prod.sqlite");
    const backupPath = dbFile + ".bak";
    if (fs.existsSync(dbFile)) {
      fs.copyFileSync(dbFile, backupPath);
    }
    fs.copyFileSync(filePaths[0], dbFile);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
});
electron.ipcMain.handle("db:getUserDataPath", () => electron.app.getPath("userData"));
