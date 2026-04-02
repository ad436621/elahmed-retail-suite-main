"use strict";const c=require("electron"),F=require("path"),pe=require("url"),H=require("fs"),Te=require("better-sqlite3");var j=typeof document<"u"?document.currentScript:null;function me(e,a){const t=e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(a);return!!(t!=null&&t.name)}function Ae(e,a){return me(e,a)?new Set(["products","sales","sale_items","customers","installments","installment_schedules","installment_payments","wallets","safe_transactions","expenses","employees","employee_salaries","employee_advances","suppliers","supplier_transactions","product_batches","blacklist","damaged_items","other_revenue","reminders","repair_tickets","repair_parts","used_devices","settings","inventory_items"]).has(a)?e.prepare(`PRAGMA table_info("${a}")`).all().map(r=>r.name):[]:[]}function g(e,a,t,r){const n=new Set(Ae(e,t));r.every(s=>n.has(s))&&e.exec(`CREATE INDEX IF NOT EXISTS ${a} ON ${t}(${r.join(", ")})`)}function Se(e){g(e,"idx_products_barcode","products",["barcode"]),g(e,"idx_expenses_date","expenses",["date"]),g(e,"idx_employee_salaries_employee_month","employee_salaries",["employeeId","month"]),g(e,"idx_employee_advances_employee_date","employee_advances",["employeeId","date"]),g(e,"idx_product_batches_productId","product_batches",["productId"]),g(e,"idx_sale_items_saleId","sale_items",["saleId"]),g(e,"idx_customers_phone","customers",["phone"]),g(e,"idx_customers_nationalId","customers",["nationalId"]),g(e,"idx_blacklist_imei_status","blacklist",["imei","status"]),g(e,"idx_damaged_items_date","damaged_items",["date"]),g(e,"idx_installments_customerId","installments",["customerId"]),g(e,"idx_installments_productId","installments",["productId"]),g(e,"idx_installments_status","installments",["status"]),g(e,"idx_installments_createdAt","installments",["createdAt"]),g(e,"idx_installment_schedules_contract_month","installment_schedules",["contractId","monthNumber"]),g(e,"idx_installment_schedules_due_paid","installment_schedules",["dueDate","paid"]),g(e,"idx_installment_payments_contract_date","installment_payments",["contractId","date"]),g(e,"idx_installment_allocations_payment","installment_payment_allocations",["paymentId"]),g(e,"idx_installment_allocations_schedule","installment_payment_allocations",["scheduleItemId"]),g(e,"idx_supplier_transactions_supplier_created","supplier_transactions",["supplierId","createdAt"]),g(e,"idx_other_revenue_date","other_revenue",["date"]),g(e,"idx_reminders_due_status","reminders",["dueDate","status","completed"]),g(e,"idx_safe_transactions_wallet_created","safe_transactions",["walletId","createdAt"]),g(e,"idx_repair_tickets_status_created","repair_tickets",["status","createdAt"]),g(e,"idx_used_devices_serial_status","used_devices",["serialNumber","status"])}function Ne(){const e=!c.app.isPackaged,a=c.app.getPath("userData"),t=F.join(a,e?"retail_dev.sqlite":"retail_prod.sqlite");console.log(`Initializing SQLite database at: ${t}`);const r=new Te(t,{verbose:e?console.log:void 0});return r.pragma("journal_mode = WAL"),r.pragma("foreign_keys = ON"),r.exec(`
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

  `),Se(r),r}function _(e,a=0){const t=Number(e);return Number.isFinite(t)?Math.round(Math.max(0,t)*100)/100:a}function q(e,a=0,t=0){const r=Number(e);return Number.isFinite(r)?Math.max(t,Math.round(r)):Math.max(t,a)}function D(e,a=""){return typeof e=="string"?e:a}function f(e){const a=D(e).trim();return a||null}function ee(e){return e?1:0}function ie(e){return e==="completed"||e==="overdue"||e==="cancelled"?e:"active"}function Le(e){if(Array.isArray(e))return e;if(typeof e!="string"||!e.trim())return[];try{const a=JSON.parse(e);return Array.isArray(a)?a:[]}catch{return[]}}function Ie(e){return!Array.isArray(e)||e.length===0?null:JSON.stringify(e)}function Re(e,a){const t=f(a.customerId);if(t){const T=e.prepare("SELECT id FROM customers WHERE id = ?").get(t);if(T)return T.id}const r=D(a.customerName).trim();if(!r)return null;const n=f(a.customerPhone),s=f(a.customerAddress),o=f(a.customerIdCard),d=n?e.prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1").get(n):void 0;if(d)return e.prepare(`
      UPDATE customers
      SET name = ?, address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(r,s,o,new Date().toISOString(),d.id),d.id;const E=e.prepare("SELECT id FROM customers WHERE name = ? LIMIT 1").get(r);if(E)return e.prepare(`
      UPDATE customers
      SET phone = COALESCE(?, phone), address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(n,s,o,new Date().toISOString(),E.id),E.id;const m=t||crypto.randomUUID(),S=new Date().toISOString();return e.prepare(`
    INSERT INTO customers (id, name, phone, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(m,r,n,s,o,"Auto-created from installment contract",S,S),m}function ye(e,a){const t=f(a.productId);if(!t)return null;const r=e.prepare("SELECT id FROM products WHERE id = ?").get(t);if(r)return r.id;const n=new Date().toISOString();return e.prepare(`
    INSERT INTO products (
      id, name, barcode, category, condition, quantity,
      oldCostPrice, newCostPrice, salePrice, supplier, source,
      notes, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?, ?, NULL)
  `).run(t,D(a.productName,"Installment Product"),t,f(a.contractType)||"installment","new",_(a.installmentPrice),"installment_snapshot","Auto-created from installment contract",n,n),t}function _e(e){const a=e.prepare(`
    SELECT id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    FROM installment_schedules
    ORDER BY contractId ASC, monthNumber ASC, dueDate ASC
  `).all(),t=new Map;for(const r of a){const n=t.get(r.contractId)||[];n.push({id:r.id,month:r.monthNumber,dueDate:r.dueDate,amount:_(r.amount),paidAmount:_(r.paidAmount),penalty:_(r.penalty),paid:!!r.paid,remainingAfter:r.remainingAfter===null?void 0:_(r.remainingAfter),note:r.note||""}),t.set(r.contractId,n)}return t}function ge(e){const a=e.prepare(`
    SELECT paymentId, scheduleItemId, amount
    FROM installment_payment_allocations
    ORDER BY paymentId ASC
  `).all(),t=new Map;for(const s of a){const o=t.get(s.paymentId)||[];o.push({scheduleItemId:s.scheduleItemId,amount:_(s.amount)}),t.set(s.paymentId,o)}const r=e.prepare(`
    SELECT id, contractId, amount, date, note, createdAt
    FROM installment_payments
    ORDER BY contractId ASC, date ASC, createdAt ASC
  `).all(),n=new Map;for(const s of r){const o=n.get(s.contractId)||[];o.push({id:s.id,amount:_(s.amount),date:s.date,note:s.note||"",allocations:t.get(s.id)||[]}),n.set(s.contractId,o)}return n}function oe(e){const a=_e(e),t=ge(e);return e.prepare(`
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
  `).all().map(n=>({id:n.id,contractNumber:n.contractNumber,contractType:n.contractType||"product",customerId:n.customerId||void 0,customerName:n.customerName,customerIdCard:n.customerIdCard||"",guarantorName:n.guarantorName||"",guarantorIdCard:n.guarantorIdCard||"",guarantorPhone:n.guarantorPhone||"",guarantorAddress:n.guarantorAddress||"",customerPhone:n.customerPhone||"",customerAddress:n.customerAddress||"",productName:n.productName,productId:n.productId||void 0,transferType:n.transferType||void 0,cashPrice:_(n.cashPrice),installmentPrice:_(n.installmentPrice),downPayment:_(n.downPayment),months:q(n.months,1,1),monthlyInstallment:_(n.monthlyInstallment),firstInstallmentDate:D(n.firstInstallmentDate),schedule:a.get(D(n.id))||[],payments:t.get(D(n.id))||[],paidTotal:_(n.paidTotal),remaining:_(n.remaining),notes:n.notes||"",customFields:Le(n.customFieldsJson),status:ie(n.status),settledEarly:!!n.settledEarly,settlementDiscount:_(n.settlementDiscount),createdAt:D(n.createdAt,new Date().toISOString()),updatedAt:D(n.updatedAt,D(n.createdAt,new Date().toISOString()))}))}function ce(e,a){const t=e.prepare(`
    INSERT INTO installments (
      id, contractNumber, contractType, customerId, customerName, customerPhone, customerAddress,
      customerIdCard, guarantorName, guarantorIdCard, guarantorPhone, guarantorAddress,
      productId, productName, transferType, cashPrice, installmentPrice, downPayment,
      months, monthlyInstallment, paidTotal, remaining, firstInstallmentDate, notes,
      customFieldsJson, status, settledEarly, settlementDiscount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),r=e.prepare(`
    INSERT INTO installment_schedules (
      id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=e.prepare(`
    INSERT INTO installment_payments (id, contractId, amount, date, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `),s=e.prepare(`
    INSERT INTO installment_payment_allocations (id, paymentId, scheduleItemId, amount)
    VALUES (?, ?, ?, ?)
  `),o=new Date().toISOString();return e.transaction(d=>{e.prepare("DELETE FROM installment_payment_allocations").run(),e.prepare("DELETE FROM installment_payments").run(),e.prepare("DELETE FROM installment_schedules").run(),e.prepare("DELETE FROM installments").run();for(const E of d){const m=D(E.id,crypto.randomUUID()),S=Re(e,E),T=ye(e,E),C=Array.isArray(E.schedule)?E.schedule:[],w=Array.isArray(E.payments)?E.payments:[],h=D(E.createdAt,o),U=D(E.updatedAt,h);t.run(m,D(E.contractNumber,`INS-${Date.now()}`),D(E.contractType,"product"),S,D(E.customerName),f(E.customerPhone),f(E.customerAddress),f(E.customerIdCard),f(E.guarantorName),f(E.guarantorIdCard),f(E.guarantorPhone),f(E.guarantorAddress),T,D(E.productName),f(E.transferType),_(E.cashPrice),_(E.installmentPrice),_(E.downPayment),q(E.months,C.length||1,1),_(E.monthlyInstallment),_(E.paidTotal),_(E.remaining),f(E.firstInstallmentDate),f(E.notes),Ie(E.customFields),ie(E.status),ee(E.settledEarly),_(E.settlementDiscount),h,U),C.slice().sort((I,v)=>q(I.month,0,0)-q(v.month,0,0)||D(I.dueDate).localeCompare(D(v.dueDate))).forEach((I,v)=>{const B=D(I.id,crypto.randomUUID());r.run(B,m,q(I.month,v+1,1),D(I.dueDate),_(I.amount),_(I.paidAmount),_(I.penalty),ee(I.paid),I.remainingAfter===void 0?null:_(I.remainingAfter),f(I.note))});for(const I of w){const v=D(I.id,crypto.randomUUID());n.run(v,m,_(I.amount),D(I.date,h.slice(0,10)),f(I.note),h);const B=Array.isArray(I.allocations)?I.allocations:[];for(const k of B){const R=f(k.scheduleItemId);R&&s.run(crypto.randomUUID(),v,R,_(k.amount))}}}})(a),oe(e)}function A(e,a){const t=e.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!t)return null;try{const r=JSON.parse(t.value);return Array.isArray(r)?r:null}catch{return null}}function N(e,a){const t=e.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(a);return!!(t!=null&&t.name)}function y(e,a){return N(e,a)?e.prepare(`SELECT COUNT(*) as c FROM ${a}`).get().c===0:!0}function Ee(e,a){return N(e,a)?e.prepare(`PRAGMA table_info(${a})`).all().map(t=>t.name):[]}function W(e,a,t){const r=new Set(Ee(e,a));return t.every(n=>r.has(n))}function l(e,a,t,r){!N(e,a)||new Set(Ee(e,a)).has(t)||e.exec(`ALTER TABLE ${a} ADD COLUMN ${t} ${r}`)}function i(...e){for(const a of e)if(typeof a=="string"&&a.trim())return a;return""}function u(...e){for(const a of e){const t=Number(a);if(Number.isFinite(t))return Math.round(Math.max(0,t)*100)/100}return 0}function P(e){return!!e}function K(e){if(Array.isArray(e))return e;if(typeof e!="string"||!e.trim())return[];try{const a=JSON.parse(e);return Array.isArray(a)?a:[]}catch{return[]}}function de(e,a){if(typeof e!="string")return 0;const t=new RegExp(`^${a}-(\\d+)$`).exec(e.trim());if(!t)return 0;const r=Number.parseInt(t[1],10);return Number.isFinite(r)?r:0}function Oe(e,a){return a<=0?"confirmed":a>=e?"paid":"partial"}const te=["dashboard","pos","sales","inventory","mobiles","computers","devices","used","cars","warehouse","maintenance","installments","expenses","damaged","otherRevenue","returns","settings","users","customers","wallets","employees","suppliers","blacklist","reminders","shiftClosing","purchaseInvoices"];function he(e){e.exec(`
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
  `)}function Ce(e){const a=new Map,t=[A(e,"gx_wallets"),A(e,"retail_wallets")];for(const r of t)for(const n of r||[]){const s=i(n.id);s&&a.set(s,n)}return a}function De(e,a,t){if(!t||e.prepare("SELECT id FROM wallets WHERE id = ?").get(t))return;const n=a.get(t),s=new Date().toISOString(),o=i(n==null?void 0:n.type,"cash"),d=i(n==null?void 0:n.icon,o==="bank"?"🏦":o==="card"?"💳":o==="transfer"?"📲":"💵"),E=t==="wallet_cash"?"الصندوق":`Wallet ${t.slice(0,8)}`;e.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(t,i(n==null?void 0:n.name,E),o,P(n==null?void 0:n.isDefault)?1:0,d||null,i(n==null?void 0:n.color)||null,i(n==null?void 0:n.notes,"Auto-created to repair wallet references"),i(n==null?void 0:n.createdAt,s),i(n==null?void 0:n.updatedAt,s))}function Ue(e){e.exec(`
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
  `)}function fe(e){if(!N(e,"installments"))return[];const a=e.prepare("SELECT * FROM installments").all();if(a.length===0)return[];const t=N(e,"installment_schedules")?e.prepare("SELECT * FROM installment_schedules").all():[],r=N(e,"installment_payments")?e.prepare("SELECT * FROM installment_payments").all():[],n=N(e,"installment_payment_allocations")?e.prepare("SELECT * FROM installment_payment_allocations").all():[],s=new Map;for(const E of t){const m=i(E.contractId);if(!m)continue;const S=s.get(m)||[];S.push(E),s.set(m,S)}const o=new Map;for(const E of n){const m=i(E.paymentId);if(!m)continue;const S=o.get(m)||[];S.push(E),o.set(m,S)}const d=new Map;for(const E of r){const m=i(E.contractId);if(!m)continue;const S=d.get(m)||[];S.push(E),d.set(m,S)}return a.map(E=>{var k;const m=i(E.id,crypto.randomUUID()),S=(s.get(m)||[]).slice().sort((R,X)=>u(R.monthNumber)-u(X.monthNumber)||i(R.dueDate).localeCompare(i(X.dueDate))),T=S.map((R,X)=>{const G=u(R.amount),Q=u(R.penalty),z=u(R.paidAmount),Z=G+Q;return{id:i(R.id,crypto.randomUUID()),month:Math.max(1,Math.round(u(R.monthNumber,X+1))),dueDate:i(R.dueDate),amount:G,paidAmount:z,penalty:Q,paid:P(R.paid)||Z>0&&z>=Z,remainingAfter:R.remainingAfter===void 0||R.remainingAfter===null?void 0:u(R.remainingAfter),note:i(R.note)}}),C=d.get(m)||[],w=C.length>0?C.slice().sort((R,X)=>i(R.date).localeCompare(i(X.date))||i(R.createdAt).localeCompare(i(X.createdAt))).map(R=>({id:i(R.id,crypto.randomUUID()),amount:u(R.amount),date:i(R.date),note:i(R.note),allocations:(o.get(i(R.id))||[]).map(X=>({scheduleItemId:i(X.scheduleItemId),amount:u(X.amount)}))})):T.filter(R=>u(R.paidAmount)>0).map(R=>{var X;return{id:`legacy-payment-${i(R.id,crypto.randomUUID())}`,amount:u(R.paidAmount),date:i((X=S.find(G=>i(G.id)===i(R.id)))==null?void 0:X.paymentDate,R.dueDate,i(E.createdAt).slice(0,10)),note:"Migrated from legacy schedule data",allocations:[{scheduleItemId:i(R.id),amount:u(R.paidAmount)}]}}),h=T.reduce((R,X)=>R+u(X.amount)+u(X.penalty),0),U=w.reduce((R,X)=>R+u(X.amount),0),I=u(E.downPayment),v=i(E.createdAt,new Date().toISOString()),B=E.remaining!==void 0||E.remainingAmount!==void 0?u(E.remaining,E.remainingAmount):Math.max(0,Math.round((h-U)*100)/100);return{id:m,contractNumber:i(E.contractNumber,`INS-${Date.now()}`),contractType:i(E.contractType,"product"),customerId:i(E.customerId)||void 0,customerName:i(E.customerName),customerPhone:i(E.customerPhone),customerAddress:i(E.customerAddress),customerIdCard:i(E.customerIdCard,E.customerNationalId),guarantorName:i(E.guarantorName),guarantorIdCard:i(E.guarantorIdCard),guarantorPhone:i(E.guarantorPhone),guarantorAddress:i(E.guarantorAddress),productId:i(E.productId)||void 0,productName:i(E.productName),transferType:i(E.transferType)||void 0,cashPrice:u(E.cashPrice,E.totalAmount),installmentPrice:u(E.installmentPrice,E.totalAmount),downPayment:I,months:Math.max(1,Math.round(u(E.months,T.length||1))),monthlyInstallment:u(E.monthlyInstallment,E.monthlyPayment,T.length>0?h/T.length:0),paidTotal:E.paidTotal!==void 0?u(E.paidTotal):Math.round((I+U)*100)/100,remaining:B,firstInstallmentDate:i(E.firstInstallmentDate,E.startDate,(k=T[0])==null?void 0:k.dueDate),schedule:T,payments:w,notes:i(E.notes),customFields:K(E.customFieldsJson),status:i(E.status,B===0?"completed":"active"),settledEarly:P(E.settledEarly),settlementDiscount:u(E.settlementDiscount),createdAt:v,updatedAt:i(E.updatedAt,v)}})}function Xe(e){return!!(!W(e,"installments",["id","contractNumber"])||!W(e,"installments",["contractType","customerIdCard","guarantorIdCard","transferType","cashPrice","installmentPrice","paidTotal","remaining","customFieldsJson","updatedAt"])||W(e,"installments",["totalAmount","remainingAmount","monthlyPayment","startDate","customerNationalId"])||!W(e,"installment_schedules",["id","contractId","monthNumber","dueDate","amount","paidAmount","penalty","paid","remainingAfter","note"])||!W(e,"installment_payments",["id","contractId","amount","date","createdAt"])||!W(e,"installment_payment_allocations",["id","paymentId","scheduleItemId","amount"]))}function Me(e){const a=fe(e);return Xe(e)&&(e.transaction(()=>{e.prepare("DROP TABLE IF EXISTS installment_payment_allocations").run(),e.prepare("DROP TABLE IF EXISTS installment_payments").run(),e.prepare("DROP TABLE IF EXISTS installment_schedules").run(),e.prepare("DROP TABLE IF EXISTS installments").run(),he(e)})(),console.log("[migration] Installments schema repaired.")),a}function Fe(e,a){if(!N(e,"installments")||!y(e,"installments"))return;const r=[{label:"settings",data:A(e,"gx_installments_v2")||[]},{label:"legacy tables",data:a}];for(const n of r)if(n.data.length)try{ce(e,n.data),console.log(`[migration] Installments: ${n.data.length} contracts migrated from ${n.label}.`);return}catch(s){console.error(`[migration] Installments migration from ${n.label} failed:`,s)}}function ve(e){return W(e,"safe_transactions",["id","walletId","type","amount","createdAt"])?!(N(e,"safe_transactions")?e.prepare("PRAGMA foreign_key_list(safe_transactions)").all():[]).some(t=>t.from==="walletId"&&t.table==="wallets"):!0}function Pe(e){const a=N(e,"safe_transactions")?e.prepare("SELECT * FROM safe_transactions").all():[],t=Ce(e),r=ve(e);r&&(e.transaction(()=>{e.prepare("DROP TABLE IF EXISTS safe_transactions").run(),Ue(e)})(),console.log("[migration] Safe transactions schema repaired."));const n=[...new Set(a.map(o=>i(o.walletId)).filter(Boolean))];for(const o of n)De(e,t,o);if(!r||a.length===0||!y(e,"safe_transactions"))return;const s=e.prepare(`
    INSERT OR IGNORE INTO safe_transactions (
      id, walletId, type, subType, amount, category, description, paymentMethod,
      affectsCapital, affectsProfit, createdBy, relatedId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const o of a)s.run(i(o.id,crypto.randomUUID()),i(o.walletId),i(o.type),i(o.subType)||null,u(o.amount),i(o.category)||null,i(o.description)||null,i(o.paymentMethod)||null,P(o.affectsCapital)?1:0,P(o.affectsProfit)?1:0,i(o.createdBy)||null,i(o.relatedId)||null,i(o.createdAt,new Date().toISOString()))})()}function le(e,a,t){const r=i(t);if(r)return r;const n=i(e,"mobile"),s=i(a,"device");return`${n}_${s}`}function we(e){if(!W(e,"categories",["id","name","inventoryType"]))return!0;const a=e.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get(),t=String((a==null?void 0:a.sql)??"").toLowerCase().replace(/\s+/g," ");return t.includes("name text unique")||!t.includes("unique(name, inventorytype)")}function ue(e){if(!N(e,"categories")||!we(e))return;const a=e.prepare("SELECT * FROM categories").all(),t=new Map;for(const r of a){const n=i(r.name),s=le(r.section,r.type,r.inventoryType);if(!n||!s)continue;const o=`${s}::${n.toLowerCase()}`;t.has(o)||t.set(o,{id:i(r.id,crypto.randomUUID()),name:n,inventoryType:s})}e.transaction(()=>{e.prepare("DROP TABLE IF EXISTS categories").run(),e.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        inventoryType TEXT NOT NULL,
        UNIQUE(name, inventoryType)
      );
    `);const r=e.prepare(`
      INSERT OR IGNORE INTO categories (id, name, inventoryType)
      VALUES (?, ?, ?)
    `);for(const n of t.values())r.run(n.id,n.name,n.inventoryType)})(),console.log("[migration] Categories schema repaired.")}function He(e){return W(e,"product_batches",["id","productId","inventoryType","productName","costPrice","salePrice","quantity","remainingQty","purchaseDate","supplier","notes","createdAt","updatedAt"])?(N(e,"product_batches")?e.prepare("PRAGMA foreign_key_list(product_batches)").all():[]).some(t=>t.from==="productId"&&t.table==="products"):!0}function xe(e){if(!N(e,"product_batches")||!He(e))return;const a=e.prepare("SELECT * FROM product_batches").all();e.transaction(()=>{e.prepare("DROP TABLE IF EXISTS product_batches").run(),e.exec(`
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
    `);const t=e.prepare(`
      INSERT OR IGNORE INTO product_batches (
        id, productId, inventoryType, productName, costPrice, salePrice,
        quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(const r of a){const n=i(r.productId);if(!n)continue;const s=i(r.purchaseDate,r.createdAt,new Date().toISOString()),o=i(r.createdAt,s);t.run(i(r.id,crypto.randomUUID()),n,i(r.inventoryType,"mobile"),i(r.productName,"Unknown product"),u(r.costPrice),u(r.salePrice),Math.max(0,Math.round(u(r.quantity))),Math.max(0,Math.round(u(r.remainingQty,r.quantity))),s,i(r.supplier)||null,i(r.notes)||null,o,i(r.updatedAt,o))}})(),console.log("[migration] Product batches schema repaired.")}function Be(e){N(e,"repair_tickets")&&l(e,"repair_tickets","final_cost","REAL DEFAULT 0"),N(e,"blacklist")&&(l(e,"blacklist","imei","TEXT"),l(e,"blacklist","deviceName","TEXT NOT NULL DEFAULT ''"),l(e,"blacklist","ownerName","TEXT"),l(e,"blacklist","ownerPhone","TEXT"),l(e,"blacklist","status","TEXT DEFAULT 'active'"),l(e,"blacklist","reportedDate","TEXT"),l(e,"blacklist","createdBy","TEXT"),l(e,"blacklist","updatedAt","TEXT"),e.exec(`
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
    `)),N(e,"damaged_items")&&(l(e,"damaged_items","costPrice","REAL DEFAULT 0"),e.exec(`
      UPDATE damaged_items
      SET costPrice = CASE
        WHEN COALESCE(costPrice, 0) > 0 THEN costPrice
        WHEN COALESCE(quantity, 0) > 0 THEN ROUND(COALESCE(estimatedLoss, 0) / quantity, 2)
        ELSE 0
      END
      WHERE COALESCE(costPrice, 0) = 0;
    `)),N(e,"other_revenue")&&(l(e,"other_revenue","addedBy","TEXT"),l(e,"other_revenue","updatedAt","TEXT"),e.exec(`
      UPDATE other_revenue
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE other_revenue
      SET addedBy = COALESCE(NULLIF(addedBy, ''), 'system')
      WHERE COALESCE(addedBy, '') = '';

      UPDATE other_revenue
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),N(e,"wallets")&&(l(e,"wallets","icon","TEXT"),e.exec(`
      UPDATE wallets
      SET icon = CASE
        WHEN COALESCE(NULLIF(icon, ''), '') <> '' THEN icon
        WHEN type = 'bank' THEN '🏦'
        WHEN type = 'card' THEN '💳'
        WHEN type = 'mobile_wallet' THEN '📱'
        ELSE '💵'
      END
      WHERE COALESCE(icon, '') = '';
    `)),N(e,"customers")&&(l(e,"customers","isArchived","INTEGER DEFAULT 0"),l(e,"customers","deletedAt","TEXT")),N(e,"suppliers")&&(l(e,"suppliers","isArchived","INTEGER DEFAULT 0"),l(e,"suppliers","deletedAt","TEXT")),N(e,"employees")&&(l(e,"employees","isArchived","INTEGER DEFAULT 0"),l(e,"employees","deletedAt","TEXT")),N(e,"used_devices")&&(l(e,"used_devices","isArchived","INTEGER DEFAULT 0"),l(e,"used_devices","deletedAt","TEXT"),l(e,"used_devices","warehouseId","TEXT")),N(e,"employee_salaries")&&(l(e,"employee_salaries","employeeName","TEXT"),l(e,"employee_salaries","advanceDeducted","REAL DEFAULT 0"),l(e,"employee_salaries","walletId","TEXT"),e.exec(`
      UPDATE employee_salaries
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(paidAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `)),e.exec(`
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
  `),N(e,"used_devices")&&(l(e,"used_devices","model","TEXT"),l(e,"used_devices","deviceType","TEXT"),l(e,"used_devices","ram","TEXT"),l(e,"used_devices","description","TEXT"),e.exec(`
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
    `)),N(e,"warehouse_items")&&(l(e,"warehouse_items","warehouseId","TEXT"),l(e,"warehouse_items","notes","TEXT"),l(e,"warehouse_items","addedBy","TEXT"),l(e,"warehouse_items","createdAt","TEXT"),l(e,"warehouse_items","updatedAt","TEXT"),e.exec(`
      UPDATE warehouse_items
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE warehouse_items
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),N(e,"cars_inventory")&&(l(e,"cars_inventory","warehouseId","TEXT"),l(e,"cars_inventory","isArchived","INTEGER DEFAULT 0"),l(e,"cars_inventory","deletedAt","TEXT"),l(e,"cars_inventory","createdAt","TEXT"),l(e,"cars_inventory","updatedAt","TEXT"),e.exec(`
      UPDATE cars_inventory
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE cars_inventory
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE cars_inventory
      SET isArchived = COALESCE(isArchived, 0)
      WHERE isArchived IS NULL;
    `)),N(e,"products")&&(l(e,"products","brand","TEXT"),l(e,"products","description","TEXT"),l(e,"products","boxNumber","TEXT"),l(e,"products","taxExcluded","INTEGER DEFAULT 0"),l(e,"products","profitMargin","REAL DEFAULT 0"),l(e,"products","minStock","INTEGER DEFAULT 0"),l(e,"products","warehouseId","TEXT"),l(e,"products","serialNumber","TEXT"),l(e,"products","imei2","TEXT"),l(e,"products","processor","TEXT"),l(e,"products","isArchived","INTEGER DEFAULT 0"),e.exec(`
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
    `)),N(e,"reminders")&&(l(e,"reminders","reminderTime","TEXT"),l(e,"reminders","status","TEXT DEFAULT 'pending'"),l(e,"reminders","notes","TEXT"),e.exec(`
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
    `)),N(e,"product_batches")&&(l(e,"product_batches","inventoryType","TEXT"),l(e,"product_batches","productName","TEXT"),l(e,"product_batches","supplier","TEXT"),l(e,"product_batches","notes","TEXT"),l(e,"product_batches","createdAt","TEXT"),l(e,"product_batches","updatedAt","TEXT"),e.exec(`
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
    `)),N(e,"accessories")&&(l(e,"accessories","oldCostPrice","REAL DEFAULT 0"),l(e,"accessories","newCostPrice","REAL DEFAULT 0"),l(e,"accessories","profitMargin","REAL DEFAULT 0"),l(e,"accessories","brand","TEXT"),l(e,"accessories","source","TEXT"),l(e,"accessories","boxNumber","TEXT"),l(e,"accessories","taxExcluded","INTEGER DEFAULT 0"),l(e,"accessories","description","TEXT"),l(e,"accessories","isArchived","INTEGER DEFAULT 0"),l(e,"accessories","deletedAt","TEXT"),e.exec(`
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
    `)),N(e,"users")&&(l(e,"users","salt","TEXT"),l(e,"users","mustChangePassword","INTEGER DEFAULT 0"),l(e,"users","createdAt","TEXT"),l(e,"users","updatedAt","TEXT"),e.exec(`
      UPDATE users
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE users
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),N(e,"sales")&&(l(e,"sales","voidedAt","TEXT"),l(e,"sales","voidReason","TEXT"),l(e,"sales","voidedBy","TEXT")),N(e,"sale_items")&&(l(e,"sale_items","name","TEXT NOT NULL DEFAULT ''"),l(e,"sale_items","qty","INTEGER NOT NULL DEFAULT 0"),l(e,"sale_items","price","REAL NOT NULL DEFAULT 0"),l(e,"sale_items","cost","REAL NOT NULL DEFAULT 0"),l(e,"sale_items","lineDiscount","REAL DEFAULT 0"),l(e,"sale_items","warehouseId","TEXT"),l(e,"sale_items","batches","TEXT")),N(e,"stock_movements")&&l(e,"stock_movements","warehouseId","TEXT"),N(e,"audit_logs")&&(l(e,"audit_logs","beforeStateJson","TEXT"),l(e,"audit_logs","afterStateJson","TEXT"),l(e,"audit_logs","machineId","TEXT")),N(e,"return_records")&&(l(e,"return_records","originalSaleId","TEXT"),l(e,"return_records","reason","TEXT"),l(e,"return_records","processedBy","TEXT"),l(e,"return_records","createdAt","TEXT")),N(e,"return_items")&&l(e,"return_items","reason","TEXT"),N(e,"purchase_invoices")&&(l(e,"purchase_invoices","supplierId","TEXT"),l(e,"purchase_invoices","status","TEXT NOT NULL DEFAULT 'confirmed'"),l(e,"purchase_invoices","notes","TEXT"),l(e,"purchase_invoices","createdBy","TEXT"),l(e,"purchase_invoices","createdAt","TEXT"),l(e,"purchase_invoices","updatedAt","TEXT"),e.exec(`
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
    `)),N(e,"purchase_invoice_items")&&(l(e,"purchase_invoice_items","category","TEXT"),l(e,"purchase_invoice_items","notes","TEXT")),N(e,"shift_closings")&&(l(e,"shift_closings","notes","TEXT"),l(e,"shift_closings","createdAt","TEXT"),e.exec(`
      UPDATE shift_closings
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(closedAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `))}function We(e){e.exec(`
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
  `)}function ke(e){console.log("[migration] Running data migration check...");try{ue(e),xe(e),Be(e),tt(e),lt(e),Ve(e),Ke(e);const a=Me(e);Fe(e,a),Pe(e),We(e),Ye(e),qe(e),Ge(e),$e(e),je(e),be(e),Je(e),ze(e),Ze(e),et(e),rt(e),Qe(e),nt(e),at(e),st(e),it(e),ot(e),ct(e),Et(e),dt(e),ut(e),pt(e),Tt(e),mt(e),At(e),console.log("[migration] All migrations complete.")}catch(a){console.error("[migration] Error:",a)}}function Ye(e){const a=[{key:"elahmed-products",source:"legacy"},{key:"gx_mobiles_v2",source:"mobile"},{key:"gx_computers_v2",source:"computer"},{key:"gx_devices_v2",source:"device"}],t=e.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, model, barcode, deviceType, category, condition, storage, ram, color,
      brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
      salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
      imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=A(e,r.key);if(n!=null&&n.length){for(const s of n){const o=i(s.source,r.source),d=i(s.createdAt,new Date().toISOString()),E=u(s.newCostPrice,s.costPrice,s.oldCostPrice);t.run(i(s.id,crypto.randomUUID()),i(s.name,"Unknown product"),i(s.model)||null,i(s.barcode)||null,i(s.deviceType,o==="mobile"?"mobile":o==="computer"?"computer":o==="device"?"device":"")||null,i(s.category)||null,i(s.condition,"new")||null,i(s.storage)||null,i(s.ram)||null,i(s.color)||null,i(s.brand)||null,i(s.description)||null,i(s.boxNumber)||null,P(s.taxExcluded)?1:0,Math.max(0,Math.round(u(s.quantity))),u(s.oldCostPrice,E),E,u(s.salePrice),u(s.profitMargin,u(s.salePrice)-E),Math.max(0,Math.round(u(s.minStock))),i(s.supplier)||null,o,i(s.warehouseId)||null,i(s.serialNumber)||null,i(s.imei2)||null,i(s.processor)||null,P(s.isArchived)?1:0,i(s.notes)||null,i(s.image)||null,d,i(s.updatedAt,d),i(s.deletedAt)||null)}console.log(`[migration] Products (${r.source}): migrated ${n.length} records.`)}}})()}function qe(e){const a=[{key:"gx_mobile_accessories",type:"mobile_accessory"},{key:"gx_mobile_spare_parts",type:"mobile_spare_part"},{key:"gx_computer_accessories",type:"computer_accessory_legacy"},{key:"gx_computer_accessories_sa",type:"computer_accessory"},{key:"gx_computer_spare_parts",type:"computer_spare_part"},{key:"gx_device_accessories",type:"device_accessory_legacy"},{key:"gx_device_accessories_sa",type:"device_accessory"},{key:"gx_device_spare_parts",type:"device_spare_part"}],t=e.prepare(`
    INSERT OR IGNORE INTO accessories (
      id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
      oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
      brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
      deletedAt, notes, image, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=A(e,r.key);if(n!=null&&n.length){for(const s of n){const o=u(s.newCostPrice,s.costPrice,s.oldCostPrice),d=i(s.createdAt,new Date().toISOString());t.run(i(s.id,crypto.randomUUID()),i(s.warehouseId)||null,r.type,i(s.name,"Unknown accessory"),i(s.category)||null,i(s.subcategory)||null,i(s.model)||null,i(s.barcode)||null,Math.max(0,Math.round(u(s.quantity))),u(s.oldCostPrice,o),o,u(s.costPrice,o),u(s.salePrice),u(s.profitMargin,u(s.salePrice)-o),Math.max(0,Math.round(u(s.minStock))),i(s.condition,"new"),i(s.brand)||null,i(s.supplier)||null,i(s.source)||null,i(s.boxNumber)||null,P(s.taxExcluded)?1:0,i(s.color)||null,i(s.description)||null,P(s.isArchived)?1:0,i(s.deletedAt)||null,i(s.notes)||null,i(s.image)||null,d,i(s.updatedAt,d))}console.log(`[migration] Accessories (${r.type}): migrated ${n.length} records.`)}}})()}function Ve(e){if(ue(e),!y(e,"categories"))return;const a=A(e,"gx_categories_v1")||A(e,"retail_categories");if(!(a!=null&&a.length))return;const t=new Map;for(const n of a){const s=i(n.name),o=le(n.section,n.type,n.inventoryType);if(!s||!o)continue;const d=`${o}::${s.toLowerCase()}`;t.has(d)||t.set(d,{id:i(n.id,crypto.randomUUID()),name:s,inventoryType:o})}if(t.size===0)return;const r=e.prepare(`
    INSERT OR IGNORE INTO categories (id, name, inventoryType)
    VALUES (?, ?, ?)
  `);e.transaction(()=>{for(const n of t.values())r.run(n.id,n.name,n.inventoryType)})(),console.log(`[migration] Categories: ${t.size} records migrated.`)}function Ke(e){if(!y(e,"users"))return;const a=A(e,"gx_users")||A(e,"retail_users"),t=new Date().toISOString(),r=e.prepare(`
    INSERT OR IGNORE INTO users (
      id, username, fullName, role, permissions, active,
      passwordHash, salt, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=a!=null&&a.length?a:[{id:"owner-1",username:"admin",fullName:"صاحب النظام",role:"owner",permissions:te,active:!0,password:"admin123",salt:null,mustChangePassword:!0,createdAt:t,updatedAt:t}];e.transaction(()=>{for(const s of n){const o=i(s.role,"user"),d=K(s.permissions),E=d.length>0?d:o==="owner"?te:[];r.run(i(s.id,crypto.randomUUID()),i(s.username,`user_${Date.now()}`),i(s.fullName,s.name,"User"),o,JSON.stringify(E),P(s.active??!0)?1:0,i(s.passwordHash,s.password),i(s.salt)||null,P(s.mustChangePassword)?1:0,i(s.createdAt,t),i(s.updatedAt,s.createdAt,t))}})(),console.log(`[migration] Users: ${n.length} records migrated.`)}function Ge(e){if(!y(e,"product_batches"))return;const a=A(e,"gx_product_batches_v1")||A(e,"retail_product_batches");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO product_batches (
      id, productId, inventoryType, productName, costPrice, salePrice,
      quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.productId);if(!n)continue;const s=i(r.purchaseDate,r.createdAt,new Date().toISOString()),o=i(r.createdAt,s);t.run(i(r.id,crypto.randomUUID()),n,i(r.inventoryType,"mobile"),i(r.productName,"Unknown product"),u(r.costPrice),u(r.salePrice),Math.max(0,Math.round(u(r.quantity))),Math.max(0,Math.round(u(r.remainingQty,r.quantity))),s,i(r.supplier)||null,i(r.notes)||null,o,i(r.updatedAt,o))}})(),console.log(`[migration] Product batches: ${a.length} records migrated.`)}function $e(e){if(!y(e,"warehouse_items"))return;const a=A(e,"gx_warehouse")||A(e,"retail_warehouse");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO warehouse_items (
      id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());t.run(i(r.id,crypto.randomUUID()),i(r.warehouseId)||null,i(r.name,"Unknown item"),i(r.category,"general"),Math.max(0,Math.round(u(r.quantity))),u(r.costPrice),i(r.notes)||null,i(r.addedBy)||null,n,i(r.updatedAt,n))}})(),console.log(`[migration] Warehouse items: ${a.length} records migrated.`)}function je(e){if(!y(e,"cars_inventory"))return;const a=A(e,"gx_cars")||A(e,"retail_cars");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO cars_inventory (
      id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
      purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());t.run(i(r.id,crypto.randomUUID()),i(r.name,"Unknown car"),i(r.model,"Unknown model"),Math.max(0,Math.round(u(r.year))),i(r.color)||null,i(r.plateNumber)||null,i(r.licenseExpiry)||null,i(r.condition,"used"),i(r.category)||null,u(r.purchasePrice),u(r.salePrice),i(r.notes)||null,i(r.image)||null,i(r.warehouseId)||null,P(r.isArchived)?1:0,i(r.deletedAt)||null,n,i(r.updatedAt,n))}})(),console.log(`[migration] Cars: ${a.length} records migrated.`)}function be(e){if(!y(e,"sales"))return;const a=A(e,"elahmed_sales")||A(e,"retail_sales");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO sales (
      id, invoiceNumber, date, subtotal, discount, total, totalCost, grossProfit, marginPct,
      paymentMethod, employee, voidedAt, voidReason, voidedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),r=e.prepare(`
    INSERT OR IGNORE INTO sale_items (
      id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const n of a){const s=i(n.id,crypto.randomUUID()),o=K(n.items);t.run(s,i(n.invoiceNumber,`INV-LEGACY-${s.slice(0,8)}`),i(n.date,n.createdAt,new Date().toISOString()),u(n.subtotal),u(n.discount),u(n.total),u(n.totalCost),u(n.grossProfit),u(n.marginPct),i(n.paymentMethod,"cash"),i(n.employee,"system"),i(n.voidedAt)||null,i(n.voidReason)||null,i(n.voidedBy)||null);for(const d of o)r.run(i(d.id,crypto.randomUUID()),s,i(d.productId),i(d.name,"Unknown item"),Math.max(1,Math.round(u(d.qty,1))),u(d.price),u(d.cost),u(d.lineDiscount),i(d.warehouseId)||null,d.batches?JSON.stringify(d.batches):null)}})(),console.log(`[migration] Sales: ${a.length} records migrated.`)}function Je(e){if(!y(e,"return_records"))return;const a=A(e,"gx_returns_v2")||A(e,"retail_returns");if(!(a!=null&&a.length))return;const t=new Set(e.prepare("SELECT id FROM sales").all().map(o=>o.id)),r=e.prepare(`
    INSERT OR IGNORE INTO return_records (
      id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=e.prepare(`
    INSERT OR IGNORE INTO return_items (
      id, returnId, productId, name, qty, price, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);let s=0;e.transaction(()=>{for(const o of a){const d=i(o.id,crypto.randomUUID()),E=i(o.createdAt,o.date,new Date().toISOString()),m=i(o.originalSaleId),S=K(o.items),T=de(o.returnNumber,"RET");s=Math.max(s+1,T),r.run(d,i(o.returnNumber,`RET-${String(s).padStart(4,"0")}`),i(o.originalInvoiceNumber,"Unknown invoice"),t.has(m)?m:null,i(o.date,E.slice(0,10)),u(o.totalRefund),i(o.reason)||null,i(o.processedBy)||null,E);for(const C of S)n.run(i(C.id,crypto.randomUUID()),d,i(C.productId),i(C.name,"Unknown item"),u(C.qty,1)||1,u(C.price),i(C.reason)||null)}})(),console.log(`[migration] Returns: ${a.length} records migrated.`)}function Qe(e){if(!y(e,"purchase_invoices"))return;const a=A(e,"gx_purchase_invoices")||A(e,"retail_purchase_invoices");if(!(a!=null&&a.length))return;const t=new Set(e.prepare("SELECT id FROM suppliers").all().map(o=>o.id)),r=e.prepare(`
    INSERT OR IGNORE INTO purchase_invoices (
      id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
      remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=e.prepare(`
    INSERT OR IGNORE INTO purchase_invoice_items (
      id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);let s=0;e.transaction(()=>{for(const o of a){const d=i(o.id,crypto.randomUUID()),E=u(o.totalAmount),m=Math.min(E,u(o.paidAmount)),S=Math.max(0,Math.round((E-m)*100)/100),T=i(o.createdAt,new Date().toISOString()),C=i(o.updatedAt,T),w=i(o.supplierId),h=K(o.items),U=de(o.invoiceNumber,"PI");s=Math.max(s+1,U),r.run(d,i(o.invoiceNumber,`PI-${String(s).padStart(4,"0")}`),t.has(w)?w:null,i(o.supplierName,"Unknown supplier"),i(o.invoiceDate,T.slice(0,10)),E,m,S,i(o.paymentMethod,"cash"),i(o.status,Oe(E,m)),i(o.notes)||null,i(o.createdBy)||null,T,C);for(const I of h){const v=u(I.quantity,1)||1,B=u(I.unitPrice),k=u(I.totalPrice,v*B);n.run(i(I.id,crypto.randomUUID()),d,i(I.productName,"Unknown item"),i(I.category)||null,v,B,k,i(I.notes)||null)}}})(),console.log(`[migration] Purchase invoices: ${a.length} records migrated.`)}function ze(e){if(!y(e,"shift_closings"))return;const a=A(e,"gx_shift_closings")||A(e,"retail_shift_closings");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO shift_closings (
      id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
      salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.closedAt,r.createdAt,new Date().toISOString());t.run(i(r.id,crypto.randomUUID()),i(r.shiftDate,n.slice(0,10)),n,i(r.closedBy,"system"),Math.max(0,Math.round(u(r.salesCount))),u(r.salesCash),u(r.salesCard),u(r.salesTransfer),u(r.salesTotal),u(r.expectedCash),u(r.actualCash),u(r.cashDifference),i(r.notes)||null,i(r.createdAt,n))}})(),console.log(`[migration] Shift closings: ${a.length} records migrated.`)}function Ze(e){if(!y(e,"stock_movements"))return;const a=A(e,"gx_stock_movements")||A(e,"retail_stock_movements");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO stock_movements (
      id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
      referenceId, userId, timestamp, warehouseId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(i(r.id,crypto.randomUUID()),i(r.productId),i(r.type,"correction"),u(r.quantityChange),u(r.previousQuantity),u(r.newQuantity),i(r.reason)||null,i(r.referenceId)||null,i(r.userId)||null,i(r.timestamp,new Date().toISOString()),i(r.warehouseId)||null)})(),console.log(`[migration] Stock movements: ${a.length} records migrated.`)}function et(e){if(!y(e,"audit_logs"))return;const a=A(e,"elahmed_audit_logs")||A(e,"retail_audit_logs");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(i(r.id,crypto.randomUUID()),i(r.userId,"system"),i(r.action,"settings_changed"),i(r.entityType,"unknown"),i(r.entityId,"unknown"),r.beforeState?JSON.stringify(r.beforeState):null,r.afterState?JSON.stringify(r.afterState):null,i(r.machineId)||null,i(r.timestamp,new Date().toISOString()))})(),console.log(`[migration] Audit logs: ${a.length} records migrated.`)}function tt(e){if(!y(e,"customers"))return;const a=A(e,"gx_customers")||A(e,"retail_customers");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO customers (
      id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.name,r.phone||null,r.email||null,r.address||null,r.nationalId||null,r.notes||null,r.totalPurchases||0,r.balance||0,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Customers: ${a.length} records migrated.`)}function rt(e){if(!y(e,"suppliers"))return;const a=A(e,"gx_suppliers")||A(e,"retail_suppliers");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO suppliers (
      id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.name,r.phone||null,r.email||null,r.address||null,r.category||null,r.balance||0,r.notes||null,r.active??1,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Suppliers: ${a.length} records migrated.`)}function nt(e){if(!y(e,"employees"))return;const a=A(e,"gx_employees")||A(e,"retail_employees");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO employees (
      id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.name,r.phone||null,i(r.role,r.position)||null,u(r.salary,r.baseSalary),u(r.commissionRate),r.hireDate||null,P(r.active??r.isActive??!0)?1:0,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Employees: ${a.length} records migrated.`)}function at(e){if(!y(e,"supplier_transactions"))return;const a=A(e,"gx_supplier_transactions")||A(e,"retail_supplier_transactions");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO supplier_transactions (
      id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.supplierId,r.supplierName||null,r.type,u(r.amount),u(r.balanceBefore),u(r.balanceAfter),r.notes||null,r.createdBy||null,r.createdAt||new Date().toISOString())})(),console.log(`[migration] Supplier transactions: ${a.length} records migrated.`)}function st(e){if(!y(e,"employee_salaries"))return;const a=A(e,"gx_salary_records")||A(e,"retail_salary_records");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO employee_salaries (
      id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
      netSalary, paid, paidAt, walletId, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.createdAt,r.paidAt,new Date().toISOString());t.run(r.id,r.employeeId,r.employeeName||null,r.month,u(r.baseSalary),u(r.commission),u(r.bonus),u(r.deduction,r.deductions),u(r.advanceDeducted),u(r.netSalary),r.paid??1,r.paidAt||n,r.walletId||null,r.notes||null,n)}})(),console.log(`[migration] Employee salaries: ${a.length} records migrated.`)}function it(e){if(!y(e,"employee_advances"))return;const a=A(e,"gx_advances")||A(e,"retail_advances");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO employee_advances (
      id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.employeeId,r.employeeName||null,u(r.amount),r.date,r.deductedMonth||null,r.notes||null,r.createdAt||r.date||new Date().toISOString())})(),console.log(`[migration] Employee advances: ${a.length} records migrated.`)}function ot(e){if(!y(e,"expenses"))return;const a=A(e,"gx_expenses")||A(e,"retail_expenses");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO expenses (
      id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.category,r.description||null,r.amount,r.date,r.paymentMethod||"cash",r.employee||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Expenses: ${a.length} records migrated.`)}function ct(e){if(!y(e,"blacklist"))return;const a=A(e,"gx_blacklist")||A(e,"retail_blacklist");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO blacklist (
      id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
      nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString()),s=i(r.updatedAt,n),o=i(r.imei,r.nationalId),d=i(r.deviceName,r.name,"Unknown device"),E=i(r.ownerPhone,r.phone),m=i(r.createdBy,r.addedBy,"system");t.run(r.id,o||null,d,r.ownerName||null,E||null,E||null,i(r.status,"active"),i(r.reportedDate,n.slice(0,10)),o||null,r.reason,r.notes||null,m||null,m||null,d,n,s)}})(),console.log(`[migration] Blacklist: ${a.length} records migrated.`)}function Et(e){if(!y(e,"damaged_items"))return;const a=A(e,"gx_damaged")||A(e,"retail_damaged");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO damaged_items (
      id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=u(r.quantity,1)||1,s=u(r.estimatedLoss,r.totalLoss,r.value),o=u(r.costPrice,n>0?s/n:0);t.run(r.id,r.productName||r.name,r.productId||null,r.inventoryType||r.category||null,n,o,r.reason||null,s,r.reportedBy||r.addedBy||null,r.date,r.notes||null,r.createdAt||new Date().toISOString())}})(),console.log(`[migration] Damaged items: ${a.length} records migrated.`)}function dt(e){if(!y(e,"other_revenue"))return;const a=A(e,"gx_other_revenue")||A(e,"retail_other_revenue");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());t.run(r.id,r.source||r.category,r.description||null,r.amount,r.date,r.paymentMethod||"cash",r.addedBy||null,r.notes||null,n,r.updatedAt||n)}})(),console.log(`[migration] Other revenue: ${a.length} records migrated.`)}function lt(e){if(!y(e,"wallets"))return;const a=A(e,"gx_wallets")||A(e,"retail_wallets");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.type,"cash");t.run(r.id,r.name,n,u(r.balance),P(r.isDefault)?1:0,i(r.icon,n==="bank"?"🏦":n==="card"?"💳":n==="transfer"?"📲":"💵")||null,r.color||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())}})(),console.log(`[migration] Wallets: ${a.length} records migrated.`)}function ut(e){if(!y(e,"used_devices"))return;const a=A(e,"gx_used_devices")||A(e,"gx_used_inventory")||A(e,"retail_used_inventory");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO used_devices (
      id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
      ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.name,i(r.model)||null,i(r.deviceType,r.category,"other")||null,i(r.category,r.deviceType)||null,i(r.condition,"good"),u(r.purchasePrice,r.buyPrice),u(r.sellingPrice,r.salePrice),i(r.status,"in_stock"),r.serialNumber||null,r.color||null,r.storage||null,i(r.ram)||null,i(r.description,r.notes)||null,i(r.notes,r.description)||null,r.image||null,r.soldAt||null,r.purchasedFrom||null,r.soldTo||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Used devices: ${a.length} records migrated.`)}function pt(e){if(!y(e,"reminders"))return;const a=A(e,"gx_reminders")||A(e,"retail_reminders");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO reminders (
      id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=i(r.status,r.completed?"done":"pending");t.run(r.id,r.title,r.description||null,r.dueDate||r.reminderDate,r.reminderTime||null,r.priority||"medium",n,n==="done"||r.completed?1:0,r.completedAt||null,r.recurring||null,r.category||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())}})(),console.log(`[migration] Reminders: ${a.length} records migrated.`)}function Tt(e){if(!y(e,"repair_tickets"))return;const a=A(e,"gx_maintenance")||A(e,"maintenance_orders");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO repair_tickets (
      id, ticket_no, customer_name, customer_phone, device_category, device_model,
      issue_description, status, package_price, final_cost, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a){const n=["received","diagnosing","repairing","waiting_parts","testing","ready","delivered","cancelled","pending","in_progress","waiting_for_parts","completed"].includes(r.status)?r.status:r.status==="done"?"delivered":r.status==="in_progress"?"repairing":"received";t.run(r.id,r.orderNumber||r.ticket_no||`TKT-${Math.random().toString(36).slice(2,7)}`,r.customerName||r.customer_name,r.customerPhone||r.customer_phone||null,r.deviceCategory||r.device_category||"other",r.deviceName||r.device_model||"Unknown",r.issueDescription||r.issue_description||r.problem_desc||"",n,r.totalSale||r.package_price||0,r.final_cost||r.totalSale||r.package_price||0,r.createdAt||r.created_at||new Date().toISOString(),r.updatedAt||r.updated_at||new Date().toISOString())}})(),console.log(`[migration] Repair Tickets: ${a.length} records migrated.`)}function mt(e){if(!y(e,"repair_parts"))return;const a=A(e,"gx_repair_parts")||A(e,"repair_parts_inventory");if(!(a!=null&&a.length))return;const t=e.prepare(`
    INSERT OR IGNORE INTO repair_parts (
      id, name, category, sku, unit_cost, selling_price, qty, min_qty, active, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);e.transaction(()=>{for(const r of a)t.run(r.id,r.name,r.category||null,r.sku||r.part_no||null,r.unit_cost||r.cost_price||0,r.selling_price||0,r.qty||r.current_stock||0,r.min_qty||r.min_stock||0,r.active??1,r.createdAt||r.created_at||new Date().toISOString())})(),console.log(`[migration] Repair Parts: ${a.length} records migrated.`)}function At(e){y(e,"inventory_items")&&(console.log("[migration] Starting Unified Inventory Migration..."),e.transaction(()=>{N(e,"products")&&(e.exec(`
        INSERT INTO inventory_items (id, type, name, barcode, quantity, costPrice, salePrice, minStock, warehouseId, isArchived, deletedAt, createdAt, updatedAt, metadata)
        SELECT
          id,
          COALESCE(deviceType, 'device'),
          name,
          barcode,
          quantity,
          newCostPrice,
          salePrice,
          minStock,
          warehouseId,
          isArchived,
          deletedAt,
          COALESCE(createdAt, CURRENT_TIMESTAMP),
          COALESCE(updatedAt, CURRENT_TIMESTAMP),
          json_object(
            'model', model,
            'category', category,
            'condition', condition,
            'storage', storage,
            'ram', ram,
            'color', color,
            'brand', brand,
            'boxNumber', boxNumber,
            'processor', processor,
            'serialNumber', serialNumber,
            'imei2', imei2
          )
        FROM products;
      `),console.log("[migration] Products migrated to Unified Inventory.")),N(e,"accessories")&&(e.exec(`
        INSERT INTO inventory_items (id, type, name, barcode, quantity, costPrice, salePrice, minStock, warehouseId, isArchived, deletedAt, createdAt, updatedAt, metadata)
        SELECT
          id,
          'accessory',
          name,
          barcode,
          quantity,
          newCostPrice,
          salePrice,
          minStock,
          warehouseId,
          isArchived,
          deletedAt,
          COALESCE(createdAt, CURRENT_TIMESTAMP),
          COALESCE(updatedAt, CURRENT_TIMESTAMP),
          json_object(
            'inventoryType', inventoryType,
            'category', category,
            'subcategory', subcategory,
            'model', model,
            'condition', condition,
            'brand', brand,
            'boxNumber', boxNumber,
            'color', color
          )
        FROM accessories;
      `),console.log("[migration] Accessories migrated to Unified Inventory.")),N(e,"cars_inventory")&&(e.exec(`
        INSERT INTO inventory_items (id, type, name, quantity, costPrice, salePrice, warehouseId, isArchived, deletedAt, createdAt, updatedAt, metadata)
        SELECT
          id,
          'car',
          name,
          1,
          purchasePrice,
          salePrice,
          warehouseId,
          isArchived,
          deletedAt,
          COALESCE(createdAt, CURRENT_TIMESTAMP),
          COALESCE(updatedAt, CURRENT_TIMESTAMP),
          json_object(
            'model', model,
            'year', year,
            'color', color,
            'plateNumber', plateNumber,
            'licenseExpiry', licenseExpiry,
            'condition', condition,
            'category', category
          )
        FROM cars_inventory;
      `),console.log("[migration] Cars migrated to Unified Inventory.")),N(e,"used_devices")&&(e.exec(`
        INSERT INTO inventory_items (id, type, name, quantity, costPrice, salePrice, warehouseId, isArchived, deletedAt, createdAt, updatedAt, metadata)
        SELECT
          id,
          'used',
          name,
          1,
          purchasePrice,
          sellingPrice,
          warehouseId,
          isArchived,
          deletedAt,
          COALESCE(createdAt, CURRENT_TIMESTAMP),
          COALESCE(updatedAt, CURRENT_TIMESTAMP),
          json_object(
            'model', model,
            'category', category,
            'condition', condition,
            'status', status,
            'serialNumber', serialNumber,
            'color', color,
            'storage', storage,
            'ram', ram,
            'soldAt', soldAt,
            'purchasedFrom', purchasedFrom,
            'soldTo', soldTo
          )
        FROM used_devices;
      `),console.log("[migration] Used Devices migrated to Unified Inventory.")),N(e,"repair_parts")&&(e.exec(`
        INSERT INTO inventory_items (id, type, name, barcode, quantity, costPrice, salePrice, minStock, createdAt, updatedAt, metadata)
        SELECT
          id,
          'part',
          name,
          sku,
          qty,
          unit_cost,
          selling_price,
          min_qty,
          COALESCE(createdAt, CURRENT_TIMESTAMP),
          CURRENT_TIMESTAMP,
          json_object(
            'category', category,
            'active', active
          )
        FROM repair_parts;
      `),console.log("[migration] Repair Parts migrated to Unified Inventory."))})(),console.log("[migration] Unified Inventory Migration Completed."))}function O(e,a=["id","createdAt"]){const t=[],r=[];for(const[n,s]of Object.entries(e))a.includes(n)||(t.push(`${n} = ?`),r.push(s));return{sets:t,values:r}}function re(e,a){const t=e.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!t)return[];try{const r=JSON.parse(t.value);return Array.isArray(r)?r:[]}catch{return[]}}function St(e,a,t){const r=e.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!r)return t;try{return JSON.parse(r.value)}catch{return t}}function Nt(e,a){if(!a||e.prepare("SELECT id FROM wallets WHERE id = ?").get(a))return;const r=[...re(e,"gx_wallets"),...re(e,"retail_wallets")].find(d=>String(d.id??"")===a),n=new Date().toISOString(),s=String((r==null?void 0:r.type)??"cash"),o=String((r==null?void 0:r.icon)??(s==="bank"?"🏦":s==="card"?"💳":s==="transfer"?"📲":"💵"));e.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(a,String((r==null?void 0:r.name)??(a==="wallet_cash"?"الصندوق":`Wallet ${a.slice(0,8)}`)),s,r!=null&&r.isDefault?1:0,o,r!=null&&r.color?String(r.color):null,String((r==null?void 0:r.notes)??"Auto-created to repair wallet references"),r!=null&&r.createdAt?String(r.createdAt):n,r!=null&&r.updatedAt?String(r.updatedAt):n)}function Lt(e,a){if(e==null||e===""||typeof e!="string")return a;try{return JSON.parse(e)}catch{return a}}function ne(e,a){if(typeof e!="string")return 0;const t=new RegExp(`^${a}-(\\d+)$`).exec(e.trim());if(!t)return 0;const r=Number.parseInt(t[1],10);return Number.isFinite(r)?r:0}function b(e,a){return a<=0?"confirmed":a>=e?"paid":"partial"}function It(e,a){return a?e.prepare("SELECT * FROM products WHERE source = ? ORDER BY createdAt DESC, id DESC").all(a):e.prepare("SELECT * FROM products ORDER BY createdAt DESC, id DESC").all()}function Rt(e,a){return a?e.prepare("SELECT * FROM accessories WHERE inventoryType = ? ORDER BY createdAt DESC, id DESC").all(a):e.prepare("SELECT * FROM accessories ORDER BY createdAt DESC, id DESC").all()}function ae(e,a=!1){const t=e.prepare(`
    SELECT * FROM sales
    ${a?"WHERE voidedAt IS NULL":""}
    ORDER BY date DESC, invoiceNumber DESC
  `).all(),r=e.prepare("SELECT * FROM sale_items ORDER BY saleId ASC, id ASC").all(),n=new Map;for(const s of r){const o=String(s.saleId??"");if(!o)continue;const d=n.get(o)||[];d.push({productId:String(s.productId??""),name:String(s.name??""),qty:Number(s.qty??0),price:Number(s.price??0),cost:Number(s.cost??0),lineDiscount:Number(s.lineDiscount??0),warehouseId:s.warehouseId?String(s.warehouseId):void 0,batches:Lt(s.batches,[])}),n.set(o,d)}return t.map(s=>({id:String(s.id??""),invoiceNumber:String(s.invoiceNumber??""),date:String(s.date??""),items:n.get(String(s.id??""))||[],subtotal:Number(s.subtotal??0),discount:Number(s.discount??0),total:Number(s.total??0),totalCost:Number(s.totalCost??0),grossProfit:Number(s.grossProfit??0),marginPct:Number(s.marginPct??0),paymentMethod:String(s.paymentMethod??"cash"),employee:String(s.employee??"system"),voidedAt:s.voidedAt?String(s.voidedAt):null,voidReason:s.voidReason?String(s.voidReason):null,voidedBy:s.voidedBy?String(s.voidedBy):null}))}function Y(e){const a=e.prepare("SELECT * FROM purchase_invoices ORDER BY invoiceDate DESC, createdAt DESC").all(),t=e.prepare("SELECT * FROM purchase_invoice_items ORDER BY invoiceId ASC, id ASC").all(),r=new Map;for(const n of t){const s=String(n.invoiceId??"");if(!s)continue;const o=r.get(s)||[];o.push({id:String(n.id??""),productName:String(n.productName??""),category:n.category?String(n.category):"",quantity:Number(n.quantity??0),unitPrice:Number(n.unitPrice??0),totalPrice:Number(n.totalPrice??0),notes:n.notes?String(n.notes):""}),r.set(s,o)}return a.map(n=>({id:String(n.id??""),invoiceNumber:String(n.invoiceNumber??""),supplierId:n.supplierId?String(n.supplierId):void 0,supplierName:String(n.supplierName??""),invoiceDate:String(n.invoiceDate??""),totalAmount:Number(n.totalAmount??0),paidAmount:Number(n.paidAmount??0),remaining:Number(n.remaining??0),paymentMethod:String(n.paymentMethod??"cash"),items:r.get(String(n.id??""))||[],status:String(n.status??"confirmed"),notes:n.notes?String(n.notes):"",createdBy:String(n.createdBy??"system"),createdAt:String(n.createdAt??""),updatedAt:String(n.updatedAt??"")}))}function J(e){const a=e.prepare("SELECT * FROM return_records ORDER BY date DESC, createdAt DESC").all(),t=e.prepare("SELECT * FROM return_items ORDER BY returnId ASC, id ASC").all(),r=new Map;for(const n of t){const s=String(n.returnId??"");if(!s)continue;const o=r.get(s)||[];o.push({productId:String(n.productId??""),name:String(n.name??""),qty:Number(n.qty??0),price:Number(n.price??0),reason:n.reason?String(n.reason):""}),r.set(s,o)}return a.map(n=>({id:String(n.id??""),returnNumber:String(n.returnNumber??""),originalInvoiceNumber:String(n.originalInvoiceNumber??""),originalSaleId:n.originalSaleId?String(n.originalSaleId):"",date:String(n.date??""),items:r.get(String(n.id??""))||[],totalRefund:Number(n.totalRefund??0),reason:n.reason?String(n.reason):"",processedBy:n.processedBy?String(n.processedBy):"",createdAt:String(n.createdAt??"")}))}function yt(e){return e.prepare("SELECT * FROM shift_closings ORDER BY closedAt DESC, createdAt DESC").all()}function _t(e,a,t,r){const n=new Date;n.setHours(0,0,0,0);const s=e.prepare("SELECT closedAt FROM shift_closings ORDER BY closedAt DESC LIMIT 1").get(),o=s!=null&&s.closedAt?String(s.closedAt):n.toISOString(),d=e.prepare(`
    SELECT
      COUNT(*) as salesCount,
      SUM(CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END) as salesCash,
      SUM(CASE WHEN paymentMethod = 'card' THEN total ELSE 0 END) as salesCard,
      SUM(CASE WHEN paymentMethod NOT IN ('cash', 'card') THEN total ELSE 0 END) as salesTransfer,
      SUM(total) as salesTotal
    FROM sales
    WHERE voidedAt IS NULL AND date >= ?
  `).get(o),E=new Date,m=Number(d.salesCash??0),S=Number(d.salesCard??0),T=Number(d.salesTransfer??0),C=Number(d.salesTotal??m+S+T);return{shiftDate:E.toISOString().slice(0,10),closedAt:E.toISOString(),closedBy:a,salesCount:Number(d.salesCount??0),salesCash:m,salesCard:S,salesTransfer:T,salesTotal:C,expectedCash:m,actualCash:t,cashDifference:t-m,notes:r}}function p(e,a,t,r){try{e.returnValue=r()}catch(n){console.error(`${a} error:`,n),e.returnValue=t}}function gt(e){c.ipcMain.on("db:installments:get",a=>{try{a.returnValue=oe(e)}catch(t){console.error("db:installments:get error:",t),a.returnValue=[]}}),c.ipcMain.on("db:installments:replaceAll",(a,t)=>{try{const r=Array.isArray(t)?t:[];a.returnValue=ce(e,r)}catch(r){console.error("db:installments:replaceAll error:",r),a.returnValue=[]}}),c.ipcMain.on("db-sync:settings:get-json",(a,t)=>{p(a,"db-sync:settings:get-json",null,()=>St(e,t,null))}),c.ipcMain.on("db-sync:settings:set-json",(a,t,r)=>{p(a,"db-sync:settings:set-json",null,()=>{const n=JSON.stringify(r??null);return e.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(t,n),r??null})}),c.ipcMain.on("db-sync:categories:get",a=>{p(a,"db-sync:categories:get",[],()=>e.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all())}),c.ipcMain.on("db-sync:categories:replaceAll",(a,t=[])=>{p(a,"db-sync:categories:replaceAll",[],()=>e.transaction(()=>{e.prepare("DELETE FROM categories").run();const n=e.prepare(`
          INSERT INTO categories (id, name, inventoryType)
          VALUES (?, ?, ?)
        `);for(const s of Array.isArray(t)?t:[])n.run(s.id??crypto.randomUUID(),s.name??"",s.inventoryType??"mobile_device");return e.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all()})())}),c.ipcMain.on("db-sync:users:get",a=>{p(a,"db-sync:users:get",[],()=>e.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all())}),c.ipcMain.on("db-sync:users:replaceAll",(a,t=[])=>{p(a,"db-sync:users:replaceAll",[],()=>e.transaction(()=>{e.prepare("DELETE FROM users").run();const n=e.prepare(`
          INSERT INTO users (
            id, username, fullName, role, permissions, active,
            passwordHash, salt, mustChangePassword, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=new Date().toISOString();for(const o of Array.isArray(t)?t:[])n.run(o.id??crypto.randomUUID(),o.username??"",o.fullName??"",o.role??"user",o.permissions??"[]",o.active?1:0,o.passwordHash??null,o.salt??null,o.mustChangePassword?1:0,o.createdAt??s,o.updatedAt??o.createdAt??s);return e.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all()})())}),c.ipcMain.on("db-sync:product_batches:get",a=>{p(a,"db-sync:product_batches:get",[],()=>e.prepare("SELECT * FROM product_batches ORDER BY purchaseDate ASC, createdAt ASC, id ASC").all())}),c.ipcMain.on("db-sync:product_batches:add",(a,t)=>{p(a,"db-sync:product_batches:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO product_batches (
          id, productId, inventoryType, productName, costPrice, salePrice,
          quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.productId,t.inventoryType??"mobile",t.productName??"Unknown product",t.costPrice??0,t.salePrice??0,t.quantity??0,t.remainingQty??t.quantity??0,t.purchaseDate??n,t.supplier??null,t.notes??null,t.createdAt??n,t.updatedAt??n),e.prepare("SELECT * FROM product_batches WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:product_batches:update",(a,t,r)=>{p(a,"db-sync:product_batches:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE product_batches SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM product_batches WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:product_batches:delete",(a,t)=>{p(a,"db-sync:product_batches:delete",!1,()=>e.prepare("DELETE FROM product_batches WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:products:get",(a,t=null)=>{p(a,"db-sync:products:get",[],()=>It(e,t))}),c.ipcMain.on("db-sync:products:add",(a,t)=>{p(a,"db-sync:products:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO products (
          id, name, model, barcode, deviceType, category, condition, storage, ram, color,
          brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
          salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
          imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name??"",t.model??null,t.barcode??null,t.deviceType??null,t.category??null,t.condition??null,t.storage??null,t.ram??null,t.color??null,t.brand??null,t.description??null,t.boxNumber??null,t.taxExcluded?1:0,t.quantity??0,t.oldCostPrice??0,t.newCostPrice??0,t.salePrice??0,t.profitMargin??0,t.minStock??0,t.supplier??null,t.source??null,t.warehouseId??null,t.serialNumber??null,t.imei2??null,t.processor??null,t.isArchived?1:0,t.notes??null,t.image??null,t.createdAt??n,t.updatedAt??n,t.deletedAt??null),e.prepare("SELECT * FROM products WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:products:update",(a,t,r)=>{p(a,"db-sync:products:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE products SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM products WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:products:delete",(a,t)=>{p(a,"db-sync:products:delete",!1,()=>e.prepare("DELETE FROM products WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:accessories:get",(a,t=null)=>{p(a,"db-sync:accessories:get",[],()=>Rt(e,t))}),c.ipcMain.on("db-sync:accessories:add",(a,t)=>{p(a,"db-sync:accessories:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO accessories (
          id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
          oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
          brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
          deletedAt, notes, image, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.warehouseId??null,t.inventoryType??null,t.name??"",t.category??null,t.subcategory??null,t.model??null,t.barcode??null,t.quantity??0,t.oldCostPrice??0,t.newCostPrice??t.costPrice??0,t.costPrice??t.newCostPrice??0,t.salePrice??0,t.profitMargin??0,t.minStock??0,t.condition??"new",t.brand??null,t.supplier??null,t.source??null,t.boxNumber??null,t.taxExcluded?1:0,t.color??null,t.description??null,t.isArchived?1:0,t.deletedAt??null,t.notes??null,t.image??null,t.createdAt??n,t.updatedAt??n),e.prepare("SELECT * FROM accessories WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:accessories:update",(a,t,r)=>{p(a,"db-sync:accessories:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE accessories SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM accessories WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:accessories:delete",(a,t)=>{p(a,"db-sync:accessories:delete",!1,()=>e.prepare("DELETE FROM accessories WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:warehouse_items:get",a=>{p(a,"db-sync:warehouse_items:get",[],()=>e.prepare("SELECT * FROM warehouse_items ORDER BY createdAt DESC, id DESC").all())}),c.ipcMain.on("db-sync:warehouse_items:add",(a,t)=>{p(a,"db-sync:warehouse_items:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO warehouse_items (
          id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.warehouseId??null,t.name??"",t.category??"general",t.quantity??0,t.costPrice??0,t.notes??null,t.addedBy??null,t.createdAt??n,t.updatedAt??n),e.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:warehouse_items:update",(a,t,r)=>{p(a,"db-sync:warehouse_items:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE warehouse_items SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:warehouse_items:delete",(a,t)=>{p(a,"db-sync:warehouse_items:delete",!1,()=>e.prepare("DELETE FROM warehouse_items WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:cars:get",a=>{p(a,"db-sync:cars:get",[],()=>e.prepare("SELECT * FROM cars_inventory ORDER BY createdAt DESC, id DESC").all())}),c.ipcMain.on("db-sync:cars:add",(a,t)=>{p(a,"db-sync:cars:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO cars_inventory (
          id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
          purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name??"",t.model??"",t.year??0,t.color??null,t.plateNumber??null,t.licenseExpiry??null,t.condition??"used",t.category??null,t.purchasePrice??0,t.salePrice??0,t.notes??null,t.image??null,t.warehouseId??null,t.isArchived?1:0,t.deletedAt??null,t.createdAt??n,t.updatedAt??n),e.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:cars:update",(a,t,r)=>{p(a,"db-sync:cars:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE cars_inventory SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:cars:delete",(a,t)=>{p(a,"db-sync:cars:delete",!1,()=>e.prepare("DELETE FROM cars_inventory WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:customers:get",a=>{p(a,"db-sync:customers:get",[],()=>e.prepare("SELECT * FROM customers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:customers:add",(a,t)=>{p(a,"db-sync:customers:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name,t.phone??null,t.email??null,t.address??null,t.nationalId??null,t.notes??null,t.totalPurchases??0,t.balance??0,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM customers WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:customers:update",(a,t,r)=>{p(a,"db-sync:customers:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE customers SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM customers WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:customers:delete",(a,t)=>{p(a,"db-sync:customers:delete",!1,()=>e.prepare("DELETE FROM customers WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:expenses:get",a=>{p(a,"db-sync:expenses:get",[],()=>e.prepare("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:expenses:add",(a,t)=>{p(a,"db-sync:expenses:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.category,t.description??null,t.amount??0,t.date,t.paymentMethod??"cash",t.employee??null,t.notes??null,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM expenses WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:expenses:update",(a,t,r)=>{p(a,"db-sync:expenses:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE expenses SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM expenses WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:expenses:delete",(a,t)=>{p(a,"db-sync:expenses:delete",!1,()=>e.prepare("DELETE FROM expenses WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:blacklist:get",a=>{p(a,"db-sync:blacklist:get",[],()=>e.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC, updatedAt DESC").all())}),c.ipcMain.on("db-sync:blacklist:add",(a,t)=>{p(a,"db-sync:blacklist:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO blacklist (
          id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
          nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.imei??null,t.deviceName,t.ownerName??null,t.ownerPhone??null,t.ownerPhone??null,t.status??"active",t.reportedDate??n.slice(0,10),t.imei??null,t.reason,t.notes??null,t.createdBy??null,t.createdBy??null,t.deviceName,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM blacklist WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:blacklist:update",(a,t,r)=>{p(a,"db-sync:blacklist:update",null,()=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"ownerPhone")&&!Object.prototype.hasOwnProperty.call(n,"phone")&&(n.phone=n.ownerPhone),Object.prototype.hasOwnProperty.call(n,"imei")&&!Object.prototype.hasOwnProperty.call(n,"nationalId")&&(n.nationalId=n.imei),Object.prototype.hasOwnProperty.call(n,"deviceName")&&!Object.prototype.hasOwnProperty.call(n,"name")&&(n.name=n.deviceName),Object.prototype.hasOwnProperty.call(n,"createdBy")&&!Object.prototype.hasOwnProperty.call(n,"addedBy")&&(n.addedBy=n.createdBy);const{sets:s,values:o}=O(n);return s.length&&(s.push("updatedAt = ?"),o.push(new Date().toISOString(),t),e.prepare(`UPDATE blacklist SET ${s.join(", ")} WHERE id = ?`).run(...o)),e.prepare("SELECT * FROM blacklist WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:blacklist:delete",(a,t)=>{p(a,"db-sync:blacklist:delete",!1,()=>e.prepare("DELETE FROM blacklist WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:damaged_items:get",a=>{p(a,"db-sync:damaged_items:get",[],()=>e.prepare("SELECT * FROM damaged_items ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:damaged_items:add",(a,t)=>{p(a,"db-sync:damaged_items:add",null,()=>{const r=t.id||crypto.randomUUID();return e.prepare(`
        INSERT INTO damaged_items (
          id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.productName??t.name,t.productId??null,t.inventoryType??null,t.quantity??1,t.costPrice??0,t.reason??null,t.estimatedLoss??0,t.reportedBy??null,t.date,t.notes??null,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM damaged_items WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:damaged_items:update",(a,t,r)=>{p(a,"db-sync:damaged_items:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(t),e.prepare(`UPDATE damaged_items SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM damaged_items WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:damaged_items:delete",(a,t)=>{p(a,"db-sync:damaged_items:delete",!1,()=>e.prepare("DELETE FROM damaged_items WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:other_revenue:get",a=>{p(a,"db-sync:other_revenue:get",[],()=>e.prepare("SELECT * FROM other_revenue ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:other_revenue:add",(a,t)=>{p(a,"db-sync:other_revenue:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.source,t.description??null,t.amount??0,t.date,t.paymentMethod??"cash",t.addedBy??null,t.notes??null,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM other_revenue WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:other_revenue:update",(a,t,r)=>{p(a,"db-sync:other_revenue:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE other_revenue SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM other_revenue WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:other_revenue:delete",(a,t)=>{p(a,"db-sync:other_revenue:delete",!1,()=>e.prepare("DELETE FROM other_revenue WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:reminders:get",a=>{p(a,"db-sync:reminders:get",[],()=>e.prepare("SELECT * FROM reminders ORDER BY dueDate ASC, reminderTime ASC").all())}),c.ipcMain.on("db-sync:reminders:add",(a,t)=>{p(a,"db-sync:reminders:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO reminders (
          id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.title,t.description??null,t.dueDate,t.reminderTime??null,t.priority??"medium",t.status??"pending",t.completed??0,t.completedAt??null,t.recurring??null,t.category??null,t.notes??null,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM reminders WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:reminders:update",(a,t,r)=>{p(a,"db-sync:reminders:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE reminders SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM reminders WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:reminders:delete",(a,t)=>{p(a,"db-sync:reminders:delete",!1,()=>e.prepare("DELETE FROM reminders WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:suppliers:get",a=>{p(a,"db-sync:suppliers:get",[],()=>e.prepare("SELECT * FROM suppliers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:suppliers:add",(a,t)=>{p(a,"db-sync:suppliers:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name,t.phone??null,t.email??null,t.address??null,t.category??null,t.balance??0,t.notes??null,t.active??1,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM suppliers WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:suppliers:update",(a,t,r)=>{p(a,"db-sync:suppliers:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE suppliers SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM suppliers WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:suppliers:delete",(a,t)=>{p(a,"db-sync:suppliers:delete",!1,()=>e.prepare("DELETE FROM suppliers WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:supplier_transactions:get",(a,t)=>{p(a,"db-sync:supplier_transactions:get",[],()=>t?e.prepare("SELECT * FROM supplier_transactions WHERE supplierId = ? ORDER BY createdAt DESC").all(t):e.prepare("SELECT * FROM supplier_transactions ORDER BY createdAt DESC").all())}),c.ipcMain.on("db-sync:supplier_transactions:add",(a,t)=>{p(a,"db-sync:supplier_transactions:add",null,()=>e.transaction(()=>{const n=e.prepare("SELECT * FROM suppliers WHERE id = ?").get(t.supplierId);if(!n)throw new Error("Supplier not found");const s=t.id||crypto.randomUUID(),o=t.createdAt||new Date().toISOString(),d=Number(t.amount??0),E=Number(n.balance??0),m=t.type==="purchase"?d:-d,S=E+m;return e.prepare(`
          INSERT INTO supplier_transactions (
            id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(s,t.supplierId,t.supplierName??n.name??null,t.type,d,E,S,t.notes??null,t.createdBy??null,o),e.prepare("UPDATE suppliers SET balance = ?, updatedAt = ? WHERE id = ?").run(S,new Date().toISOString(),t.supplierId),e.prepare("SELECT * FROM supplier_transactions WHERE id = ?").get(s)})())}),c.ipcMain.on("db-sync:employees:get",a=>{p(a,"db-sync:employees:get",[],()=>e.prepare("SELECT * FROM employees WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:employees:add",(a,t)=>{p(a,"db-sync:employees:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name,t.phone??null,t.role??null,t.salary??0,t.commissionRate??0,t.hireDate??null,t.active??1,t.notes??null,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM employees WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employees:update",(a,t,r)=>{p(a,"db-sync:employees:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),t),e.prepare(`UPDATE employees SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM employees WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:employees:delete",(a,t)=>{p(a,"db-sync:employees:delete",!1,()=>e.prepare("DELETE FROM employees WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:employee_salaries:get",(a,t)=>{p(a,"db-sync:employee_salaries:get",[],()=>t?e.prepare("SELECT * FROM employee_salaries WHERE employeeId = ? ORDER BY month DESC, paidAt DESC, createdAt DESC").all(t):e.prepare("SELECT * FROM employee_salaries ORDER BY month DESC, paidAt DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:employee_salaries:add",(a,t)=>{p(a,"db-sync:employee_salaries:add",null,()=>{const r=t.id||crypto.randomUUID(),n=t.createdAt||t.paidAt||new Date().toISOString();return e.prepare(`
        INSERT INTO employee_salaries (
          id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
          netSalary, paid, paidAt, walletId, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.employeeId,t.employeeName??null,t.month,t.baseSalary??0,t.commission??0,t.bonus??0,t.deductions??0,t.advanceDeducted??0,t.netSalary??0,t.paid??1,t.paidAt??n,t.walletId??null,t.notes??null,n),e.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employee_salaries:update",(a,t,r)=>{p(a,"db-sync:employee_salaries:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(t),e.prepare(`UPDATE employee_salaries SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:employee_salaries:delete",(a,t)=>{p(a,"db-sync:employee_salaries:delete",!1,()=>e.prepare("DELETE FROM employee_salaries WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:employee_advances:get",(a,t)=>{p(a,"db-sync:employee_advances:get",[],()=>t?e.prepare("SELECT * FROM employee_advances WHERE employeeId = ? ORDER BY date DESC, createdAt DESC").all(t):e.prepare("SELECT * FROM employee_advances ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:employee_advances:add",(a,t)=>{p(a,"db-sync:employee_advances:add",null,()=>{const r=t.id||crypto.randomUUID(),n=t.createdAt||t.date||new Date().toISOString();return e.prepare(`
        INSERT INTO employee_advances (id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.employeeId,t.employeeName??null,t.amount??0,t.date,t.deductedMonth??null,t.notes??null,n),e.prepare("SELECT * FROM employee_advances WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employee_advances:update",(a,t,r)=>{p(a,"db-sync:employee_advances:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(t),e.prepare(`UPDATE employee_advances SET ${n.join(", ")} WHERE id = ?`).run(...s)),e.prepare("SELECT * FROM employee_advances WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:employee_advances:delete",(a,t)=>{p(a,"db-sync:employee_advances:delete",!1,()=>e.prepare("DELETE FROM employee_advances WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:used_devices:get",a=>{p(a,"db-sync:used_devices:get",[],()=>e.prepare("SELECT * FROM used_devices WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY createdAt DESC, updatedAt DESC").all())}),c.ipcMain.on("db-sync:used_devices:add",(a,t)=>{p(a,"db-sync:used_devices:add",null,()=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
        INSERT INTO used_devices (
          id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
          ram, description, notes, image, soldAt, purchasedFrom, soldTo, isArchived, deletedAt, warehouseId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.name,t.model??null,t.deviceType??null,t.category??t.deviceType??null,t.condition??"good",t.purchasePrice??0,t.sellingPrice??t.salePrice??0,t.status??"in_stock",t.serialNumber??null,t.color??null,t.storage??null,t.ram??null,t.description??null,t.notes??t.description??null,t.image??null,t.soldAt??null,t.purchasedFrom??null,t.soldTo??null,t.isArchived?1:0,t.deletedAt??null,t.warehouseId??null,t.createdAt||n,t.updatedAt||n),e.prepare("SELECT * FROM used_devices WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:used_devices:update",(a,t,r)=>{p(a,"db-sync:used_devices:update",null,()=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"deviceType")&&!Object.prototype.hasOwnProperty.call(n,"category")&&(n.category=n.deviceType),Object.prototype.hasOwnProperty.call(n,"description")&&!Object.prototype.hasOwnProperty.call(n,"notes")&&(n.notes=n.description);const{sets:s,values:o}=O(n);return s.length&&(s.push("updatedAt = ?"),o.push(new Date().toISOString(),t),e.prepare(`UPDATE used_devices SET ${s.join(", ")} WHERE id = ?`).run(...o)),e.prepare("SELECT * FROM used_devices WHERE id = ?").get(t)})}),c.ipcMain.on("db-sync:used_devices:delete",(a,t)=>{p(a,"db-sync:used_devices:delete",!1,()=>e.prepare("DELETE FROM used_devices WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:sales:get",(a,t=!1)=>{p(a,"db-sync:sales:get",[],()=>ae(e,!!t))}),c.ipcMain.on("db-sync:sales:maxInvoiceSequence",a=>{p(a,"db-sync:sales:maxInvoiceSequence",0,()=>e.prepare("SELECT invoiceNumber FROM sales").all().reduce((r,n)=>{const s=/^INV-\d{4}-(\d+)$/.exec(String(n.invoiceNumber??"")),o=s?Number.parseInt(s[1],10):0;return Number.isFinite(o)?Math.max(r,o):r},0))}),c.ipcMain.on("db-sync:sales:upsert",(a,t)=>{p(a,"db-sync:sales:upsert",null,()=>e.transaction(()=>{e.prepare(`
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
        `).run(t.id,t.invoiceNumber,t.date,t.subtotal??0,t.discount??0,t.total??0,t.totalCost??0,t.grossProfit??0,t.marginPct??0,t.paymentMethod??"cash",t.employee??"system",t.voidedAt??null,t.voidReason??null,t.voidedBy??null),e.prepare("DELETE FROM sale_items WHERE saleId = ?").run(t.id);const n=e.prepare(`
          INSERT INTO sale_items (id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const s of Array.isArray(t.items)?t.items:[])n.run(s.id??crypto.randomUUID(),t.id,s.productId,s.name,s.qty??0,s.price??0,s.cost??0,s.lineDiscount??0,s.warehouseId??null,s.batches?JSON.stringify(s.batches):null);return ae(e).find(s=>s.id===t.id)??null})())}),c.ipcMain.on("db-sync:returns:get",a=>{p(a,"db-sync:returns:get",[],()=>J(e))}),c.ipcMain.on("db-sync:returns:add",(a,t)=>{p(a,"db-sync:returns:add",null,()=>e.transaction(()=>{const s=J(e).reduce((T,C)=>Math.max(T,ne(C.returnNumber,"RET")),0),o=t.id||crypto.randomUUID(),d=t.createdAt||new Date().toISOString(),E=t.returnNumber||`RET-${String(s+1).padStart(4,"0")}`,m=t.originalSaleId?e.prepare("SELECT id FROM sales WHERE id = ?").get(t.originalSaleId):void 0;e.prepare(`
          INSERT INTO return_records (
            id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(o,E,t.originalInvoiceNumber,(m==null?void 0:m.id)??null,t.date,t.totalRefund??0,t.reason??null,t.processedBy??null,d);const S=e.prepare(`
          INSERT INTO return_items (id, returnId, productId, name, qty, price, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);for(const T of Array.isArray(t.items)?t.items:[])S.run(T.id??crypto.randomUUID(),o,T.productId,T.name,T.qty??0,T.price??0,T.reason??null);return J(e).find(T=>T.id===o)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:get",a=>{p(a,"db-sync:purchase_invoices:get",[],()=>Y(e))}),c.ipcMain.on("db-sync:purchase_invoices:add",(a,t)=>{p(a,"db-sync:purchase_invoices:add",null,()=>e.transaction(()=>{var h;const s=Y(e).reduce((U,I)=>Math.max(U,ne(I.invoiceNumber,"PI")),0),o=t.id||crypto.randomUUID(),d=new Date().toISOString(),E=Number(t.totalAmount??0),m=Math.min(E,Number(t.paidAmount??0)),S=Math.max(0,Math.round((E-m)*100)/100),T=b(E,m),C=t.supplierId?((h=e.prepare("SELECT id FROM suppliers WHERE id = ?").get(t.supplierId))==null?void 0:h.id)??null:null;e.prepare(`
          INSERT INTO purchase_invoices (
            id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
            remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(o,t.invoiceNumber||`PI-${String(s+1).padStart(4,"0")}`,C,t.supplierName,t.invoiceDate,E,m,S,t.paymentMethod??"cash",T,t.notes??null,t.createdBy??"system",t.createdAt||d,t.updatedAt||d);const w=e.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const U of Array.isArray(t.items)?t.items:[]){const I=Number(U.quantity??0),v=Number(U.unitPrice??0);w.run(U.id??crypto.randomUUID(),o,U.productName,U.category??null,I,v,U.totalPrice??I*v,U.notes??null)}return Y(e).find(U=>U.id===o)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:update",(a,t,r)=>{p(a,"db-sync:purchase_invoices:update",null,()=>e.transaction(()=>{var w;const s=Y(e).find(h=>h.id===t);if(!s)return null;const o={...s,...r,items:Array.isArray(r==null?void 0:r.items)?r.items:s.items},d=Number(o.totalAmount??0),E=Math.min(d,Number(o.paidAmount??0)),m=Math.max(0,Math.round((d-E)*100)/100),S=b(d,E),T=o.supplierId?((w=e.prepare("SELECT id FROM suppliers WHERE id = ?").get(o.supplierId))==null?void 0:w.id)??null:null;e.prepare(`
          UPDATE purchase_invoices
          SET supplierId = ?, supplierName = ?, invoiceDate = ?, totalAmount = ?, paidAmount = ?, remaining = ?,
              paymentMethod = ?, status = ?, notes = ?, createdBy = ?, updatedAt = ?
          WHERE id = ?
        `).run(T,o.supplierName,o.invoiceDate,d,E,m,o.paymentMethod??"cash",S,o.notes??null,o.createdBy??"system",new Date().toISOString(),t),e.prepare("DELETE FROM purchase_invoice_items WHERE invoiceId = ?").run(t);const C=e.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const h of Array.isArray(o.items)?o.items:[]){const U=Number(h.quantity??0),I=Number(h.unitPrice??0);C.run(h.id??crypto.randomUUID(),t,h.productName,h.category??null,U,I,h.totalPrice??U*I,h.notes??null)}return Y(e).find(h=>h.id===t)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:applyPayment",(a,t,r)=>{p(a,"db-sync:purchase_invoices:applyPayment",null,()=>e.transaction(()=>{const s=e.prepare("SELECT * FROM purchase_invoices WHERE id = ?").get(t);if(!s)return null;const o=Number(s.totalAmount??0),d=Math.min(o,Number(s.paidAmount??0)+Math.max(0,Number(r??0))),E=Math.max(0,Math.round((o-d)*100)/100),m=b(o,d);return e.prepare(`
          UPDATE purchase_invoices
          SET paidAmount = ?, remaining = ?, status = ?, updatedAt = ?
          WHERE id = ?
        `).run(d,E,m,new Date().toISOString(),t),Y(e).find(S=>S.id===t)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:delete",(a,t)=>{p(a,"db-sync:purchase_invoices:delete",!1,()=>e.prepare("DELETE FROM purchase_invoices WHERE id = ?").run(t).changes>0)}),c.ipcMain.on("db-sync:shift_closings:get",a=>{p(a,"db-sync:shift_closings:get",[],()=>yt(e))}),c.ipcMain.on("db-sync:shift_closings:buildSummary",(a,t,r,n)=>{p(a,"db-sync:shift_closings:buildSummary",null,()=>_t(e,t,Number(r??0),n))}),c.ipcMain.on("db-sync:shift_closings:add",(a,t)=>{p(a,"db-sync:shift_closings:add",null,()=>{const r=t.id||crypto.randomUUID(),n=t.createdAt||t.closedAt||new Date().toISOString();return e.prepare(`
        INSERT INTO shift_closings (
          id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
          salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.shiftDate,t.closedAt,t.closedBy,t.salesCount??0,t.salesCash??0,t.salesCard??0,t.salesTransfer??0,t.salesTotal??0,t.expectedCash??0,t.actualCash??0,t.cashDifference??0,t.notes??null,n),e.prepare("SELECT * FROM shift_closings WHERE id = ?").get(r)??null})}),c.ipcMain.on("db-sync:stock_movements:get",(a,t)=>{p(a,"db-sync:stock_movements:get",[],()=>t?e.prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY timestamp DESC, id DESC").all(t):e.prepare("SELECT * FROM stock_movements ORDER BY timestamp DESC, id DESC").all())}),c.ipcMain.on("db-sync:stock_movements:add",(a,t)=>{p(a,"db-sync:stock_movements:add",null,()=>{const r=t.id||crypto.randomUUID();return e.prepare(`
        INSERT INTO stock_movements (
          id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
          referenceId, userId, timestamp, warehouseId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.productId,t.type,t.quantityChange??0,t.previousQuantity??0,t.newQuantity??0,t.reason??null,t.referenceId??null,t.userId??null,t.timestamp??new Date().toISOString(),t.warehouseId??null),e.prepare("SELECT * FROM stock_movements WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:stock_movements:addBulk",(a,t)=>{p(a,"db-sync:stock_movements:addBulk",[],()=>e.transaction(()=>{const n=e.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
            referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=[];for(const d of Array.isArray(t)?t:[]){const E=d.id||crypto.randomUUID();s.push(E),n.run(E,d.productId,d.type,d.quantityChange??0,d.previousQuantity??0,d.newQuantity??0,d.reason??null,d.referenceId??null,d.userId??null,d.timestamp??new Date().toISOString(),d.warehouseId??null)}if(s.length===0)return[];const o=s.map(()=>"?").join(", ");return e.prepare(`SELECT * FROM stock_movements WHERE id IN (${o}) ORDER BY timestamp DESC, id DESC`).all(...s)})())}),c.ipcMain.on("db-sync:audit_logs:get",a=>{p(a,"db-sync:audit_logs:get",[],()=>e.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC").all())}),c.ipcMain.on("db-sync:audit_logs:add",(a,t)=>{p(a,"db-sync:audit_logs:add",null,()=>{const r=t.id||crypto.randomUUID();return e.prepare(`
        INSERT INTO audit_logs (
          id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,t.userId??"system",t.action,t.entityType,t.entityId,t.beforeState?JSON.stringify(t.beforeState):null,t.afterState?JSON.stringify(t.afterState):null,t.machineId??null,t.timestamp??new Date().toISOString()),e.prepare("SELECT * FROM audit_logs WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:audit_logs:addBulk",(a,t)=>{p(a,"db-sync:audit_logs:addBulk",[],()=>e.transaction(()=>{const n=e.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=[];for(const d of Array.isArray(t)?t:[]){const E=d.id||crypto.randomUUID();s.push(E),n.run(E,d.userId??"system",d.action,d.entityType,d.entityId,d.beforeState?JSON.stringify(d.beforeState):null,d.afterState?JSON.stringify(d.afterState):null,d.machineId??null,d.timestamp??new Date().toISOString())}if(s.length===0)return[];const o=s.map(()=>"?").join(", ");return e.prepare(`SELECT * FROM audit_logs WHERE id IN (${o}) ORDER BY timestamp DESC, id DESC`).all(...s)})())}),c.ipcMain.handle("db:partners:get",()=>e.prepare("SELECT * FROM partners ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:partners:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.phone,t.address,t.partnershipType,t.sharePercent||0,t.profitShareDevices||0,t.profitShareAccessories||0,t.capitalAmount||0,t.active?1:0,t.notes,t.createdAt||n,n),e.prepare("SELECT * FROM partners WHERE id = ?").get(r)}),c.ipcMain.handle("db:partners:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE partners SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM partners WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:partners:delete",(a,t)=>e.prepare("DELETE FROM partners WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:partner_transactions:get",(a,t)=>t?e.prepare("SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC").all(t):e.prepare("SELECT * FROM partner_transactions ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:partner_transactions:add",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(r,t.partnerId,t.type,t.amount,t.description,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM partner_transactions WHERE id = ?").get(r)}),c.ipcMain.handle("db:warehouses:get",()=>e.prepare("SELECT * FROM warehouses ORDER BY name ASC").all()),c.ipcMain.handle("db:warehouses:add",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO warehouses (id, name, location, isDefault, notes) VALUES (?, ?, ?, ?, ?)").run(r,t.name,t.location,t.isDefault?1:0,t.notes),e.prepare("SELECT * FROM warehouses WHERE id = ?").get(r)}),c.ipcMain.handle("db:warehouses:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(s.push(t),e.prepare(`UPDATE warehouses SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM warehouses WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:warehouses:delete",(a,t)=>e.prepare("DELETE FROM warehouses WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:safe_transactions:get",(a,t)=>t?e.prepare("SELECT * FROM safe_transactions WHERE walletId = ? ORDER BY createdAt DESC").all(t):e.prepare("SELECT * FROM safe_transactions ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:safe_transactions:add",(a,t)=>{const r=t.id||crypto.randomUUID();return Nt(e,String(t.walletId??"")),e.prepare("INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.walletId,t.type,t.subType,t.amount,t.category,t.description,t.paymentMethod,t.affectsCapital?1:0,t.affectsProfit?1:0,t.createdBy,t.relatedId,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM safe_transactions WHERE id = ?").get(r)}),c.ipcMain.handle("db:customers:get",()=>e.prepare("SELECT * FROM customers ORDER BY name ASC").all()),c.ipcMain.handle("db:customers:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.phone,t.email,t.address,t.nationalId,t.notes,t.totalPurchases||0,t.balance||0,t.createdAt||n,n),e.prepare("SELECT * FROM customers WHERE id = ?").get(r)}),c.ipcMain.handle("db:customers:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE customers SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM customers WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:customers:delete",(a,t)=>e.prepare("DELETE FROM customers WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:suppliers:get",()=>e.prepare("SELECT * FROM suppliers ORDER BY name ASC").all()),c.ipcMain.handle("db:suppliers:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.phone,t.email,t.address,t.category,t.balance||0,t.notes,t.active??1,t.createdAt||n,n),e.prepare("SELECT * FROM suppliers WHERE id = ?").get(r)}),c.ipcMain.handle("db:suppliers:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE suppliers SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM suppliers WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:suppliers:delete",(a,t)=>e.prepare("DELETE FROM suppliers WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:employees:get",()=>e.prepare("SELECT * FROM employees ORDER BY name ASC").all()),c.ipcMain.handle("db:employees:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.phone,t.role,t.salary||0,t.commissionRate||0,t.hireDate,t.active??1,t.notes,t.createdAt||n,n),e.prepare("SELECT * FROM employees WHERE id = ?").get(r)}),c.ipcMain.handle("db:employees:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE employees SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM employees WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:employees:delete",(a,t)=>e.prepare("DELETE FROM employees WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:expenses:get",(a,{from:t,to:r}={})=>t&&r?e.prepare("SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC").all(t,r):e.prepare("SELECT * FROM expenses ORDER BY date DESC").all()),c.ipcMain.handle("db:expenses:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.category,t.description,t.amount,t.date,t.paymentMethod||"cash",t.employee,t.notes,t.createdAt||n,n),e.prepare("SELECT * FROM expenses WHERE id = ?").get(r)}),c.ipcMain.handle("db:expenses:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE expenses SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM expenses WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:expenses:delete",(a,t)=>e.prepare("DELETE FROM expenses WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:blacklist:get",()=>e.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:blacklist:add",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.phone,t.nationalId,t.reason,t.notes,t.addedBy,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM blacklist WHERE id = ?").get(r)}),c.ipcMain.handle("db:blacklist:delete",(a,t)=>e.prepare("DELETE FROM blacklist WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:blacklist:search",(a,t)=>{const r=`%${t}%`;return e.prepare("SELECT * FROM blacklist WHERE name LIKE ? OR phone LIKE ? OR nationalId LIKE ?").all(r,r,r)}),c.ipcMain.handle("db:damaged_items:get",()=>e.prepare("SELECT * FROM damaged_items ORDER BY date DESC").all()),c.ipcMain.handle("db:damaged_items:add",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.productName||t.name,t.productId,t.inventoryType,t.quantity||1,t.reason,t.estimatedLoss||0,t.reportedBy,t.date,t.notes,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM damaged_items WHERE id = ?").get(r)}),c.ipcMain.handle("db:damaged_items:delete",(a,t)=>e.prepare("DELETE FROM damaged_items WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:other_revenue:get",()=>e.prepare("SELECT * FROM other_revenue ORDER BY date DESC").all()),c.ipcMain.handle("db:other_revenue:add",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.source,t.description,t.amount,t.date,t.paymentMethod||"cash",t.notes,t.createdAt||new Date().toISOString()),e.prepare("SELECT * FROM other_revenue WHERE id = ?").get(r)}),c.ipcMain.handle("db:other_revenue:delete",(a,t)=>e.prepare("DELETE FROM other_revenue WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:wallets:get",()=>e.prepare("SELECT * FROM wallets ORDER BY name ASC").all()),c.ipcMain.handle("db:wallets:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.name,t.type||"cash",t.balance||0,t.isDefault?1:0,t.icon||null,t.color,t.notes,t.createdAt||n,n),e.prepare("SELECT * FROM wallets WHERE id = ?").get(r)}),c.ipcMain.handle("db:wallets:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE wallets SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM wallets WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:wallets:delete",(a,t)=>e.transaction(()=>(e.prepare("DELETE FROM safe_transactions WHERE walletId = ?").run(t),e.prepare("DELETE FROM wallets WHERE id = ?").run(t).changes>0))()),c.ipcMain.handle("db:used_devices:get",()=>e.prepare("SELECT * FROM used_devices ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:used_devices:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare(`
      INSERT INTO used_devices (
        id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
        ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(r,t.name,t.model??null,t.deviceType??null,t.category??t.deviceType??null,t.condition||"good",t.purchasePrice||0,t.sellingPrice||0,t.status||"in_stock",t.serialNumber,t.color,t.storage,t.ram??null,t.description??null,t.notes??t.description??null,t.image,t.soldAt,t.purchasedFrom,t.soldTo,t.createdAt||n,n),e.prepare("SELECT * FROM used_devices WHERE id = ?").get(r)}),c.ipcMain.handle("db:used_devices:update",(a,t,r)=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"deviceType")&&!Object.prototype.hasOwnProperty.call(n,"category")&&(n.category=n.deviceType),Object.prototype.hasOwnProperty.call(n,"description")&&!Object.prototype.hasOwnProperty.call(n,"notes")&&(n.notes=n.description);const{sets:s,values:o}=O(n);return s.length?(s.push("updatedAt = ?"),o.push(new Date().toISOString()),o.push(t),e.prepare(`UPDATE used_devices SET ${s.join(", ")} WHERE id = ?`).run(...o),e.prepare("SELECT * FROM used_devices WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:used_devices:delete",(a,t)=>e.prepare("DELETE FROM used_devices WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:reminders:get",()=>e.prepare("SELECT * FROM reminders ORDER BY dueDate ASC").all()),c.ipcMain.handle("db:reminders:add",(a,t)=>{const r=t.id||crypto.randomUUID(),n=new Date().toISOString();return e.prepare("INSERT INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,t.title,t.description,t.dueDate,t.priority||"medium",t.completed?1:0,t.completedAt,t.recurring,t.category,t.createdAt||n,n),e.prepare("SELECT * FROM reminders WHERE id = ?").get(r)}),c.ipcMain.handle("db:reminders:update",(a,t,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(t),e.prepare(`UPDATE reminders SET ${n.join(", ")} WHERE id = ?`).run(...s),e.prepare("SELECT * FROM reminders WHERE id = ?").get(t)):!0}),c.ipcMain.handle("db:reminders:delete",(a,t)=>e.prepare("DELETE FROM reminders WHERE id = ?").run(t).changes>0),c.ipcMain.handle("db:shifts:get",()=>e.prepare("SELECT * FROM shift_records ORDER BY openedAt DESC").all()),c.ipcMain.handle("db:shifts:getActive",()=>e.prepare("SELECT * FROM shift_records WHERE closedAt IS NULL ORDER BY openedAt DESC LIMIT 1").get()),c.ipcMain.handle("db:shifts:open",(a,t)=>{const r=t.id||crypto.randomUUID();return e.prepare("INSERT INTO shift_records (id, openedAt, openingBalance, openedBy, notes) VALUES (?, ?, ?, ?, ?)").run(r,t.openedAt||new Date().toISOString(),t.openingBalance||0,t.openedBy,t.notes),e.prepare("SELECT * FROM shift_records WHERE id = ?").get(r)}),c.ipcMain.handle("db:shifts:close",(a,t,r)=>(e.prepare("UPDATE shift_records SET closedAt = ?, closingBalance = ?, totalSales = ?, totalExpenses = ?, closedBy = ?, notes = ? WHERE id = ?").run(r.closedAt||new Date().toISOString(),r.closingBalance||0,r.totalSales||0,r.totalExpenses||0,r.closedBy,r.notes,t),e.prepare("SELECT * FROM shift_records WHERE id = ?").get(t))),c.ipcMain.handle("db-sync:checkout:process",(a,{sale:t,stockMovements:r,auditEntries:n})=>{var s;try{return e.transaction(()=>{e.prepare(`
          INSERT INTO sales (
            id, invoiceNumber, date, subtotal, discount, total, 
            totalCost, grossProfit, marginPct, paymentMethod, employee, idempotencyKey
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(t.id,t.invoiceNumber,t.date,t.subtotal,t.discount,t.total,t.totalCost,t.grossProfit,t.marginPct,t.paymentMethod,t.employeeId||t.employee,t.idempotencyKey);const o=e.prepare(`
          INSERT INTO sale_items (
            id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const T of t.items)o.run(T.id,t.id,T.productId,T.name,T.qty,T.price,T.cost,T.lineDiscount||0,T.warehouseId,JSON.stringify(T.batches||[]));const d=e.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, 
            reason, referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),E=e.prepare(`
          UPDATE products SET quantity = quantity + ? WHERE id = ?
        `),m=e.prepare(`
          UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?
        `);for(const T of r){d.run(T.id,T.productId,T.type,T.quantityChange,T.previousQuantity,T.newQuantity,T.reason,T.referenceId,T.userId,T.timestamp,T.warehouseId),E.run(T.quantityChange,T.productId);try{m.run(T.quantityChange,T.productId)}catch{}}const S=e.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const T of n||[])S.run(T.id||crypto.randomUUID(),T.userId,T.action,T.entityType,T.entityId,T.beforeStateJson?JSON.stringify(T.beforeStateJson):null,T.afterStateJson?JSON.stringify(T.afterStateJson):null,T.machineId||"local",T.timestamp||new Date().toISOString())})(),{success:!0}}catch(o){return console.error("[checkout] Transaction failed:",o),(s=o==null?void 0:o.message)!=null&&s.includes("UNIQUE constraint failed: sales.idempotencyKey")?{success:!1,error:"DUPLICATE_TRANSACTION",message:"This transaction was already completed."}:{success:!1,error:"TRANSACTION_FAILED",message:o.message}}}),c.ipcMain.handle("db:stats",()=>{const a=["products","sales","customers","suppliers","employees","expenses","installments","repair_tickets","repair_parts","wallets","used_devices","reminders","blacklist","damaged_items","other_revenue","partners","warehouses"],t={};for(const r of a)try{const n=e.prepare(`SELECT COUNT(*) as c FROM ${r}`).get();t[r]=n.c}catch{t[r]=-1}return t}),c.ipcMain.handle("db:factory-reset",()=>{try{return e.transaction(()=>{const t=e.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);for(const r of t)if(!(r==="settings"||r==="users"||r==="sqlite_sequence"||r==="sqlite_stat1"))try{e.prepare(`DELETE FROM ${r}`).run()}catch{}})(),!0}catch(a){return console.error("Factory reset failed:",a),!1}})}function Ot(e){const a=["mobile_spare_part","device_spare_part","computer_spare_part"],t=r=>{switch(r){case"mobile":case"tablet":return"mobile_spare_part";case"device":return"device_spare_part";case"computer":case"laptop":return"computer_spare_part";default:return null}};c.ipcMain.handle("db:repairs:getTickets",(r,n={})=>{let s="SELECT * FROM repair_tickets WHERE 1=1";const o=[];if(n.status&&(s+=" AND status = ?",o.push(n.status)),n.customerId&&(s+=" AND client_id = ?",o.push(n.customerId)),n.search){s+=" AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ?)";const d=`%${n.search}%`;o.push(d,d,d)}return s+=" ORDER BY createdAt DESC",e.prepare(s).all(...o)}),c.ipcMain.handle("db:repairs:getTicket",(r,n)=>e.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(n)),c.ipcMain.handle("db:repairs:addTicket",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=n.ticket_no||`TKT-${Date.now()}`;return e.prepare(`
      INSERT INTO repair_tickets (
        id, ticket_no, client_id, customer_name, customer_phone,
        device_category, device_brand, device_model, imei_or_serial,
        issue_description, accessories_received, device_passcode,
        status, package_price, final_cost, warranty_days,
        assigned_tech_name, tech_bonus_type, tech_bonus_value,
        createdAt, createdBy, updatedAt, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,d,n.client_id||n.customerId||null,n.customer_name||"عميل نقدي",n.customer_phone||null,n.device_category||"mobile",n.device_brand||n.deviceBrand||null,n.device_model||n.deviceModel||null,n.imei_or_serial||n.serial||null,n.issue_description||n.problemDesc||"",n.accessories_received||n.accessories||null,n.device_passcode||n.password||null,n.status||"received",n.package_price??n.expectedCost??null,n.final_cost??null,n.warranty_days??null,n.assigned_tech_name||n.techName||null,n.tech_bonus_type||null,n.tech_bonus_value??null,n.createdAt||o,n.createdBy||null,o,n.updatedBy||null),e.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:updateTicket",(r,n,s)=>{const o=new Set(["client_id","customer_name","customer_phone","device_category","device_brand","device_model","imei_or_serial","issue_description","accessories_received","device_passcode","status","package_price","final_cost","warranty_days","assigned_tech_name","tech_bonus_type","tech_bonus_value","updatedBy"]),d=[],E=[];for(const[m,S]of Object.entries(s))o.has(m)&&(d.push(`${m} = ?`),E.push(S===void 0?null:S));return d.length===0||(d.push("updatedAt = ?"),E.push(new Date().toISOString()),E.push(n),e.prepare(`UPDATE repair_tickets SET ${d.join(", ")} WHERE id = ?`).run(...E)),e.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(n)}),c.ipcMain.handle("db:repairs:deleteTicket",(r,n)=>(e.prepare("DELETE FROM repair_ticket_parts WHERE ticket_id = ?").run(n),e.prepare("DELETE FROM repair_events WHERE ticket_id = ?").run(n),e.prepare("DELETE FROM repair_payments WHERE ticket_id = ?").run(n),e.prepare("DELETE FROM repair_status_history WHERE ticket_id = ?").run(n),e.prepare("DELETE FROM repair_tickets WHERE id = ?").run(n).changes>0)),c.ipcMain.handle("db:repairs:getHistory",(r,n)=>e.prepare("SELECT * FROM repair_status_history WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addHistory",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return e.prepare(`
      INSERT INTO repair_status_history (id, ticket_id, from_status, to_status, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.from_status||null,n.to_status,n.note||null,o,n.createdBy||null),e.prepare("SELECT * FROM repair_status_history WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getEvents",(r,n)=>e.prepare("SELECT * FROM repair_events WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addEvent",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return e.prepare(`
      INSERT INTO repair_events (id, ticket_id, event_type, from_status, to_status, note, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.event_type,n.from_status||n.old_status||null,n.to_status||n.new_status||null,n.note||n.notes||null,n.createdBy||n.user_name||null,o),e.prepare("SELECT * FROM repair_events WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getPayments",(r,n)=>e.prepare("SELECT * FROM repair_payments WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addPayment",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return e.prepare(`
      INSERT INTO repair_payments (id, ticket_id, kind, amount, wallet_type, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.kind||"deposit",n.amount,n.wallet_type||"cash",n.note||null,o,n.createdBy||null),e.prepare("SELECT * FROM repair_payments WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getParts",()=>e.prepare("SELECT * FROM repair_parts ORDER BY name ASC").all()),c.ipcMain.handle("db:repairs:getPart",(r,n)=>e.prepare("SELECT * FROM repair_parts WHERE id = ?").get(n)),c.ipcMain.handle("db:repairs:addPart",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return e.prepare(`
      INSERT INTO repair_parts (
        id, name, category, sku, brand, compatible_models,
        unit_cost, selling_price, qty, min_qty,
        barcode, color, location, active, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.name,n.category||null,n.sku||n.part_no||null,n.brand||null,n.compatible_models||null,n.unit_cost||n.cost_price||0,n.selling_price||0,n.qty||n.current_stock||0,n.min_qty||n.min_stock||0,n.barcode||null,n.color||null,n.location||null,n.active??1,n.notes||null,o),e.prepare("SELECT * FROM repair_parts WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:updatePart",(r,n,s)=>{const o=["id","createdAt"],d=[],E=[];for(const[m,S]of Object.entries(s))o.includes(m)||(d.push(`${m} = ?`),E.push(S));return d.length===0||(E.push(n),e.prepare(`UPDATE repair_parts SET ${d.join(", ")} WHERE id = ?`).run(...E)),e.prepare("SELECT * FROM repair_parts WHERE id = ?").get(n)}),c.ipcMain.handle("db:repairs:deletePart",(r,n)=>e.prepare("DELETE FROM repair_parts WHERE id = ?").run(n).changes>0),c.ipcMain.handle("db:repairs:getTicketParts",(r,n)=>e.prepare(`
      SELECT tp.*, 
        COALESCE(rp.name, acc.name) as partName,
        COALESCE(rp.unit_cost, acc.costPrice, acc.newCostPrice) as partCostPrice,
        COALESCE(rp.selling_price, acc.salePrice) as partSellingPrice
      FROM repair_ticket_parts tp
      LEFT JOIN repair_parts rp ON tp.part_id = rp.id
      LEFT JOIN accessories acc ON tp.part_id = acc.id
      WHERE tp.ticket_id = ?
    `).all(n)),c.ipcMain.handle("db:repairs:addTicketPart",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=Math.max(1,Number(n.qty||n.quantity||1)),E=e.prepare("SELECT id, ticket_no, device_category FROM repair_tickets WHERE id = ?").get(n.ticket_id);if(!E)throw new Error("طلب الصيانة غير موجود.");const m=t(E.device_category),S=e.prepare("SELECT id, name, quantity, inventoryType FROM accessories WHERE id = ?").get(n.part_id),T=S?void 0:e.prepare("SELECT id, name, qty FROM repair_parts WHERE id = ?").get(n.part_id);if(S){if(!a.includes(S.inventoryType))throw new Error("القطعة المختارة ليست من مخزون قطع الغيار.");if(m&&S.inventoryType!==m)throw new Error("يجب اختيار قطعة من مخزون نفس نوع الجهاز الجاري إصلاحه.");if(Number(S.quantity||0)<d)throw new Error(`الكمية المتاحة من ${S.name} هي ${S.quantity} فقط.`)}else if(T&&Number(T.qty||0)<d)throw new Error(`الكمية المتاحة من ${T.name} هي ${T.qty} فقط.`);return e.prepare(`
      INSERT INTO repair_ticket_parts (id, ticket_id, part_id, qty, unit_cost, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.part_id,d,n.unit_cost||n.cost_price||0,n.status||"used",o,o),S?e.prepare("UPDATE accessories SET quantity = MAX(0, quantity - ?) WHERE id = ?").run(d,n.part_id):T&&e.prepare("UPDATE repair_parts SET qty = MAX(0, qty - ?) WHERE id = ?").run(d,n.part_id),(S||T)&&e.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, 'usage', ?, ?, ?, ?)
    `).run(crypto.randomUUID(),n.part_id,n.ticket_id,d,n.unit_cost||0,`استخدام في تذكرة ${n.ticket_id}`,o),e.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:removeTicketPart",(r,n)=>{const s=e.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(n);return s&&(e.prepare("SELECT id FROM accessories WHERE id = ?").get(s.part_id)?e.prepare("UPDATE accessories SET quantity = quantity + ? WHERE id = ?").run(s.qty,s.part_id):e.prepare("SELECT id FROM repair_parts WHERE id = ?").get(s.part_id)&&e.prepare("UPDATE repair_parts SET qty = qty + ? WHERE id = ?").run(s.qty,s.part_id)),e.prepare("DELETE FROM repair_ticket_parts WHERE id = ?").run(n).changes>0}),c.ipcMain.handle("db:repairs:getInvoices",(r,n)=>n?e.prepare("SELECT * FROM repair_invoices WHERE ticket_id = ? ORDER BY createdAt DESC").all(n):e.prepare("SELECT * FROM repair_invoices ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:repairs:addInvoice",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=n.invoice_no||`INV-${Date.now()}`;if(e.prepare(`
      INSERT INTO repair_invoices (id, invoice_no, ticket_id, createdAt, deliveredAt,
        subtotal_labor, subtotal_parts, discount, tax, total, paid_total, remaining,
        payment_summary_json, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,d,n.ticket_id,o,n.deliveredAt||null,n.subtotal_labor||0,n.subtotal_parts||0,n.discount||0,n.tax||0,n.total||0,n.paid_total||0,n.remaining||0,n.payment_summary_json?JSON.stringify(n.payment_summary_json):null,n.createdBy||null),Array.isArray(n.items))for(const E of n.items)e.prepare(`
          INSERT INTO repair_invoice_items (id, invoice_id, type, ref_id, name, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(),s,E.type,E.ref_id||null,E.name,E.qty||1,E.unit_price||0,(E.qty||1)*(E.unit_price||0));return e.prepare("SELECT * FROM repair_invoices WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getPartMovements",(r,n)=>e.prepare("SELECT * FROM repair_parts_movements WHERE part_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addPartMovement",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();e.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.part_id,n.ticket_id||null,n.type,n.qty,n.unit_cost||0,n.note||null,o);const d=["purchase","return","adjustment_add"].includes(n.type)?n.qty:-n.qty;return e.prepare("UPDATE repair_parts SET qty = MAX(0, qty + ?) WHERE id = ?").run(d,n.part_id),e.prepare("SELECT * FROM repair_parts_movements WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getAccessoryParts",(r,n)=>{const s=`
      SELECT * FROM accessories 
      WHERE inventoryType IN ('mobile_spare_part', 'device_spare_part', 'computer_spare_part')
      ${n?"AND inventoryType = ?":""}
      AND (isArchived IS NULL OR isArchived = 0)
      ORDER BY name ASC
    `;return n?e.prepare(s).all(n):e.prepare(s).all()}),c.ipcMain.handle("db:repairs:stats",()=>{const r=["received","diagnosing","waiting_parts","repairing","ready","delivered","cancelled"],n={};for(const o of r){const d=e.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status = ?").get(o);n[o]=d.c}const s=e.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status NOT IN ('delivered','cancelled')").get();return n.active=s.c,n})}c.protocol.registerSchemesAsPrivileged([{scheme:"local-img",privileges:{secure:!0,standard:!0,bypassCSP:!0}}]);const ht=pe.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:j&&j.tagName.toUpperCase()==="SCRIPT"&&j.src||new URL("main.js",document.baseURI).href),V=F.dirname(ht);let x=null,L=null;function $(){return!c.app.isPackaged}function M(e,a){try{const t=c.app.isReady()?c.app.getPath("userData"):F.join(process.cwd(),"logs");H.mkdirSync(t,{recursive:!0});const r=F.join(t,"startup.log"),n=a instanceof Error?`${a.stack??a.message}`:a?JSON.stringify(a):"";H.appendFileSync(r,`[${new Date().toISOString()}] ${e}${n?`
${n}`:""}
`)}catch(t){console.error("Failed to write startup log",t)}}function Ct(){const e=["preload.js","preload.cjs","preload.mjs"];for(const a of e){const t=F.join(V,a);if(H.existsSync(t))return t}return F.join(V,"preload.js")}function Dt(){const e=$()?[F.join(V,"../public/logo.png")]:[F.join(V,"../dist/logo.png"),F.join(process.resourcesPath,"app.asar.unpacked/dist/logo.png")];for(const a of e)if(H.existsSync(a))return a}function se(){const e=Ct(),a=Dt();let t=null;if(M(`Creating main window with preload at ${e}`),L=new c.BrowserWindow({width:1280,height:800,minWidth:900,minHeight:600,show:!1,icon:a,webPreferences:{nodeIntegration:!1,contextIsolation:!0,preload:e}}),$()&&process.env.VITE_DEV_SERVER_URL)M(`Loading renderer URL ${process.env.VITE_DEV_SERVER_URL}`),L.loadURL(process.env.VITE_DEV_SERVER_URL),L.webContents.openDevTools();else{const n=F.join(V,"../dist/index.html");M(`Loading renderer file ${n}`),L.loadFile(n)}L.once("ready-to-show",()=>{M("Main window emitted ready-to-show"),t&&(clearTimeout(t),t=null),L==null||L.show(),L==null||L.focus()}),L.webContents.on("did-finish-load",()=>{M("Main window emitted did-finish-load"),t&&(clearTimeout(t),t=null),L!=null&&L.isVisible()||(L==null||L.show(),L==null||L.focus())}),L.webContents.on("did-fail-load",(n,s,o,d)=>{console.error("Renderer failed to load",{errorCode:s,errorDescription:o,validatedURL:d}),M(`Renderer failed to load (${s}) ${d??"unknown url"}: ${o}`),t&&(clearTimeout(t),t=null),L!=null&&L.isVisible()||L==null||L.show()}),L.on("closed",()=>{M("Main window closed"),t&&(clearTimeout(t),t=null),L=null}),t=setTimeout(()=>{L!=null&&L.isVisible()||(console.warn("Renderer did not trigger ready-to-show in time, revealing window fallback."),M("Renderer did not trigger ready-to-show in time, revealing window fallback"),L==null||L.show(),L==null||L.focus())},3e3),L.setMenuBarVisibility(!1)}c.ipcMain.on("store-get",(e,a)=>{if(!x){e.returnValue=null;return}try{const t=x.prepare("SELECT value FROM settings WHERE key = ?").get(a);e.returnValue=t?JSON.parse(t.value):null}catch(t){console.error("store-get error:",t),e.returnValue=null}});c.ipcMain.on("store-set",(e,a,t)=>{if(!x){e.returnValue=!1;return}try{x.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(a,JSON.stringify(t)),e.returnValue=!0}catch(r){console.error("store-set error:",r),e.returnValue=!1}});c.ipcMain.on("store-delete",(e,a)=>{if(!x){e.returnValue=!1;return}try{x.prepare("DELETE FROM settings WHERE key = ?").run(a),e.returnValue=!0}catch(t){console.error("store-delete error:",t),e.returnValue=!1}});c.app.whenReady().then(()=>{try{M("Electron app is ready"),x=Ne(),M("Database initialized"),ke(x),M("Data migration completed"),gt(x),M("IPC handlers registered"),Ot(x),M("Repair handlers registered");const e=c.app.getPath("userData"),a=F.join(e,"images");c.protocol.handle("local-img",t=>{const r=t.url.slice(12).split("?")[0],n=F.join(a,decodeURIComponent(r));return c.net.fetch(`file://${n}`)}),M("local-img protocol handler registered"),se(),c.app.on("activate",()=>{c.BrowserWindow.getAllWindows().length===0&&(M("App activated with no windows, recreating main window"),se())})}catch(e){M("Fatal startup error",e),c.dialog.showErrorBox("تعذر تشغيل البرنامج",e instanceof Error?e.message:"حدث خطأ غير متوقع أثناء تشغيل البرنامج."),c.app.quit()}});c.app.on("window-all-closed",()=>{process.platform!=="darwin"&&c.app.quit()});process.on("uncaughtException",e=>{M("Uncaught exception",e),c.dialog.showErrorBox("خطأ غير متوقع",e.message)});process.on("unhandledRejection",e=>{M("Unhandled rejection",e)});c.ipcMain.handle("ping",()=>"pong");c.ipcMain.handle("save-image",async(e,a)=>{try{const t=c.app.getPath("userData"),r=F.join(t,"images");H.existsSync(r)||H.mkdirSync(r,{recursive:!0});const n=a.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);if(!n||n.length!==3)return{success:!1,error:"Invalid base64 format"};const s=n[1].split("/")[1]||"png",o=Buffer.from(n[2],"base64"),d=`img_${Date.now()}.${s}`,E=F.join(r,d);return H.writeFileSync(E,o),{success:!0,path:`local-img://${d}`}}catch(t){return console.error("Error saving image:",t),{success:!1,error:t instanceof Error?t.message:"Unknown error"}}});c.ipcMain.handle("db:backup",async()=>{try{const e=c.app.getPath("userData"),a=$(),t=F.join(e,a?"retail_dev.sqlite":"retail_prod.sqlite"),{canceled:r,filePath:n}=await c.dialog.showSaveDialog({title:"حفظ نسخة احتياطية من قاعدة البيانات",defaultPath:F.join(c.app.getPath("downloads"),`backup_${new Date().toISOString().replace(/[:.]/g,"-")}.sqlite`),filters:[{name:"SQLite Database",extensions:["sqlite"]}]});return r||!n?{success:!1,reason:"canceled"}:(H.copyFileSync(t,n),{success:!0,path:n})}catch(e){return{success:!1,error:e instanceof Error?e.message:"Unknown error"}}});c.ipcMain.handle("db:restore",async()=>{try{const{canceled:e,filePaths:a}=await c.dialog.showOpenDialog({title:"استعادة قاعدة البيانات من نسخة احتياطية",filters:[{name:"SQLite Database",extensions:["sqlite"]}],properties:["openFile"]});if(e||!a.length)return{success:!1,reason:"canceled"};const t=c.app.getPath("userData"),r=$(),n=F.join(t,r?"retail_dev.sqlite":"retail_prod.sqlite"),s=n+".bak";return H.existsSync(n)&&H.copyFileSync(n,s),H.copyFileSync(a[0],n),{success:!0}}catch(e){return{success:!1,error:e instanceof Error?e.message:"Unknown error"}}});c.ipcMain.handle("db:getUserDataPath",()=>c.app.getPath("userData"));
