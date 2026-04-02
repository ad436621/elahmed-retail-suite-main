import Database from 'better-sqlite3';
import { replaceInstallmentContracts } from './installmentsDb.ts';

type DB = ReturnType<typeof Database>;
type UnknownRecord = Record<string, unknown>;

function getSettingsJson(db: DB, key: string): any[] | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return null;

  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function tableExists(db: DB, table: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name: string } | undefined;
  return Boolean(row?.name);
}

function tableIsEmpty(db: DB, table: string): boolean {
  if (!tableExists(db, table)) return true;
  const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
  return row.c === 0;
}

function getTableColumns(db: DB, table: string): string[] {
  if (!tableExists(db, table)) return [];
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name);
}

function tableHasColumns(db: DB, table: string, columns: string[]): boolean {
  const tableColumns = new Set(getTableColumns(db, table));
  return columns.every((column) => tableColumns.has(column));
}

function ensureColumn(db: DB, table: string, column: string, definition: string): void {
  if (!tableExists(db, table)) return;
  const columns = new Set(getTableColumns(db, table));
  if (columns.has(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function firstNumber(...values: unknown[]): number {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(Math.max(0, parsed) * 100) / 100;
    }
  }
  return 0;
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== 'string' || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function extractPrefixedSequence(value: unknown, prefix: string): number {
  if (typeof value !== 'string') return 0;
  const match = new RegExp(`^${prefix}-(\\d+)$`).exec(value.trim());
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function derivePurchaseInvoiceStatus(totalAmount: number, paidAmount: number): string {
  if (paidAmount <= 0) return 'confirmed';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

const DEFAULT_OWNER_PERMISSIONS = [
  'dashboard',
  'pos',
  'sales',
  'inventory',
  'mobiles',
  'computers',
  'devices',
  'used',
  'cars',
  'warehouse',
  'maintenance',
  'installments',
  'expenses',
  'damaged',
  'otherRevenue',
  'returns',
  'settings',
  'users',
  'customers',
  'wallets',
  'employees',
  'suppliers',
  'blacklist',
  'reminders',
  'shiftClosing',
  'purchaseInvoices',
];

function createInstallmentsTables(db: DB): void {
  db.exec(`
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

function buildWalletDirectory(db: DB): Map<string, UnknownRecord> {
  const directory = new Map<string, UnknownRecord>();
  const sources = [getSettingsJson(db, 'gx_wallets'), getSettingsJson(db, 'retail_wallets')];

  for (const source of sources) {
    for (const wallet of source || []) {
      const walletId = firstText((wallet as UnknownRecord).id);
      if (!walletId) continue;
      directory.set(walletId, wallet as UnknownRecord);
    }
  }

  return directory;
}

function ensureWalletRecord(db: DB, walletDirectory: Map<string, UnknownRecord>, walletId: string): void {
  if (!walletId) return;
  const existing = db.prepare('SELECT id FROM wallets WHERE id = ?').get(walletId) as { id: string } | undefined;
  if (existing) return;

  const metadata = walletDirectory.get(walletId);
  const now = new Date().toISOString();
  const walletType = firstText(metadata?.type, 'cash');
  const walletIcon = firstText(
    metadata?.icon,
    walletType === 'bank' ? '🏦' : walletType === 'card' ? '💳' : walletType === 'transfer' ? '📲' : '💵',
  );
  const fallbackName = walletId === 'wallet_cash' ? 'الصندوق' : `Wallet ${walletId.slice(0, 8)}`;

  db.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    walletId,
    firstText(metadata?.name, fallbackName),
    walletType,
    toBoolean(metadata?.isDefault) ? 1 : 0,
    walletIcon || null,
    firstText(metadata?.color) || null,
    firstText(metadata?.notes, 'Auto-created to repair wallet references'),
    firstText(metadata?.createdAt, now),
    firstText(metadata?.updatedAt, now),
  );
}

function createSafeTransactionsTable(db: DB): void {
  db.exec(`
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

function readLegacyInstallmentContracts(db: DB): UnknownRecord[] {
  if (!tableExists(db, 'installments')) return [];

  const contractRows = db.prepare('SELECT * FROM installments').all() as UnknownRecord[];
  if (contractRows.length === 0) return [];

  const scheduleRows = tableExists(db, 'installment_schedules')
    ? (db.prepare('SELECT * FROM installment_schedules').all() as UnknownRecord[])
    : [];
  const paymentRows = tableExists(db, 'installment_payments')
    ? (db.prepare('SELECT * FROM installment_payments').all() as UnknownRecord[])
    : [];
  const allocationRows = tableExists(db, 'installment_payment_allocations')
    ? (db.prepare('SELECT * FROM installment_payment_allocations').all() as UnknownRecord[])
    : [];

  const schedulesByContract = new Map<string, UnknownRecord[]>();
  for (const row of scheduleRows) {
    const contractId = firstText(row.contractId);
    if (!contractId) continue;
    const entries = schedulesByContract.get(contractId) || [];
    entries.push(row);
    schedulesByContract.set(contractId, entries);
  }

  const allocationsByPayment = new Map<string, UnknownRecord[]>();
  for (const row of allocationRows) {
    const paymentId = firstText(row.paymentId);
    if (!paymentId) continue;
    const entries = allocationsByPayment.get(paymentId) || [];
    entries.push(row);
    allocationsByPayment.set(paymentId, entries);
  }

  const paymentsByContract = new Map<string, UnknownRecord[]>();
  for (const row of paymentRows) {
    const contractId = firstText(row.contractId);
    if (!contractId) continue;
    const entries = paymentsByContract.get(contractId) || [];
    entries.push(row);
    paymentsByContract.set(contractId, entries);
  }

  return contractRows.map((row) => {
    const contractId = firstText(row.id, crypto.randomUUID());
    const rawSchedule = (schedulesByContract.get(contractId) || [])
      .slice()
      .sort((left, right) => firstNumber(left.monthNumber) - firstNumber(right.monthNumber) || firstText(left.dueDate).localeCompare(firstText(right.dueDate)));

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
        paid: toBoolean(item.paid) || (totalDue > 0 && paidAmount >= totalDue),
        remainingAfter: item.remainingAfter === undefined || item.remainingAfter === null ? undefined : firstNumber(item.remainingAfter),
        note: firstText(item.note),
      };
    });

    const rawPayments = paymentsByContract.get(contractId) || [];
    const payments = rawPayments.length > 0
      ? rawPayments
          .slice()
          .sort((left, right) => firstText(left.date).localeCompare(firstText(right.date)) || firstText(left.createdAt).localeCompare(firstText(right.createdAt)))
          .map((payment) => ({
            id: firstText(payment.id, crypto.randomUUID()),
            amount: firstNumber(payment.amount),
            date: firstText(payment.date),
            note: firstText(payment.note),
            allocations: (allocationsByPayment.get(firstText(payment.id)) || []).map((allocation) => ({
              scheduleItemId: firstText(allocation.scheduleItemId),
              amount: firstNumber(allocation.amount),
            })),
          }))
      : schedule
          .filter((item) => firstNumber(item.paidAmount) > 0)
          .map((item) => ({
            id: `legacy-payment-${firstText(item.id, crypto.randomUUID())}`,
            amount: firstNumber(item.paidAmount),
            date: firstText(
              rawSchedule.find((rawItem) => firstText(rawItem.id) === firstText(item.id))?.paymentDate,
              item.dueDate,
              firstText(row.createdAt).slice(0, 10),
            ),
            note: 'Migrated from legacy schedule data',
            allocations: [{ scheduleItemId: firstText(item.id), amount: firstNumber(item.paidAmount) }],
          }));

    const scheduleTotal = schedule.reduce((sum, item) => sum + firstNumber(item.amount) + firstNumber(item.penalty), 0);
    const paymentsTotal = payments.reduce((sum, payment) => sum + firstNumber(payment.amount), 0);
    const downPayment = firstNumber(row.downPayment);
    const createdAt = firstText(row.createdAt, new Date().toISOString());
    const remaining = row.remaining !== undefined || row.remainingAmount !== undefined
      ? firstNumber(row.remaining, row.remainingAmount)
      : Math.max(0, Math.round((scheduleTotal - paymentsTotal) * 100) / 100);

    return {
      id: contractId,
      contractNumber: firstText(row.contractNumber, `INS-${Date.now()}`),
      contractType: firstText(row.contractType, 'product'),
      customerId: firstText(row.customerId) || undefined,
      customerName: firstText(row.customerName),
      customerPhone: firstText(row.customerPhone),
      customerAddress: firstText(row.customerAddress),
      customerIdCard: firstText(row.customerIdCard, row.customerNationalId),
      guarantorName: firstText(row.guarantorName),
      guarantorIdCard: firstText(row.guarantorIdCard),
      guarantorPhone: firstText(row.guarantorPhone),
      guarantorAddress: firstText(row.guarantorAddress),
      productId: firstText(row.productId) || undefined,
      productName: firstText(row.productName),
      transferType: firstText(row.transferType) || undefined,
      cashPrice: firstNumber(row.cashPrice, row.totalAmount),
      installmentPrice: firstNumber(row.installmentPrice, row.totalAmount),
      downPayment,
      months: Math.max(1, Math.round(firstNumber(row.months, schedule.length || 1))),
      monthlyInstallment: firstNumber(row.monthlyInstallment, row.monthlyPayment, schedule.length > 0 ? scheduleTotal / schedule.length : 0),
      paidTotal: row.paidTotal !== undefined ? firstNumber(row.paidTotal) : Math.round((downPayment + paymentsTotal) * 100) / 100,
      remaining,
      firstInstallmentDate: firstText(row.firstInstallmentDate, row.startDate, schedule[0]?.dueDate),
      schedule,
      payments,
      notes: firstText(row.notes),
      customFields: parseJsonArray(row.customFieldsJson),
      status: firstText(row.status, remaining === 0 ? 'completed' : 'active'),
      settledEarly: toBoolean(row.settledEarly),
      settlementDiscount: firstNumber(row.settlementDiscount),
      createdAt,
      updatedAt: firstText(row.updatedAt, createdAt),
    };
  });
}

function needsInstallmentSchemaRepair(db: DB): boolean {
  if (!tableHasColumns(db, 'installments', ['id', 'contractNumber'])) return true;

  if (!tableHasColumns(db, 'installments', [
    'contractType',
    'customerIdCard',
    'guarantorIdCard',
    'transferType',
    'cashPrice',
    'installmentPrice',
    'paidTotal',
    'remaining',
    'customFieldsJson',
    'updatedAt',
  ])) {
    return true;
  }

  if (tableHasColumns(db, 'installments', ['totalAmount', 'remainingAmount', 'monthlyPayment', 'startDate', 'customerNationalId'])) {
    return true;
  }

  if (!tableHasColumns(db, 'installment_schedules', [
    'id',
    'contractId',
    'monthNumber',
    'dueDate',
    'amount',
    'paidAmount',
    'penalty',
    'paid',
    'remainingAfter',
    'note',
  ])) {
    return true;
  }

  if (!tableHasColumns(db, 'installment_payments', ['id', 'contractId', 'amount', 'date', 'createdAt'])) return true;
  if (!tableHasColumns(db, 'installment_payment_allocations', ['id', 'paymentId', 'scheduleItemId', 'amount'])) return true;

  return false;
}

function repairInstallmentsSchema(db: DB): UnknownRecord[] {
  const legacyContracts = readLegacyInstallmentContracts(db);
  if (!needsInstallmentSchemaRepair(db)) return legacyContracts;

  db.transaction(() => {
    db.prepare('DROP TABLE IF EXISTS installment_payment_allocations').run();
    db.prepare('DROP TABLE IF EXISTS installment_payments').run();
    db.prepare('DROP TABLE IF EXISTS installment_schedules').run();
    db.prepare('DROP TABLE IF EXISTS installments').run();
    createInstallmentsTables(db);
  })();

  console.log('[migration] Installments schema repaired.');
  return legacyContracts;
}

function migrateInstallments(db: DB, legacyContracts: UnknownRecord[]): void {
  if (!tableExists(db, 'installments') || !tableIsEmpty(db, 'installments')) return;

  const settingsContracts = getSettingsJson(db, 'gx_installments_v2') || [];
  const sources = [
    { label: 'settings', data: settingsContracts as UnknownRecord[] },
    { label: 'legacy tables', data: legacyContracts },
  ];

  for (const source of sources) {
    if (!source.data.length) continue;
    try {
      replaceInstallmentContracts(db, source.data);
      console.log(`[migration] Installments: ${source.data.length} contracts migrated from ${source.label}.`);
      return;
    } catch (error) {
      console.error(`[migration] Installments migration from ${source.label} failed:`, error);
    }
  }
}

function needsSafeTransactionsRepair(db: DB): boolean {
  if (!tableHasColumns(db, 'safe_transactions', ['id', 'walletId', 'type', 'amount', 'createdAt'])) return true;

  const foreignKeys = tableExists(db, 'safe_transactions')
    ? (db.prepare('PRAGMA foreign_key_list(safe_transactions)').all() as Array<{ from: string; table: string }>)
    : [];

  return !foreignKeys.some((foreignKey) => foreignKey.from === 'walletId' && foreignKey.table === 'wallets');
}

function repairSafeTransactionsSchema(db: DB): void {
  const safeTransactions = tableExists(db, 'safe_transactions')
    ? (db.prepare('SELECT * FROM safe_transactions').all() as UnknownRecord[])
    : [];
  const walletDirectory = buildWalletDirectory(db);
  const shouldRebuild = needsSafeTransactionsRepair(db);

  if (shouldRebuild) {
    db.transaction(() => {
      db.prepare('DROP TABLE IF EXISTS safe_transactions').run();
      createSafeTransactionsTable(db);
    })();
    console.log('[migration] Safe transactions schema repaired.');
  }

  const distinctWalletIds = [...new Set(safeTransactions.map((row) => firstText(row.walletId)).filter(Boolean))];
  for (const walletId of distinctWalletIds) {
    ensureWalletRecord(db, walletDirectory, walletId);
  }

  if (!shouldRebuild || safeTransactions.length === 0 || !tableIsEmpty(db, 'safe_transactions')) return;

  const insertTransaction = db.prepare(`
    INSERT OR IGNORE INTO safe_transactions (
      id, walletId, type, subType, amount, category, description, paymentMethod,
      affectsCapital, affectsProfit, createdBy, relatedId, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
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
        firstText(transaction.createdAt, new Date().toISOString()),
      );
    }
  })();
}

function normalizeCategoryInventoryType(sectionValue: unknown, typeValue: unknown, fallbackValue: unknown): string {
  const fallback = firstText(fallbackValue);
  if (fallback) return fallback;

  const section = firstText(sectionValue, 'mobile');
  const type = firstText(typeValue, 'device');
  return `${section}_${type}`;
}

function categoriesSchemaNeedsRepair(db: DB): boolean {
  if (!tableHasColumns(db, 'categories', ['id', 'name', 'inventoryType'])) return true;

  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'categories'")
    .get() as { sql?: string } | undefined;
  const sql = String(row?.sql ?? '').toLowerCase().replace(/\s+/g, ' ');

  return sql.includes('name text unique') || !sql.includes('unique(name, inventorytype)');
}

function repairCategoriesSchema(db: DB): void {
  if (!tableExists(db, 'categories') || !categoriesSchemaNeedsRepair(db)) return;

  const existing = db.prepare('SELECT * FROM categories').all() as UnknownRecord[];
  const deduped = new Map<string, { id: string; name: string; inventoryType: string }>();

  for (const row of existing) {
    const name = firstText(row.name);
    const inventoryType = normalizeCategoryInventoryType(row.section, row.type, row.inventoryType);
    if (!name || !inventoryType) continue;
    const key = `${inventoryType}::${name.toLowerCase()}`;
    if (deduped.has(key)) continue;
    deduped.set(key, {
      id: firstText(row.id, crypto.randomUUID()),
      name,
      inventoryType,
    });
  }

  db.transaction(() => {
    db.prepare('DROP TABLE IF EXISTS categories').run();
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        inventoryType TEXT NOT NULL,
        UNIQUE(name, inventoryType)
      );
    `);

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO categories (id, name, inventoryType)
      VALUES (?, ?, ?)
    `);

    for (const category of deduped.values()) {
      stmt.run(category.id, category.name, category.inventoryType);
    }
  })();

  console.log('[migration] Categories schema repaired.');
}

function productBatchesSchemaNeedsRepair(db: DB): boolean {
  if (!tableHasColumns(db, 'product_batches', [
    'id',
    'productId',
    'inventoryType',
    'productName',
    'costPrice',
    'salePrice',
    'quantity',
    'remainingQty',
    'purchaseDate',
    'supplier',
    'notes',
    'createdAt',
    'updatedAt',
  ])) {
    return true;
  }

  const foreignKeys = tableExists(db, 'product_batches')
    ? (db.prepare('PRAGMA foreign_key_list(product_batches)').all() as Array<{ from: string; table: string }>)
    : [];

  return foreignKeys.some((foreignKey) => foreignKey.from === 'productId' && foreignKey.table === 'products');
}

function repairProductBatchesSchema(db: DB): void {
  if (!tableExists(db, 'product_batches') || !productBatchesSchemaNeedsRepair(db)) return;

  const existing = db.prepare('SELECT * FROM product_batches').all() as UnknownRecord[];

  db.transaction(() => {
    db.prepare('DROP TABLE IF EXISTS product_batches').run();
    db.exec(`
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

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO product_batches (
        id, productId, inventoryType, productName, costPrice, salePrice,
        quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const batch of existing) {
      const productId = firstText(batch.productId);
      if (!productId) continue;
      const purchaseDate = firstText(batch.purchaseDate, batch.createdAt, new Date().toISOString());
      const createdAt = firstText(batch.createdAt, purchaseDate);
      stmt.run(
        firstText(batch.id, crypto.randomUUID()),
        productId,
        firstText(batch.inventoryType, 'mobile'),
        firstText(batch.productName, 'Unknown product'),
        firstNumber(batch.costPrice),
        firstNumber(batch.salePrice),
        Math.max(0, Math.round(firstNumber(batch.quantity))),
        Math.max(0, Math.round(firstNumber(batch.remainingQty, batch.quantity))),
        purchaseDate,
        firstText(batch.supplier) || null,
        firstText(batch.notes) || null,
        createdAt,
        firstText(batch.updatedAt, createdAt),
      );
    }
  })();

  console.log('[migration] Product batches schema repaired.');
}

function repairOperationalSchemas(db: DB): void {
  if (tableExists(db, 'repair_tickets')) {
    ensureColumn(db, 'repair_tickets', 'final_cost', 'REAL DEFAULT 0');
  }

  if (tableExists(db, 'blacklist')) {
    ensureColumn(db, 'blacklist', 'imei', 'TEXT');
    ensureColumn(db, 'blacklist', 'deviceName', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'blacklist', 'ownerName', 'TEXT');
    ensureColumn(db, 'blacklist', 'ownerPhone', 'TEXT');
    ensureColumn(db, 'blacklist', 'status', "TEXT DEFAULT 'active'");
    ensureColumn(db, 'blacklist', 'reportedDate', 'TEXT');
    ensureColumn(db, 'blacklist', 'createdBy', 'TEXT');
    ensureColumn(db, 'blacklist', 'updatedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'damaged_items')) {
    ensureColumn(db, 'damaged_items', 'costPrice', 'REAL DEFAULT 0');

    db.exec(`
      UPDATE damaged_items
      SET costPrice = CASE
        WHEN COALESCE(costPrice, 0) > 0 THEN costPrice
        WHEN COALESCE(quantity, 0) > 0 THEN ROUND(COALESCE(estimatedLoss, 0) / quantity, 2)
        ELSE 0
      END
      WHERE COALESCE(costPrice, 0) = 0;
    `);
  }

  if (tableExists(db, 'other_revenue')) {
    ensureColumn(db, 'other_revenue', 'addedBy', 'TEXT');
    ensureColumn(db, 'other_revenue', 'updatedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'wallets')) {
    ensureColumn(db, 'wallets', 'icon', 'TEXT');

    db.exec(`
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

  // ── Soft-delete columns ──────────────────────────────────────────────────────
  if (tableExists(db, 'customers')) {
    ensureColumn(db, 'customers', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'customers', 'deletedAt', 'TEXT');
  }

  if (tableExists(db, 'suppliers')) {
    ensureColumn(db, 'suppliers', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'suppliers', 'deletedAt', 'TEXT');
  }

  if (tableExists(db, 'employees')) {
    ensureColumn(db, 'employees', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'employees', 'deletedAt', 'TEXT');
  }

  if (tableExists(db, 'used_devices')) {
    ensureColumn(db, 'used_devices', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'used_devices', 'deletedAt', 'TEXT');
    ensureColumn(db, 'used_devices', 'warehouseId', 'TEXT');
  }

  if (tableExists(db, 'employee_salaries')) {
    ensureColumn(db, 'employee_salaries', 'employeeName', 'TEXT');
    ensureColumn(db, 'employee_salaries', 'advanceDeducted', 'REAL DEFAULT 0');
    ensureColumn(db, 'employee_salaries', 'walletId', 'TEXT');

    db.exec(`
      UPDATE employee_salaries
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(paidAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `);
  }

  db.exec(`
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

  if (tableExists(db, 'used_devices')) {
    ensureColumn(db, 'used_devices', 'model', 'TEXT');
    ensureColumn(db, 'used_devices', 'deviceType', 'TEXT');
    ensureColumn(db, 'used_devices', 'ram', 'TEXT');
    ensureColumn(db, 'used_devices', 'description', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'warehouse_items')) {
    ensureColumn(db, 'warehouse_items', 'warehouseId', 'TEXT');
    ensureColumn(db, 'warehouse_items', 'notes', 'TEXT');
    ensureColumn(db, 'warehouse_items', 'addedBy', 'TEXT');
    ensureColumn(db, 'warehouse_items', 'createdAt', 'TEXT');
    ensureColumn(db, 'warehouse_items', 'updatedAt', 'TEXT');

    db.exec(`
      UPDATE warehouse_items
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE warehouse_items
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }

  if (tableExists(db, 'cars_inventory')) {
    ensureColumn(db, 'cars_inventory', 'warehouseId', 'TEXT');
    ensureColumn(db, 'cars_inventory', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'cars_inventory', 'deletedAt', 'TEXT');
    ensureColumn(db, 'cars_inventory', 'createdAt', 'TEXT');
    ensureColumn(db, 'cars_inventory', 'updatedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'products')) {
    ensureColumn(db, 'products', 'brand', 'TEXT');
    ensureColumn(db, 'products', 'description', 'TEXT');
    ensureColumn(db, 'products', 'boxNumber', 'TEXT');
    ensureColumn(db, 'products', 'taxExcluded', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'products', 'profitMargin', 'REAL DEFAULT 0');
    ensureColumn(db, 'products', 'minStock', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'products', 'warehouseId', 'TEXT');
    ensureColumn(db, 'products', 'serialNumber', 'TEXT');
    ensureColumn(db, 'products', 'imei2', 'TEXT');
    ensureColumn(db, 'products', 'processor', 'TEXT');
    ensureColumn(db, 'products', 'isArchived', 'INTEGER DEFAULT 0');

    db.exec(`
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

  if (tableExists(db, 'reminders')) {
    ensureColumn(db, 'reminders', 'reminderTime', 'TEXT');
    ensureColumn(db, 'reminders', 'status', "TEXT DEFAULT 'pending'");
    ensureColumn(db, 'reminders', 'notes', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'product_batches')) {
    ensureColumn(db, 'product_batches', 'inventoryType', 'TEXT');
    ensureColumn(db, 'product_batches', 'productName', 'TEXT');
    ensureColumn(db, 'product_batches', 'supplier', 'TEXT');
    ensureColumn(db, 'product_batches', 'notes', 'TEXT');
    ensureColumn(db, 'product_batches', 'createdAt', 'TEXT');
    ensureColumn(db, 'product_batches', 'updatedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'accessories')) {
    ensureColumn(db, 'accessories', 'oldCostPrice', 'REAL DEFAULT 0');
    ensureColumn(db, 'accessories', 'newCostPrice', 'REAL DEFAULT 0');
    ensureColumn(db, 'accessories', 'profitMargin', 'REAL DEFAULT 0');
    ensureColumn(db, 'accessories', 'brand', 'TEXT');
    ensureColumn(db, 'accessories', 'source', 'TEXT');
    ensureColumn(db, 'accessories', 'boxNumber', 'TEXT');
    ensureColumn(db, 'accessories', 'taxExcluded', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'accessories', 'description', 'TEXT');
    ensureColumn(db, 'accessories', 'isArchived', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'accessories', 'deletedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'users')) {
    ensureColumn(db, 'users', 'salt', 'TEXT');
    ensureColumn(db, 'users', 'mustChangePassword', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'users', 'createdAt', 'TEXT');
    ensureColumn(db, 'users', 'updatedAt', 'TEXT');

    db.exec(`
      UPDATE users
      SET createdAt = COALESCE(NULLIF(createdAt, ''), CURRENT_TIMESTAMP)
      WHERE COALESCE(createdAt, '') = '';

      UPDATE users
      SET updatedAt = COALESCE(NULLIF(updatedAt, ''), COALESCE(createdAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(updatedAt, '') = '';
    `);
  }

  if (tableExists(db, 'sales')) {
    ensureColumn(db, 'sales', 'voidedAt', 'TEXT');
    ensureColumn(db, 'sales', 'voidReason', 'TEXT');
    ensureColumn(db, 'sales', 'voidedBy', 'TEXT');
  }

  if (tableExists(db, 'sale_items')) {
    ensureColumn(db, 'sale_items', 'name', "TEXT NOT NULL DEFAULT ''");
    ensureColumn(db, 'sale_items', 'qty', 'INTEGER NOT NULL DEFAULT 0');
    ensureColumn(db, 'sale_items', 'price', 'REAL NOT NULL DEFAULT 0');
    ensureColumn(db, 'sale_items', 'cost', 'REAL NOT NULL DEFAULT 0');
    ensureColumn(db, 'sale_items', 'lineDiscount', 'REAL DEFAULT 0');
    ensureColumn(db, 'sale_items', 'warehouseId', 'TEXT');
    ensureColumn(db, 'sale_items', 'batches', 'TEXT');
  }

  if (tableExists(db, 'stock_movements')) {
    ensureColumn(db, 'stock_movements', 'warehouseId', 'TEXT');
  }

  if (tableExists(db, 'audit_logs')) {
    ensureColumn(db, 'audit_logs', 'beforeStateJson', 'TEXT');
    ensureColumn(db, 'audit_logs', 'afterStateJson', 'TEXT');
    ensureColumn(db, 'audit_logs', 'machineId', 'TEXT');
  }

  if (tableExists(db, 'return_records')) {
    ensureColumn(db, 'return_records', 'originalSaleId', 'TEXT');
    ensureColumn(db, 'return_records', 'reason', 'TEXT');
    ensureColumn(db, 'return_records', 'processedBy', 'TEXT');
    ensureColumn(db, 'return_records', 'createdAt', 'TEXT');
  }

  if (tableExists(db, 'return_items')) {
    ensureColumn(db, 'return_items', 'reason', 'TEXT');
  }

  if (tableExists(db, 'purchase_invoices')) {
    ensureColumn(db, 'purchase_invoices', 'supplierId', 'TEXT');
    ensureColumn(db, 'purchase_invoices', 'status', "TEXT NOT NULL DEFAULT 'confirmed'");
    ensureColumn(db, 'purchase_invoices', 'notes', 'TEXT');
    ensureColumn(db, 'purchase_invoices', 'createdBy', 'TEXT');
    ensureColumn(db, 'purchase_invoices', 'createdAt', 'TEXT');
    ensureColumn(db, 'purchase_invoices', 'updatedAt', 'TEXT');

    db.exec(`
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

  if (tableExists(db, 'purchase_invoice_items')) {
    ensureColumn(db, 'purchase_invoice_items', 'category', 'TEXT');
    ensureColumn(db, 'purchase_invoice_items', 'notes', 'TEXT');
  }

  if (tableExists(db, 'shift_closings')) {
    ensureColumn(db, 'shift_closings', 'notes', 'TEXT');
    ensureColumn(db, 'shift_closings', 'createdAt', 'TEXT');

    db.exec(`
      UPDATE shift_closings
      SET createdAt = COALESCE(NULLIF(createdAt, ''), COALESCE(closedAt, CURRENT_TIMESTAMP))
      WHERE COALESCE(createdAt, '') = '';
    `);
  }
}

function ensurePerformanceIndexes(db: DB): void {
  db.exec(`
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

export function runDataMigration(db: DB) {
  console.log('[migration] Running data migration check...');
  try {
    repairCategoriesSchema(db);
    repairProductBatchesSchema(db);
    repairOperationalSchemas(db);
    migrateCustomers(db);
    migrateWallets(db);
    migrateCategories(db);
    migrateAppUsers(db);

    const legacyInstallments = repairInstallmentsSchema(db);
    migrateInstallments(db, legacyInstallments);
    repairSafeTransactionsSchema(db);
    ensurePerformanceIndexes(db);

    migrateProductsInventory(db);
    migrateAccessories(db);
    migrateBatches(db);
    migrateWarehouseItems(db);
    migrateCars(db);
    migrateSales(db);
    migrateReturnRecords(db);
    migrateShiftClosings(db);
    migrateStockMovements(db);
    migrateAuditLogs(db);
    migrateSuppliers(db);
    migratePurchaseInvoices(db);
    migrateEmployees(db);
    migrateSupplierTransactions(db);
    migrateSalaryRecords(db);
    migrateAdvances(db);
    migrateExpenses(db);
    migrateBlacklist(db);
    migrateDamagedItems(db);
    migrateOtherRevenue(db);
    migrateUsedDevices(db);
    migrateReminders(db);
    migrateRepairs(db);
    migrateRepairParts(db);
    
    // NEW: Run the Unified Inventory Migration
    migrateUnifiedInventory(db);
    
    console.log('[migration] All migrations complete.');
  } catch (err) {
    console.error('[migration] Error:', err);
  }
}

function migrateProductsInventory(db: DB) {
  const sources = [
    { key: 'elahmed-products', source: 'legacy' },
    { key: 'gx_mobiles_v2', source: 'mobile' },
    { key: 'gx_computers_v2', source: 'computer' },
    { key: 'gx_devices_v2', source: 'device' },
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, model, barcode, deviceType, category, condition, storage, ram, color,
      brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
      salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
      imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const target of sources) {
      const items = getSettingsJson(db, target.key);
      if (!items?.length) continue;

      for (const item of items) {
        const source = firstText(item.source, target.source);
        const createdAt = firstText(item.createdAt, new Date().toISOString());
        const newCostPrice = firstNumber(item.newCostPrice, item.costPrice, item.oldCostPrice);
        stmt.run(
          firstText(item.id, crypto.randomUUID()),
          firstText(item.name, 'Unknown product'),
          firstText(item.model) || null,
          firstText(item.barcode) || null,
          firstText(item.deviceType, source === 'mobile' ? 'mobile' : source === 'computer' ? 'computer' : source === 'device' ? 'device' : '') || null,
          firstText(item.category) || null,
          firstText(item.condition, 'new') || null,
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
          firstText(item.deletedAt) || null,
        );
      }

      console.log(`[migration] Products (${target.source}): migrated ${items.length} records.`);
    }
  })();
}

function migrateAccessories(db: DB) {
  const keysToMigrate = [
    { key: 'gx_mobile_accessories', type: 'mobile_accessory' },
    { key: 'gx_mobile_spare_parts', type: 'mobile_spare_part' },
    { key: 'gx_computer_accessories', type: 'computer_accessory_legacy' },
    { key: 'gx_computer_accessories_sa', type: 'computer_accessory' },
    { key: 'gx_computer_spare_parts', type: 'computer_spare_part' },
    { key: 'gx_device_accessories', type: 'device_accessory_legacy' },
    { key: 'gx_device_accessories_sa', type: 'device_accessory' },
    { key: 'gx_device_spare_parts', type: 'device_spare_part' },
  ];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO accessories (
      id, warehouseId, inventoryType, name, category, subcategory, model, barcode, quantity,
      oldCostPrice, newCostPrice, costPrice, salePrice, profitMargin, minStock, condition,
      brand, supplier, source, boxNumber, taxExcluded, color, description, isArchived,
      deletedAt, notes, image, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const migrationTarget of keysToMigrate) {
      const items = getSettingsJson(db, migrationTarget.key);
      if (!items?.length) continue;
      for (const item of items) {
        const newCostPrice = firstNumber(item.newCostPrice, item.costPrice, item.oldCostPrice);
        const createdAt = firstText(item.createdAt, new Date().toISOString());
        stmt.run(
          firstText(item.id, crypto.randomUUID()),
          firstText(item.warehouseId) || null,
          migrationTarget.type,
          firstText(item.name, 'Unknown accessory'),
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
          firstText(item.condition, 'new'),
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
          firstText(item.updatedAt, createdAt),
        );
      }
      console.log(`[migration] Accessories (${migrationTarget.type}): migrated ${items.length} records.`);
    }
  })();
}

function migrateCategories(db: DB) {
  repairCategoriesSchema(db);
  if (!tableIsEmpty(db, 'categories')) return;

  const data = getSettingsJson(db, 'gx_categories_v1') || getSettingsJson(db, 'retail_categories');
  if (!data?.length) return;

  const uniqueCategories = new Map<string, { id: string; name: string; inventoryType: string }>();
  for (const rawCategory of data) {
    const name = firstText(rawCategory.name);
    const inventoryType = normalizeCategoryInventoryType(
      rawCategory.section,
      rawCategory.type,
      rawCategory.inventoryType,
    );
    if (!name || !inventoryType) continue;

    const key = `${inventoryType}::${name.toLowerCase()}`;
    if (uniqueCategories.has(key)) continue;
    uniqueCategories.set(key, {
      id: firstText(rawCategory.id, crypto.randomUUID()),
      name,
      inventoryType,
    });
  }

  if (uniqueCategories.size === 0) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO categories (id, name, inventoryType)
    VALUES (?, ?, ?)
  `);

  db.transaction(() => {
    for (const category of uniqueCategories.values()) {
      stmt.run(category.id, category.name, category.inventoryType);
    }
  })();

  console.log(`[migration] Categories: ${uniqueCategories.size} records migrated.`);
}

function migrateAppUsers(db: DB) {
  if (!tableIsEmpty(db, 'users')) return;

  const data = getSettingsJson(db, 'gx_users') || getSettingsJson(db, 'retail_users');
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO users (
      id, username, fullName, role, permissions, active,
      passwordHash, salt, mustChangePassword, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const records = data?.length
    ? data
    : [{
      id: 'owner-1',
      username: 'admin',
      fullName: 'صاحب النظام',
      role: 'owner',
      permissions: DEFAULT_OWNER_PERMISSIONS,
      active: true,
      password: 'admin123',
      salt: null,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
    }];

  db.transaction(() => {
    for (const user of records) {
      const role = firstText(user.role, 'user');
      const permissions = parseJsonArray<string>(user.permissions);
      const normalizedPermissions = permissions.length > 0
        ? permissions
        : role === 'owner'
          ? DEFAULT_OWNER_PERMISSIONS
          : [];
      stmt.run(
        firstText(user.id, crypto.randomUUID()),
        firstText(user.username, `user_${Date.now()}`),
        firstText(user.fullName, user.name, 'User'),
        role,
        JSON.stringify(normalizedPermissions),
        toBoolean(user.active ?? true) ? 1 : 0,
        firstText(user.passwordHash, user.password),
        firstText(user.salt) || null,
        toBoolean(user.mustChangePassword) ? 1 : 0,
        firstText(user.createdAt, now),
        firstText(user.updatedAt, user.createdAt, now),
      );
    }
  })();

  console.log(`[migration] Users: ${records.length} records migrated.`);
}

function migrateBatches(db: DB) {
  if (!tableIsEmpty(db, 'product_batches')) return;

  const data = getSettingsJson(db, 'gx_product_batches_v1') || getSettingsJson(db, 'retail_product_batches');
  if (!data?.length) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO product_batches (
      id, productId, inventoryType, productName, costPrice, salePrice,
      quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const batch of data) {
      const productId = firstText(batch.productId);
      if (!productId) continue;
      const purchaseDate = firstText(batch.purchaseDate, batch.createdAt, new Date().toISOString());
      const createdAt = firstText(batch.createdAt, purchaseDate);
      stmt.run(
        firstText(batch.id, crypto.randomUUID()),
        productId,
        firstText(batch.inventoryType, 'mobile'),
        firstText(batch.productName, 'Unknown product'),
        firstNumber(batch.costPrice),
        firstNumber(batch.salePrice),
        Math.max(0, Math.round(firstNumber(batch.quantity))),
        Math.max(0, Math.round(firstNumber(batch.remainingQty, batch.quantity))),
        purchaseDate,
        firstText(batch.supplier) || null,
        firstText(batch.notes) || null,
        createdAt,
        firstText(batch.updatedAt, createdAt),
      );
    }
  })();

  console.log(`[migration] Product batches: ${data.length} records migrated.`);
}

function migrateWarehouseItems(db: DB) {
  if (!tableIsEmpty(db, 'warehouse_items')) return;

  const data = getSettingsJson(db, 'gx_warehouse') || getSettingsJson(db, 'retail_warehouse');
  if (!data?.length) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO warehouse_items (
      id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const item of data) {
      const createdAt = firstText(item.createdAt, new Date().toISOString());
      stmt.run(
        firstText(item.id, crypto.randomUUID()),
        firstText(item.warehouseId) || null,
        firstText(item.name, 'Unknown item'),
        firstText(item.category, 'general'),
        Math.max(0, Math.round(firstNumber(item.quantity))),
        firstNumber(item.costPrice),
        firstText(item.notes) || null,
        firstText(item.addedBy) || null,
        createdAt,
        firstText(item.updatedAt, createdAt),
      );
    }
  })();

  console.log(`[migration] Warehouse items: ${data.length} records migrated.`);
}

function migrateCars(db: DB) {
  if (!tableIsEmpty(db, 'cars_inventory')) return;

  const data = getSettingsJson(db, 'gx_cars') || getSettingsJson(db, 'retail_cars');
  if (!data?.length) return;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cars_inventory (
      id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
      purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const car of data) {
      const createdAt = firstText(car.createdAt, new Date().toISOString());
      stmt.run(
        firstText(car.id, crypto.randomUUID()),
        firstText(car.name, 'Unknown car'),
        firstText(car.model, 'Unknown model'),
        Math.max(0, Math.round(firstNumber(car.year))),
        firstText(car.color) || null,
        firstText(car.plateNumber) || null,
        firstText(car.licenseExpiry) || null,
        firstText(car.condition, 'used'),
        firstText(car.category) || null,
        firstNumber(car.purchasePrice),
        firstNumber(car.salePrice),
        firstText(car.notes) || null,
        firstText(car.image) || null,
        firstText(car.warehouseId) || null,
        toBoolean(car.isArchived) ? 1 : 0,
        firstText(car.deletedAt) || null,
        createdAt,
        firstText(car.updatedAt, createdAt),
      );
    }
  })();

  console.log(`[migration] Cars: ${data.length} records migrated.`);
}

function migrateSales(db: DB) {
  if (!tableIsEmpty(db, 'sales')) return;
  const data = getSettingsJson(db, 'elahmed_sales') || getSettingsJson(db, 'retail_sales');
  if (!data?.length) return;

  const saleStmt = db.prepare(`
    INSERT OR IGNORE INTO sales (
      id, invoiceNumber, date, subtotal, discount, total, totalCost, grossProfit, marginPct,
      paymentMethod, employee, voidedAt, voidReason, voidedBy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db.prepare(`
    INSERT OR IGNORE INTO sale_items (
      id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const sale of data) {
      const saleId = firstText(sale.id, crypto.randomUUID());
      const items = parseJsonArray<UnknownRecord>(sale.items);
      saleStmt.run(
        saleId,
        firstText(sale.invoiceNumber, `INV-LEGACY-${saleId.slice(0, 8)}`),
        firstText(sale.date, sale.createdAt, new Date().toISOString()),
        firstNumber(sale.subtotal),
        firstNumber(sale.discount),
        firstNumber(sale.total),
        firstNumber(sale.totalCost),
        firstNumber(sale.grossProfit),
        firstNumber(sale.marginPct),
        firstText(sale.paymentMethod, 'cash'),
        firstText(sale.employee, 'system'),
        firstText(sale.voidedAt) || null,
        firstText(sale.voidReason) || null,
        firstText(sale.voidedBy) || null,
      );

      for (const item of items) {
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          saleId,
          firstText(item.productId),
          firstText(item.name, 'Unknown item'),
          Math.max(1, Math.round(firstNumber(item.qty, 1))),
          firstNumber(item.price),
          firstNumber(item.cost),
          firstNumber(item.lineDiscount),
          firstText(item.warehouseId) || null,
          item.batches ? JSON.stringify(item.batches) : null,
        );
      }
    }
  })();
  console.log(`[migration] Sales: ${data.length} records migrated.`);
}

function migrateReturnRecords(db: DB) {
  if (!tableIsEmpty(db, 'return_records')) return;
  const data = getSettingsJson(db, 'gx_returns_v2') || getSettingsJson(db, 'retail_returns');
  if (!data?.length) return;

  const saleIds = new Set(
    (db.prepare('SELECT id FROM sales').all() as Array<{ id: string }>).map((sale) => sale.id),
  );
  const recordStmt = db.prepare(`
    INSERT OR IGNORE INTO return_records (
      id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db.prepare(`
    INSERT OR IGNORE INTO return_items (
      id, returnId, productId, name, qty, price, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  let fallbackSequence = 0;

  db.transaction(() => {
    for (const record of data) {
      const recordId = firstText(record.id, crypto.randomUUID());
      const createdAt = firstText(record.createdAt, record.date, new Date().toISOString());
      const originalSaleId = firstText(record.originalSaleId);
      const items = parseJsonArray<UnknownRecord>(record.items);
      const existingSequence = extractPrefixedSequence(record.returnNumber, 'RET');
      fallbackSequence = Math.max(fallbackSequence + 1, existingSequence);

      recordStmt.run(
        recordId,
        firstText(record.returnNumber, `RET-${String(fallbackSequence).padStart(4, '0')}`),
        firstText(record.originalInvoiceNumber, 'Unknown invoice'),
        saleIds.has(originalSaleId) ? originalSaleId : null,
        firstText(record.date, createdAt.slice(0, 10)),
        firstNumber(record.totalRefund),
        firstText(record.reason) || null,
        firstText(record.processedBy) || null,
        createdAt,
      );

      for (const item of items) {
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          recordId,
          firstText(item.productId),
          firstText(item.name, 'Unknown item'),
          firstNumber(item.qty, 1) || 1,
          firstNumber(item.price),
          firstText(item.reason) || null,
        );
      }
    }
  })();
  console.log(`[migration] Returns: ${data.length} records migrated.`);
}

function migratePurchaseInvoices(db: DB) {
  if (!tableIsEmpty(db, 'purchase_invoices')) return;
  const data = getSettingsJson(db, 'gx_purchase_invoices') || getSettingsJson(db, 'retail_purchase_invoices');
  if (!data?.length) return;

  const supplierIds = new Set(
    (db.prepare('SELECT id FROM suppliers').all() as Array<{ id: string }>).map((supplier) => supplier.id),
  );
  const invoiceStmt = db.prepare(`
    INSERT OR IGNORE INTO purchase_invoices (
      id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
      remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const itemStmt = db.prepare(`
    INSERT OR IGNORE INTO purchase_invoice_items (
      id, invoiceId, productName, category, quantity, unitPrice, totalPrice, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  let fallbackSequence = 0;

  db.transaction(() => {
    for (const invoice of data) {
      const invoiceId = firstText(invoice.id, crypto.randomUUID());
      const totalAmount = firstNumber(invoice.totalAmount);
      const paidAmount = Math.min(totalAmount, firstNumber(invoice.paidAmount));
      const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
      const createdAt = firstText(invoice.createdAt, new Date().toISOString());
      const updatedAt = firstText(invoice.updatedAt, createdAt);
      const supplierId = firstText(invoice.supplierId);
      const items = parseJsonArray<UnknownRecord>(invoice.items);
      const existingSequence = extractPrefixedSequence(invoice.invoiceNumber, 'PI');
      fallbackSequence = Math.max(fallbackSequence + 1, existingSequence);

      invoiceStmt.run(
        invoiceId,
        firstText(invoice.invoiceNumber, `PI-${String(fallbackSequence).padStart(4, '0')}`),
        supplierIds.has(supplierId) ? supplierId : null,
        firstText(invoice.supplierName, 'Unknown supplier'),
        firstText(invoice.invoiceDate, createdAt.slice(0, 10)),
        totalAmount,
        paidAmount,
        remaining,
        firstText(invoice.paymentMethod, 'cash'),
        firstText(invoice.status, derivePurchaseInvoiceStatus(totalAmount, paidAmount)),
        firstText(invoice.notes) || null,
        firstText(invoice.createdBy) || null,
        createdAt,
        updatedAt,
      );

      for (const item of items) {
        const quantity = firstNumber(item.quantity, 1) || 1;
        const unitPrice = firstNumber(item.unitPrice);
        const totalPrice = firstNumber(item.totalPrice, quantity * unitPrice);
        itemStmt.run(
          firstText(item.id, crypto.randomUUID()),
          invoiceId,
          firstText(item.productName, 'Unknown item'),
          firstText(item.category) || null,
          quantity,
          unitPrice,
          totalPrice,
          firstText(item.notes) || null,
        );
      }
    }
  })();
  console.log(`[migration] Purchase invoices: ${data.length} records migrated.`);
}

function migrateShiftClosings(db: DB) {
  if (!tableIsEmpty(db, 'shift_closings')) return;
  const data = getSettingsJson(db, 'gx_shift_closings') || getSettingsJson(db, 'retail_shift_closings');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO shift_closings (
      id, shiftDate, closedAt, closedBy, salesCount, salesCash, salesCard, salesTransfer,
      salesTotal, expectedCash, actualCash, cashDifference, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const closing of data) {
      const closedAt = firstText(closing.closedAt, closing.createdAt, new Date().toISOString());
      stmt.run(
        firstText(closing.id, crypto.randomUUID()),
        firstText(closing.shiftDate, closedAt.slice(0, 10)),
        closedAt,
        firstText(closing.closedBy, 'system'),
        Math.max(0, Math.round(firstNumber(closing.salesCount))),
        firstNumber(closing.salesCash),
        firstNumber(closing.salesCard),
        firstNumber(closing.salesTransfer),
        firstNumber(closing.salesTotal),
        firstNumber(closing.expectedCash),
        firstNumber(closing.actualCash),
        firstNumber(closing.cashDifference),
        firstText(closing.notes) || null,
        firstText(closing.createdAt, closedAt),
      );
    }
  })();
  console.log(`[migration] Shift closings: ${data.length} records migrated.`);
}

function migrateStockMovements(db: DB) {
  if (!tableIsEmpty(db, 'stock_movements')) return;
  const data = getSettingsJson(db, 'gx_stock_movements') || getSettingsJson(db, 'retail_stock_movements');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO stock_movements (
      id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
      referenceId, userId, timestamp, warehouseId
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const movement of data) {
      stmt.run(
        firstText(movement.id, crypto.randomUUID()),
        firstText(movement.productId),
        firstText(movement.type, 'correction'),
        firstNumber(movement.quantityChange),
        firstNumber(movement.previousQuantity),
        firstNumber(movement.newQuantity),
        firstText(movement.reason) || null,
        firstText(movement.referenceId) || null,
        firstText(movement.userId) || null,
        firstText(movement.timestamp, new Date().toISOString()),
        firstText(movement.warehouseId) || null,
      );
    }
  })();
  console.log(`[migration] Stock movements: ${data.length} records migrated.`);
}

function migrateAuditLogs(db: DB) {
  if (!tableIsEmpty(db, 'audit_logs')) return;
  const data = getSettingsJson(db, 'elahmed_audit_logs') || getSettingsJson(db, 'retail_audit_logs');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO audit_logs (
      id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const entry of data) {
      stmt.run(
        firstText(entry.id, crypto.randomUUID()),
        firstText(entry.userId, 'system'),
        firstText(entry.action, 'settings_changed'),
        firstText(entry.entityType, 'unknown'),
        firstText(entry.entityId, 'unknown'),
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        firstText(entry.machineId) || null,
        firstText(entry.timestamp, new Date().toISOString()),
      );
    }
  })();
  console.log(`[migration] Audit logs: ${data.length} records migrated.`);
}

function migrateCustomers(db: DB) {
  if (!tableIsEmpty(db, 'customers')) return;
  const data = getSettingsJson(db, 'gx_customers') || getSettingsJson(db, 'retail_customers');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO customers (
      id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        c.createdAt || new Date().toISOString(),
        c.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Customers: ${data.length} records migrated.`);
}

function migrateSuppliers(db: DB) {
  if (!tableIsEmpty(db, 'suppliers')) return;
  const data = getSettingsJson(db, 'gx_suppliers') || getSettingsJson(db, 'retail_suppliers');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO suppliers (
      id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        s.createdAt || new Date().toISOString(),
        s.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Suppliers: ${data.length} records migrated.`);
}

function migrateEmployees(db: DB) {
  if (!tableIsEmpty(db, 'employees')) return;
  const data = getSettingsJson(db, 'gx_employees') || getSettingsJson(db, 'retail_employees');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO employees (
      id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        e.createdAt || new Date().toISOString(),
        e.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Employees: ${data.length} records migrated.`);
}

function migrateSupplierTransactions(db: DB) {
  if (!tableIsEmpty(db, 'supplier_transactions')) return;
  const data = getSettingsJson(db, 'gx_supplier_transactions') || getSettingsJson(db, 'retail_supplier_transactions');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO supplier_transactions (
      id, supplierId, supplierName, type, amount, balanceBefore, balanceAfter, notes, createdBy, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        item.createdAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Supplier transactions: ${data.length} records migrated.`);
}

function migrateSalaryRecords(db: DB) {
  if (!tableIsEmpty(db, 'employee_salaries')) return;
  const data = getSettingsJson(db, 'gx_salary_records') || getSettingsJson(db, 'retail_salary_records');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO employee_salaries (
      id, employeeId, employeeName, month, baseSalary, commission, bonus, deductions, advanceDeducted,
      netSalary, paid, paidAt, walletId, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const item of data) {
      const createdAt = firstText(item.createdAt, item.paidAt, new Date().toISOString());
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
        createdAt,
      );
    }
  })();
  console.log(`[migration] Employee salaries: ${data.length} records migrated.`);
}

function migrateAdvances(db: DB) {
  if (!tableIsEmpty(db, 'employee_advances')) return;
  const data = getSettingsJson(db, 'gx_advances') || getSettingsJson(db, 'retail_advances');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO employee_advances (
      id, employeeId, employeeName, amount, date, deductedMonth, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const item of data) {
      stmt.run(
        item.id,
        item.employeeId,
        item.employeeName || null,
        firstNumber(item.amount),
        item.date,
        item.deductedMonth || null,
        item.notes || null,
        item.createdAt || item.date || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Employee advances: ${data.length} records migrated.`);
}

function migrateExpenses(db: DB) {
  if (!tableIsEmpty(db, 'expenses')) return;
  const data = getSettingsJson(db, 'gx_expenses') || getSettingsJson(db, 'retail_expenses');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO expenses (
      id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const e of data) {
      stmt.run(
        e.id,
        e.category,
        e.description || null,
        e.amount,
        e.date,
        e.paymentMethod || 'cash',
        e.employee || null,
        e.notes || null,
        e.createdAt || new Date().toISOString(),
        e.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Expenses: ${data.length} records migrated.`);
}

function migrateBlacklist(db: DB) {
  if (!tableIsEmpty(db, 'blacklist')) return;
  const data = getSettingsJson(db, 'gx_blacklist') || getSettingsJson(db, 'retail_blacklist');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO blacklist (
      id, imei, deviceName, ownerName, ownerPhone, phone, status, reportedDate,
      nationalId, reason, notes, addedBy, createdBy, name, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const b of data) {
      const createdAt = firstText(b.createdAt, new Date().toISOString());
      const updatedAt = firstText(b.updatedAt, createdAt);
      const imei = firstText(b.imei, b.nationalId);
      const deviceName = firstText(b.deviceName, b.name, 'Unknown device');
      const ownerPhone = firstText(b.ownerPhone, b.phone);
      const createdBy = firstText(b.createdBy, b.addedBy, 'system');
      stmt.run(
        b.id,
        imei || null,
        deviceName,
        b.ownerName || null,
        ownerPhone || null,
        ownerPhone || null,
        firstText(b.status, 'active'),
        firstText(b.reportedDate, createdAt.slice(0, 10)),
        imei || null,
        b.reason,
        b.notes || null,
        createdBy || null,
        createdBy || null,
        deviceName,
        createdAt,
        updatedAt,
      );
    }
  })();
  console.log(`[migration] Blacklist: ${data.length} records migrated.`);
}

function migrateDamagedItems(db: DB) {
  if (!tableIsEmpty(db, 'damaged_items')) return;
  const data = getSettingsJson(db, 'gx_damaged') || getSettingsJson(db, 'retail_damaged');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO damaged_items (
      id, productName, productId, inventoryType, quantity, costPrice, reason, estimatedLoss, reportedBy, date, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        d.createdAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Damaged items: ${data.length} records migrated.`);
}

function migrateOtherRevenue(db: DB) {
  if (!tableIsEmpty(db, 'other_revenue')) return;
  const data = getSettingsJson(db, 'gx_other_revenue') || getSettingsJson(db, 'retail_other_revenue');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const r of data) {
      const createdAt = firstText(r.createdAt, new Date().toISOString());
      stmt.run(
        r.id,
        r.source || r.category,
        r.description || null,
        r.amount,
        r.date,
        r.paymentMethod || 'cash',
        r.addedBy || null,
        r.notes || null,
        createdAt,
        r.updatedAt || createdAt,
      );
    }
  })();
  console.log(`[migration] Other revenue: ${data.length} records migrated.`);
}

function migrateWallets(db: DB) {
  if (!tableIsEmpty(db, 'wallets')) return;
  const data = getSettingsJson(db, 'gx_wallets') || getSettingsJson(db, 'retail_wallets');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const w of data) {
      const type = firstText(w.type, 'cash');
      stmt.run(
        w.id,
        w.name,
        type,
        firstNumber(w.balance),
        toBoolean(w.isDefault) ? 1 : 0,
        firstText(
          w.icon,
          type === 'bank' ? '🏦' : type === 'card' ? '💳' : type === 'transfer' ? '📲' : '💵',
        ) || null,
        w.color || null,
        w.notes || null,
        w.createdAt || new Date().toISOString(),
        w.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Wallets: ${data.length} records migrated.`);
}

function migrateUsedDevices(db: DB) {
  if (!tableIsEmpty(db, 'used_devices')) return;
  const data = getSettingsJson(db, 'gx_used_devices')
    || getSettingsJson(db, 'gx_used_inventory')
    || getSettingsJson(db, 'retail_used_inventory');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO used_devices (
      id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
      ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const u of data) {
      stmt.run(
        u.id,
        u.name,
        firstText(u.model) || null,
        firstText(u.deviceType, u.category, 'other') || null,
        firstText(u.category, u.deviceType) || null,
        firstText(u.condition, 'good'),
        firstNumber(u.purchasePrice, u.buyPrice),
        firstNumber(u.sellingPrice, u.salePrice),
        firstText(u.status, 'in_stock'),
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
        u.createdAt || new Date().toISOString(),
        u.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Used devices: ${data.length} records migrated.`);
}

function migrateReminders(db: DB) {
  if (!tableIsEmpty(db, 'reminders')) return;
  const data = getSettingsJson(db, 'gx_reminders') || getSettingsJson(db, 'retail_reminders');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO reminders (
      id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const r of data) {
      const status = firstText(r.status, r.completed ? 'done' : 'pending');
      stmt.run(
        r.id,
        r.title,
        r.description || null,
        r.dueDate || r.reminderDate,
        r.reminderTime || null,
        r.priority || 'medium',
        status,
        status === 'done' || !!r.completed ? 1 : 0,
        r.completedAt || null,
        r.recurring || null,
        r.category || null,
        r.notes || null,
        r.createdAt || new Date().toISOString(),
        r.updatedAt || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Reminders: ${data.length} records migrated.`);
}

function migrateRepairs(db: DB) {
  if (!tableIsEmpty(db, 'repair_tickets')) return;
  const data = getSettingsJson(db, 'gx_maintenance') || getSettingsJson(db, 'maintenance_orders');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO repair_tickets (
      id, ticket_no, customer_name, customer_phone, device_category, device_model,
      issue_description, status, package_price, final_cost, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
    for (const r of data) {
      const status = ['received', 'diagnosing', 'repairing', 'waiting_parts', 'testing', 'ready', 'delivered', 'cancelled', 'pending', 'in_progress', 'waiting_for_parts', 'completed'].includes(r.status)
        ? r.status
        : r.status === 'done'
          ? 'delivered'
          : r.status === 'in_progress'
            ? 'repairing'
            : 'received';

      stmt.run(
        r.id,
        r.orderNumber || r.ticket_no || `TKT-${Math.random().toString(36).slice(2, 7)}`,
        r.customerName || r.customer_name,
        r.customerPhone || r.customer_phone || null,
        r.deviceCategory || r.device_category || 'other',
        r.deviceName || r.device_model || 'Unknown',
        r.issueDescription || r.issue_description || r.problem_desc || '',
        status,
        r.totalSale || r.package_price || 0,
        r.final_cost || r.totalSale || r.package_price || 0,
        r.createdAt || r.created_at || new Date().toISOString(),
        r.updatedAt || r.updated_at || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Repair Tickets: ${data.length} records migrated.`);
}

function migrateRepairParts(db: DB) {
  if (!tableIsEmpty(db, 'repair_parts')) return;
  const data = getSettingsJson(db, 'gx_repair_parts') || getSettingsJson(db, 'repair_parts_inventory');
  if (!data?.length) return;
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO repair_parts (
      id, name, category, sku, unit_cost, selling_price, qty, min_qty, active, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  db.transaction(() => {
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
        p.createdAt || p.created_at || new Date().toISOString(),
      );
    }
  })();
  console.log(`[migration] Repair Parts: ${data.length} records migrated.`);
}

function migrateUnifiedInventory(db: DB) {
  if (!tableIsEmpty(db, 'inventory_items')) return;

  console.log('[migration] Starting Unified Inventory Migration...');

  db.transaction(() => {
    // 1. Migrate Products
    if (tableExists(db, 'products')) {
      db.exec(`
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
      `);
      console.log('[migration] Products migrated to Unified Inventory.');
    }

    // 2. Migrate Accessories
    if (tableExists(db, 'accessories')) {
      db.exec(`
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
      `);
      console.log('[migration] Accessories migrated to Unified Inventory.');
    }

    // 3. Migrate Cars
    if (tableExists(db, 'cars_inventory')) {
      db.exec(`
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
      `);
      console.log('[migration] Cars migrated to Unified Inventory.');
    }

    // 4. Migrate Used Devices
    if (tableExists(db, 'used_devices')) {
      db.exec(`
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
      `);
      console.log('[migration] Used Devices migrated to Unified Inventory.');
    }

    // 5. Migrate Repair Parts
    if (tableExists(db, 'repair_parts')) {
      db.exec(`
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
      `);
      console.log('[migration] Repair Parts migrated to Unified Inventory.');
    }
  })();

  console.log('[migration] Unified Inventory Migration Completed.');
}
