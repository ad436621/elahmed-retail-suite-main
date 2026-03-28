"use strict";const c=require("electron"),M=require("path"),de=require("url"),W=require("fs"),le=require("better-sqlite3");var G=typeof document<"u"?document.currentScript:null;function ue(){const t=process.env.NODE_ENV!=="production",a=c.app.getPath("userData"),e=M.join(a,t?"retail_dev.sqlite":"retail_prod.sqlite");console.log(`Initializing SQLite database at: ${e}`);const r=new le(e,{verbose:t?console.log:void 0});return r.pragma("journal_mode = WAL"),r.pragma("foreign_keys = ON"),r.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee_month ON employee_salaries(employeeId, month);
    CREATE INDEX IF NOT EXISTS idx_employee_advances_employee_date ON employee_advances(employeeId, date);
    CREATE INDEX IF NOT EXISTS idx_product_batches_productId ON product_batches(productId);
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
    CREATE INDEX IF NOT EXISTS idx_supplier_transactions_supplier_created ON supplier_transactions(supplierId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_other_revenue_date ON other_revenue(date);
    CREATE INDEX IF NOT EXISTS idx_reminders_due_status ON reminders(dueDate, status, completed);
    CREATE INDEX IF NOT EXISTS idx_safe_transactions_wallet_created ON safe_transactions(walletId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_repair_tickets_status_created ON repair_tickets(status, createdAt);
    CREATE INDEX IF NOT EXISTS idx_used_devices_serial_status ON used_devices(serialNumber, status);
  `),r}function y(t,a=0){const e=Number(t);return Number.isFinite(e)?Math.round(Math.max(0,e)*100)/100:a}function k(t,a=0,e=0){const r=Number(t);return Number.isFinite(r)?Math.max(e,Math.round(r)):Math.max(e,a)}function h(t,a=""){return typeof t=="string"?t:a}function D(t){const a=h(t).trim();return a||null}function Q(t){return t?1:0}function ne(t){return t==="completed"||t==="overdue"||t==="cancelled"?t:"active"}function pe(t){if(Array.isArray(t))return t;if(typeof t!="string"||!t.trim())return[];try{const a=JSON.parse(t);return Array.isArray(a)?a:[]}catch{return[]}}function Te(t){return!Array.isArray(t)||t.length===0?null:JSON.stringify(t)}function me(t,a){const e=D(a.customerId);if(e){const N=t.prepare("SELECT id FROM customers WHERE id = ?").get(e);if(N)return N.id}const r=h(a.customerName).trim();if(!r)return null;const n=D(a.customerPhone),s=D(a.customerAddress),o=D(a.customerIdCard),d=n?t.prepare("SELECT id FROM customers WHERE phone = ? LIMIT 1").get(n):void 0;if(d)return t.prepare(`
      UPDATE customers
      SET name = ?, address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(r,s,o,new Date().toISOString(),d.id),d.id;const E=t.prepare("SELECT id FROM customers WHERE name = ? LIMIT 1").get(r);if(E)return t.prepare(`
      UPDATE customers
      SET phone = COALESCE(?, phone), address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(n,s,o,new Date().toISOString(),E.id),E.id;const T=e||crypto.randomUUID(),A=new Date().toISOString();return t.prepare(`
    INSERT INTO customers (id, name, phone, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(T,r,n,s,o,"Auto-created from installment contract",A,A),T}function Ae(t,a){const e=D(a.productId);if(!e)return null;const r=t.prepare("SELECT id FROM products WHERE id = ?").get(e);if(r)return r.id;const n=new Date().toISOString();return t.prepare(`
    INSERT INTO products (
      id, name, barcode, category, condition, quantity,
      oldCostPrice, newCostPrice, salePrice, supplier, source,
      notes, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?, ?, NULL)
  `).run(e,h(a.productName,"Installment Product"),e,D(a.contractType)||"installment","new",y(a.installmentPrice),"installment_snapshot","Auto-created from installment contract",n,n),e}function Ne(t){const a=t.prepare(`
    SELECT id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    FROM installment_schedules
    ORDER BY contractId ASC, monthNumber ASC, dueDate ASC
  `).all(),e=new Map;for(const r of a){const n=e.get(r.contractId)||[];n.push({id:r.id,month:r.monthNumber,dueDate:r.dueDate,amount:y(r.amount),paidAmount:y(r.paidAmount),penalty:y(r.penalty),paid:!!r.paid,remainingAfter:r.remainingAfter===null?void 0:y(r.remainingAfter),note:r.note||""}),e.set(r.contractId,n)}return e}function Se(t){const a=t.prepare(`
    SELECT paymentId, scheduleItemId, amount
    FROM installment_payment_allocations
    ORDER BY paymentId ASC
  `).all(),e=new Map;for(const s of a){const o=e.get(s.paymentId)||[];o.push({scheduleItemId:s.scheduleItemId,amount:y(s.amount)}),e.set(s.paymentId,o)}const r=t.prepare(`
    SELECT id, contractId, amount, date, note, createdAt
    FROM installment_payments
    ORDER BY contractId ASC, date ASC, createdAt ASC
  `).all(),n=new Map;for(const s of r){const o=n.get(s.contractId)||[];o.push({id:s.id,amount:y(s.amount),date:s.date,note:s.note||"",allocations:e.get(s.id)||[]}),n.set(s.contractId,o)}return n}function ae(t){const a=Ne(t),e=Se(t);return t.prepare(`
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
  `).all().map(n=>({id:n.id,contractNumber:n.contractNumber,contractType:n.contractType||"product",customerId:n.customerId||void 0,customerName:n.customerName,customerIdCard:n.customerIdCard||"",guarantorName:n.guarantorName||"",guarantorIdCard:n.guarantorIdCard||"",guarantorPhone:n.guarantorPhone||"",guarantorAddress:n.guarantorAddress||"",customerPhone:n.customerPhone||"",customerAddress:n.customerAddress||"",productName:n.productName,productId:n.productId||void 0,transferType:n.transferType||void 0,cashPrice:y(n.cashPrice),installmentPrice:y(n.installmentPrice),downPayment:y(n.downPayment),months:k(n.months,1,1),monthlyInstallment:y(n.monthlyInstallment),firstInstallmentDate:h(n.firstInstallmentDate),schedule:a.get(h(n.id))||[],payments:e.get(h(n.id))||[],paidTotal:y(n.paidTotal),remaining:y(n.remaining),notes:n.notes||"",customFields:pe(n.customFieldsJson),status:ne(n.status),settledEarly:!!n.settledEarly,settlementDiscount:y(n.settlementDiscount),createdAt:h(n.createdAt,new Date().toISOString()),updatedAt:h(n.updatedAt,h(n.createdAt,new Date().toISOString()))}))}function se(t,a){const e=t.prepare(`
    INSERT INTO installments (
      id, contractNumber, contractType, customerId, customerName, customerPhone, customerAddress,
      customerIdCard, guarantorName, guarantorIdCard, guarantorPhone, guarantorAddress,
      productId, productName, transferType, cashPrice, installmentPrice, downPayment,
      months, monthlyInstallment, paidTotal, remaining, firstInstallmentDate, notes,
      customFieldsJson, status, settledEarly, settlementDiscount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),r=t.prepare(`
    INSERT INTO installment_schedules (
      id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=t.prepare(`
    INSERT INTO installment_payments (id, contractId, amount, date, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `),s=t.prepare(`
    INSERT INTO installment_payment_allocations (id, paymentId, scheduleItemId, amount)
    VALUES (?, ?, ?, ?)
  `),o=new Date().toISOString();return t.transaction(d=>{t.prepare("DELETE FROM installment_payment_allocations").run(),t.prepare("DELETE FROM installment_payments").run(),t.prepare("DELETE FROM installment_schedules").run(),t.prepare("DELETE FROM installments").run();for(const E of d){const T=h(E.id,crypto.randomUUID()),A=me(t,E),N=Ae(t,E),g=Array.isArray(E.schedule)?E.schedule:[],F=Array.isArray(E.payments)?E.payments:[],_=h(E.createdAt,o),C=h(E.updatedAt,_);e.run(T,h(E.contractNumber,`INS-${Date.now()}`),h(E.contractType,"product"),A,h(E.customerName),D(E.customerPhone),D(E.customerAddress),D(E.customerIdCard),D(E.guarantorName),D(E.guarantorIdCard),D(E.guarantorPhone),D(E.guarantorAddress),N,h(E.productName),D(E.transferType),y(E.cashPrice),y(E.installmentPrice),y(E.downPayment),k(E.months,g.length||1,1),y(E.monthlyInstallment),y(E.paidTotal),y(E.remaining),D(E.firstInstallmentDate),D(E.notes),Te(E.customFields),ne(E.status),Q(E.settledEarly),y(E.settlementDiscount),_,C),g.slice().sort((L,f)=>k(L.month,0,0)-k(f.month,0,0)||h(L.dueDate).localeCompare(h(f.dueDate))).forEach((L,f)=>{const P=h(L.id,crypto.randomUUID());r.run(P,T,k(L.month,f+1,1),h(L.dueDate),y(L.amount),y(L.paidAmount),y(L.penalty),Q(L.paid),L.remainingAfter===void 0?null:y(L.remainingAfter),D(L.note))});for(const L of F){const f=h(L.id,crypto.randomUUID());n.run(f,T,y(L.amount),h(L.date,_.slice(0,10)),D(L.note),_);const P=Array.isArray(L.allocations)?L.allocations:[];for(const H of P){const I=D(H.scheduleItemId);I&&s.run(crypto.randomUUID(),f,I,y(H.amount))}}}})(a),ae(t)}function m(t,a){const e=t.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!e)return null;try{const r=JSON.parse(e.value);return Array.isArray(r)?r:null}catch{return null}}function S(t,a){const e=t.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(a);return!!(e!=null&&e.name)}function R(t,a){return S(t,a)?t.prepare(`SELECT COUNT(*) as c FROM ${a}`).get().c===0:!0}function ie(t,a){return S(t,a)?t.prepare(`PRAGMA table_info(${a})`).all().map(e=>e.name):[]}function w(t,a,e){const r=new Set(ie(t,a));return e.every(n=>r.has(n))}function l(t,a,e,r){!S(t,a)||new Set(ie(t,a)).has(e)||t.exec(`ALTER TABLE ${a} ADD COLUMN ${e} ${r}`)}function i(...t){for(const a of t)if(typeof a=="string"&&a.trim())return a;return""}function u(...t){for(const a of t){const e=Number(a);if(Number.isFinite(e))return Math.round(Math.max(0,e)*100)/100}return 0}function X(t){return!!t}function Y(t){if(Array.isArray(t))return t;if(typeof t!="string"||!t.trim())return[];try{const a=JSON.parse(t);return Array.isArray(a)?a:[]}catch{return[]}}function oe(t,a){if(typeof t!="string")return 0;const e=new RegExp(`^${a}-(\\d+)$`).exec(t.trim());if(!e)return 0;const r=Number.parseInt(e[1],10);return Number.isFinite(r)?r:0}function Le(t,a){return a<=0?"confirmed":a>=t?"paid":"partial"}const z=["dashboard","pos","sales","inventory","mobiles","computers","devices","used","cars","warehouse","maintenance","installments","expenses","damaged","otherRevenue","returns","settings","users","customers","wallets","employees","suppliers","blacklist","reminders","shiftClosing","purchaseInvoices"];function Ie(t){t.exec(`
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
  `)}function Re(t){const a=new Map,e=[m(t,"gx_wallets"),m(t,"retail_wallets")];for(const r of e)for(const n of r||[]){const s=i(n.id);s&&a.set(s,n)}return a}function ye(t,a,e){if(!e||t.prepare("SELECT id FROM wallets WHERE id = ?").get(e))return;const n=a.get(e),s=new Date().toISOString(),o=i(n==null?void 0:n.type,"cash"),d=i(n==null?void 0:n.icon,o==="bank"?"🏦":o==="card"?"💳":o==="transfer"?"📲":"💵"),E=e==="wallet_cash"?"الصندوق":`Wallet ${e.slice(0,8)}`;t.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(e,i(n==null?void 0:n.name,E),o,X(n==null?void 0:n.isDefault)?1:0,d||null,i(n==null?void 0:n.color)||null,i(n==null?void 0:n.notes,"Auto-created to repair wallet references"),i(n==null?void 0:n.createdAt,s),i(n==null?void 0:n.updatedAt,s))}function Oe(t){t.exec(`
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
  `)}function _e(t){if(!S(t,"installments"))return[];const a=t.prepare("SELECT * FROM installments").all();if(a.length===0)return[];const e=S(t,"installment_schedules")?t.prepare("SELECT * FROM installment_schedules").all():[],r=S(t,"installment_payments")?t.prepare("SELECT * FROM installment_payments").all():[],n=S(t,"installment_payment_allocations")?t.prepare("SELECT * FROM installment_payment_allocations").all():[],s=new Map;for(const E of e){const T=i(E.contractId);if(!T)continue;const A=s.get(T)||[];A.push(E),s.set(T,A)}const o=new Map;for(const E of n){const T=i(E.paymentId);if(!T)continue;const A=o.get(T)||[];A.push(E),o.set(T,A)}const d=new Map;for(const E of r){const T=i(E.contractId);if(!T)continue;const A=d.get(T)||[];A.push(E),d.set(T,A)}return a.map(E=>{var H;const T=i(E.id,crypto.randomUUID()),A=(s.get(T)||[]).slice().sort((I,U)=>u(I.monthNumber)-u(U.monthNumber)||i(I.dueDate).localeCompare(i(U.dueDate))),N=A.map((I,U)=>{const q=u(I.amount),b=u(I.penalty),j=u(I.paidAmount),J=q+b;return{id:i(I.id,crypto.randomUUID()),month:Math.max(1,Math.round(u(I.monthNumber,U+1))),dueDate:i(I.dueDate),amount:q,paidAmount:j,penalty:b,paid:X(I.paid)||J>0&&j>=J,remainingAfter:I.remainingAfter===void 0||I.remainingAfter===null?void 0:u(I.remainingAfter),note:i(I.note)}}),g=d.get(T)||[],F=g.length>0?g.slice().sort((I,U)=>i(I.date).localeCompare(i(U.date))||i(I.createdAt).localeCompare(i(U.createdAt))).map(I=>({id:i(I.id,crypto.randomUUID()),amount:u(I.amount),date:i(I.date),note:i(I.note),allocations:(o.get(i(I.id))||[]).map(U=>({scheduleItemId:i(U.scheduleItemId),amount:u(U.amount)}))})):N.filter(I=>u(I.paidAmount)>0).map(I=>{var U;return{id:`legacy-payment-${i(I.id,crypto.randomUUID())}`,amount:u(I.paidAmount),date:i((U=A.find(q=>i(q.id)===i(I.id)))==null?void 0:U.paymentDate,I.dueDate,i(E.createdAt).slice(0,10)),note:"Migrated from legacy schedule data",allocations:[{scheduleItemId:i(I.id),amount:u(I.paidAmount)}]}}),_=N.reduce((I,U)=>I+u(U.amount)+u(U.penalty),0),C=F.reduce((I,U)=>I+u(U.amount),0),L=u(E.downPayment),f=i(E.createdAt,new Date().toISOString()),P=E.remaining!==void 0||E.remainingAmount!==void 0?u(E.remaining,E.remainingAmount):Math.max(0,Math.round((_-C)*100)/100);return{id:T,contractNumber:i(E.contractNumber,`INS-${Date.now()}`),contractType:i(E.contractType,"product"),customerId:i(E.customerId)||void 0,customerName:i(E.customerName),customerPhone:i(E.customerPhone),customerAddress:i(E.customerAddress),customerIdCard:i(E.customerIdCard,E.customerNationalId),guarantorName:i(E.guarantorName),guarantorIdCard:i(E.guarantorIdCard),guarantorPhone:i(E.guarantorPhone),guarantorAddress:i(E.guarantorAddress),productId:i(E.productId)||void 0,productName:i(E.productName),transferType:i(E.transferType)||void 0,cashPrice:u(E.cashPrice,E.totalAmount),installmentPrice:u(E.installmentPrice,E.totalAmount),downPayment:L,months:Math.max(1,Math.round(u(E.months,N.length||1))),monthlyInstallment:u(E.monthlyInstallment,E.monthlyPayment,N.length>0?_/N.length:0),paidTotal:E.paidTotal!==void 0?u(E.paidTotal):Math.round((L+C)*100)/100,remaining:P,firstInstallmentDate:i(E.firstInstallmentDate,E.startDate,(H=N[0])==null?void 0:H.dueDate),schedule:N,payments:F,notes:i(E.notes),customFields:Y(E.customFieldsJson),status:i(E.status,P===0?"completed":"active"),settledEarly:X(E.settledEarly),settlementDiscount:u(E.settlementDiscount),createdAt:f,updatedAt:i(E.updatedAt,f)}})}function ge(t){return!!(!w(t,"installments",["id","contractNumber"])||!w(t,"installments",["contractType","customerIdCard","guarantorIdCard","transferType","cashPrice","installmentPrice","paidTotal","remaining","customFieldsJson","updatedAt"])||w(t,"installments",["totalAmount","remainingAmount","monthlyPayment","startDate","customerNationalId"])||!w(t,"installment_schedules",["id","contractId","monthNumber","dueDate","amount","paidAmount","penalty","paid","remainingAfter","note"])||!w(t,"installment_payments",["id","contractId","amount","date","createdAt"])||!w(t,"installment_payment_allocations",["id","paymentId","scheduleItemId","amount"]))}function he(t){const a=_e(t);return ge(t)&&(t.transaction(()=>{t.prepare("DROP TABLE IF EXISTS installment_payment_allocations").run(),t.prepare("DROP TABLE IF EXISTS installment_payments").run(),t.prepare("DROP TABLE IF EXISTS installment_schedules").run(),t.prepare("DROP TABLE IF EXISTS installments").run(),Ie(t)})(),console.log("[migration] Installments schema repaired.")),a}function Ce(t,a){if(!S(t,"installments")||!R(t,"installments"))return;const r=[{label:"settings",data:m(t,"gx_installments_v2")||[]},{label:"legacy tables",data:a}];for(const n of r)if(n.data.length)try{se(t,n.data),console.log(`[migration] Installments: ${n.data.length} contracts migrated from ${n.label}.`);return}catch(s){console.error(`[migration] Installments migration from ${n.label} failed:`,s)}}function De(t){return w(t,"safe_transactions",["id","walletId","type","amount","createdAt"])?!(S(t,"safe_transactions")?t.prepare("PRAGMA foreign_key_list(safe_transactions)").all():[]).some(e=>e.from==="walletId"&&e.table==="wallets"):!0}function Ue(t){const a=S(t,"safe_transactions")?t.prepare("SELECT * FROM safe_transactions").all():[],e=Re(t),r=De(t);r&&(t.transaction(()=>{t.prepare("DROP TABLE IF EXISTS safe_transactions").run(),Oe(t)})(),console.log("[migration] Safe transactions schema repaired."));const n=[...new Set(a.map(o=>i(o.walletId)).filter(Boolean))];for(const o of n)ye(t,e,o);if(!r||a.length===0||!R(t,"safe_transactions"))return;const s=t.prepare(`
    INSERT OR IGNORE INTO safe_transactions (
      id, walletId, type, subType, amount, category, description, paymentMethod,
      affectsCapital, affectsProfit, createdBy, relatedId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const o of a)s.run(i(o.id,crypto.randomUUID()),i(o.walletId),i(o.type),i(o.subType)||null,u(o.amount),i(o.category)||null,i(o.description)||null,i(o.paymentMethod)||null,X(o.affectsCapital)?1:0,X(o.affectsProfit)?1:0,i(o.createdBy)||null,i(o.relatedId)||null,i(o.createdAt,new Date().toISOString()))})()}function ce(t,a,e){const r=i(e);if(r)return r;const n=i(t,"mobile"),s=i(a,"device");return`${n}_${s}`}function fe(t){if(!w(t,"categories",["id","name","inventoryType"]))return!0;const a=t.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get(),e=String((a==null?void 0:a.sql)??"").toLowerCase().replace(/\s+/g," ");return e.includes("name text unique")||!e.includes("unique(name, inventorytype)")}function Ee(t){if(!S(t,"categories")||!fe(t))return;const a=t.prepare("SELECT * FROM categories").all(),e=new Map;for(const r of a){const n=i(r.name),s=ce(r.section,r.type,r.inventoryType);if(!n||!s)continue;const o=`${s}::${n.toLowerCase()}`;e.has(o)||e.set(o,{id:i(r.id,crypto.randomUUID()),name:n,inventoryType:s})}t.transaction(()=>{t.prepare("DROP TABLE IF EXISTS categories").run(),t.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        inventoryType TEXT NOT NULL,
        UNIQUE(name, inventoryType)
      );
    `);const r=t.prepare(`
      INSERT OR IGNORE INTO categories (id, name, inventoryType)
      VALUES (?, ?, ?)
    `);for(const n of e.values())r.run(n.id,n.name,n.inventoryType)})(),console.log("[migration] Categories schema repaired.")}function Xe(t){return w(t,"product_batches",["id","productId","inventoryType","productName","costPrice","salePrice","quantity","remainingQty","purchaseDate","supplier","notes","createdAt","updatedAt"])?(S(t,"product_batches")?t.prepare("PRAGMA foreign_key_list(product_batches)").all():[]).some(e=>e.from==="productId"&&e.table==="products"):!0}function Fe(t){if(!S(t,"product_batches")||!Xe(t))return;const a=t.prepare("SELECT * FROM product_batches").all();t.transaction(()=>{t.prepare("DROP TABLE IF EXISTS product_batches").run(),t.exec(`
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
    `);const e=t.prepare(`
      INSERT OR IGNORE INTO product_batches (
        id, productId, inventoryType, productName, costPrice, salePrice,
        quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);for(const r of a){const n=i(r.productId);if(!n)continue;const s=i(r.purchaseDate,r.createdAt,new Date().toISOString()),o=i(r.createdAt,s);e.run(i(r.id,crypto.randomUUID()),n,i(r.inventoryType,"mobile"),i(r.productName,"Unknown product"),u(r.costPrice),u(r.salePrice),Math.max(0,Math.round(u(r.quantity))),Math.max(0,Math.round(u(r.remainingQty,r.quantity))),s,i(r.supplier)||null,i(r.notes)||null,o,i(r.updatedAt,o))}})(),console.log("[migration] Product batches schema repaired.")}function Me(t){S(t,"repair_tickets")&&l(t,"repair_tickets","final_cost","REAL DEFAULT 0"),S(t,"blacklist")&&(l(t,"blacklist","imei","TEXT"),l(t,"blacklist","deviceName","TEXT NOT NULL DEFAULT ''"),l(t,"blacklist","ownerName","TEXT"),l(t,"blacklist","ownerPhone","TEXT"),l(t,"blacklist","status","TEXT DEFAULT 'active'"),l(t,"blacklist","reportedDate","TEXT"),l(t,"blacklist","createdBy","TEXT"),l(t,"blacklist","updatedAt","TEXT"),t.exec(`
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
    `)),S(t,"damaged_items")&&(l(t,"damaged_items","costPrice","REAL DEFAULT 0"),t.exec(`
      UPDATE damaged_items
      SET costPrice = CASE
        WHEN COALESCE(costPrice, 0) > 0 THEN costPrice
        WHEN COALESCE(quantity, 0) > 0 THEN ROUND(COALESCE(estimatedLoss, 0) / quantity, 2)
        ELSE 0
      END
      WHERE COALESCE(costPrice, 0) = 0;
    `)),S(t,"other_revenue")&&(l(t,"other_revenue","addedBy","TEXT"),l(t,"other_revenue","updatedAt","TEXT"),t.exec(`
      UPDATE other_revenue
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE other_revenue
      SET addedBy = COALESCE(NULLIF(addedBy, ''), 'system')
      WHERE COALESCE(addedBy, '') = '';

      UPDATE other_revenue
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),S(t,"wallets")&&(l(t,"wallets","icon","TEXT"),t.exec(`
      UPDATE wallets
      SET icon = CASE
        WHEN COALESCE(NULLIF(icon, ''), '') <> '' THEN icon
        WHEN type = 'bank' THEN '🏦'
        WHEN type = 'card' THEN '💳'
        WHEN type = 'mobile_wallet' THEN '📱'
        ELSE '💵'
      END
      WHERE COALESCE(icon, '') = '';
    `)),S(t,"customers")&&(l(t,"customers","isArchived","INTEGER DEFAULT 0"),l(t,"customers","deletedAt","TEXT")),S(t,"suppliers")&&(l(t,"suppliers","isArchived","INTEGER DEFAULT 0"),l(t,"suppliers","deletedAt","TEXT")),S(t,"employees")&&(l(t,"employees","isArchived","INTEGER DEFAULT 0"),l(t,"employees","deletedAt","TEXT")),S(t,"used_devices")&&(l(t,"used_devices","isArchived","INTEGER DEFAULT 0"),l(t,"used_devices","deletedAt","TEXT"),l(t,"used_devices","warehouseId","TEXT")),S(t,"employee_salaries")&&(l(t,"employee_salaries","employeeName","TEXT"),l(t,"employee_salaries","advanceDeducted","REAL DEFAULT 0"),l(t,"employee_salaries","walletId","TEXT"),t.exec(`
      UPDATE employee_salaries
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(paidAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `)),t.exec(`
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
  `),S(t,"used_devices")&&(l(t,"used_devices","model","TEXT"),l(t,"used_devices","deviceType","TEXT"),l(t,"used_devices","ram","TEXT"),l(t,"used_devices","description","TEXT"),t.exec(`
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
    `)),S(t,"warehouse_items")&&(l(t,"warehouse_items","warehouseId","TEXT"),l(t,"warehouse_items","notes","TEXT"),l(t,"warehouse_items","addedBy","TEXT"),l(t,"warehouse_items","createdAt","TEXT"),l(t,"warehouse_items","updatedAt","TEXT"),t.exec(`
      UPDATE warehouse_items
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE warehouse_items
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),S(t,"cars_inventory")&&(l(t,"cars_inventory","warehouseId","TEXT"),l(t,"cars_inventory","isArchived","INTEGER DEFAULT 0"),l(t,"cars_inventory","deletedAt","TEXT"),l(t,"cars_inventory","createdAt","TEXT"),l(t,"cars_inventory","updatedAt","TEXT"),t.exec(`
      UPDATE cars_inventory
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE cars_inventory
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';

      UPDATE cars_inventory
      SET isArchived = COALESCE(isArchived, 0)
      WHERE isArchived IS NULL;
    `)),S(t,"products")&&(l(t,"products","brand","TEXT"),l(t,"products","description","TEXT"),l(t,"products","boxNumber","TEXT"),l(t,"products","taxExcluded","INTEGER DEFAULT 0"),l(t,"products","profitMargin","REAL DEFAULT 0"),l(t,"products","minStock","INTEGER DEFAULT 0"),l(t,"products","warehouseId","TEXT"),l(t,"products","serialNumber","TEXT"),l(t,"products","imei2","TEXT"),l(t,"products","processor","TEXT"),l(t,"products","isArchived","INTEGER DEFAULT 0"),t.exec(`
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
    `)),S(t,"reminders")&&(l(t,"reminders","reminderTime","TEXT"),l(t,"reminders","status","TEXT DEFAULT 'pending'"),l(t,"reminders","notes","TEXT"),t.exec(`
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
    `)),S(t,"product_batches")&&(l(t,"product_batches","inventoryType","TEXT"),l(t,"product_batches","productName","TEXT"),l(t,"product_batches","supplier","TEXT"),l(t,"product_batches","notes","TEXT"),l(t,"product_batches","createdAt","TEXT"),l(t,"product_batches","updatedAt","TEXT"),t.exec(`
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
    `)),S(t,"accessories")&&(l(t,"accessories","oldCostPrice","REAL DEFAULT 0"),l(t,"accessories","newCostPrice","REAL DEFAULT 0"),l(t,"accessories","profitMargin","REAL DEFAULT 0"),l(t,"accessories","brand","TEXT"),l(t,"accessories","source","TEXT"),l(t,"accessories","boxNumber","TEXT"),l(t,"accessories","taxExcluded","INTEGER DEFAULT 0"),l(t,"accessories","description","TEXT"),l(t,"accessories","isArchived","INTEGER DEFAULT 0"),l(t,"accessories","deletedAt","TEXT"),t.exec(`
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
    `)),S(t,"users")&&(l(t,"users","salt","TEXT"),l(t,"users","mustChangePassword","INTEGER DEFAULT 0"),l(t,"users","createdAt","TEXT"),l(t,"users","updatedAt","TEXT"),t.exec(`
      UPDATE users
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE users
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `)),S(t,"sales")&&(l(t,"sales","voidedAt","TEXT"),l(t,"sales","voidReason","TEXT"),l(t,"sales","voidedBy","TEXT")),S(t,"sale_items")&&(l(t,"sale_items","name","TEXT NOT NULL DEFAULT ''"),l(t,"sale_items","qty","INTEGER NOT NULL DEFAULT 0"),l(t,"sale_items","price","REAL NOT NULL DEFAULT 0"),l(t,"sale_items","cost","REAL NOT NULL DEFAULT 0"),l(t,"sale_items","lineDiscount","REAL DEFAULT 0"),l(t,"sale_items","warehouseId","TEXT"),l(t,"sale_items","batches","TEXT")),S(t,"stock_movements")&&l(t,"stock_movements","warehouseId","TEXT"),S(t,"audit_logs")&&(l(t,"audit_logs","beforeStateJson","TEXT"),l(t,"audit_logs","afterStateJson","TEXT"),l(t,"audit_logs","machineId","TEXT")),S(t,"return_records")&&(l(t,"return_records","originalSaleId","TEXT"),l(t,"return_records","reason","TEXT"),l(t,"return_records","processedBy","TEXT"),l(t,"return_records","createdAt","TEXT")),S(t,"return_items")&&l(t,"return_items","reason","TEXT"),S(t,"purchase_invoices")&&(l(t,"purchase_invoices","supplierId","TEXT"),l(t,"purchase_invoices","status","TEXT NOT NULL DEFAULT 'confirmed'"),l(t,"purchase_invoices","notes","TEXT"),l(t,"purchase_invoices","createdBy","TEXT"),l(t,"purchase_invoices","createdAt","TEXT"),l(t,"purchase_invoices","updatedAt","TEXT"),t.exec(`
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
    `)),S(t,"purchase_invoice_items")&&(l(t,"purchase_invoice_items","category","TEXT"),l(t,"purchase_invoice_items","notes","TEXT")),S(t,"shift_closings")&&(l(t,"shift_closings","notes","TEXT"),l(t,"shift_closings","createdAt","TEXT"),t.exec(`
      UPDATE shift_closings
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(closedAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `))}function ve(t){t.exec(`
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
  `)}function Pe(t){console.log("[migration] Running data migration check...");try{Ee(t),Fe(t),je(t),st(t),We(t),Be(t);const a=he(t);Ce(t,a),Ue(t),Me(t),ve(t),we(t),He(t),xe(t),ke(t),Ye(t),qe(t),Ge(t),Ke(t),$e(t),be(t),Je(t),Ve(t),Qe(t),ze(t),Ze(t),et(t),tt(t),rt(t),nt(t),at(t),it(t),ot(t),ct(t),Et(t),console.log("[migration] All migrations complete.")}catch(a){console.error("[migration] Error:",a)}}function we(t){const a=[{key:"elahmed-products",source:"legacy"},{key:"gx_mobiles_v2",source:"mobile"},{key:"gx_computers_v2",source:"computer"},{key:"gx_devices_v2",source:"device"}],e=t.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, model, barcode, deviceType, category, condition, storage, ram, color,
      brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
      salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
      imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=m(t,r.key);if(n!=null&&n.length){for(const s of n){const o=i(s.source,r.source),d=i(s.createdAt,new Date().toISOString()),E=u(s.newCostPrice,s.costPrice,s.oldCostPrice);e.run(i(s.id,crypto.randomUUID()),i(s.name,"Unknown product"),i(s.model)||null,i(s.barcode)||null,i(s.deviceType,o==="mobile"?"mobile":o==="computer"?"computer":o==="device"?"device":"")||null,i(s.category)||null,i(s.condition,"new")||null,i(s.storage)||null,i(s.ram)||null,i(s.color)||null,i(s.brand)||null,i(s.description)||null,i(s.boxNumber)||null,X(s.taxExcluded)?1:0,Math.max(0,Math.round(u(s.quantity))),u(s.oldCostPrice,E),E,u(s.salePrice),u(s.profitMargin,u(s.salePrice)-E),Math.max(0,Math.round(u(s.minStock))),i(s.supplier)||null,o,i(s.warehouseId)||null,i(s.serialNumber)||null,i(s.imei2)||null,i(s.processor)||null,X(s.isArchived)?1:0,i(s.notes)||null,i(s.image)||null,d,i(s.updatedAt,d),i(s.deletedAt)||null)}console.log(`[migration] Products (${r.source}): migrated ${n.length} records.`)}}})()}function He(t){const a=[{key:"gx_mobile_accessories",type:"mobile_accessory"},{key:"gx_mobile_spare_parts",type:"mobile_spare_part"},{key:"gx_computer_accessories",type:"computer_accessory_legacy"},{key:"gx_computer_accessories_sa",type:"computer_accessory"},{key:"gx_computer_spare_parts",type:"computer_spare_part"},{key:"gx_device_accessories",type:"device_accessory_legacy"},{key:"gx_device_accessories_sa",type:"device_accessory"},{key:"gx_device_spare_parts",type:"device_spare_part"}],e=t.prepare(`
    INSERT OR IGNORE INTO accessories (
      id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
      oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
      brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
      deletedAt, notes, image, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=m(t,r.key);if(n!=null&&n.length){for(const s of n){const o=u(s.newCostPrice,s.costPrice,s.oldCostPrice),d=i(s.createdAt,new Date().toISOString());e.run(i(s.id,crypto.randomUUID()),i(s.warehouseId)||null,r.type,i(s.name,"Unknown accessory"),i(s.category)||null,i(s.subcategory)||null,i(s.model)||null,i(s.barcode)||null,Math.max(0,Math.round(u(s.quantity))),u(s.oldCostPrice,o),o,u(s.costPrice,o),u(s.salePrice),u(s.profitMargin,u(s.salePrice)-o),Math.max(0,Math.round(u(s.minStock))),i(s.condition,"new"),i(s.brand)||null,i(s.supplier)||null,i(s.source)||null,i(s.boxNumber)||null,X(s.taxExcluded)?1:0,i(s.color)||null,i(s.description)||null,X(s.isArchived)?1:0,i(s.deletedAt)||null,i(s.notes)||null,i(s.image)||null,d,i(s.updatedAt,d))}console.log(`[migration] Accessories (${r.type}): migrated ${n.length} records.`)}}})()}function We(t){if(Ee(t),!R(t,"categories"))return;const a=m(t,"gx_categories_v1")||m(t,"retail_categories");if(!(a!=null&&a.length))return;const e=new Map;for(const n of a){const s=i(n.name),o=ce(n.section,n.type,n.inventoryType);if(!s||!o)continue;const d=`${o}::${s.toLowerCase()}`;e.has(d)||e.set(d,{id:i(n.id,crypto.randomUUID()),name:s,inventoryType:o})}if(e.size===0)return;const r=t.prepare(`
    INSERT OR IGNORE INTO categories (id, name, inventoryType)
    VALUES (?, ?, ?)
  `);t.transaction(()=>{for(const n of e.values())r.run(n.id,n.name,n.inventoryType)})(),console.log(`[migration] Categories: ${e.size} records migrated.`)}function Be(t){if(!R(t,"users"))return;const a=m(t,"gx_users")||m(t,"retail_users"),e=new Date().toISOString(),r=t.prepare(`
    INSERT OR IGNORE INTO users (
      id, username, fullName, role, permissions, active,
      passwordHash, salt, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=a!=null&&a.length?a:[{id:"owner-1",username:"admin",fullName:"صاحب النظام",role:"owner",permissions:z,active:!0,password:"admin123",salt:null,mustChangePassword:!0,createdAt:e,updatedAt:e}];t.transaction(()=>{for(const s of n){const o=i(s.role,"user"),d=Y(s.permissions),E=d.length>0?d:o==="owner"?z:[];r.run(i(s.id,crypto.randomUUID()),i(s.username,`user_${Date.now()}`),i(s.fullName,s.name,"User"),o,JSON.stringify(E),X(s.active??!0)?1:0,i(s.passwordHash,s.password),i(s.salt)||null,X(s.mustChangePassword)?1:0,i(s.createdAt,e),i(s.updatedAt,s.createdAt,e))}})(),console.log(`[migration] Users: ${n.length} records migrated.`)}function xe(t){if(!R(t,"product_batches"))return;const a=m(t,"gx_product_batches_v1")||m(t,"retail_product_batches");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO product_batches (
      id, productId, inventoryType, productName, costPrice, salePrice,
      quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.productId);if(!n)continue;const s=i(r.purchaseDate,r.createdAt,new Date().toISOString()),o=i(r.createdAt,s);e.run(i(r.id,crypto.randomUUID()),n,i(r.inventoryType,"mobile"),i(r.productName,"Unknown product"),u(r.costPrice),u(r.salePrice),Math.max(0,Math.round(u(r.quantity))),Math.max(0,Math.round(u(r.remainingQty,r.quantity))),s,i(r.supplier)||null,i(r.notes)||null,o,i(r.updatedAt,o))}})(),console.log(`[migration] Product batches: ${a.length} records migrated.`)}function ke(t){if(!R(t,"warehouse_items"))return;const a=m(t,"gx_warehouse")||m(t,"retail_warehouse");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO warehouse_items (
      id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());e.run(i(r.id,crypto.randomUUID()),i(r.warehouseId)||null,i(r.name,"Unknown item"),i(r.category,"general"),Math.max(0,Math.round(u(r.quantity))),u(r.costPrice),i(r.notes)||null,i(r.addedBy)||null,n,i(r.updatedAt,n))}})(),console.log(`[migration] Warehouse items: ${a.length} records migrated.`)}function Ye(t){if(!R(t,"cars_inventory"))return;const a=m(t,"gx_cars")||m(t,"retail_cars");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO cars_inventory (
      id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
      purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());e.run(i(r.id,crypto.randomUUID()),i(r.name,"Unknown car"),i(r.model,"Unknown model"),Math.max(0,Math.round(u(r.year))),i(r.color)||null,i(r.plateNumber)||null,i(r.licenseExpiry)||null,i(r.condition,"used"),i(r.category)||null,u(r.purchasePrice),u(r.salePrice),i(r.notes)||null,i(r.image)||null,i(r.warehouseId)||null,X(r.isArchived)?1:0,i(r.deletedAt)||null,n,i(r.updatedAt,n))}})(),console.log(`[migration] Cars: ${a.length} records migrated.`)}function qe(t){if(!R(t,"sales"))return;const a=m(t,"elahmed_sales")||m(t,"retail_sales");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO sales (
      id, invoiceNumber, date, subtotal, discount, total, totalCost, grossProfit, marginPct,
      paymentMethod, employee, voidedAt, voidReason, voidedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),r=t.prepare(`
    INSERT OR IGNORE INTO sale_items (
      id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const n of a){const s=i(n.id,crypto.randomUUID()),o=Y(n.items);e.run(s,i(n.invoiceNumber,`INV-LEGACY-${s.slice(0,8)}`),i(n.date,n.createdAt,new Date().toISOString()),u(n.subtotal),u(n.discount),u(n.total),u(n.totalCost),u(n.grossProfit),u(n.marginPct),i(n.paymentMethod,"cash"),i(n.employee,"system"),i(n.voidedAt)||null,i(n.voidReason)||null,i(n.voidedBy)||null);for(const d of o)r.run(i(d.id,crypto.randomUUID()),s,i(d.productId),i(d.name,"Unknown item"),Math.max(1,Math.round(u(d.qty,1))),u(d.price),u(d.cost),u(d.lineDiscount),i(d.warehouseId)||null,d.batches?JSON.stringify(d.batches):null)}})(),console.log(`[migration] Sales: ${a.length} records migrated.`)}function Ge(t){if(!R(t,"return_records"))return;const a=m(t,"gx_returns_v2")||m(t,"retail_returns");if(!(a!=null&&a.length))return;const e=new Set(t.prepare("SELECT id FROM sales").all().map(o=>o.id)),r=t.prepare(`
    INSERT OR IGNORE INTO return_records (
      id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=t.prepare(`
    INSERT OR IGNORE INTO return_items (
      id, returnId, productId, name, qty, price, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);let s=0;t.transaction(()=>{for(const o of a){const d=i(o.id,crypto.randomUUID()),E=i(o.createdAt,o.date,new Date().toISOString()),T=i(o.originalSaleId),A=Y(o.items),N=oe(o.returnNumber,"RET");s=Math.max(s+1,N),r.run(d,i(o.returnNumber,`RET-${String(s).padStart(4,"0")}`),i(o.originalInvoiceNumber,"Unknown invoice"),e.has(T)?T:null,i(o.date,E.slice(0,10)),u(o.totalRefund),i(o.reason)||null,i(o.processedBy)||null,E);for(const g of A)n.run(i(g.id,crypto.randomUUID()),d,i(g.productId),i(g.name,"Unknown item"),u(g.qty,1)||1,u(g.price),i(g.reason)||null)}})(),console.log(`[migration] Returns: ${a.length} records migrated.`)}function Ve(t){if(!R(t,"purchase_invoices"))return;const a=m(t,"gx_purchase_invoices")||m(t,"retail_purchase_invoices");if(!(a!=null&&a.length))return;const e=new Set(t.prepare("SELECT id FROM suppliers").all().map(o=>o.id)),r=t.prepare(`
    INSERT OR IGNORE INTO purchase_invoices (
      id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
      remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),n=t.prepare(`
    INSERT OR IGNORE INTO purchase_invoice_items (
      id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);let s=0;t.transaction(()=>{for(const o of a){const d=i(o.id,crypto.randomUUID()),E=u(o.totalAmount),T=Math.min(E,u(o.paidAmount)),A=Math.max(0,Math.round((E-T)*100)/100),N=i(o.createdAt,new Date().toISOString()),g=i(o.updatedAt,N),F=i(o.supplierId),_=Y(o.items),C=oe(o.invoiceNumber,"PI");s=Math.max(s+1,C),r.run(d,i(o.invoiceNumber,`PI-${String(s).padStart(4,"0")}`),e.has(F)?F:null,i(o.supplierName,"Unknown supplier"),i(o.invoiceDate,N.slice(0,10)),E,T,A,i(o.paymentMethod,"cash"),i(o.status,Le(E,T)),i(o.notes)||null,i(o.createdBy)||null,N,g);for(const L of _){const f=u(L.quantity,1)||1,P=u(L.unitPrice),H=u(L.totalPrice,f*P);n.run(i(L.id,crypto.randomUUID()),d,i(L.productName,"Unknown item"),i(L.category)||null,f,P,H,i(L.notes)||null)}}})(),console.log(`[migration] Purchase invoices: ${a.length} records migrated.`)}function Ke(t){if(!R(t,"shift_closings"))return;const a=m(t,"gx_shift_closings")||m(t,"retail_shift_closings");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO shift_closings (
      id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
      salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.closedAt,r.createdAt,new Date().toISOString());e.run(i(r.id,crypto.randomUUID()),i(r.shiftDate,n.slice(0,10)),n,i(r.closedBy,"system"),Math.max(0,Math.round(u(r.salesCount))),u(r.salesCash),u(r.salesCard),u(r.salesTransfer),u(r.salesTotal),u(r.expectedCash),u(r.actualCash),u(r.cashDifference),i(r.notes)||null,i(r.createdAt,n))}})(),console.log(`[migration] Shift closings: ${a.length} records migrated.`)}function $e(t){if(!R(t,"stock_movements"))return;const a=m(t,"gx_stock_movements")||m(t,"retail_stock_movements");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO stock_movements (
      id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
      referenceId, userId, timestamp, warehouseId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(i(r.id,crypto.randomUUID()),i(r.productId),i(r.type,"correction"),u(r.quantityChange),u(r.previousQuantity),u(r.newQuantity),i(r.reason)||null,i(r.referenceId)||null,i(r.userId)||null,i(r.timestamp,new Date().toISOString()),i(r.warehouseId)||null)})(),console.log(`[migration] Stock movements: ${a.length} records migrated.`)}function be(t){if(!R(t,"audit_logs"))return;const a=m(t,"elahmed_audit_logs")||m(t,"retail_audit_logs");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(i(r.id,crypto.randomUUID()),i(r.userId,"system"),i(r.action,"settings_changed"),i(r.entityType,"unknown"),i(r.entityId,"unknown"),r.beforeState?JSON.stringify(r.beforeState):null,r.afterState?JSON.stringify(r.afterState):null,i(r.machineId)||null,i(r.timestamp,new Date().toISOString()))})(),console.log(`[migration] Audit logs: ${a.length} records migrated.`)}function je(t){if(!R(t,"customers"))return;const a=m(t,"gx_customers")||m(t,"retail_customers");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO customers (
      id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.name,r.phone||null,r.email||null,r.address||null,r.nationalId||null,r.notes||null,r.totalPurchases||0,r.balance||0,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Customers: ${a.length} records migrated.`)}function Je(t){if(!R(t,"suppliers"))return;const a=m(t,"gx_suppliers")||m(t,"retail_suppliers");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO suppliers (
      id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.name,r.phone||null,r.email||null,r.address||null,r.category||null,r.balance||0,r.notes||null,r.active??1,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Suppliers: ${a.length} records migrated.`)}function Qe(t){if(!R(t,"employees"))return;const a=m(t,"gx_employees")||m(t,"retail_employees");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO employees (
      id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.name,r.phone||null,i(r.role,r.position)||null,u(r.salary,r.baseSalary),u(r.commissionRate),r.hireDate||null,X(r.active??r.isActive??!0)?1:0,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Employees: ${a.length} records migrated.`)}function ze(t){if(!R(t,"supplier_transactions"))return;const a=m(t,"gx_supplier_transactions")||m(t,"retail_supplier_transactions");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO supplier_transactions (
      id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.supplierId,r.supplierName||null,r.type,u(r.amount),u(r.balanceBefore),u(r.balanceAfter),r.notes||null,r.createdBy||null,r.createdAt||new Date().toISOString())})(),console.log(`[migration] Supplier transactions: ${a.length} records migrated.`)}function Ze(t){if(!R(t,"employee_salaries"))return;const a=m(t,"gx_salary_records")||m(t,"retail_salary_records");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO employee_salaries (
      id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
      netSalary, paid, paidAt, walletId, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.createdAt,r.paidAt,new Date().toISOString());e.run(r.id,r.employeeId,r.employeeName||null,r.month,u(r.baseSalary),u(r.commission),u(r.bonus),u(r.deduction,r.deductions),u(r.advanceDeducted),u(r.netSalary),r.paid??1,r.paidAt||n,r.walletId||null,r.notes||null,n)}})(),console.log(`[migration] Employee salaries: ${a.length} records migrated.`)}function et(t){if(!R(t,"employee_advances"))return;const a=m(t,"gx_advances")||m(t,"retail_advances");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO employee_advances (
      id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.employeeId,r.employeeName||null,u(r.amount),r.date,r.deductedMonth||null,r.notes||null,r.createdAt||r.date||new Date().toISOString())})(),console.log(`[migration] Employee advances: ${a.length} records migrated.`)}function tt(t){if(!R(t,"expenses"))return;const a=m(t,"gx_expenses")||m(t,"retail_expenses");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO expenses (
      id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.category,r.description||null,r.amount,r.date,r.paymentMethod||"cash",r.employee||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Expenses: ${a.length} records migrated.`)}function rt(t){if(!R(t,"blacklist"))return;const a=m(t,"gx_blacklist")||m(t,"retail_blacklist");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO blacklist (
      id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
      nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString()),s=i(r.updatedAt,n),o=i(r.imei,r.nationalId),d=i(r.deviceName,r.name,"Unknown device"),E=i(r.ownerPhone,r.phone),T=i(r.createdBy,r.addedBy,"system");e.run(r.id,o||null,d,r.ownerName||null,E||null,E||null,i(r.status,"active"),i(r.reportedDate,n.slice(0,10)),o||null,r.reason,r.notes||null,T||null,T||null,d,n,s)}})(),console.log(`[migration] Blacklist: ${a.length} records migrated.`)}function nt(t){if(!R(t,"damaged_items"))return;const a=m(t,"gx_damaged")||m(t,"retail_damaged");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO damaged_items (
      id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=u(r.quantity,1)||1,s=u(r.estimatedLoss,r.totalLoss,r.value),o=u(r.costPrice,n>0?s/n:0);e.run(r.id,r.productName||r.name,r.productId||null,r.inventoryType||r.category||null,n,o,r.reason||null,s,r.reportedBy||r.addedBy||null,r.date,r.notes||null,r.createdAt||new Date().toISOString())}})(),console.log(`[migration] Damaged items: ${a.length} records migrated.`)}function at(t){if(!R(t,"other_revenue"))return;const a=m(t,"gx_other_revenue")||m(t,"retail_other_revenue");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.createdAt,new Date().toISOString());e.run(r.id,r.source||r.category,r.description||null,r.amount,r.date,r.paymentMethod||"cash",r.addedBy||null,r.notes||null,n,r.updatedAt||n)}})(),console.log(`[migration] Other revenue: ${a.length} records migrated.`)}function st(t){if(!R(t,"wallets"))return;const a=m(t,"gx_wallets")||m(t,"retail_wallets");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.type,"cash");e.run(r.id,r.name,n,u(r.balance),X(r.isDefault)?1:0,i(r.icon,n==="bank"?"🏦":n==="card"?"💳":n==="transfer"?"📲":"💵")||null,r.color||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())}})(),console.log(`[migration] Wallets: ${a.length} records migrated.`)}function it(t){if(!R(t,"used_devices"))return;const a=m(t,"gx_used_devices")||m(t,"gx_used_inventory")||m(t,"retail_used_inventory");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO used_devices (
      id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
      ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.name,i(r.model)||null,i(r.deviceType,r.category,"other")||null,i(r.category,r.deviceType)||null,i(r.condition,"good"),u(r.purchasePrice,r.buyPrice),u(r.sellingPrice,r.salePrice),i(r.status,"in_stock"),r.serialNumber||null,r.color||null,r.storage||null,i(r.ram)||null,i(r.description,r.notes)||null,i(r.notes,r.description)||null,r.image||null,r.soldAt||null,r.purchasedFrom||null,r.soldTo||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())})(),console.log(`[migration] Used devices: ${a.length} records migrated.`)}function ot(t){if(!R(t,"reminders"))return;const a=m(t,"gx_reminders")||m(t,"retail_reminders");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO reminders (
      id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=i(r.status,r.completed?"done":"pending");e.run(r.id,r.title,r.description||null,r.dueDate||r.reminderDate,r.reminderTime||null,r.priority||"medium",n,n==="done"||r.completed?1:0,r.completedAt||null,r.recurring||null,r.category||null,r.notes||null,r.createdAt||new Date().toISOString(),r.updatedAt||new Date().toISOString())}})(),console.log(`[migration] Reminders: ${a.length} records migrated.`)}function ct(t){if(!R(t,"repair_tickets"))return;const a=m(t,"gx_maintenance")||m(t,"maintenance_orders");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO repair_tickets (
      id, ticket_no, customer_name, customer_phone, device_category, device_model,
      issue_description, status, package_price, final_cost, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a){const n=["received","diagnosing","repairing","waiting_parts","testing","ready","delivered","cancelled","pending","in_progress","waiting_for_parts","completed"].includes(r.status)?r.status:r.status==="done"?"delivered":r.status==="in_progress"?"repairing":"received";e.run(r.id,r.orderNumber||r.ticket_no||`TKT-${Math.random().toString(36).slice(2,7)}`,r.customerName||r.customer_name,r.customerPhone||r.customer_phone||null,r.deviceCategory||r.device_category||"other",r.deviceName||r.device_model||"Unknown",r.issueDescription||r.issue_description||r.problem_desc||"",n,r.totalSale||r.package_price||0,r.final_cost||r.totalSale||r.package_price||0,r.createdAt||r.created_at||new Date().toISOString(),r.updatedAt||r.updated_at||new Date().toISOString())}})(),console.log(`[migration] Repair Tickets: ${a.length} records migrated.`)}function Et(t){if(!R(t,"repair_parts"))return;const a=m(t,"gx_repair_parts")||m(t,"repair_parts_inventory");if(!(a!=null&&a.length))return;const e=t.prepare(`
    INSERT OR IGNORE INTO repair_parts (
      id, name, category, sku, unit_cost, selling_price, qty, min_qty, active, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);t.transaction(()=>{for(const r of a)e.run(r.id,r.name,r.category||null,r.sku||r.part_no||null,r.unit_cost||r.cost_price||0,r.selling_price||0,r.qty||r.current_stock||0,r.min_qty||r.min_stock||0,r.active??1,r.createdAt||r.created_at||new Date().toISOString())})(),console.log(`[migration] Repair Parts: ${a.length} records migrated.`)}function O(t,a=["id","createdAt"]){const e=[],r=[];for(const[n,s]of Object.entries(t))a.includes(n)||(e.push(`${n} = ?`),r.push(s));return{sets:e,values:r}}function Z(t,a){const e=t.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!e)return[];try{const r=JSON.parse(e.value);return Array.isArray(r)?r:[]}catch{return[]}}function dt(t,a,e){const r=t.prepare("SELECT value FROM settings WHERE key = ?").get(a);if(!r)return e;try{return JSON.parse(r.value)}catch{return e}}function lt(t,a){if(!a||t.prepare("SELECT id FROM wallets WHERE id = ?").get(a))return;const r=[...Z(t,"gx_wallets"),...Z(t,"retail_wallets")].find(d=>String(d.id??"")===a),n=new Date().toISOString(),s=String((r==null?void 0:r.type)??"cash"),o=String((r==null?void 0:r.icon)??(s==="bank"?"🏦":s==="card"?"💳":s==="transfer"?"📲":"💵"));t.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(a,String((r==null?void 0:r.name)??(a==="wallet_cash"?"الصندوق":`Wallet ${a.slice(0,8)}`)),s,r!=null&&r.isDefault?1:0,o,r!=null&&r.color?String(r.color):null,String((r==null?void 0:r.notes)??"Auto-created to repair wallet references"),r!=null&&r.createdAt?String(r.createdAt):n,r!=null&&r.updatedAt?String(r.updatedAt):n)}function ut(t,a){if(t==null||t===""||typeof t!="string")return a;try{return JSON.parse(t)}catch{return a}}function ee(t,a){if(typeof t!="string")return 0;const e=new RegExp(`^${a}-(\\d+)$`).exec(t.trim());if(!e)return 0;const r=Number.parseInt(e[1],10);return Number.isFinite(r)?r:0}function V(t,a){return a<=0?"confirmed":a>=t?"paid":"partial"}function pt(t,a){return a?t.prepare("SELECT * FROM products WHERE source = ? ORDER BY createdAt DESC, id DESC").all(a):t.prepare("SELECT * FROM products ORDER BY createdAt DESC, id DESC").all()}function Tt(t,a){return a?t.prepare("SELECT * FROM accessories WHERE inventoryType = ? ORDER BY createdAt DESC, id DESC").all(a):t.prepare("SELECT * FROM accessories ORDER BY createdAt DESC, id DESC").all()}function te(t,a=!1){const e=t.prepare(`
    SELECT * FROM sales
    ${a?"WHERE voidedAt IS NULL":""}
    ORDER BY date DESC, invoiceNumber DESC
  `).all(),r=t.prepare("SELECT * FROM sale_items ORDER BY saleId ASC, id ASC").all(),n=new Map;for(const s of r){const o=String(s.saleId??"");if(!o)continue;const d=n.get(o)||[];d.push({productId:String(s.productId??""),name:String(s.name??""),qty:Number(s.qty??0),price:Number(s.price??0),cost:Number(s.cost??0),lineDiscount:Number(s.lineDiscount??0),warehouseId:s.warehouseId?String(s.warehouseId):void 0,batches:ut(s.batches,[])}),n.set(o,d)}return e.map(s=>({id:String(s.id??""),invoiceNumber:String(s.invoiceNumber??""),date:String(s.date??""),items:n.get(String(s.id??""))||[],subtotal:Number(s.subtotal??0),discount:Number(s.discount??0),total:Number(s.total??0),totalCost:Number(s.totalCost??0),grossProfit:Number(s.grossProfit??0),marginPct:Number(s.marginPct??0),paymentMethod:String(s.paymentMethod??"cash"),employee:String(s.employee??"system"),voidedAt:s.voidedAt?String(s.voidedAt):null,voidReason:s.voidReason?String(s.voidReason):null,voidedBy:s.voidedBy?String(s.voidedBy):null}))}function B(t){const a=t.prepare("SELECT * FROM purchase_invoices ORDER BY invoiceDate DESC, createdAt DESC").all(),e=t.prepare("SELECT * FROM purchase_invoice_items ORDER BY invoiceId ASC, id ASC").all(),r=new Map;for(const n of e){const s=String(n.invoiceId??"");if(!s)continue;const o=r.get(s)||[];o.push({id:String(n.id??""),productName:String(n.productName??""),category:n.category?String(n.category):"",quantity:Number(n.quantity??0),unitPrice:Number(n.unitPrice??0),totalPrice:Number(n.totalPrice??0),notes:n.notes?String(n.notes):""}),r.set(s,o)}return a.map(n=>({id:String(n.id??""),invoiceNumber:String(n.invoiceNumber??""),supplierId:n.supplierId?String(n.supplierId):void 0,supplierName:String(n.supplierName??""),invoiceDate:String(n.invoiceDate??""),totalAmount:Number(n.totalAmount??0),paidAmount:Number(n.paidAmount??0),remaining:Number(n.remaining??0),paymentMethod:String(n.paymentMethod??"cash"),items:r.get(String(n.id??""))||[],status:String(n.status??"confirmed"),notes:n.notes?String(n.notes):"",createdBy:String(n.createdBy??"system"),createdAt:String(n.createdAt??""),updatedAt:String(n.updatedAt??"")}))}function K(t){const a=t.prepare("SELECT * FROM return_records ORDER BY date DESC, createdAt DESC").all(),e=t.prepare("SELECT * FROM return_items ORDER BY returnId ASC, id ASC").all(),r=new Map;for(const n of e){const s=String(n.returnId??"");if(!s)continue;const o=r.get(s)||[];o.push({productId:String(n.productId??""),name:String(n.name??""),qty:Number(n.qty??0),price:Number(n.price??0),reason:n.reason?String(n.reason):""}),r.set(s,o)}return a.map(n=>({id:String(n.id??""),returnNumber:String(n.returnNumber??""),originalInvoiceNumber:String(n.originalInvoiceNumber??""),originalSaleId:n.originalSaleId?String(n.originalSaleId):"",date:String(n.date??""),items:r.get(String(n.id??""))||[],totalRefund:Number(n.totalRefund??0),reason:n.reason?String(n.reason):"",processedBy:n.processedBy?String(n.processedBy):"",createdAt:String(n.createdAt??"")}))}function mt(t){return t.prepare("SELECT * FROM shift_closings ORDER BY closedAt DESC, createdAt DESC").all()}function At(t,a,e,r){const n=new Date;n.setHours(0,0,0,0);const s=t.prepare("SELECT closedAt FROM shift_closings ORDER BY closedAt DESC LIMIT 1").get(),o=s!=null&&s.closedAt?String(s.closedAt):n.toISOString(),d=t.prepare(`
    SELECT
      COUNT(*) as salesCount,
      SUM(CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END) as salesCash,
      SUM(CASE WHEN paymentMethod = 'card' THEN total ELSE 0 END) as salesCard,
      SUM(CASE WHEN paymentMethod NOT IN ('cash', 'card') THEN total ELSE 0 END) as salesTransfer,
      SUM(total) as salesTotal
    FROM sales
    WHERE voidedAt IS NULL AND date >= ?
  `).get(o),E=new Date,T=Number(d.salesCash??0),A=Number(d.salesCard??0),N=Number(d.salesTransfer??0),g=Number(d.salesTotal??T+A+N);return{shiftDate:E.toISOString().slice(0,10),closedAt:E.toISOString(),closedBy:a,salesCount:Number(d.salesCount??0),salesCash:T,salesCard:A,salesTransfer:N,salesTotal:g,expectedCash:T,actualCash:e,cashDifference:e-T,notes:r}}function p(t,a,e,r){try{t.returnValue=r()}catch(n){console.error(`${a} error:`,n),t.returnValue=e}}function Nt(t){c.ipcMain.on("db:installments:get",a=>{try{a.returnValue=ae(t)}catch(e){console.error("db:installments:get error:",e),a.returnValue=[]}}),c.ipcMain.on("db:installments:replaceAll",(a,e)=>{try{const r=Array.isArray(e)?e:[];a.returnValue=se(t,r)}catch(r){console.error("db:installments:replaceAll error:",r),a.returnValue=[]}}),c.ipcMain.on("db-sync:settings:get-json",(a,e)=>{p(a,"db-sync:settings:get-json",null,()=>dt(t,e,null))}),c.ipcMain.on("db-sync:settings:set-json",(a,e,r)=>{p(a,"db-sync:settings:set-json",null,()=>{const n=JSON.stringify(r??null);return t.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(e,n),r??null})}),c.ipcMain.on("db-sync:categories:get",a=>{p(a,"db-sync:categories:get",[],()=>t.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all())}),c.ipcMain.on("db-sync:categories:replaceAll",(a,e=[])=>{p(a,"db-sync:categories:replaceAll",[],()=>t.transaction(()=>{t.prepare("DELETE FROM categories").run();const n=t.prepare(`
          INSERT INTO categories (id, name, inventoryType)
          VALUES (?, ?, ?)
        `);for(const s of Array.isArray(e)?e:[])n.run(s.id??crypto.randomUUID(),s.name??"",s.inventoryType??"mobile_device");return t.prepare("SELECT * FROM categories ORDER BY inventoryType ASC, name ASC").all()})())}),c.ipcMain.on("db-sync:users:get",a=>{p(a,"db-sync:users:get",[],()=>t.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all())}),c.ipcMain.on("db-sync:users:replaceAll",(a,e=[])=>{p(a,"db-sync:users:replaceAll",[],()=>t.transaction(()=>{t.prepare("DELETE FROM users").run();const n=t.prepare(`
          INSERT INTO users (
            id, username, fullName, role, permissions, active,
            passwordHash, salt, mustChangePassword, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=new Date().toISOString();for(const o of Array.isArray(e)?e:[])n.run(o.id??crypto.randomUUID(),o.username??"",o.fullName??"",o.role??"user",o.permissions??"[]",o.active?1:0,o.passwordHash??null,o.salt??null,o.mustChangePassword?1:0,o.createdAt??s,o.updatedAt??o.createdAt??s);return t.prepare("SELECT * FROM users ORDER BY createdAt ASC, username ASC").all()})())}),c.ipcMain.on("db-sync:product_batches:get",a=>{p(a,"db-sync:product_batches:get",[],()=>t.prepare("SELECT * FROM product_batches ORDER BY purchaseDate ASC, createdAt ASC, id ASC").all())}),c.ipcMain.on("db-sync:product_batches:add",(a,e)=>{p(a,"db-sync:product_batches:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO product_batches (
          id, productId, inventoryType, productName, costPrice, salePrice,
          quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.productId,e.inventoryType??"mobile",e.productName??"Unknown product",e.costPrice??0,e.salePrice??0,e.quantity??0,e.remainingQty??e.quantity??0,e.purchaseDate??n,e.supplier??null,e.notes??null,e.createdAt??n,e.updatedAt??n),t.prepare("SELECT * FROM product_batches WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:product_batches:update",(a,e,r)=>{p(a,"db-sync:product_batches:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE product_batches SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM product_batches WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:product_batches:delete",(a,e)=>{p(a,"db-sync:product_batches:delete",!1,()=>t.prepare("DELETE FROM product_batches WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:products:get",(a,e=null)=>{p(a,"db-sync:products:get",[],()=>pt(t,e))}),c.ipcMain.on("db-sync:products:add",(a,e)=>{p(a,"db-sync:products:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO products (
          id, name, model, barcode, deviceType, category, condition, storage, ram, color,
          brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
          salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
          imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name??"",e.model??null,e.barcode??null,e.deviceType??null,e.category??null,e.condition??null,e.storage??null,e.ram??null,e.color??null,e.brand??null,e.description??null,e.boxNumber??null,e.taxExcluded?1:0,e.quantity??0,e.oldCostPrice??0,e.newCostPrice??0,e.salePrice??0,e.profitMargin??0,e.minStock??0,e.supplier??null,e.source??null,e.warehouseId??null,e.serialNumber??null,e.imei2??null,e.processor??null,e.isArchived?1:0,e.notes??null,e.image??null,e.createdAt??n,e.updatedAt??n,e.deletedAt??null),t.prepare("SELECT * FROM products WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:products:update",(a,e,r)=>{p(a,"db-sync:products:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE products SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM products WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:products:delete",(a,e)=>{p(a,"db-sync:products:delete",!1,()=>t.prepare("DELETE FROM products WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:accessories:get",(a,e=null)=>{p(a,"db-sync:accessories:get",[],()=>Tt(t,e))}),c.ipcMain.on("db-sync:accessories:add",(a,e)=>{p(a,"db-sync:accessories:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO accessories (
          id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
          oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
          brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
          deletedAt, notes, image, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.warehouseId??null,e.inventoryType??null,e.name??"",e.category??null,e.subcategory??null,e.model??null,e.barcode??null,e.quantity??0,e.oldCostPrice??0,e.newCostPrice??e.costPrice??0,e.costPrice??e.newCostPrice??0,e.salePrice??0,e.profitMargin??0,e.minStock??0,e.condition??"new",e.brand??null,e.supplier??null,e.source??null,e.boxNumber??null,e.taxExcluded?1:0,e.color??null,e.description??null,e.isArchived?1:0,e.deletedAt??null,e.notes??null,e.image??null,e.createdAt??n,e.updatedAt??n),t.prepare("SELECT * FROM accessories WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:accessories:update",(a,e,r)=>{p(a,"db-sync:accessories:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE accessories SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM accessories WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:accessories:delete",(a,e)=>{p(a,"db-sync:accessories:delete",!1,()=>t.prepare("DELETE FROM accessories WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:warehouse_items:get",a=>{p(a,"db-sync:warehouse_items:get",[],()=>t.prepare("SELECT * FROM warehouse_items ORDER BY createdAt DESC, id DESC").all())}),c.ipcMain.on("db-sync:warehouse_items:add",(a,e)=>{p(a,"db-sync:warehouse_items:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO warehouse_items (
          id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.warehouseId??null,e.name??"",e.category??"general",e.quantity??0,e.costPrice??0,e.notes??null,e.addedBy??null,e.createdAt??n,e.updatedAt??n),t.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:warehouse_items:update",(a,e,r)=>{p(a,"db-sync:warehouse_items:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE warehouse_items SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM warehouse_items WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:warehouse_items:delete",(a,e)=>{p(a,"db-sync:warehouse_items:delete",!1,()=>t.prepare("DELETE FROM warehouse_items WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:cars:get",a=>{p(a,"db-sync:cars:get",[],()=>t.prepare("SELECT * FROM cars_inventory ORDER BY createdAt DESC, id DESC").all())}),c.ipcMain.on("db-sync:cars:add",(a,e)=>{p(a,"db-sync:cars:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO cars_inventory (
          id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
          purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name??"",e.model??"",e.year??0,e.color??null,e.plateNumber??null,e.licenseExpiry??null,e.condition??"used",e.category??null,e.purchasePrice??0,e.salePrice??0,e.notes??null,e.image??null,e.warehouseId??null,e.isArchived?1:0,e.deletedAt??null,e.createdAt??n,e.updatedAt??n),t.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:cars:update",(a,e,r)=>{p(a,"db-sync:cars:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE cars_inventory SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM cars_inventory WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:cars:delete",(a,e)=>{p(a,"db-sync:cars:delete",!1,()=>t.prepare("DELETE FROM cars_inventory WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:customers:get",a=>{p(a,"db-sync:customers:get",[],()=>t.prepare("SELECT * FROM customers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:customers:add",(a,e)=>{p(a,"db-sync:customers:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name,e.phone??null,e.email??null,e.address??null,e.nationalId??null,e.notes??null,e.totalPurchases??0,e.balance??0,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM customers WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:customers:update",(a,e,r)=>{p(a,"db-sync:customers:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE customers SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM customers WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:customers:delete",(a,e)=>{p(a,"db-sync:customers:delete",!1,()=>t.prepare("DELETE FROM customers WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:expenses:get",a=>{p(a,"db-sync:expenses:get",[],()=>t.prepare("SELECT * FROM expenses ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:expenses:add",(a,e)=>{p(a,"db-sync:expenses:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.category,e.description??null,e.amount??0,e.date,e.paymentMethod??"cash",e.employee??null,e.notes??null,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM expenses WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:expenses:update",(a,e,r)=>{p(a,"db-sync:expenses:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE expenses SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM expenses WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:expenses:delete",(a,e)=>{p(a,"db-sync:expenses:delete",!1,()=>t.prepare("DELETE FROM expenses WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:blacklist:get",a=>{p(a,"db-sync:blacklist:get",[],()=>t.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC, updatedAt DESC").all())}),c.ipcMain.on("db-sync:blacklist:add",(a,e)=>{p(a,"db-sync:blacklist:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO blacklist (
          id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
          nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.imei??null,e.deviceName,e.ownerName??null,e.ownerPhone??null,e.ownerPhone??null,e.status??"active",e.reportedDate??n.slice(0,10),e.imei??null,e.reason,e.notes??null,e.createdBy??null,e.createdBy??null,e.deviceName,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM blacklist WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:blacklist:update",(a,e,r)=>{p(a,"db-sync:blacklist:update",null,()=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"ownerPhone")&&!Object.prototype.hasOwnProperty.call(n,"phone")&&(n.phone=n.ownerPhone),Object.prototype.hasOwnProperty.call(n,"imei")&&!Object.prototype.hasOwnProperty.call(n,"nationalId")&&(n.nationalId=n.imei),Object.prototype.hasOwnProperty.call(n,"deviceName")&&!Object.prototype.hasOwnProperty.call(n,"name")&&(n.name=n.deviceName),Object.prototype.hasOwnProperty.call(n,"createdBy")&&!Object.prototype.hasOwnProperty.call(n,"addedBy")&&(n.addedBy=n.createdBy);const{sets:s,values:o}=O(n);return s.length&&(s.push("updatedAt = ?"),o.push(new Date().toISOString(),e),t.prepare(`UPDATE blacklist SET ${s.join(", ")} WHERE id = ?`).run(...o)),t.prepare("SELECT * FROM blacklist WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:blacklist:delete",(a,e)=>{p(a,"db-sync:blacklist:delete",!1,()=>t.prepare("DELETE FROM blacklist WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:damaged_items:get",a=>{p(a,"db-sync:damaged_items:get",[],()=>t.prepare("SELECT * FROM damaged_items ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:damaged_items:add",(a,e)=>{p(a,"db-sync:damaged_items:add",null,()=>{const r=e.id||crypto.randomUUID();return t.prepare(`
        INSERT INTO damaged_items (
          id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.productName??e.name,e.productId??null,e.inventoryType??null,e.quantity??1,e.costPrice??0,e.reason??null,e.estimatedLoss??0,e.reportedBy??null,e.date,e.notes??null,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM damaged_items WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:damaged_items:update",(a,e,r)=>{p(a,"db-sync:damaged_items:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(e),t.prepare(`UPDATE damaged_items SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM damaged_items WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:damaged_items:delete",(a,e)=>{p(a,"db-sync:damaged_items:delete",!1,()=>t.prepare("DELETE FROM damaged_items WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:other_revenue:get",a=>{p(a,"db-sync:other_revenue:get",[],()=>t.prepare("SELECT * FROM other_revenue ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:other_revenue:add",(a,e)=>{p(a,"db-sync:other_revenue:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.source,e.description??null,e.amount??0,e.date,e.paymentMethod??"cash",e.addedBy??null,e.notes??null,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM other_revenue WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:other_revenue:update",(a,e,r)=>{p(a,"db-sync:other_revenue:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE other_revenue SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM other_revenue WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:other_revenue:delete",(a,e)=>{p(a,"db-sync:other_revenue:delete",!1,()=>t.prepare("DELETE FROM other_revenue WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:reminders:get",a=>{p(a,"db-sync:reminders:get",[],()=>t.prepare("SELECT * FROM reminders ORDER BY dueDate ASC, reminderTime ASC").all())}),c.ipcMain.on("db-sync:reminders:add",(a,e)=>{p(a,"db-sync:reminders:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO reminders (
          id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.title,e.description??null,e.dueDate,e.reminderTime??null,e.priority??"medium",e.status??"pending",e.completed??0,e.completedAt??null,e.recurring??null,e.category??null,e.notes??null,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM reminders WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:reminders:update",(a,e,r)=>{p(a,"db-sync:reminders:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE reminders SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM reminders WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:reminders:delete",(a,e)=>{p(a,"db-sync:reminders:delete",!1,()=>t.prepare("DELETE FROM reminders WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:suppliers:get",a=>{p(a,"db-sync:suppliers:get",[],()=>t.prepare("SELECT * FROM suppliers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:suppliers:add",(a,e)=>{p(a,"db-sync:suppliers:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name,e.phone??null,e.email??null,e.address??null,e.category??null,e.balance??0,e.notes??null,e.active??1,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM suppliers WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:suppliers:update",(a,e,r)=>{p(a,"db-sync:suppliers:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE suppliers SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM suppliers WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:suppliers:delete",(a,e)=>{p(a,"db-sync:suppliers:delete",!1,()=>t.prepare("DELETE FROM suppliers WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:supplier_transactions:get",(a,e)=>{p(a,"db-sync:supplier_transactions:get",[],()=>e?t.prepare("SELECT * FROM supplier_transactions WHERE supplierId = ? ORDER BY createdAt DESC").all(e):t.prepare("SELECT * FROM supplier_transactions ORDER BY createdAt DESC").all())}),c.ipcMain.on("db-sync:supplier_transactions:add",(a,e)=>{p(a,"db-sync:supplier_transactions:add",null,()=>t.transaction(()=>{const n=t.prepare("SELECT * FROM suppliers WHERE id = ?").get(e.supplierId);if(!n)throw new Error("Supplier not found");const s=e.id||crypto.randomUUID(),o=e.createdAt||new Date().toISOString(),d=Number(e.amount??0),E=Number(n.balance??0),T=e.type==="purchase"?d:-d,A=E+T;return t.prepare(`
          INSERT INTO supplier_transactions (
            id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(s,e.supplierId,e.supplierName??n.name??null,e.type,d,E,A,e.notes??null,e.createdBy??null,o),t.prepare("UPDATE suppliers SET balance = ?, updatedAt = ? WHERE id = ?").run(A,new Date().toISOString(),e.supplierId),t.prepare("SELECT * FROM supplier_transactions WHERE id = ?").get(s)})())}),c.ipcMain.on("db-sync:employees:get",a=>{p(a,"db-sync:employees:get",[],()=>t.prepare("SELECT * FROM employees WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all())}),c.ipcMain.on("db-sync:employees:add",(a,e)=>{p(a,"db-sync:employees:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name,e.phone??null,e.role??null,e.salary??0,e.commissionRate??0,e.hireDate??null,e.active??1,e.notes??null,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM employees WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employees:update",(a,e,r)=>{p(a,"db-sync:employees:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(n.push("updatedAt = ?"),s.push(new Date().toISOString(),e),t.prepare(`UPDATE employees SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM employees WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:employees:delete",(a,e)=>{p(a,"db-sync:employees:delete",!1,()=>t.prepare("DELETE FROM employees WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:employee_salaries:get",(a,e)=>{p(a,"db-sync:employee_salaries:get",[],()=>e?t.prepare("SELECT * FROM employee_salaries WHERE employeeId = ? ORDER BY month DESC, paidAt DESC, createdAt DESC").all(e):t.prepare("SELECT * FROM employee_salaries ORDER BY month DESC, paidAt DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:employee_salaries:add",(a,e)=>{p(a,"db-sync:employee_salaries:add",null,()=>{const r=e.id||crypto.randomUUID(),n=e.createdAt||e.paidAt||new Date().toISOString();return t.prepare(`
        INSERT INTO employee_salaries (
          id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
          netSalary, paid, paidAt, walletId, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.employeeId,e.employeeName??null,e.month,e.baseSalary??0,e.commission??0,e.bonus??0,e.deductions??0,e.advanceDeducted??0,e.netSalary??0,e.paid??1,e.paidAt??n,e.walletId??null,e.notes??null,n),t.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employee_salaries:update",(a,e,r)=>{p(a,"db-sync:employee_salaries:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(e),t.prepare(`UPDATE employee_salaries SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM employee_salaries WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:employee_salaries:delete",(a,e)=>{p(a,"db-sync:employee_salaries:delete",!1,()=>t.prepare("DELETE FROM employee_salaries WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:employee_advances:get",(a,e)=>{p(a,"db-sync:employee_advances:get",[],()=>e?t.prepare("SELECT * FROM employee_advances WHERE employeeId = ? ORDER BY date DESC, createdAt DESC").all(e):t.prepare("SELECT * FROM employee_advances ORDER BY date DESC, createdAt DESC").all())}),c.ipcMain.on("db-sync:employee_advances:add",(a,e)=>{p(a,"db-sync:employee_advances:add",null,()=>{const r=e.id||crypto.randomUUID(),n=e.createdAt||e.date||new Date().toISOString();return t.prepare(`
        INSERT INTO employee_advances (id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.employeeId,e.employeeName??null,e.amount??0,e.date,e.deductedMonth??null,e.notes??null,n),t.prepare("SELECT * FROM employee_advances WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:employee_advances:update",(a,e,r)=>{p(a,"db-sync:employee_advances:update",null,()=>{const{sets:n,values:s}=O(r);return n.length&&(s.push(e),t.prepare(`UPDATE employee_advances SET ${n.join(", ")} WHERE id = ?`).run(...s)),t.prepare("SELECT * FROM employee_advances WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:employee_advances:delete",(a,e)=>{p(a,"db-sync:employee_advances:delete",!1,()=>t.prepare("DELETE FROM employee_advances WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:used_devices:get",a=>{p(a,"db-sync:used_devices:get",[],()=>t.prepare("SELECT * FROM used_devices WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY createdAt DESC, updatedAt DESC").all())}),c.ipcMain.on("db-sync:used_devices:add",(a,e)=>{p(a,"db-sync:used_devices:add",null,()=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
        INSERT INTO used_devices (
          id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
          ram, description, notes, image, soldAt, purchasedFrom, soldTo, isArchived, deletedAt, warehouseId, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.name,e.model??null,e.deviceType??null,e.category??e.deviceType??null,e.condition??"good",e.purchasePrice??0,e.sellingPrice??e.salePrice??0,e.status??"in_stock",e.serialNumber??null,e.color??null,e.storage??null,e.ram??null,e.description??null,e.notes??e.description??null,e.image??null,e.soldAt??null,e.purchasedFrom??null,e.soldTo??null,e.isArchived?1:0,e.deletedAt??null,e.warehouseId??null,e.createdAt||n,e.updatedAt||n),t.prepare("SELECT * FROM used_devices WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:used_devices:update",(a,e,r)=>{p(a,"db-sync:used_devices:update",null,()=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"deviceType")&&!Object.prototype.hasOwnProperty.call(n,"category")&&(n.category=n.deviceType),Object.prototype.hasOwnProperty.call(n,"description")&&!Object.prototype.hasOwnProperty.call(n,"notes")&&(n.notes=n.description);const{sets:s,values:o}=O(n);return s.length&&(s.push("updatedAt = ?"),o.push(new Date().toISOString(),e),t.prepare(`UPDATE used_devices SET ${s.join(", ")} WHERE id = ?`).run(...o)),t.prepare("SELECT * FROM used_devices WHERE id = ?").get(e)})}),c.ipcMain.on("db-sync:used_devices:delete",(a,e)=>{p(a,"db-sync:used_devices:delete",!1,()=>t.prepare("DELETE FROM used_devices WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:sales:get",(a,e=!1)=>{p(a,"db-sync:sales:get",[],()=>te(t,!!e))}),c.ipcMain.on("db-sync:sales:maxInvoiceSequence",a=>{p(a,"db-sync:sales:maxInvoiceSequence",0,()=>t.prepare("SELECT invoiceNumber FROM sales").all().reduce((r,n)=>{const s=/^INV-\d{4}-(\d+)$/.exec(String(n.invoiceNumber??"")),o=s?Number.parseInt(s[1],10):0;return Number.isFinite(o)?Math.max(r,o):r},0))}),c.ipcMain.on("db-sync:sales:upsert",(a,e)=>{p(a,"db-sync:sales:upsert",null,()=>t.transaction(()=>{t.prepare(`
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
        `).run(e.id,e.invoiceNumber,e.date,e.subtotal??0,e.discount??0,e.total??0,e.totalCost??0,e.grossProfit??0,e.marginPct??0,e.paymentMethod??"cash",e.employee??"system",e.voidedAt??null,e.voidReason??null,e.voidedBy??null),t.prepare("DELETE FROM sale_items WHERE saleId = ?").run(e.id);const n=t.prepare(`
          INSERT INTO sale_items (id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const s of Array.isArray(e.items)?e.items:[])n.run(s.id??crypto.randomUUID(),e.id,s.productId,s.name,s.qty??0,s.price??0,s.cost??0,s.lineDiscount??0,s.warehouseId??null,s.batches?JSON.stringify(s.batches):null);return te(t).find(s=>s.id===e.id)??null})())}),c.ipcMain.on("db-sync:returns:get",a=>{p(a,"db-sync:returns:get",[],()=>K(t))}),c.ipcMain.on("db-sync:returns:add",(a,e)=>{p(a,"db-sync:returns:add",null,()=>t.transaction(()=>{const s=K(t).reduce((N,g)=>Math.max(N,ee(g.returnNumber,"RET")),0),o=e.id||crypto.randomUUID(),d=e.createdAt||new Date().toISOString(),E=e.returnNumber||`RET-${String(s+1).padStart(4,"0")}`,T=e.originalSaleId?t.prepare("SELECT id FROM sales WHERE id = ?").get(e.originalSaleId):void 0;t.prepare(`
          INSERT INTO return_records (
            id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(o,E,e.originalInvoiceNumber,(T==null?void 0:T.id)??null,e.date,e.totalRefund??0,e.reason??null,e.processedBy??null,d);const A=t.prepare(`
          INSERT INTO return_items (id, returnId, productId, name, qty, price, reason)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);for(const N of Array.isArray(e.items)?e.items:[])A.run(N.id??crypto.randomUUID(),o,N.productId,N.name,N.qty??0,N.price??0,N.reason??null);return K(t).find(N=>N.id===o)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:get",a=>{p(a,"db-sync:purchase_invoices:get",[],()=>B(t))}),c.ipcMain.on("db-sync:purchase_invoices:add",(a,e)=>{p(a,"db-sync:purchase_invoices:add",null,()=>t.transaction(()=>{var _;const s=B(t).reduce((C,L)=>Math.max(C,ee(L.invoiceNumber,"PI")),0),o=e.id||crypto.randomUUID(),d=new Date().toISOString(),E=Number(e.totalAmount??0),T=Math.min(E,Number(e.paidAmount??0)),A=Math.max(0,Math.round((E-T)*100)/100),N=V(E,T),g=e.supplierId?((_=t.prepare("SELECT id FROM suppliers WHERE id = ?").get(e.supplierId))==null?void 0:_.id)??null:null;t.prepare(`
          INSERT INTO purchase_invoices (
            id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
            remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(o,e.invoiceNumber||`PI-${String(s+1).padStart(4,"0")}`,g,e.supplierName,e.invoiceDate,E,T,A,e.paymentMethod??"cash",N,e.notes??null,e.createdBy??"system",e.createdAt||d,e.updatedAt||d);const F=t.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const C of Array.isArray(e.items)?e.items:[]){const L=Number(C.quantity??0),f=Number(C.unitPrice??0);F.run(C.id??crypto.randomUUID(),o,C.productName,C.category??null,L,f,C.totalPrice??L*f,C.notes??null)}return B(t).find(C=>C.id===o)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:update",(a,e,r)=>{p(a,"db-sync:purchase_invoices:update",null,()=>t.transaction(()=>{var F;const s=B(t).find(_=>_.id===e);if(!s)return null;const o={...s,...r,items:Array.isArray(r==null?void 0:r.items)?r.items:s.items},d=Number(o.totalAmount??0),E=Math.min(d,Number(o.paidAmount??0)),T=Math.max(0,Math.round((d-E)*100)/100),A=V(d,E),N=o.supplierId?((F=t.prepare("SELECT id FROM suppliers WHERE id = ?").get(o.supplierId))==null?void 0:F.id)??null:null;t.prepare(`
          UPDATE purchase_invoices
          SET supplierId = ?, supplierName = ?, invoiceDate = ?, totalAmount = ?, paidAmount = ?, remaining = ?,
              paymentMethod = ?, status = ?, notes = ?, createdBy = ?, updatedAt = ?
          WHERE id = ?
        `).run(N,o.supplierName,o.invoiceDate,d,E,T,o.paymentMethod??"cash",A,o.notes??null,o.createdBy??"system",new Date().toISOString(),e),t.prepare("DELETE FROM purchase_invoice_items WHERE invoiceId = ?").run(e);const g=t.prepare(`
          INSERT INTO purchase_invoice_items (
            id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);for(const _ of Array.isArray(o.items)?o.items:[]){const C=Number(_.quantity??0),L=Number(_.unitPrice??0);g.run(_.id??crypto.randomUUID(),e,_.productName,_.category??null,C,L,_.totalPrice??C*L,_.notes??null)}return B(t).find(_=>_.id===e)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:applyPayment",(a,e,r)=>{p(a,"db-sync:purchase_invoices:applyPayment",null,()=>t.transaction(()=>{const s=t.prepare("SELECT * FROM purchase_invoices WHERE id = ?").get(e);if(!s)return null;const o=Number(s.totalAmount??0),d=Math.min(o,Number(s.paidAmount??0)+Math.max(0,Number(r??0))),E=Math.max(0,Math.round((o-d)*100)/100),T=V(o,d);return t.prepare(`
          UPDATE purchase_invoices
          SET paidAmount = ?, remaining = ?, status = ?, updatedAt = ?
          WHERE id = ?
        `).run(d,E,T,new Date().toISOString(),e),B(t).find(A=>A.id===e)??null})())}),c.ipcMain.on("db-sync:purchase_invoices:delete",(a,e)=>{p(a,"db-sync:purchase_invoices:delete",!1,()=>t.prepare("DELETE FROM purchase_invoices WHERE id = ?").run(e).changes>0)}),c.ipcMain.on("db-sync:shift_closings:get",a=>{p(a,"db-sync:shift_closings:get",[],()=>mt(t))}),c.ipcMain.on("db-sync:shift_closings:buildSummary",(a,e,r,n)=>{p(a,"db-sync:shift_closings:buildSummary",null,()=>At(t,e,Number(r??0),n))}),c.ipcMain.on("db-sync:shift_closings:add",(a,e)=>{p(a,"db-sync:shift_closings:add",null,()=>{const r=e.id||crypto.randomUUID(),n=e.createdAt||e.closedAt||new Date().toISOString();return t.prepare(`
        INSERT INTO shift_closings (
          id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
          salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.shiftDate,e.closedAt,e.closedBy,e.salesCount??0,e.salesCash??0,e.salesCard??0,e.salesTransfer??0,e.salesTotal??0,e.expectedCash??0,e.actualCash??0,e.cashDifference??0,e.notes??null,n),t.prepare("SELECT * FROM shift_closings WHERE id = ?").get(r)??null})}),c.ipcMain.on("db-sync:stock_movements:get",(a,e)=>{p(a,"db-sync:stock_movements:get",[],()=>e?t.prepare("SELECT * FROM stock_movements WHERE productId = ? ORDER BY timestamp DESC, id DESC").all(e):t.prepare("SELECT * FROM stock_movements ORDER BY timestamp DESC, id DESC").all())}),c.ipcMain.on("db-sync:stock_movements:add",(a,e)=>{p(a,"db-sync:stock_movements:add",null,()=>{const r=e.id||crypto.randomUUID();return t.prepare(`
        INSERT INTO stock_movements (
          id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
          referenceId, userId, timestamp, warehouseId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.productId,e.type,e.quantityChange??0,e.previousQuantity??0,e.newQuantity??0,e.reason??null,e.referenceId??null,e.userId??null,e.timestamp??new Date().toISOString(),e.warehouseId??null),t.prepare("SELECT * FROM stock_movements WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:stock_movements:addBulk",(a,e)=>{p(a,"db-sync:stock_movements:addBulk",[],()=>t.transaction(()=>{const n=t.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
            referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=[];for(const d of Array.isArray(e)?e:[]){const E=d.id||crypto.randomUUID();s.push(E),n.run(E,d.productId,d.type,d.quantityChange??0,d.previousQuantity??0,d.newQuantity??0,d.reason??null,d.referenceId??null,d.userId??null,d.timestamp??new Date().toISOString(),d.warehouseId??null)}if(s.length===0)return[];const o=s.map(()=>"?").join(", ");return t.prepare(`SELECT * FROM stock_movements WHERE id IN (${o}) ORDER BY timestamp DESC, id DESC`).all(...s)})())}),c.ipcMain.on("db-sync:audit_logs:get",a=>{p(a,"db-sync:audit_logs:get",[],()=>t.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC").all())}),c.ipcMain.on("db-sync:audit_logs:add",(a,e)=>{p(a,"db-sync:audit_logs:add",null,()=>{const r=e.id||crypto.randomUUID();return t.prepare(`
        INSERT INTO audit_logs (
          id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(r,e.userId??"system",e.action,e.entityType,e.entityId,e.beforeState?JSON.stringify(e.beforeState):null,e.afterState?JSON.stringify(e.afterState):null,e.machineId??null,e.timestamp??new Date().toISOString()),t.prepare("SELECT * FROM audit_logs WHERE id = ?").get(r)})}),c.ipcMain.on("db-sync:audit_logs:addBulk",(a,e)=>{p(a,"db-sync:audit_logs:addBulk",[],()=>t.transaction(()=>{const n=t.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `),s=[];for(const d of Array.isArray(e)?e:[]){const E=d.id||crypto.randomUUID();s.push(E),n.run(E,d.userId??"system",d.action,d.entityType,d.entityId,d.beforeState?JSON.stringify(d.beforeState):null,d.afterState?JSON.stringify(d.afterState):null,d.machineId??null,d.timestamp??new Date().toISOString())}if(s.length===0)return[];const o=s.map(()=>"?").join(", ");return t.prepare(`SELECT * FROM audit_logs WHERE id IN (${o}) ORDER BY timestamp DESC, id DESC`).all(...s)})())}),c.ipcMain.handle("db:partners:get",()=>t.prepare("SELECT * FROM partners ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:partners:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.phone,e.address,e.partnershipType,e.sharePercent||0,e.profitShareDevices||0,e.profitShareAccessories||0,e.capitalAmount||0,e.active?1:0,e.notes,e.createdAt||n,n),t.prepare("SELECT * FROM partners WHERE id = ?").get(r)}),c.ipcMain.handle("db:partners:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE partners SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM partners WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:partners:delete",(a,e)=>t.prepare("DELETE FROM partners WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:partner_transactions:get",(a,e)=>e?t.prepare("SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC").all(e):t.prepare("SELECT * FROM partner_transactions ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:partner_transactions:add",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(r,e.partnerId,e.type,e.amount,e.description,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM partner_transactions WHERE id = ?").get(r)}),c.ipcMain.handle("db:warehouses:get",()=>t.prepare("SELECT * FROM warehouses ORDER BY name ASC").all()),c.ipcMain.handle("db:warehouses:add",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO warehouses (id, name, location, isDefault, notes) VALUES (?, ?, ?, ?, ?)").run(r,e.name,e.location,e.isDefault?1:0,e.notes),t.prepare("SELECT * FROM warehouses WHERE id = ?").get(r)}),c.ipcMain.handle("db:warehouses:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(s.push(e),t.prepare(`UPDATE warehouses SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM warehouses WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:warehouses:delete",(a,e)=>t.prepare("DELETE FROM warehouses WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:safe_transactions:get",(a,e)=>e?t.prepare("SELECT * FROM safe_transactions WHERE walletId = ? ORDER BY createdAt DESC").all(e):t.prepare("SELECT * FROM safe_transactions ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:safe_transactions:add",(a,e)=>{const r=e.id||crypto.randomUUID();return lt(t,String(e.walletId??"")),t.prepare("INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.walletId,e.type,e.subType,e.amount,e.category,e.description,e.paymentMethod,e.affectsCapital?1:0,e.affectsProfit?1:0,e.createdBy,e.relatedId,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM safe_transactions WHERE id = ?").get(r)}),c.ipcMain.handle("db:customers:get",()=>t.prepare("SELECT * FROM customers ORDER BY name ASC").all()),c.ipcMain.handle("db:customers:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.phone,e.email,e.address,e.nationalId,e.notes,e.totalPurchases||0,e.balance||0,e.createdAt||n,n),t.prepare("SELECT * FROM customers WHERE id = ?").get(r)}),c.ipcMain.handle("db:customers:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE customers SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM customers WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:customers:delete",(a,e)=>t.prepare("DELETE FROM customers WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:suppliers:get",()=>t.prepare("SELECT * FROM suppliers ORDER BY name ASC").all()),c.ipcMain.handle("db:suppliers:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.phone,e.email,e.address,e.category,e.balance||0,e.notes,e.active??1,e.createdAt||n,n),t.prepare("SELECT * FROM suppliers WHERE id = ?").get(r)}),c.ipcMain.handle("db:suppliers:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE suppliers SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM suppliers WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:suppliers:delete",(a,e)=>t.prepare("DELETE FROM suppliers WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:employees:get",()=>t.prepare("SELECT * FROM employees ORDER BY name ASC").all()),c.ipcMain.handle("db:employees:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.phone,e.role,e.salary||0,e.commissionRate||0,e.hireDate,e.active??1,e.notes,e.createdAt||n,n),t.prepare("SELECT * FROM employees WHERE id = ?").get(r)}),c.ipcMain.handle("db:employees:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE employees SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM employees WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:employees:delete",(a,e)=>t.prepare("DELETE FROM employees WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:expenses:get",(a,{from:e,to:r}={})=>e&&r?t.prepare("SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC").all(e,r):t.prepare("SELECT * FROM expenses ORDER BY date DESC").all()),c.ipcMain.handle("db:expenses:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.category,e.description,e.amount,e.date,e.paymentMethod||"cash",e.employee,e.notes,e.createdAt||n,n),t.prepare("SELECT * FROM expenses WHERE id = ?").get(r)}),c.ipcMain.handle("db:expenses:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE expenses SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM expenses WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:expenses:delete",(a,e)=>t.prepare("DELETE FROM expenses WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:blacklist:get",()=>t.prepare("SELECT * FROM blacklist ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:blacklist:add",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.phone,e.nationalId,e.reason,e.notes,e.addedBy,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM blacklist WHERE id = ?").get(r)}),c.ipcMain.handle("db:blacklist:delete",(a,e)=>t.prepare("DELETE FROM blacklist WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:blacklist:search",(a,e)=>{const r=`%${e}%`;return t.prepare("SELECT * FROM blacklist WHERE name LIKE ? OR phone LIKE ? OR nationalId LIKE ?").all(r,r,r)}),c.ipcMain.handle("db:damaged_items:get",()=>t.prepare("SELECT * FROM damaged_items ORDER BY date DESC").all()),c.ipcMain.handle("db:damaged_items:add",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.productName||e.name,e.productId,e.inventoryType,e.quantity||1,e.reason,e.estimatedLoss||0,e.reportedBy,e.date,e.notes,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM damaged_items WHERE id = ?").get(r)}),c.ipcMain.handle("db:damaged_items:delete",(a,e)=>t.prepare("DELETE FROM damaged_items WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:other_revenue:get",()=>t.prepare("SELECT * FROM other_revenue ORDER BY date DESC").all()),c.ipcMain.handle("db:other_revenue:add",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.source,e.description,e.amount,e.date,e.paymentMethod||"cash",e.notes,e.createdAt||new Date().toISOString()),t.prepare("SELECT * FROM other_revenue WHERE id = ?").get(r)}),c.ipcMain.handle("db:other_revenue:delete",(a,e)=>t.prepare("DELETE FROM other_revenue WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:wallets:get",()=>t.prepare("SELECT * FROM wallets ORDER BY name ASC").all()),c.ipcMain.handle("db:wallets:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.name,e.type||"cash",e.balance||0,e.isDefault?1:0,e.icon||null,e.color,e.notes,e.createdAt||n,n),t.prepare("SELECT * FROM wallets WHERE id = ?").get(r)}),c.ipcMain.handle("db:wallets:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE wallets SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM wallets WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:wallets:delete",(a,e)=>t.transaction(()=>(t.prepare("DELETE FROM safe_transactions WHERE walletId = ?").run(e),t.prepare("DELETE FROM wallets WHERE id = ?").run(e).changes>0))()),c.ipcMain.handle("db:used_devices:get",()=>t.prepare("SELECT * FROM used_devices ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:used_devices:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare(`
      INSERT INTO used_devices (
        id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
        ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(r,e.name,e.model??null,e.deviceType??null,e.category??e.deviceType??null,e.condition||"good",e.purchasePrice||0,e.sellingPrice||0,e.status||"in_stock",e.serialNumber,e.color,e.storage,e.ram??null,e.description??null,e.notes??e.description??null,e.image,e.soldAt,e.purchasedFrom,e.soldTo,e.createdAt||n,n),t.prepare("SELECT * FROM used_devices WHERE id = ?").get(r)}),c.ipcMain.handle("db:used_devices:update",(a,e,r)=>{const n={...r};Object.prototype.hasOwnProperty.call(n,"deviceType")&&!Object.prototype.hasOwnProperty.call(n,"category")&&(n.category=n.deviceType),Object.prototype.hasOwnProperty.call(n,"description")&&!Object.prototype.hasOwnProperty.call(n,"notes")&&(n.notes=n.description);const{sets:s,values:o}=O(n);return s.length?(s.push("updatedAt = ?"),o.push(new Date().toISOString()),o.push(e),t.prepare(`UPDATE used_devices SET ${s.join(", ")} WHERE id = ?`).run(...o),t.prepare("SELECT * FROM used_devices WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:used_devices:delete",(a,e)=>t.prepare("DELETE FROM used_devices WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:reminders:get",()=>t.prepare("SELECT * FROM reminders ORDER BY dueDate ASC").all()),c.ipcMain.handle("db:reminders:add",(a,e)=>{const r=e.id||crypto.randomUUID(),n=new Date().toISOString();return t.prepare("INSERT INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r,e.title,e.description,e.dueDate,e.priority||"medium",e.completed?1:0,e.completedAt,e.recurring,e.category,e.createdAt||n,n),t.prepare("SELECT * FROM reminders WHERE id = ?").get(r)}),c.ipcMain.handle("db:reminders:update",(a,e,r)=>{const{sets:n,values:s}=O(r);return n.length?(n.push("updatedAt = ?"),s.push(new Date().toISOString()),s.push(e),t.prepare(`UPDATE reminders SET ${n.join(", ")} WHERE id = ?`).run(...s),t.prepare("SELECT * FROM reminders WHERE id = ?").get(e)):!0}),c.ipcMain.handle("db:reminders:delete",(a,e)=>t.prepare("DELETE FROM reminders WHERE id = ?").run(e).changes>0),c.ipcMain.handle("db:shifts:get",()=>t.prepare("SELECT * FROM shift_records ORDER BY openedAt DESC").all()),c.ipcMain.handle("db:shifts:getActive",()=>t.prepare("SELECT * FROM shift_records WHERE closedAt IS NULL ORDER BY openedAt DESC LIMIT 1").get()),c.ipcMain.handle("db:shifts:open",(a,e)=>{const r=e.id||crypto.randomUUID();return t.prepare("INSERT INTO shift_records (id, openedAt, openingBalance, openedBy, notes) VALUES (?, ?, ?, ?, ?)").run(r,e.openedAt||new Date().toISOString(),e.openingBalance||0,e.openedBy,e.notes),t.prepare("SELECT * FROM shift_records WHERE id = ?").get(r)}),c.ipcMain.handle("db:shifts:close",(a,e,r)=>(t.prepare("UPDATE shift_records SET closedAt = ?, closingBalance = ?, totalSales = ?, totalExpenses = ?, closedBy = ?, notes = ? WHERE id = ?").run(r.closedAt||new Date().toISOString(),r.closingBalance||0,r.totalSales||0,r.totalExpenses||0,r.closedBy,r.notes,e),t.prepare("SELECT * FROM shift_records WHERE id = ?").get(e))),c.ipcMain.handle("db:stats",()=>{const a=["products","sales","customers","suppliers","employees","expenses","installments","repair_tickets","repair_parts","wallets","used_devices","reminders","blacklist","damaged_items","other_revenue","partners","warehouses"],e={};for(const r of a)try{const n=t.prepare(`SELECT COUNT(*) as c FROM ${r}`).get();e[r]=n.c}catch{e[r]=-1}return e})}function St(t){const a=["mobile_spare_part","device_spare_part","computer_spare_part"],e=r=>{switch(r){case"mobile":case"tablet":return"mobile_spare_part";case"device":return"device_spare_part";case"computer":case"laptop":return"computer_spare_part";default:return null}};c.ipcMain.handle("db:repairs:getTickets",(r,n={})=>{let s="SELECT * FROM repair_tickets WHERE 1=1";const o=[];if(n.status&&(s+=" AND status = ?",o.push(n.status)),n.customerId&&(s+=" AND client_id = ?",o.push(n.customerId)),n.search){s+=" AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ?)";const d=`%${n.search}%`;o.push(d,d,d)}return s+=" ORDER BY createdAt DESC",t.prepare(s).all(...o)}),c.ipcMain.handle("db:repairs:getTicket",(r,n)=>t.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(n)),c.ipcMain.handle("db:repairs:addTicket",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=n.ticket_no||`TKT-${Date.now()}`;return t.prepare(`
      INSERT INTO repair_tickets (
        id, ticket_no, client_id, customer_name, customer_phone,
        device_category, device_brand, device_model, imei_or_serial,
        issue_description, accessories_received, device_passcode,
        status, package_price, final_cost, warranty_days,
        assigned_tech_name, tech_bonus_type, tech_bonus_value,
        createdAt, createdBy, updatedAt, updatedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,d,n.client_id||n.customerId||null,n.customer_name||"عميل نقدي",n.customer_phone||null,n.device_category||"mobile",n.device_brand||n.deviceBrand||null,n.device_model||n.deviceModel||null,n.imei_or_serial||n.serial||null,n.issue_description||n.problemDesc||"",n.accessories_received||n.accessories||null,n.device_passcode||n.password||null,n.status||"received",n.package_price??n.expectedCost??null,n.final_cost??null,n.warranty_days??null,n.assigned_tech_name||n.techName||null,n.tech_bonus_type||null,n.tech_bonus_value??null,n.createdAt||o,n.createdBy||null,o,n.updatedBy||null),t.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:updateTicket",(r,n,s)=>{const o=new Set(["client_id","customer_name","customer_phone","device_category","device_brand","device_model","imei_or_serial","issue_description","accessories_received","device_passcode","status","package_price","final_cost","warranty_days","assigned_tech_name","tech_bonus_type","tech_bonus_value","updatedBy"]),d=[],E=[];for(const[T,A]of Object.entries(s))o.has(T)&&(d.push(`${T} = ?`),E.push(A===void 0?null:A));return d.length===0||(d.push("updatedAt = ?"),E.push(new Date().toISOString()),E.push(n),t.prepare(`UPDATE repair_tickets SET ${d.join(", ")} WHERE id = ?`).run(...E)),t.prepare("SELECT * FROM repair_tickets WHERE id = ?").get(n)}),c.ipcMain.handle("db:repairs:deleteTicket",(r,n)=>(t.prepare("DELETE FROM repair_ticket_parts WHERE ticket_id = ?").run(n),t.prepare("DELETE FROM repair_events WHERE ticket_id = ?").run(n),t.prepare("DELETE FROM repair_payments WHERE ticket_id = ?").run(n),t.prepare("DELETE FROM repair_status_history WHERE ticket_id = ?").run(n),t.prepare("DELETE FROM repair_tickets WHERE id = ?").run(n).changes>0)),c.ipcMain.handle("db:repairs:getHistory",(r,n)=>t.prepare("SELECT * FROM repair_status_history WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addHistory",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return t.prepare(`
      INSERT INTO repair_status_history (id, ticket_id, from_status, to_status, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.from_status||null,n.to_status,n.note||null,o,n.createdBy||null),t.prepare("SELECT * FROM repair_status_history WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getEvents",(r,n)=>t.prepare("SELECT * FROM repair_events WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addEvent",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return t.prepare(`
      INSERT INTO repair_events (id, ticket_id, event_type, from_status, to_status, note, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.event_type,n.from_status||n.old_status||null,n.to_status||n.new_status||null,n.note||n.notes||null,n.createdBy||n.user_name||null,o),t.prepare("SELECT * FROM repair_events WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getPayments",(r,n)=>t.prepare("SELECT * FROM repair_payments WHERE ticket_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addPayment",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return t.prepare(`
      INSERT INTO repair_payments (id, ticket_id, kind, amount, wallet_type, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.kind||"deposit",n.amount,n.wallet_type||"cash",n.note||null,o,n.createdBy||null),t.prepare("SELECT * FROM repair_payments WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getParts",()=>t.prepare("SELECT * FROM repair_parts ORDER BY name ASC").all()),c.ipcMain.handle("db:repairs:getPart",(r,n)=>t.prepare("SELECT * FROM repair_parts WHERE id = ?").get(n)),c.ipcMain.handle("db:repairs:addPart",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();return t.prepare(`
      INSERT INTO repair_parts (
        id, name, category, sku, brand, compatible_models,
        unit_cost, selling_price, qty, min_qty,
        barcode, color, location, active, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.name,n.category||null,n.sku||n.part_no||null,n.brand||null,n.compatible_models||null,n.unit_cost||n.cost_price||0,n.selling_price||0,n.qty||n.current_stock||0,n.min_qty||n.min_stock||0,n.barcode||null,n.color||null,n.location||null,n.active??1,n.notes||null,o),t.prepare("SELECT * FROM repair_parts WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:updatePart",(r,n,s)=>{const o=["id","createdAt"],d=[],E=[];for(const[T,A]of Object.entries(s))o.includes(T)||(d.push(`${T} = ?`),E.push(A));return d.length===0||(E.push(n),t.prepare(`UPDATE repair_parts SET ${d.join(", ")} WHERE id = ?`).run(...E)),t.prepare("SELECT * FROM repair_parts WHERE id = ?").get(n)}),c.ipcMain.handle("db:repairs:deletePart",(r,n)=>t.prepare("DELETE FROM repair_parts WHERE id = ?").run(n).changes>0),c.ipcMain.handle("db:repairs:getTicketParts",(r,n)=>t.prepare(`
      SELECT tp.*, 
        COALESCE(rp.name, acc.name) as partName,
        COALESCE(rp.unit_cost, acc.costPrice, acc.newCostPrice) as partCostPrice,
        COALESCE(rp.selling_price, acc.salePrice) as partSellingPrice
      FROM repair_ticket_parts tp
      LEFT JOIN repair_parts rp ON tp.part_id = rp.id
      LEFT JOIN accessories acc ON tp.part_id = acc.id
      WHERE tp.ticket_id = ?
    `).all(n)),c.ipcMain.handle("db:repairs:addTicketPart",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=Math.max(1,Number(n.qty||n.quantity||1)),E=t.prepare("SELECT id, ticket_no, device_category FROM repair_tickets WHERE id = ?").get(n.ticket_id);if(!E)throw new Error("طلب الصيانة غير موجود.");const T=e(E.device_category),A=t.prepare("SELECT id, name, quantity, inventoryType FROM accessories WHERE id = ?").get(n.part_id),N=A?void 0:t.prepare("SELECT id, name, qty FROM repair_parts WHERE id = ?").get(n.part_id);if(A){if(!a.includes(A.inventoryType))throw new Error("القطعة المختارة ليست من مخزون قطع الغيار.");if(T&&A.inventoryType!==T)throw new Error("يجب اختيار قطعة من مخزون نفس نوع الجهاز الجاري إصلاحه.");if(Number(A.quantity||0)<d)throw new Error(`الكمية المتاحة من ${A.name} هي ${A.quantity} فقط.`)}else if(N&&Number(N.qty||0)<d)throw new Error(`الكمية المتاحة من ${N.name} هي ${N.qty} فقط.`);return t.prepare(`
      INSERT INTO repair_ticket_parts (id, ticket_id, part_id, qty, unit_cost, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.ticket_id,n.part_id,d,n.unit_cost||n.cost_price||0,n.status||"used",o,o),A?t.prepare("UPDATE accessories SET quantity = MAX(0, quantity - ?) WHERE id = ?").run(d,n.part_id):N&&t.prepare("UPDATE repair_parts SET qty = MAX(0, qty - ?) WHERE id = ?").run(d,n.part_id),(A||N)&&t.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, 'usage', ?, ?, ?, ?)
    `).run(crypto.randomUUID(),n.part_id,n.ticket_id,d,n.unit_cost||0,`استخدام في تذكرة ${n.ticket_id}`,o),t.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:removeTicketPart",(r,n)=>{const s=t.prepare("SELECT * FROM repair_ticket_parts WHERE id = ?").get(n);return s&&(t.prepare("SELECT id FROM accessories WHERE id = ?").get(s.part_id)?t.prepare("UPDATE accessories SET quantity = quantity + ? WHERE id = ?").run(s.qty,s.part_id):t.prepare("SELECT id FROM repair_parts WHERE id = ?").get(s.part_id)&&t.prepare("UPDATE repair_parts SET qty = qty + ? WHERE id = ?").run(s.qty,s.part_id)),t.prepare("DELETE FROM repair_ticket_parts WHERE id = ?").run(n).changes>0}),c.ipcMain.handle("db:repairs:getInvoices",(r,n)=>n?t.prepare("SELECT * FROM repair_invoices WHERE ticket_id = ? ORDER BY createdAt DESC").all(n):t.prepare("SELECT * FROM repair_invoices ORDER BY createdAt DESC").all()),c.ipcMain.handle("db:repairs:addInvoice",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString(),d=n.invoice_no||`INV-${Date.now()}`;if(t.prepare(`
      INSERT INTO repair_invoices (id, invoice_no, ticket_id, createdAt, deliveredAt,
        subtotal_labor, subtotal_parts, discount, tax, total, paid_total, remaining,
        payment_summary_json, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,d,n.ticket_id,o,n.deliveredAt||null,n.subtotal_labor||0,n.subtotal_parts||0,n.discount||0,n.tax||0,n.total||0,n.paid_total||0,n.remaining||0,n.payment_summary_json?JSON.stringify(n.payment_summary_json):null,n.createdBy||null),Array.isArray(n.items))for(const E of n.items)t.prepare(`
          INSERT INTO repair_invoice_items (id, invoice_id, type, ref_id, name, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(crypto.randomUUID(),s,E.type,E.ref_id||null,E.name,E.qty||1,E.unit_price||0,(E.qty||1)*(E.unit_price||0));return t.prepare("SELECT * FROM repair_invoices WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getPartMovements",(r,n)=>t.prepare("SELECT * FROM repair_parts_movements WHERE part_id = ? ORDER BY createdAt DESC").all(n)),c.ipcMain.handle("db:repairs:addPartMovement",(r,n)=>{const s=n.id||crypto.randomUUID(),o=new Date().toISOString();t.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(s,n.part_id,n.ticket_id||null,n.type,n.qty,n.unit_cost||0,n.note||null,o);const d=["purchase","return","adjustment_add"].includes(n.type)?n.qty:-n.qty;return t.prepare("UPDATE repair_parts SET qty = MAX(0, qty + ?) WHERE id = ?").run(d,n.part_id),t.prepare("SELECT * FROM repair_parts_movements WHERE id = ?").get(s)}),c.ipcMain.handle("db:repairs:getAccessoryParts",(r,n)=>{const s=`
      SELECT * FROM accessories 
      WHERE inventoryType IN ('mobile_spare_part', 'device_spare_part', 'computer_spare_part')
      ${n?"AND inventoryType = ?":""}
      AND (isArchived IS NULL OR isArchived = 0)
      ORDER BY name ASC
    `;return n?t.prepare(s).all(n):t.prepare(s).all()}),c.ipcMain.handle("db:repairs:stats",()=>{const r=["received","diagnosing","waiting_parts","repairing","ready","delivered","cancelled"],n={};for(const o of r){const d=t.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status = ?").get(o);n[o]=d.c}const s=t.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status NOT IN ('delivered','cancelled')").get();return n.active=s.c,n})}c.protocol.registerSchemesAsPrivileged([{scheme:"local-img",privileges:{secure:!0,standard:!0,bypassCSP:!0}}]);const Lt=de.fileURLToPath(typeof document>"u"?require("url").pathToFileURL(__filename).href:G&&G.tagName.toUpperCase()==="SCRIPT"&&G.src||new URL("main.js",document.baseURI).href),$=M.dirname(Lt);let v=null,x=null;function re(){x=new c.BrowserWindow({width:1280,height:800,minWidth:900,minHeight:600,icon:M.join($,"../public/logo.png"),webPreferences:{nodeIntegration:!1,contextIsolation:!0,preload:M.join($,"preload.cjs")}}),process.env.NODE_ENV!=="production"&&process.env.VITE_DEV_SERVER_URL?(x.loadURL(process.env.VITE_DEV_SERVER_URL),x.webContents.openDevTools()):(x.loadFile(M.join($,"../dist/index.html")),x.webContents.openDevTools()),x.setMenuBarVisibility(!1)}c.ipcMain.on("store-get",(t,a)=>{if(!v){t.returnValue=null;return}try{const e=v.prepare("SELECT value FROM settings WHERE key = ?").get(a);t.returnValue=e?JSON.parse(e.value):null}catch(e){console.error("store-get error:",e),t.returnValue=null}});c.ipcMain.on("store-set",(t,a,e)=>{if(!v){t.returnValue=!1;return}try{v.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(a,JSON.stringify(e)),t.returnValue=!0}catch(r){console.error("store-set error:",r),t.returnValue=!1}});c.ipcMain.on("store-delete",(t,a)=>{if(!v){t.returnValue=!1;return}try{v.prepare("DELETE FROM settings WHERE key = ?").run(a),t.returnValue=!0}catch(e){console.error("store-delete error:",e),t.returnValue=!1}});c.app.whenReady().then(()=>{v=ue(),Pe(v),Nt(v),St(v);const t=c.app.getPath("userData"),a=M.join(t,"images");c.protocol.handle("local-img",e=>{const r=e.url.slice(12).split("?")[0],n=M.join(a,decodeURIComponent(r));return c.net.fetch(`file://${n}`)}),re(),c.app.on("activate",()=>{c.BrowserWindow.getAllWindows().length===0&&re()})});c.app.on("window-all-closed",()=>{process.platform!=="darwin"&&c.app.quit()});c.ipcMain.handle("ping",()=>"pong");c.ipcMain.handle("save-image",async(t,a)=>{try{const e=c.app.getPath("userData"),r=M.join(e,"images");W.existsSync(r)||W.mkdirSync(r,{recursive:!0});const n=a.match(/^data:([A-Za-z+/.-]+);base64,(.+)$/);if(!n||n.length!==3)return{success:!1,error:"Invalid base64 format"};const s=n[1].split("/")[1]||"png",o=Buffer.from(n[2],"base64"),d=`img_${Date.now()}.${s}`,E=M.join(r,d);return W.writeFileSync(E,o),{success:!0,path:`local-img://${d}`}}catch(e){return console.error("Error saving image:",e),{success:!1,error:e instanceof Error?e.message:"Unknown error"}}});c.ipcMain.handle("db:backup",async()=>{try{const t=c.app.getPath("userData"),a=process.env.NODE_ENV!=="production",e=M.join(t,a?"retail_dev.sqlite":"retail_prod.sqlite"),{canceled:r,filePath:n}=await c.dialog.showSaveDialog({title:"حفظ نسخة احتياطية من قاعدة البيانات",defaultPath:M.join(c.app.getPath("downloads"),`backup_${new Date().toISOString().replace(/[:.]/g,"-")}.sqlite`),filters:[{name:"SQLite Database",extensions:["sqlite"]}]});return r||!n?{success:!1,reason:"canceled"}:(W.copyFileSync(e,n),{success:!0,path:n})}catch(t){return{success:!1,error:t instanceof Error?t.message:"Unknown error"}}});c.ipcMain.handle("db:restore",async()=>{try{const{canceled:t,filePaths:a}=await c.dialog.showOpenDialog({title:"استعادة قاعدة البيانات من نسخة احتياطية",filters:[{name:"SQLite Database",extensions:["sqlite"]}],properties:["openFile"]});if(t||!a.length)return{success:!1,reason:"canceled"};const e=c.app.getPath("userData"),r=process.env.NODE_ENV!=="production",n=M.join(e,r?"retail_dev.sqlite":"retail_prod.sqlite"),s=n+".bak";return W.existsSync(n)&&W.copyFileSync(n,s),W.copyFileSync(a[0],n),{success:!0}}catch(t){return{success:!1,error:t instanceof Error?t.message:"Unknown error"}}});c.ipcMain.handle("db:getUserDataPath",()=>c.app.getPath("userData"));
