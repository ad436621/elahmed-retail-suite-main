"use strict";
const electron = require("electron");
const path = require("path");
const url = require("url");
const fs = require("fs");
const Database = require("better-sqlite3");
var _documentCurrentScript = typeof document !== "undefined" ? document.currentScript : null;
function initializeDatabase() {
  const isDev = process.env.NODE_ENV !== "production";
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
  return db2;
}
function getSettingsJson(db2, key) {
  const row = db2.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return null;
  }
}
function tableIsEmpty(db2, table) {
  const row = db2.prepare(`SELECT COUNT(*) as c FROM ${table}`).get();
  return row.c === 0;
}
function runDataMigration(db2) {
  console.log("[migration] Running data migration check...");
  try {
    migratePartners(db2);
    migrateAccessories(db2);
    migrateCustomers(db2);
    migrateSuppliers(db2);
    migrateEmployees(db2);
    migrateExpenses(db2);
    migrateBlacklist(db2);
    migrateDamagedItems(db2);
    migrateOtherRevenue(db2);
    migrateWallets(db2);
    migrateUsedDevices(db2);
    migrateReminders(db2);
    migrateRepairs(db2);
    migrateRepairParts(db2);
    console.log("[migration] All migrations complete.");
  } catch (err) {
    console.error("[migration] Error:", err);
  }
}
function migratePartners(db2) {
  if (!tableIsEmpty(db2, "partners")) return;
  const data = getSettingsJson(db2, "gx_partners");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
        INSERT OR IGNORE INTO partners (id, name, phone, address, partnershipType, sharePercent, 
            profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const p of data) {
      stmt.run(
        p.id,
        p.name,
        p.phone || null,
        p.address || null,
        p.partnershipType || "other",
        p.sharePercent || 0,
        p.profitShareDevices || 0,
        p.profitShareAccessories || 0,
        p.capitalAmount || 0,
        p.active ? 1 : 0,
        p.notes || null,
        p.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        p.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Partners: ${data.length} records migrated.`);
}
function migrateAccessories(db2) {
  if (!tableIsEmpty(db2, "accessories")) return;
  const keysToMigrate = [
    { key: "gx_mobile_accessories", type: "mobile_accessory" },
    { key: "gx_mobile_spare_parts", type: "mobile_spare_part" },
    { key: "gx_computer_accessories_sa", type: "computer_accessory" },
    { key: "gx_computer_spare_parts", type: "computer_spare_part" },
    { key: "gx_device_accessories_sa", type: "device_accessory" },
    { key: "gx_device_spare_parts", type: "device_spare_part" }
  ];
  const stmt = db2.prepare(`
        INSERT OR IGNORE INTO accessories (id, inventoryType, name, category, subcategory, model, 
            barcode, quantity, costPrice, salePrice, minStock, condition, supplier, color, notes, image, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const km of keysToMigrate) {
      const items = getSettingsJson(db2, km.key);
      if (!(items == null ? void 0 : items.length)) continue;
      for (const item of items) {
        stmt.run(
          item.id,
          km.type,
          item.name,
          item.category || null,
          null,
          item.model || null,
          item.barcode || null,
          item.quantity || 0,
          item.newCostPrice || item.costPrice || item.oldCostPrice || 0,
          item.salePrice || 0,
          item.minStock || 0,
          item.condition || "new",
          item.supplier || null,
          item.color || null,
          item.notes || null,
          item.image || null,
          item.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
          item.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
        );
      }
      console.log(`[migration] Accessories (${km.type}): migrated ${items.length} records.`);
    }
  })();
}
function migrateCustomers(db2) {
  if (!tableIsEmpty(db2, "customers")) return;
  const data = getSettingsJson(db2, "gx_customers") || getSettingsJson(db2, "retail_customers");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
        INSERT OR IGNORE INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT OR IGNORE INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT OR IGNORE INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const e of data) {
      stmt.run(
        e.id,
        e.name,
        e.phone || null,
        e.role || null,
        e.salary || 0,
        e.commissionRate || 0,
        e.hireDate || null,
        e.active ?? 1,
        e.notes || null,
        e.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
        e.updatedAt || (/* @__PURE__ */ new Date()).toISOString()
      );
    }
  })();
  console.log(`[migration] Employees: ${data.length} records migrated.`);
}
function migrateExpenses(db2) {
  if (!tableIsEmpty(db2, "expenses")) return;
  const data = getSettingsJson(db2, "gx_expenses") || getSettingsJson(db2, "retail_expenses");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
        INSERT OR IGNORE INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        INSERT OR IGNORE INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const b of data) {
      stmt.run(
        b.id,
        b.name,
        b.phone || null,
        b.nationalId || null,
        b.reason,
        b.notes || null,
        b.addedBy || null,
        b.createdAt || (/* @__PURE__ */ new Date()).toISOString()
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
        INSERT OR IGNORE INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const d of data) {
      stmt.run(
        d.id,
        d.productName || d.name,
        d.productId || null,
        d.inventoryType || null,
        d.quantity || 1,
        d.reason || null,
        d.estimatedLoss || d.value || 0,
        d.reportedBy || null,
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
        INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const r of data) {
      stmt.run(
        r.id,
        r.source || r.category,
        r.description || null,
        r.amount,
        r.date,
        r.paymentMethod || "cash",
        r.notes || null,
        r.createdAt || (/* @__PURE__ */ new Date()).toISOString()
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
        INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, color, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const w of data) {
      stmt.run(
        w.id,
        w.name,
        w.type || "cash",
        w.balance || 0,
        w.isDefault ? 1 : 0,
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
  const data = getSettingsJson(db2, "gx_used_inventory") || getSettingsJson(db2, "retail_used_inventory");
  if (!(data == null ? void 0 : data.length)) return;
  const stmt = db2.prepare(`
        INSERT OR IGNORE INTO used_devices (id, name, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const u of data) {
      stmt.run(
        u.id,
        u.name,
        u.category || null,
        u.condition || "good",
        u.purchasePrice || u.buyPrice || 0,
        u.sellingPrice || u.salePrice || 0,
        u.status || "in_stock",
        u.serialNumber || null,
        u.color || null,
        u.storage || null,
        u.notes || null,
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
        INSERT OR IGNORE INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const r of data) {
      stmt.run(
        r.id,
        r.title,
        r.description || null,
        r.dueDate,
        r.priority || "medium",
        r.completed ? 1 : 0,
        r.completedAt || null,
        r.recurring || null,
        r.category || null,
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
            issue_description, status, package_price, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  db2.transaction(() => {
    for (const r of data) {
      const status = ["received", "diagnosing", "repairing", "ready", "delivered", "cancelled"].includes(r.status) ? r.status : r.status === "done" ? "delivered" : r.status === "in_progress" ? "repairing" : "received";
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
function setupIpcHandlers(db2) {
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
    db2.prepare(`INSERT INTO wallets (id, name, type, balance, isDefault, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, w.name, w.type || "cash", w.balance || 0, w.isDefault ? 1 : 0, w.color, w.notes, w.createdAt || now, now);
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
  electron.ipcMain.handle("db:wallets:delete", (_, id) => db2.prepare("DELETE FROM wallets WHERE id = ?").run(id).changes > 0);
  electron.ipcMain.handle("db:used_devices:get", () => db2.prepare("SELECT * FROM used_devices ORDER BY createdAt DESC").all());
  electron.ipcMain.handle("db:used_devices:add", (_, d) => {
    const id = d.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`INSERT INTO used_devices (id, name, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, d.name, d.category, d.condition || "good", d.purchasePrice || 0, d.sellingPrice || 0, d.status || "in_stock", d.serialNumber, d.color, d.storage, d.notes, d.image, d.soldAt, d.purchasedFrom, d.soldTo, d.createdAt || now, now);
    return db2.prepare("SELECT * FROM used_devices WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:used_devices:update", (_, id, data) => {
    const { sets, values } = buildUpdateSql(data);
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
}
function setupRepairHandlers(db2) {
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
        status, package_price, warranty_days,
        assigned_tech_name, tech_bonus_type, tech_bonus_value,
        createdAt, createdBy, updatedAt, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      ticketNo,
      ticket.client_id || ticket.customerId || null,
      ticket.customer_name,
      ticket.customer_phone || null,
      ticket.device_category,
      ticket.device_brand || ticket.deviceBrand || null,
      ticket.device_model || ticket.deviceModel || null,
      ticket.imei_or_serial || ticket.serial || null,
      ticket.issue_description || ticket.problemDesc || "",
      ticket.accessories_received || ticket.accessories || null,
      ticket.device_passcode || ticket.password || null,
      ticket.status || "received",
      ticket.package_price || ticket.expectedCost || null,
      ticket.warranty_days || null,
      ticket.assigned_tech_name || ticket.techName || null,
      ticket.tech_bonus_type || null,
      ticket.tech_bonus_value || null,
      ticket.createdAt || now,
      ticket.createdBy || null,
      now,
      ticket.updatedBy || null
    );
    return db2.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:updateTicket", (_, id, data) => {
    const EXCLUDED = ["id", "createdAt", "createdBy", "ticket_no"];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(data)) {
      if (!EXCLUDED.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
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
      SELECT tp.*, rp.name as partName FROM repair_ticket_parts tp
      LEFT JOIN repair_parts rp ON tp.part_id = rp.id
      WHERE tp.ticket_id = ?
    `).all(ticketId);
  });
  electron.ipcMain.handle("db:repairs:addTicketPart", (_, tpart) => {
    const id = tpart.id || crypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db2.prepare(`
      INSERT INTO repair_ticket_parts (id, ticket_id, part_id, qty, unit_cost, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tpart.ticket_id,
      tpart.part_id,
      tpart.qty || tpart.quantity || 1,
      tpart.unit_cost || tpart.cost_price || 0,
      tpart.status || "used",
      now,
      now
    );
    db2.prepare("UPDATE repair_parts SET qty = MAX(0, qty - ?) WHERE id = ?").run(
      tpart.qty || tpart.quantity || 1,
      tpart.part_id
    );
    db2.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, 'usage', ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      tpart.part_id,
      tpart.ticket_id,
      tpart.qty || 1,
      tpart.unit_cost || 0,
      `استخدام في تذكرة ${tpart.ticket_id}`,
      now
    );
    return db2.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(id);
  });
  electron.ipcMain.handle("db:repairs:removeTicketPart", (_, id) => {
    const tpart = db2.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(id);
    if (tpart) {
      db2.prepare("UPDATE repair_parts SET qty = qty + ? WHERE id = ?").run(tpart.qty, tpart.part_id);
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
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname$1, "../public/logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname$1, "preload.cjs")
    }
  });
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
    mainWindow.webContents.openDevTools();
  }
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
  db = initializeDatabase();
  runDataMigration(db);
  setupIpcHandlers(db);
  setupRepairHandlers(db);
  const userDataPath = electron.app.getPath("userData");
  const imagesDir = path.join(userDataPath, "images");
  electron.protocol.handle("local-img", (request) => {
    const fileName = request.url.slice("local-img://".length).split("?")[0];
    const filePath = path.join(imagesDir, decodeURIComponent(fileName));
    return electron.net.fetch(`file://${filePath}`);
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
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
    const isDev = process.env.NODE_ENV !== "production";
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
    const isDev = process.env.NODE_ENV !== "production";
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
