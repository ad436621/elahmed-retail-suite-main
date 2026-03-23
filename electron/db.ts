import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export function initializeDatabase() {
  const isDev = process.env.NODE_ENV !== 'production';
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
      passwordHash TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      inventoryType TEXT NOT NULL
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
      quantity INTEGER DEFAULT 0,
      oldCostPrice REAL DEFAULT 0,
      newCostPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      supplier TEXT,
      source TEXT, -- 'mobile', 'computer', 'used', etc.
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
      updatedAt TEXT,
      FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE
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
      batches TEXT, -- JSON array of batch deductions
      FOREIGN KEY (saleId) REFERENCES sales(id) ON DELETE CASCADE
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
      customerId TEXT,
      customerName TEXT NOT NULL,
      customerPhone TEXT,
      customerAddress TEXT,
      customerNationalId TEXT,
      guarantorName TEXT,
      guarantorPhone TEXT,
      guarantorAddress TEXT,
      productId TEXT,
      productName TEXT NOT NULL,
      totalAmount REAL NOT NULL,
      downPayment REAL NOT NULL,
      remainingAmount REAL NOT NULL,
      months INTEGER NOT NULL,
      monthlyPayment REAL NOT NULL,
      firstInstallmentDate TEXT,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL, -- 'active', 'completed', 'defaulted'
      notes TEXT,
      settledEarly INTEGER DEFAULT 0,
      settlementDiscount REAL DEFAULT 0,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS installment_schedules (
      id TEXT PRIMARY KEY,
      contractId TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      amount REAL NOT NULL,
      paidAmount REAL DEFAULT 0,
      penalty REAL DEFAULT 0,
      paid INTEGER DEFAULT 0,
      paymentDate TEXT,
      FOREIGN KEY (contractId) REFERENCES installments(id) ON DELETE CASCADE
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
      costPrice REAL DEFAULT 0,
      salePrice REAL DEFAULT 0,
      minStock INTEGER DEFAULT 0,
      condition TEXT DEFAULT 'new',
      supplier TEXT,
      color TEXT,
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
      createdAt TEXT
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
      month TEXT NOT NULL,
      baseSalary REAL NOT NULL,
      commission REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      deductions REAL DEFAULT 0,
      netSalary REAL NOT NULL,
      paid INTEGER DEFAULT 0,
      paidAt TEXT,
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

    -- ==========================================
    -- REMINDERS
    -- ==========================================

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      dueDate TEXT NOT NULL,
      priority TEXT DEFAULT 'medium',
      completed INTEGER DEFAULT 0,
      completedAt TEXT,
      recurring TEXT,
      category TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- BLACKLIST
    -- ==========================================

    CREATE TABLE IF NOT EXISTS blacklist (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      nationalId TEXT,
      reason TEXT NOT NULL,
      notes TEXT,
      addedBy TEXT,
      createdAt TEXT
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
      notes TEXT,
      createdAt TEXT
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
      color TEXT,
      notes TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    -- ==========================================
    -- USED DEVICES
    -- ==========================================

    CREATE TABLE IF NOT EXISTS used_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      condition TEXT DEFAULT 'good',
      purchasePrice REAL DEFAULT 0,
      sellingPrice REAL DEFAULT 0,
      status TEXT DEFAULT 'in_stock',
      serialNumber TEXT,
      color TEXT,
      storage TEXT,
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

  return db;
}
