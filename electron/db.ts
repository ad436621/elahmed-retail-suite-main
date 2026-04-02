import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;

  return Boolean(row?.name);
}

function getTableColumns(db: Database.Database, table: string): string[] {
  if (!tableExists(db, table)) {
    return [];
  }

  // Use parameterized query - validate table name against whitelist
  const validTables = new Set([
    'products', 'sales', 'sale_items', 'customers', 'installments',
    'installment_schedules', 'installment_payments', 'wallets',
    'safe_transactions', 'expenses', 'employees', 'employee_salaries',
    'employee_advances', 'suppliers', 'supplier_transactions', 'product_batches',
    'blacklist', 'damaged_items', 'other_revenue', 'reminders',
    'repair_tickets', 'repair_parts', 'used_devices', 'settings', 'inventory_items'
  ]);
  
  // Only allow known table names to prevent SQL injection
  if (!validTables.has(table)) {
    return [];
  }

  return (db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map((column) => column.name);
}

function createIndexIfColumnsExist(
  db: Database.Database,
  indexName: string,
  table: string,
  columns: string[],
) {
  const tableColumns = new Set(getTableColumns(db, table));
  if (!columns.every((column) => tableColumns.has(column))) {
    return;
  }

  db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${columns.join(', ')})`);
}

function ensureSchemaIndexes(db: Database.Database) {
  createIndexIfColumnsExist(db, 'idx_products_barcode', 'products', ['barcode']);
  createIndexIfColumnsExist(db, 'idx_expenses_date', 'expenses', ['date']);
  createIndexIfColumnsExist(db, 'idx_employee_salaries_employee_month', 'employee_salaries', ['employeeId', 'month']);
  createIndexIfColumnsExist(db, 'idx_employee_advances_employee_date', 'employee_advances', ['employeeId', 'date']);
  createIndexIfColumnsExist(db, 'idx_product_batches_productId', 'product_batches', ['productId']);
  createIndexIfColumnsExist(db, 'idx_sale_items_saleId', 'sale_items', ['saleId']);
  createIndexIfColumnsExist(db, 'idx_customers_phone', 'customers', ['phone']);
  createIndexIfColumnsExist(db, 'idx_customers_nationalId', 'customers', ['nationalId']);
  createIndexIfColumnsExist(db, 'idx_blacklist_imei_status', 'blacklist', ['imei', 'status']);
  createIndexIfColumnsExist(db, 'idx_damaged_items_date', 'damaged_items', ['date']);
  createIndexIfColumnsExist(db, 'idx_installments_customerId', 'installments', ['customerId']);
  createIndexIfColumnsExist(db, 'idx_installments_productId', 'installments', ['productId']);
  createIndexIfColumnsExist(db, 'idx_installments_status', 'installments', ['status']);
  createIndexIfColumnsExist(db, 'idx_installments_createdAt', 'installments', ['createdAt']);
  createIndexIfColumnsExist(db, 'idx_installment_schedules_contract_month', 'installment_schedules', ['contractId', 'monthNumber']);
  createIndexIfColumnsExist(db, 'idx_installment_schedules_due_paid', 'installment_schedules', ['dueDate', 'paid']);
  createIndexIfColumnsExist(db, 'idx_installment_payments_contract_date', 'installment_payments', ['contractId', 'date']);
  createIndexIfColumnsExist(db, 'idx_installment_allocations_payment', 'installment_payment_allocations', ['paymentId']);
  createIndexIfColumnsExist(db, 'idx_installment_allocations_schedule', 'installment_payment_allocations', ['scheduleItemId']);
  createIndexIfColumnsExist(db, 'idx_supplier_transactions_supplier_created', 'supplier_transactions', ['supplierId', 'createdAt']);
  createIndexIfColumnsExist(db, 'idx_other_revenue_date', 'other_revenue', ['date']);
  createIndexIfColumnsExist(db, 'idx_reminders_due_status', 'reminders', ['dueDate', 'status', 'completed']);
  createIndexIfColumnsExist(db, 'idx_safe_transactions_wallet_created', 'safe_transactions', ['walletId', 'createdAt']);
  createIndexIfColumnsExist(db, 'idx_repair_tickets_status_created', 'repair_tickets', ['status', 'createdAt']);
  createIndexIfColumnsExist(db, 'idx_used_devices_serial_status', 'used_devices', ['serialNumber', 'status']);
}

export function initializeDatabase() {
  const isDev = !app.isPackaged;
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, isDev ? 'retail_dev.sqlite' : 'retail_prod.sqlite');
  
  console.log(`Initializing SQLite database at: ${dbPath}`);
  
  const db = new Database(dbPath, { 
    verbose: isDev ? console.log : undefined 
  });

  // Enable WAL mode for better concurrency and performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize Schemas
  db.exec(`
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

  ensureSchemaIndexes(db);

  return db;
}
