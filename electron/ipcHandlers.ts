import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import { readInstallmentContracts, replaceInstallmentContracts } from './installmentsDb';

type DB = ReturnType<typeof Database>;

// ─── Generic helpers ─────────────────────────────────────────────────────────

function buildUpdateSql(data: Record<string, unknown>, excludeKeys = ['id', 'createdAt']) {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    if (!excludeKeys.includes(key)) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  return { sets, values };
}

function readSettingsArray(db: DB, key: string): Record<string, unknown>[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return [];

  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function readSettingJson<T>(db: DB, key: string, fallback: T): T {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  if (!row) return fallback;

  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

function ensureWalletRecord(db: DB, walletId: string) {
  if (!walletId) return;
  const existing = db.prepare('SELECT id FROM wallets WHERE id = ?').get(walletId) as { id: string } | undefined;
  if (existing) return;

  const walletMetadata = [...readSettingsArray(db, 'gx_wallets'), ...readSettingsArray(db, 'retail_wallets')]
    .find((wallet) => String(wallet.id ?? '') === walletId);
  const now = new Date().toISOString();
  const walletType = String(walletMetadata?.type ?? 'cash');
  const walletIcon = String(
    walletMetadata?.icon
    ?? (walletType === 'bank' ? '🏦' : walletType === 'card' ? '💳' : walletType === 'transfer' ? '📲' : '💵'),
  );

  db.prepare(`
    INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  `).run(
    walletId,
    String(walletMetadata?.name ?? (walletId === 'wallet_cash' ? 'الصندوق' : `Wallet ${walletId.slice(0, 8)}`)),
    walletType,
    walletMetadata?.isDefault ? 1 : 0,
    walletIcon,
    walletMetadata?.color ? String(walletMetadata.color) : null,
    String(walletMetadata?.notes ?? 'Auto-created to repair wallet references'),
    walletMetadata?.createdAt ? String(walletMetadata.createdAt) : now,
    walletMetadata?.updatedAt ? String(walletMetadata.updatedAt) : now,
  );
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
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

function readProducts(db: DB, source?: string | null) {
  const rows = source
    ? db.prepare('SELECT * FROM products WHERE source = ? ORDER BY createdAt DESC, id DESC').all(source)
    : db.prepare('SELECT * FROM products ORDER BY createdAt DESC, id DESC').all();
  return rows as Array<Record<string, unknown>>;
}

function readAccessories(db: DB, inventoryType?: string | null) {
  const rows = inventoryType
    ? db.prepare('SELECT * FROM accessories WHERE inventoryType = ? ORDER BY createdAt DESC, id DESC').all(inventoryType)
    : db.prepare('SELECT * FROM accessories ORDER BY createdAt DESC, id DESC').all();
  return rows as Array<Record<string, unknown>>;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function getBackupTableNames(db: DB): string[] {
  const rows = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
      AND name NOT IN ('better_sqlite3_temp_directory')
    ORDER BY name ASC
  `).all() as Array<{ name: string }>;

  return rows.map((row) => row.name);
}

function exportDatabaseSnapshot(db: DB) {
  const tables: Record<string, Array<Record<string, unknown>>> = {};

  for (const table of getBackupTableNames(db)) {
    tables[table] = db.prepare(`SELECT * FROM ${quoteIdentifier(table)}`).all() as Array<Record<string, unknown>>;
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

function importDatabaseSnapshot(db: DB, payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;

  const rawTables = (payload as { tables?: Record<string, unknown> }).tables;
  if (!rawTables || typeof rawTables !== 'object') return false;

  const knownTables = new Set(getBackupTableNames(db));
  const tables = Object.entries(rawTables)
    .filter(([table]) => knownTables.has(table))
    .map(([table, rows]) => ({
      table,
      rows: Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') as Array<Record<string, unknown>> : [],
    }));

  const restore = db.transaction(() => {
    db.pragma('foreign_keys = OFF');

    for (const { table } of [...tables].reverse()) {
      db.prepare(`DELETE FROM ${quoteIdentifier(table)}`).run();
    }

    for (const { table, rows } of tables) {
      if (rows.length === 0) continue;

      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>;
      const allowedColumns = new Set(columns.map((column) => column.name));

      for (const row of rows) {
        const entries = Object.entries(row).filter(([key]) => allowedColumns.has(key));
        if (entries.length === 0) continue;

        const columnSql = entries.map(([key]) => quoteIdentifier(key)).join(', ');
        const placeholders = entries.map(() => '?').join(', ');
        db.prepare(`INSERT INTO ${quoteIdentifier(table)} (${columnSql}) VALUES (${placeholders})`)
          .run(...entries.map(([, value]) => value));
      }
    }

    db.pragma('foreign_keys = ON');
    const foreignKeyErrors = db.prepare('PRAGMA foreign_key_check').all();
    if (foreignKeyErrors.length > 0) {
      throw new Error(`Foreign key check failed for ${foreignKeyErrors.length} row(s)`);
    }
  });

  restore();
  return true;
}

function readSales(db: DB, activeOnly = false) {
  const sales = db.prepare(`
    SELECT * FROM sales
    ${activeOnly ? 'WHERE voidedAt IS NULL' : ''}
    ORDER BY date DESC, invoiceNumber DESC
  `).all() as Array<Record<string, unknown>>;
  const items = db.prepare('SELECT * FROM sale_items ORDER BY saleId ASC, id ASC').all() as Array<Record<string, unknown>>;
  const itemsBySaleId = new Map<string, Array<Record<string, unknown>>>();

  for (const item of items) {
    const saleId = String(item.saleId ?? '');
    if (!saleId) continue;
    const bucket = itemsBySaleId.get(saleId) || [];
    bucket.push({
      productId: String(item.productId ?? ''),
      name: String(item.name ?? ''),
      qty: Number(item.qty ?? 0),
      price: Number(item.price ?? 0),
      cost: Number(item.cost ?? 0),
      lineDiscount: Number(item.lineDiscount ?? 0),
      warehouseId: item.warehouseId ? String(item.warehouseId) : undefined,
      batches: parseJsonValue(item.batches, []),
    });
    itemsBySaleId.set(saleId, bucket);
  }

  return sales.map((sale) => ({
    id: String(sale.id ?? ''),
    invoiceNumber: String(sale.invoiceNumber ?? ''),
    date: String(sale.date ?? ''),
    items: itemsBySaleId.get(String(sale.id ?? '')) || [],
    subtotal: Number(sale.subtotal ?? 0),
    discount: Number(sale.discount ?? 0),
    total: Number(sale.total ?? 0),
    totalCost: Number(sale.totalCost ?? 0),
    grossProfit: Number(sale.grossProfit ?? 0),
    marginPct: Number(sale.marginPct ?? 0),
    paymentMethod: String(sale.paymentMethod ?? 'cash'),
    employee: String(sale.employee ?? 'system'),
    voidedAt: sale.voidedAt ? String(sale.voidedAt) : null,
    voidReason: sale.voidReason ? String(sale.voidReason) : null,
    voidedBy: sale.voidedBy ? String(sale.voidedBy) : null,
  }));
}

function readPurchaseInvoices(db: DB) {
  const invoices = db.prepare('SELECT * FROM purchase_invoices ORDER BY invoiceDate DESC, createdAt DESC').all() as Array<Record<string, unknown>>;
  const items = db.prepare('SELECT * FROM purchase_invoice_items ORDER BY invoiceId ASC, id ASC').all() as Array<Record<string, unknown>>;
  const itemsByInvoiceId = new Map<string, Array<Record<string, unknown>>>();

  for (const item of items) {
    const invoiceId = String(item.invoiceId ?? '');
    if (!invoiceId) continue;
    const bucket = itemsByInvoiceId.get(invoiceId) || [];
    bucket.push({
      id: String(item.id ?? ''),
      productName: String(item.productName ?? ''),
      category: item.category ? String(item.category) : '',
      quantity: Number(item.quantity ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      totalPrice: Number(item.totalPrice ?? 0),
      notes: item.notes ? String(item.notes) : '',
    });
    itemsByInvoiceId.set(invoiceId, bucket);
  }

  return invoices.map((invoice) => ({
    id: String(invoice.id ?? ''),
    invoiceNumber: String(invoice.invoiceNumber ?? ''),
    supplierId: invoice.supplierId ? String(invoice.supplierId) : undefined,
    supplierName: String(invoice.supplierName ?? ''),
    invoiceDate: String(invoice.invoiceDate ?? ''),
    totalAmount: Number(invoice.totalAmount ?? 0),
    paidAmount: Number(invoice.paidAmount ?? 0),
    remaining: Number(invoice.remaining ?? 0),
    paymentMethod: String(invoice.paymentMethod ?? 'cash'),
    items: itemsByInvoiceId.get(String(invoice.id ?? '')) || [],
    status: String(invoice.status ?? 'confirmed'),
    notes: invoice.notes ? String(invoice.notes) : '',
    createdBy: String(invoice.createdBy ?? 'system'),
    createdAt: String(invoice.createdAt ?? ''),
    updatedAt: String(invoice.updatedAt ?? ''),
  }));
}

function readReturnRecords(db: DB) {
  const records = db.prepare('SELECT * FROM return_records ORDER BY date DESC, createdAt DESC').all() as Array<Record<string, unknown>>;
  const items = db.prepare('SELECT * FROM return_items ORDER BY returnId ASC, id ASC').all() as Array<Record<string, unknown>>;
  const itemsByReturnId = new Map<string, Array<Record<string, unknown>>>();

  for (const item of items) {
    const returnId = String(item.returnId ?? '');
    if (!returnId) continue;
    const bucket = itemsByReturnId.get(returnId) || [];
    bucket.push({
      productId: String(item.productId ?? ''),
      name: String(item.name ?? ''),
      qty: Number(item.qty ?? 0),
      price: Number(item.price ?? 0),
      reason: item.reason ? String(item.reason) : '',
    });
    itemsByReturnId.set(returnId, bucket);
  }

  return records.map((record) => ({
    id: String(record.id ?? ''),
    returnNumber: String(record.returnNumber ?? ''),
    originalInvoiceNumber: String(record.originalInvoiceNumber ?? ''),
    originalSaleId: record.originalSaleId ? String(record.originalSaleId) : '',
    date: String(record.date ?? ''),
    items: itemsByReturnId.get(String(record.id ?? '')) || [],
    totalRefund: Number(record.totalRefund ?? 0),
    reason: record.reason ? String(record.reason) : '',
    processedBy: record.processedBy ? String(record.processedBy) : '',
    createdAt: String(record.createdAt ?? ''),
  }));
}

function readShiftClosings(db: DB) {
  return db.prepare('SELECT * FROM shift_closings ORDER BY closedAt DESC, createdAt DESC').all() as Array<Record<string, unknown>>;
}

function buildShiftSummary(db: DB, closedBy: string, actualCash: number, notes?: string) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const lastClose = db.prepare('SELECT closedAt FROM shift_closings ORDER BY closedAt DESC LIMIT 1').get() as { closedAt?: string } | undefined;
  const fromTimestamp = lastClose?.closedAt ? String(lastClose.closedAt) : startOfToday.toISOString();
  const summary = db.prepare(`
    SELECT
      COUNT(*) as salesCount,
      SUM(CASE WHEN paymentMethod = 'cash' THEN total ELSE 0 END) as salesCash,
      SUM(CASE WHEN paymentMethod = 'card' THEN total ELSE 0 END) as salesCard,
      SUM(CASE WHEN paymentMethod NOT IN ('cash', 'card') THEN total ELSE 0 END) as salesTransfer,
      SUM(total) as salesTotal
    FROM sales
    WHERE voidedAt IS NULL AND date >= ?
  `).get(fromTimestamp) as Record<string, unknown>;
  const now = new Date();
  const salesCash = Number(summary.salesCash ?? 0);
  const salesCard = Number(summary.salesCard ?? 0);
  const salesTransfer = Number(summary.salesTransfer ?? 0);
  const salesTotal = Number(summary.salesTotal ?? (salesCash + salesCard + salesTransfer));

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
    notes,
  };
}

// ─── Setup All Handlers ───────────────────────────────────────────────────────

function replySync<T>(event: Electron.IpcMainEvent, label: string, fallback: T, action: () => T) {
  try {
    event.returnValue = action();
  } catch (error) {
    console.error(`${label} error:`, error);
    event.returnValue = fallback;
  }
}

export function setupIpcHandlers(db: DB) {
  ipcMain.on('db:installments:get', (event) => {
    try {
      event.returnValue = readInstallmentContracts(db);
    } catch (error) {
      console.error('db:installments:get error:', error);
      event.returnValue = [];
    }
  });

  ipcMain.on('db:installments:replaceAll', (event, contracts: unknown) => {
    try {
      const rows = Array.isArray(contracts) ? (contracts as Record<string, unknown>[]) : [];
      event.returnValue = replaceInstallmentContracts(db, rows);
    } catch (error) {
      console.error('db:installments:replaceAll error:', error);
      event.returnValue = [];
    }
  });

  ipcMain.on('db-sync:settings:get-json', (event, key: string) => {
    replySync(event, 'db-sync:settings:get-json', null, () => readSettingJson(db, key, null));
  });
  ipcMain.on('db-sync:settings:set-json', (event, key: string, value: unknown) => {
    replySync(event, 'db-sync:settings:set-json', null, () => {
      const serialized = JSON.stringify(value ?? null);
      db.prepare(`
        INSERT INTO settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, serialized);
      return value ?? null;
    });
  });

  ipcMain.on('db-sync:categories:get', (event) => {
    replySync(event, 'db-sync:categories:get', [], () => (
      db.prepare('SELECT * FROM categories ORDER BY inventoryType ASC, name ASC').all()
    ));
  });
  ipcMain.on('db-sync:categories:replaceAll', (event, categories: any[] = []) => {
    replySync(event, 'db-sync:categories:replaceAll', [], () => {
      const replaceAll = db.transaction(() => {
        db.prepare('DELETE FROM categories').run();
        const stmt = db.prepare(`
          INSERT INTO categories (id, name, inventoryType)
          VALUES (?, ?, ?)
        `);
        for (const category of Array.isArray(categories) ? categories : []) {
          stmt.run(
            category.id ?? crypto.randomUUID(),
            category.name ?? '',
            category.inventoryType ?? 'mobile_device',
          );
        }
        return db.prepare('SELECT * FROM categories ORDER BY inventoryType ASC, name ASC').all();
      });

      return replaceAll();
    });
  });

  ipcMain.on('db-sync:users:get', (event) => {
    replySync(event, 'db-sync:users:get', [], () => (
      db.prepare('SELECT * FROM users ORDER BY createdAt ASC, username ASC').all()
    ));
  });
  ipcMain.on('db-sync:users:replaceAll', (event, users: any[] = []) => {
    replySync(event, 'db-sync:users:replaceAll', [], () => {
      const replaceAll = db.transaction(() => {
        db.prepare('DELETE FROM users').run();
        const stmt = db.prepare(`
          INSERT INTO users (
            id, username, fullName, role, permissions, active,
            passwordHash, salt, mustChangePassword, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = new Date().toISOString();
        for (const user of Array.isArray(users) ? users : []) {
          stmt.run(
            user.id ?? crypto.randomUUID(),
            user.username ?? '',
            user.fullName ?? '',
            user.role ?? 'user',
            user.permissions ?? '[]',
            user.active ? 1 : 0,
            user.passwordHash ?? null,
            user.salt ?? null,
            user.mustChangePassword ? 1 : 0,
            user.createdAt ?? now,
            user.updatedAt ?? user.createdAt ?? now,
          );
        }
        return db.prepare('SELECT * FROM users ORDER BY createdAt ASC, username ASC').all();
      });

      return replaceAll();
    });
  });

  ipcMain.on('db-sync:product_batches:get', (event) => {
    replySync(event, 'db-sync:product_batches:get', [], () => (
      db.prepare('SELECT * FROM product_batches ORDER BY purchaseDate ASC, createdAt ASC, id ASC').all()
    ));
  });
  ipcMain.on('db-sync:product_batches:add', (event, batch: any) => {
    replySync(event, 'db-sync:product_batches:add', null, () => {
      const id = batch.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO product_batches (
          id, productId, inventoryType, productName, costPrice, salePrice,
          quantity, remainingQty, purchaseDate, supplier, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        batch.productId,
        batch.inventoryType ?? 'mobile',
        batch.productName ?? 'Unknown product',
        batch.costPrice ?? 0,
        batch.salePrice ?? 0,
        batch.quantity ?? 0,
        batch.remainingQty ?? batch.quantity ?? 0,
        batch.purchaseDate ?? now,
        batch.supplier ?? null,
        batch.notes ?? null,
        batch.createdAt ?? now,
        batch.updatedAt ?? now,
      );
      return db.prepare('SELECT * FROM product_batches WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:product_batches:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:product_batches:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM product_batches WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE product_batches SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM product_batches WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:product_batches:delete', (event, id: string) => {
    replySync(event, 'db-sync:product_batches:delete', false, () => (
      db.prepare('DELETE FROM product_batches WHERE id = ?').run(id).changes > 0
    ));
  });

  ipcMain.on('db-sync:products:get', (event, source: string | null = null) => {
    replySync(event, 'db-sync:products:get', [], () => readProducts(db, source));
  });
  ipcMain.on('db-sync:products:add', (event, product: any) => {
    replySync(event, 'db-sync:products:add', null, () => {
      const id = product.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO products (
          id, name, model, barcode, deviceType, category, condition, storage, ram, color,
          brand, description, boxNumber, taxExcluded, quantity, oldCostPrice, newCostPrice,
          salePrice, profitMargin, minStock, supplier, source, warehouseId, serialNumber,
          imei2, processor, isArchived, notes, image, createdAt, updatedAt, deletedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        product.name ?? '',
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
        product.deletedAt ?? null,
      );
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:products:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:products:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:products:delete', (event, id: string) => {
    replySync(event, 'db-sync:products:delete', false, () => (
      db.prepare('DELETE FROM products WHERE id = ?').run(id).changes > 0
    ));
  });

  ipcMain.on('db-sync:accessories:get', (event, inventoryType: string | null = null) => {
    replySync(event, 'db-sync:accessories:get', [], () => readAccessories(db, inventoryType));
  });
  ipcMain.on('db-sync:accessories:add', (event, accessory: any) => {
    replySync(event, 'db-sync:accessories:add', null, () => {
      const id = accessory.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        accessory.name ?? '',
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
        accessory.condition ?? 'new',
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
        accessory.updatedAt ?? now,
      );
      return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:accessories:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:accessories:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE accessories SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM accessories WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:accessories:delete', (event, id: string) => {
    replySync(event, 'db-sync:accessories:delete', false, () => (
      db.prepare('DELETE FROM accessories WHERE id = ?').run(id).changes > 0
    ));
  });

  ipcMain.on('db-sync:warehouse_items:get', (event) => {
    replySync(event, 'db-sync:warehouse_items:get', [], () => (
      db.prepare('SELECT * FROM warehouse_items ORDER BY createdAt DESC, id DESC').all()
    ));
  });
  ipcMain.on('db-sync:warehouse_items:add', (event, item: any) => {
    replySync(event, 'db-sync:warehouse_items:add', null, () => {
      const id = item.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO warehouse_items (
          id, warehouseId, name, category, quantity, costPrice, notes, addedBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        item.warehouseId ?? null,
        item.name ?? '',
        item.category ?? 'general',
        item.quantity ?? 0,
        item.costPrice ?? 0,
        item.notes ?? null,
        item.addedBy ?? null,
        item.createdAt ?? now,
        item.updatedAt ?? now,
      );
      return db.prepare('SELECT * FROM warehouse_items WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:warehouse_items:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:warehouse_items:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM warehouse_items WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE warehouse_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM warehouse_items WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:warehouse_items:delete', (event, id: string) => {
    replySync(event, 'db-sync:warehouse_items:delete', false, () => (
      db.prepare('DELETE FROM warehouse_items WHERE id = ?').run(id).changes > 0
    ));
  });

  ipcMain.on('db-sync:cars:get', (event) => {
    replySync(event, 'db-sync:cars:get', [], () => (
      db.prepare('SELECT * FROM cars_inventory ORDER BY createdAt DESC, id DESC').all()
    ));
  });
  ipcMain.on('db-sync:cars:add', (event, car: any) => {
    replySync(event, 'db-sync:cars:add', null, () => {
      const id = car.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO cars_inventory (
          id, name, model, year, color, plateNumber, licenseExpiry, condition, category,
          purchasePrice, salePrice, notes, image, warehouseId, isArchived, deletedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        car.name ?? '',
        car.model ?? '',
        car.year ?? 0,
        car.color ?? null,
        car.plateNumber ?? null,
        car.licenseExpiry ?? null,
        car.condition ?? 'used',
        car.category ?? null,
        car.purchasePrice ?? 0,
        car.salePrice ?? 0,
        car.notes ?? null,
        car.image ?? null,
        car.warehouseId ?? null,
        car.isArchived ? 1 : 0,
        car.deletedAt ?? null,
        car.createdAt ?? now,
        car.updatedAt ?? now,
      );
      return db.prepare('SELECT * FROM cars_inventory WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:cars:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:cars:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM cars_inventory WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE cars_inventory SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM cars_inventory WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:cars:delete', (event, id: string) => {
    replySync(event, 'db-sync:cars:delete', false, () => (
      db.prepare('DELETE FROM cars_inventory WHERE id = ?').run(id).changes > 0
    ));
  });

  ipcMain.on('db-sync:customers:get', (event) => {
    replySync(event, 'db-sync:customers:get', [], () => db.prepare("SELECT * FROM customers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  ipcMain.on('db-sync:customers:add', (event, customer: any) => {
    replySync(event, 'db-sync:customers:add', null, () => {
      const id = customer.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        customer.updatedAt || now,
      );
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:customers:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:customers:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:customers:delete', (event, id: string) => {
    replySync(event, 'db-sync:customers:delete', false, () => db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:expenses:get', (event) => {
    replySync(event, 'db-sync:expenses:get', [], () => db.prepare('SELECT * FROM expenses ORDER BY date DESC, createdAt DESC').all());
  });
  ipcMain.on('db-sync:expenses:add', (event, expense: any) => {
    replySync(event, 'db-sync:expenses:add', null, () => {
      const id = expense.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        expense.category,
        expense.description ?? null,
        expense.amount ?? 0,
        expense.date,
        expense.paymentMethod ?? 'cash',
        expense.employee ?? null,
        expense.notes ?? null,
        expense.createdAt || now,
        expense.updatedAt || now,
      );
      return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:expenses:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:expenses:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:expenses:delete', (event, id: string) => {
    replySync(event, 'db-sync:expenses:delete', false, () => db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:blacklist:get', (event) => {
    replySync(event, 'db-sync:blacklist:get', [], () => db.prepare('SELECT * FROM blacklist ORDER BY createdAt DESC, updatedAt DESC').all());
  });
  ipcMain.on('db-sync:blacklist:add', (event, entry: any) => {
    replySync(event, 'db-sync:blacklist:add', null, () => {
      const id = entry.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        entry.status ?? 'active',
        entry.reportedDate ?? now.slice(0, 10),
        entry.imei ?? null,
        entry.reason,
        entry.notes ?? null,
        entry.createdBy ?? null,
        entry.createdBy ?? null,
        entry.deviceName,
        entry.createdAt || now,
        entry.updatedAt || now,
      );
      return db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:blacklist:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:blacklist:update', null, () => {
      const updates = { ...data };
      if (Object.prototype.hasOwnProperty.call(updates, 'ownerPhone') && !Object.prototype.hasOwnProperty.call(updates, 'phone')) {
        updates.phone = updates.ownerPhone;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'imei') && !Object.prototype.hasOwnProperty.call(updates, 'nationalId')) {
        updates.nationalId = updates.imei;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'deviceName') && !Object.prototype.hasOwnProperty.call(updates, 'name')) {
        updates.name = updates.deviceName;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'createdBy') && !Object.prototype.hasOwnProperty.call(updates, 'addedBy')) {
        updates.addedBy = updates.createdBy;
      }
      const { sets, values } = buildUpdateSql(updates);
      if (!sets.length) return db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE blacklist SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:blacklist:delete', (event, id: string) => {
    replySync(event, 'db-sync:blacklist:delete', false, () => db.prepare('DELETE FROM blacklist WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:damaged_items:get', (event) => {
    replySync(event, 'db-sync:damaged_items:get', [], () => db.prepare('SELECT * FROM damaged_items ORDER BY date DESC, createdAt DESC').all());
  });
  ipcMain.on('db-sync:damaged_items:add', (event, item: any) => {
    replySync(event, 'db-sync:damaged_items:add', null, () => {
      const id = item.id || crypto.randomUUID();
      db.prepare(`
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
        item.createdAt || new Date().toISOString(),
      );
      return db.prepare('SELECT * FROM damaged_items WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:damaged_items:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:damaged_items:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM damaged_items WHERE id = ?').get(id);
      values.push(id);
      db.prepare(`UPDATE damaged_items SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM damaged_items WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:damaged_items:delete', (event, id: string) => {
    replySync(event, 'db-sync:damaged_items:delete', false, () => db.prepare('DELETE FROM damaged_items WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:other_revenue:get', (event) => {
    replySync(event, 'db-sync:other_revenue:get', [], () => db.prepare('SELECT * FROM other_revenue ORDER BY date DESC, createdAt DESC').all());
  });
  ipcMain.on('db-sync:other_revenue:add', (event, revenue: any) => {
    replySync(event, 'db-sync:other_revenue:add', null, () => {
      const id = revenue.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, addedBy, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        revenue.source,
        revenue.description ?? null,
        revenue.amount ?? 0,
        revenue.date,
        revenue.paymentMethod ?? 'cash',
        revenue.addedBy ?? null,
        revenue.notes ?? null,
        revenue.createdAt || now,
        revenue.updatedAt || now,
      );
      return db.prepare('SELECT * FROM other_revenue WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:other_revenue:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:other_revenue:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM other_revenue WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE other_revenue SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM other_revenue WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:other_revenue:delete', (event, id: string) => {
    replySync(event, 'db-sync:other_revenue:delete', false, () => db.prepare('DELETE FROM other_revenue WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:reminders:get', (event) => {
    replySync(event, 'db-sync:reminders:get', [], () => db.prepare('SELECT * FROM reminders ORDER BY dueDate ASC, reminderTime ASC').all());
  });
  ipcMain.on('db-sync:reminders:add', (event, reminder: any) => {
    replySync(event, 'db-sync:reminders:add', null, () => {
      const id = reminder.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO reminders (
          id, title, description, dueDate, reminderTime, priority, status, completed, completedAt, recurring, category, notes, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        reminder.title,
        reminder.description ?? null,
        reminder.dueDate,
        reminder.reminderTime ?? null,
        reminder.priority ?? 'medium',
        reminder.status ?? 'pending',
        reminder.completed ?? 0,
        reminder.completedAt ?? null,
        reminder.recurring ?? null,
        reminder.category ?? null,
        reminder.notes ?? null,
        reminder.createdAt || now,
        reminder.updatedAt || now,
      );
      return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:reminders:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:reminders:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:reminders:delete', (event, id: string) => {
    replySync(event, 'db-sync:reminders:delete', false, () => db.prepare('DELETE FROM reminders WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:suppliers:get', (event) => {
    replySync(event, 'db-sync:suppliers:get', [], () => db.prepare("SELECT * FROM suppliers WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  ipcMain.on('db-sync:suppliers:add', (event, supplier: any) => {
    replySync(event, 'db-sync:suppliers:add', null, () => {
      const id = supplier.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        supplier.updatedAt || now,
      );
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:suppliers:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:suppliers:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:suppliers:delete', (event, id: string) => {
    replySync(event, 'db-sync:suppliers:delete', false, () => db.prepare('DELETE FROM suppliers WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:supplier_transactions:get', (event, supplierId?: string) => {
    replySync(event, 'db-sync:supplier_transactions:get', [], () => {
      if (supplierId) {
        return db.prepare('SELECT * FROM supplier_transactions WHERE supplierId = ? ORDER BY createdAt DESC').all(supplierId);
      }
      return db.prepare('SELECT * FROM supplier_transactions ORDER BY createdAt DESC').all();
    });
  });
  ipcMain.on('db-sync:supplier_transactions:add', (event, transaction: any) => {
    replySync(event, 'db-sync:supplier_transactions:add', null, () => {
      const persistTransaction = db.transaction(() => {
        const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(transaction.supplierId) as Record<string, unknown> | undefined;
        if (!supplier) throw new Error('Supplier not found');

        const id = transaction.id || crypto.randomUUID();
        const now = transaction.createdAt || new Date().toISOString();
        const amount = Number(transaction.amount ?? 0);
        const balanceBefore = Number(supplier.balance ?? 0);
        const delta = transaction.type === 'purchase' ? amount : -amount;
        const balanceAfter = balanceBefore + delta;

        db.prepare(`
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
          now,
        );

        db.prepare('UPDATE suppliers SET balance = ?, updatedAt = ? WHERE id = ?').run(balanceAfter, new Date().toISOString(), transaction.supplierId);
        return db.prepare('SELECT * FROM supplier_transactions WHERE id = ?').get(id);
      });

      return persistTransaction();
    });
  });

  ipcMain.on('db-sync:employees:get', (event) => {
    replySync(event, 'db-sync:employees:get', [], () => db.prepare("SELECT * FROM employees WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY name ASC").all());
  });
  ipcMain.on('db-sync:employees:add', (event, employee: any) => {
    replySync(event, 'db-sync:employees:add', null, () => {
      const id = employee.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        employee.updatedAt || now,
      );
      return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employees:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:employees:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employees:delete', (event, id: string) => {
    replySync(event, 'db-sync:employees:delete', false, () => db.prepare('DELETE FROM employees WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:employee_salaries:get', (event, employeeId?: string) => {
    replySync(event, 'db-sync:employee_salaries:get', [], () => {
      if (employeeId) {
        return db.prepare('SELECT * FROM employee_salaries WHERE employeeId = ? ORDER BY month DESC, paidAt DESC, createdAt DESC').all(employeeId);
      }
      return db.prepare('SELECT * FROM employee_salaries ORDER BY month DESC, paidAt DESC, createdAt DESC').all();
    });
  });
  ipcMain.on('db-sync:employee_salaries:add', (event, salary: any) => {
    replySync(event, 'db-sync:employee_salaries:add', null, () => {
      const id = salary.id || crypto.randomUUID();
      const createdAt = salary.createdAt || salary.paidAt || new Date().toISOString();
      db.prepare(`
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
        createdAt,
      );
      return db.prepare('SELECT * FROM employee_salaries WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employee_salaries:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:employee_salaries:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM employee_salaries WHERE id = ?').get(id);
      values.push(id);
      db.prepare(`UPDATE employee_salaries SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM employee_salaries WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employee_salaries:delete', (event, id: string) => {
    replySync(event, 'db-sync:employee_salaries:delete', false, () => db.prepare('DELETE FROM employee_salaries WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:employee_advances:get', (event, employeeId?: string) => {
    replySync(event, 'db-sync:employee_advances:get', [], () => {
      if (employeeId) {
        return db.prepare('SELECT * FROM employee_advances WHERE employeeId = ? ORDER BY date DESC, createdAt DESC').all(employeeId);
      }
      return db.prepare('SELECT * FROM employee_advances ORDER BY date DESC, createdAt DESC').all();
    });
  });
  ipcMain.on('db-sync:employee_advances:add', (event, advance: any) => {
    replySync(event, 'db-sync:employee_advances:add', null, () => {
      const id = advance.id || crypto.randomUUID();
      const createdAt = advance.createdAt || advance.date || new Date().toISOString();
      db.prepare(`
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
        createdAt,
      );
      return db.prepare('SELECT * FROM employee_advances WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employee_advances:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:employee_advances:update', null, () => {
      const { sets, values } = buildUpdateSql(data);
      if (!sets.length) return db.prepare('SELECT * FROM employee_advances WHERE id = ?').get(id);
      values.push(id);
      db.prepare(`UPDATE employee_advances SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM employee_advances WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:employee_advances:delete', (event, id: string) => {
    replySync(event, 'db-sync:employee_advances:delete', false, () => db.prepare('DELETE FROM employee_advances WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:used_devices:get', (event) => {
    replySync(event, 'db-sync:used_devices:get', [], () => db.prepare("SELECT * FROM used_devices WHERE COALESCE(isArchived, 0) = 0 AND deletedAt IS NULL ORDER BY createdAt DESC, updatedAt DESC").all());
  });
  ipcMain.on('db-sync:used_devices:add', (event, device: any) => {
    replySync(event, 'db-sync:used_devices:add', null, () => {
      const id = device.id || crypto.randomUUID();
      const now = new Date().toISOString();
      db.prepare(`
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
        device.condition ?? 'good',
        device.purchasePrice ?? 0,
        device.sellingPrice ?? device.salePrice ?? 0,
        device.status ?? 'in_stock',
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
        device.updatedAt || now,
      );
      return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:used_devices:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:used_devices:update', null, () => {
      const updates = { ...data };
      if (Object.prototype.hasOwnProperty.call(updates, 'deviceType') && !Object.prototype.hasOwnProperty.call(updates, 'category')) {
        updates.category = updates.deviceType;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'description') && !Object.prototype.hasOwnProperty.call(updates, 'notes')) {
        updates.notes = updates.description;
      }
      const { sets, values } = buildUpdateSql(updates);
      if (!sets.length) return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
      sets.push('updatedAt = ?');
      values.push(new Date().toISOString(), id);
      db.prepare(`UPDATE used_devices SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:used_devices:delete', (event, id: string) => {
    replySync(event, 'db-sync:used_devices:delete', false, () => db.prepare('DELETE FROM used_devices WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:sales:get', (event, activeOnly = false) => {
    replySync(event, 'db-sync:sales:get', [], () => readSales(db, Boolean(activeOnly)));
  });
  ipcMain.on('db-sync:sales:maxInvoiceSequence', (event) => {
    replySync(event, 'db-sync:sales:maxInvoiceSequence', 0, () => {
      const rows = db.prepare('SELECT invoiceNumber FROM sales').all() as Array<{ invoiceNumber?: string }>;
      return rows.reduce((max, row) => {
        const match = /^INV-\d{4}-(\d+)$/.exec(String(row.invoiceNumber ?? ''));
        const sequence = match ? Number.parseInt(match[1], 10) : 0;
        return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
      }, 0);
    });
  });
  ipcMain.on('db-sync:sales:upsert', (event, sale: any) => {
    replySync(event, 'db-sync:sales:upsert', null, () => {
      const persistSale = db.transaction(() => {
        db.prepare(`
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
          sale.paymentMethod ?? 'cash',
          sale.employee ?? 'system',
          sale.voidedAt ?? null,
          sale.voidReason ?? null,
          sale.voidedBy ?? null,
        );

        db.prepare('DELETE FROM sale_items WHERE saleId = ?').run(sale.id);
        const itemStmt = db.prepare(`
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
            item.batches ? JSON.stringify(item.batches) : null,
          );
        }

        return readSales(db).find((row) => row.id === sale.id) ?? null;
      });

      return persistSale();
    });
  });

  ipcMain.on('db-sync:returns:get', (event) => {
    replySync(event, 'db-sync:returns:get', [], () => readReturnRecords(db));
  });
  ipcMain.on('db-sync:returns:add', (event, record: any) => {
    replySync(event, 'db-sync:returns:add', null, () => {
      const persistReturn = db.transaction(() => {
        const existing = readReturnRecords(db);
        const maxSequence = existing.reduce((max, item) => Math.max(max, extractPrefixedSequence(item.returnNumber, 'RET')), 0);
        const id = record.id || crypto.randomUUID();
        const createdAt = record.createdAt || new Date().toISOString();
        const returnNumber = record.returnNumber || `RET-${String(maxSequence + 1).padStart(4, '0')}`;
        const originalSaleRow = record.originalSaleId
          ? (db.prepare('SELECT id FROM sales WHERE id = ?').get(record.originalSaleId) as { id?: string } | undefined)
          : undefined;

        db.prepare(`
          INSERT INTO return_records (
            id, returnNumber, originalInvoiceNumber, originalSaleId, date, totalRefund, reason, processedBy, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          returnNumber,
          record.originalInvoiceNumber,
          originalSaleRow?.id ?? null,
          record.date,
          record.totalRefund ?? 0,
          record.reason ?? null,
          record.processedBy ?? null,
          createdAt,
        );

        const itemStmt = db.prepare(`
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
            item.reason ?? null,
          );
        }

        return readReturnRecords(db).find((row) => row.id === id) ?? null;
      });

      return persistReturn();
    });
  });

  ipcMain.on('db-sync:purchase_invoices:get', (event) => {
    replySync(event, 'db-sync:purchase_invoices:get', [], () => readPurchaseInvoices(db));
  });
  ipcMain.on('db-sync:purchase_invoices:add', (event, invoice: any) => {
    replySync(event, 'db-sync:purchase_invoices:add', null, () => {
      const persistInvoice = db.transaction(() => {
        const invoices = readPurchaseInvoices(db);
        const maxSequence = invoices.reduce((max, item) => Math.max(max, extractPrefixedSequence(item.invoiceNumber, 'PI')), 0);
        const id = invoice.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const totalAmount = Number(invoice.totalAmount ?? 0);
        const paidAmount = Math.min(totalAmount, Number(invoice.paidAmount ?? 0));
        const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, paidAmount);
        const supplierId = invoice.supplierId
          ? (db.prepare('SELECT id FROM suppliers WHERE id = ?').get(invoice.supplierId) as { id?: string } | undefined)?.id ?? null
          : null;

        db.prepare(`
          INSERT INTO purchase_invoices (
            id, invoiceNumber, supplierId, supplierName, invoiceDate, totalAmount, paidAmount,
            remaining, paymentMethod, status, notes, createdBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          invoice.invoiceNumber || `PI-${String(maxSequence + 1).padStart(4, '0')}`,
          supplierId,
          invoice.supplierName,
          invoice.invoiceDate,
          totalAmount,
          paidAmount,
          remaining,
          invoice.paymentMethod ?? 'cash',
          status,
          invoice.notes ?? null,
          invoice.createdBy ?? 'system',
          invoice.createdAt || now,
          invoice.updatedAt || now,
        );

        const itemStmt = db.prepare(`
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
            item.notes ?? null,
          );
        }

        return readPurchaseInvoices(db).find((row) => row.id === id) ?? null;
      });

      return persistInvoice();
    });
  });
  ipcMain.on('db-sync:purchase_invoices:update', (event, id: string, data: any) => {
    replySync(event, 'db-sync:purchase_invoices:update', null, () => {
      const persistInvoice = db.transaction(() => {
        const existing = readPurchaseInvoices(db).find((invoice) => invoice.id === id);
        if (!existing) return null;
        const merged = {
          ...existing,
          ...data,
          items: Array.isArray(data?.items) ? data.items : existing.items,
        };
        const totalAmount = Number(merged.totalAmount ?? 0);
        const paidAmount = Math.min(totalAmount, Number(merged.paidAmount ?? 0));
        const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, paidAmount);
        const supplierId = merged.supplierId
          ? (db.prepare('SELECT id FROM suppliers WHERE id = ?').get(merged.supplierId) as { id?: string } | undefined)?.id ?? null
          : null;

        db.prepare(`
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
          merged.paymentMethod ?? 'cash',
          status,
          merged.notes ?? null,
          merged.createdBy ?? 'system',
          new Date().toISOString(),
          id,
        );

        db.prepare('DELETE FROM purchase_invoice_items WHERE invoiceId = ?').run(id);
        const itemStmt = db.prepare(`
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
            item.notes ?? null,
          );
        }

        return readPurchaseInvoices(db).find((invoice) => invoice.id === id) ?? null;
      });

      return persistInvoice();
    });
  });
  ipcMain.on('db-sync:purchase_invoices:applyPayment', (event, id: string, amount: number) => {
    replySync(event, 'db-sync:purchase_invoices:applyPayment', null, () => {
      const applyInvoicePayment = db.transaction(() => {
        const current = db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        if (!current) return null;
        const totalAmount = Number(current.totalAmount ?? 0);
        const nextPaidAmount = Math.min(totalAmount, Number(current.paidAmount ?? 0) + Math.max(0, Number(amount ?? 0)));
        const remaining = Math.max(0, Math.round((totalAmount - nextPaidAmount) * 100) / 100);
        const status = derivePurchaseInvoiceStatus(totalAmount, nextPaidAmount);

        db.prepare(`
          UPDATE purchase_invoices
          SET paidAmount = ?, remaining = ?, status = ?, updatedAt = ?
          WHERE id = ?
        `).run(nextPaidAmount, remaining, status, new Date().toISOString(), id);

        return readPurchaseInvoices(db).find((invoice) => invoice.id === id) ?? null;
      });

      return applyInvoicePayment();
    });
  });
  ipcMain.on('db-sync:purchase_invoices:delete', (event, id: string) => {
    replySync(event, 'db-sync:purchase_invoices:delete', false, () => db.prepare('DELETE FROM purchase_invoices WHERE id = ?').run(id).changes > 0);
  });

  ipcMain.on('db-sync:shift_closings:get', (event) => {
    replySync(event, 'db-sync:shift_closings:get', [], () => readShiftClosings(db));
  });
  ipcMain.on('db-sync:shift_closings:buildSummary', (event, closedBy: string, actualCash: number, notes?: string) => {
    replySync(event, 'db-sync:shift_closings:buildSummary', null, () => buildShiftSummary(db, closedBy, Number(actualCash ?? 0), notes));
  });
  ipcMain.on('db-sync:shift_closings:add', (event, closing: any) => {
    replySync(event, 'db-sync:shift_closings:add', null, () => {
      const id = closing.id || crypto.randomUUID();
      const createdAt = closing.createdAt || closing.closedAt || new Date().toISOString();
      db.prepare(`
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
        createdAt,
      );
      return (db.prepare('SELECT * FROM shift_closings WHERE id = ?').get(id) as Record<string, unknown> | undefined) ?? null;
    });
  });

  ipcMain.on('db-sync:stock_movements:get', (event, productId?: string) => {
    replySync(event, 'db-sync:stock_movements:get', [], () => {
      if (productId) {
        return db.prepare('SELECT * FROM stock_movements WHERE productId = ? ORDER BY timestamp DESC, id DESC').all(productId);
      }
      return db.prepare('SELECT * FROM stock_movements ORDER BY timestamp DESC, id DESC').all();
    });
  });
  ipcMain.on('db-sync:stock_movements:add', (event, movement: any) => {
    replySync(event, 'db-sync:stock_movements:add', null, () => {
      const id = movement.id || crypto.randomUUID();
      db.prepare(`
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
        movement.timestamp ?? new Date().toISOString(),
        movement.warehouseId ?? null,
      );
      return db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:stock_movements:addBulk', (event, movements: any[]) => {
    replySync(event, 'db-sync:stock_movements:addBulk', [], () => {
      const persistMovements = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, reason,
            referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertedIds: string[] = [];
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
            movement.timestamp ?? new Date().toISOString(),
            movement.warehouseId ?? null,
          );
        }

        if (insertedIds.length === 0) return [];
        const placeholders = insertedIds.map(() => '?').join(', ');
        return db.prepare(`SELECT * FROM stock_movements WHERE id IN (${placeholders}) ORDER BY timestamp DESC, id DESC`).all(...insertedIds);
      });

      return persistMovements();
    });
  });

  ipcMain.on('db-sync:audit_logs:get', (event) => {
    replySync(event, 'db-sync:audit_logs:get', [], () => db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC, id DESC').all());
  });
  ipcMain.on('db-sync:audit_logs:add', (event, entry: any) => {
    replySync(event, 'db-sync:audit_logs:add', null, () => {
      const id = entry.id || crypto.randomUUID();
      db.prepare(`
        INSERT INTO audit_logs (
          id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        entry.userId ?? 'system',
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.beforeState ? JSON.stringify(entry.beforeState) : null,
        entry.afterState ? JSON.stringify(entry.afterState) : null,
        entry.machineId ?? null,
        entry.timestamp ?? new Date().toISOString(),
      );
      return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id);
    });
  });
  ipcMain.on('db-sync:audit_logs:addBulk', (event, entries: any[]) => {
    replySync(event, 'db-sync:audit_logs:addBulk', [], () => {
      const persistEntries = db.transaction(() => {
        const stmt = db.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertedIds: string[] = [];
        for (const entry of Array.isArray(entries) ? entries : []) {
          const id = entry.id || crypto.randomUUID();
          insertedIds.push(id);
          stmt.run(
            id,
            entry.userId ?? 'system',
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.beforeState ? JSON.stringify(entry.beforeState) : null,
            entry.afterState ? JSON.stringify(entry.afterState) : null,
            entry.machineId ?? null,
            entry.timestamp ?? new Date().toISOString(),
          );
        }

        if (insertedIds.length === 0) return [];
        const placeholders = insertedIds.map(() => '?').join(', ');
        return db.prepare(`SELECT * FROM audit_logs WHERE id IN (${placeholders}) ORDER BY timestamp DESC, id DESC`).all(...insertedIds);
      });

      return persistEntries();
    });
  });

  ipcMain.handle('db:partners:get', () => db.prepare('SELECT * FROM partners ORDER BY createdAt DESC').all());

  ipcMain.handle('db:partners:add', (_, partner: any) => {
    const id = partner.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, partner.name, partner.phone, partner.address, partner.partnershipType, partner.sharePercent || 0, partner.profitShareDevices || 0, partner.profitShareAccessories || 0, partner.capitalAmount || 0, partner.active ? 1 : 0, partner.notes, partner.createdAt || now, now);
    return db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
  });

  ipcMain.handle('db:partners:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE partners SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
  });

  ipcMain.handle('db:partners:delete', (_, id: string) => db.prepare('DELETE FROM partners WHERE id = ?').run(id).changes > 0);

  // ── Partner Transactions ──────────────────────────────────────────────────
  ipcMain.handle('db:partner_transactions:get', (_, partnerId?: string) => {
    if (partnerId) return db.prepare('SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC').all(partnerId);
    return db.prepare('SELECT * FROM partner_transactions ORDER BY createdAt DESC').all();
  });
  ipcMain.handle('db:partner_transactions:add', (_, trx: any) => {
    const id = trx.id || crypto.randomUUID();
    db.prepare(`INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt) VALUES (?, ?, ?, ?, ?, ?)`).run(id, trx.partnerId, trx.type, trx.amount, trx.description, trx.createdAt || new Date().toISOString());
    return db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(id);
  });

  // ── Warehouses ──────────────────────────────────────────────────────────
  ipcMain.handle('db:warehouses:get', () => db.prepare('SELECT * FROM warehouses ORDER BY name ASC').all());
  ipcMain.handle('db:warehouses:add', (_, w: any) => {
    const id = w.id || crypto.randomUUID();
    db.prepare(`INSERT INTO warehouses (id, name, location, isDefault, notes) VALUES (?, ?, ?, ?, ?)`).run(id, w.name, w.location, w.isDefault ? 1 : 0, w.notes);
    return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  });
  ipcMain.handle('db:warehouses:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    values.push(id);
    db.prepare(`UPDATE warehouses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  });
  ipcMain.handle('db:warehouses:delete', (_, id: string) => db.prepare('DELETE FROM warehouses WHERE id = ?').run(id).changes > 0);

  // ── Safe Transactions ─────────────────────────────────────────────────────
  ipcMain.handle('db:safe_transactions:get', (_, walletId?: string) => {
    if (walletId) return db.prepare('SELECT * FROM safe_transactions WHERE walletId = ? ORDER BY createdAt DESC').all(walletId);
    return db.prepare('SELECT * FROM safe_transactions ORDER BY createdAt DESC').all();
  });
  ipcMain.handle('db:safe_transactions:add', (_, trx: any) => {
    const id = trx.id || crypto.randomUUID();
    ensureWalletRecord(db, String(trx.walletId ?? ''));
    db.prepare(`INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, trx.walletId, trx.type, trx.subType, trx.amount, trx.category, trx.description, trx.paymentMethod, trx.affectsCapital ? 1 : 0, trx.affectsProfit ? 1 : 0, trx.createdBy, trx.relatedId, trx.createdAt || new Date().toISOString());
    return db.prepare('SELECT * FROM safe_transactions WHERE id = ?').get(id);
  });

  // ── Customers ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:customers:get', () => db.prepare('SELECT * FROM customers ORDER BY name ASC').all());
  ipcMain.handle('db:customers:add', (_, c: any) => {
    const id = c.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, c.name, c.phone, c.email, c.address, c.nationalId, c.notes, c.totalPurchases || 0, c.balance || 0, c.createdAt || now, now);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  });
  ipcMain.handle('db:customers:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  });
  ipcMain.handle('db:customers:delete', (_, id: string) => db.prepare('DELETE FROM customers WHERE id = ?').run(id).changes > 0);

  // ── Suppliers ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:suppliers:get', () => db.prepare('SELECT * FROM suppliers ORDER BY name ASC').all());
  ipcMain.handle('db:suppliers:add', (_, s: any) => {
    const id = s.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, s.name, s.phone, s.email, s.address, s.category, s.balance || 0, s.notes, s.active ?? 1, s.createdAt || now, now);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  });
  ipcMain.handle('db:suppliers:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  });
  ipcMain.handle('db:suppliers:delete', (_, id: string) => db.prepare('DELETE FROM suppliers WHERE id = ?').run(id).changes > 0);

  // ── Employees ────────────────────────────────────────────────────────────
  ipcMain.handle('db:employees:get', () => db.prepare('SELECT * FROM employees ORDER BY name ASC').all());
  ipcMain.handle('db:employees:add', (_, e: any) => {
    const id = e.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, e.name, e.phone, e.role, e.salary || 0, e.commissionRate || 0, e.hireDate, e.active ?? 1, e.notes, e.createdAt || now, now);
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  });
  ipcMain.handle('db:employees:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE employees SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
  });
  ipcMain.handle('db:employees:delete', (_, id: string) => db.prepare('DELETE FROM employees WHERE id = ?').run(id).changes > 0);

  // ── Expenses ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:expenses:get', (_, { from, to }: { from?: string; to?: string } = {}) => {
    if (from && to) return db.prepare('SELECT * FROM expenses WHERE date BETWEEN ? AND ? ORDER BY date DESC').all(from, to);
    return db.prepare('SELECT * FROM expenses ORDER BY date DESC').all();
  });
  ipcMain.handle('db:expenses:add', (_, e: any) => {
    const id = e.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, e.category, e.description, e.amount, e.date, e.paymentMethod || 'cash', e.employee, e.notes, e.createdAt || now, now);
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  });
  ipcMain.handle('db:expenses:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  });
  ipcMain.handle('db:expenses:delete', (_, id: string) => db.prepare('DELETE FROM expenses WHERE id = ?').run(id).changes > 0);

  // ── Blacklist ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:blacklist:get', () => db.prepare('SELECT * FROM blacklist ORDER BY createdAt DESC').all());
  ipcMain.handle('db:blacklist:add', (_, b: any) => {
    const id = b.id || crypto.randomUUID();
    db.prepare(`INSERT INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, b.name, b.phone, b.nationalId, b.reason, b.notes, b.addedBy, b.createdAt || new Date().toISOString());
    return db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id);
  });
  ipcMain.handle('db:blacklist:delete', (_, id: string) => db.prepare('DELETE FROM blacklist WHERE id = ?').run(id).changes > 0);
  ipcMain.handle('db:blacklist:search', (_, query: string) => {
    const q = `%${query}%`;
    return db.prepare('SELECT * FROM blacklist WHERE name LIKE ? OR phone LIKE ? OR nationalId LIKE ?').all(q, q, q);
  });

  // ── Damaged Items ─────────────────────────────────────────────────────────
  ipcMain.handle('db:damaged_items:get', () => db.prepare('SELECT * FROM damaged_items ORDER BY date DESC').all());
  ipcMain.handle('db:damaged_items:add', (_, d: any) => {
    const id = d.id || crypto.randomUUID();
    db.prepare(`INSERT INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, d.productName || d.name, d.productId, d.inventoryType, d.quantity || 1, d.reason, d.estimatedLoss || 0, d.reportedBy, d.date, d.notes, d.createdAt || new Date().toISOString());
    return db.prepare('SELECT * FROM damaged_items WHERE id = ?').get(id);
  });
  ipcMain.handle('db:damaged_items:delete', (_, id: string) => db.prepare('DELETE FROM damaged_items WHERE id = ?').run(id).changes > 0);

  // ── Other Revenue ─────────────────────────────────────────────────────────
  ipcMain.handle('db:other_revenue:get', () => db.prepare('SELECT * FROM other_revenue ORDER BY date DESC').all());
  ipcMain.handle('db:other_revenue:add', (_, r: any) => {
    const id = r.id || crypto.randomUUID();
    db.prepare(`INSERT INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, r.source, r.description, r.amount, r.date, r.paymentMethod || 'cash', r.notes, r.createdAt || new Date().toISOString());
    return db.prepare('SELECT * FROM other_revenue WHERE id = ?').get(id);
  });
  ipcMain.handle('db:other_revenue:delete', (_, id: string) => db.prepare('DELETE FROM other_revenue WHERE id = ?').run(id).changes > 0);

  // ── Wallets ───────────────────────────────────────────────────────────────
  ipcMain.handle('db:wallets:get', () => db.prepare('SELECT * FROM wallets ORDER BY name ASC').all());
  ipcMain.handle('db:wallets:add', (_, w: any) => {
    const id = w.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO wallets (id, name, type, balance, isDefault, icon, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, w.name, w.type || 'cash', w.balance || 0, w.isDefault ? 1 : 0, w.icon || null, w.color, w.notes, w.createdAt || now, now);
    return db.prepare('SELECT * FROM wallets WHERE id = ?').get(id);
  });
  ipcMain.handle('db:wallets:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE wallets SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM wallets WHERE id = ?').get(id);
  });
  ipcMain.handle('db:wallets:delete', (_, id: string) => {
    const deleteWallet = db.transaction(() => {
      db.prepare('DELETE FROM safe_transactions WHERE walletId = ?').run(id);
      return db.prepare('DELETE FROM wallets WHERE id = ?').run(id).changes > 0;
    });
    return deleteWallet();
  });

  // ── Used Devices ──────────────────────────────────────────────────────────
  ipcMain.handle('db:used_devices:get', () => db.prepare('SELECT * FROM used_devices ORDER BY createdAt DESC').all());
  ipcMain.handle('db:used_devices:add', (_, d: any) => {
    const id = d.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO used_devices (
        id, name, model, deviceType, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage,
        ram, description, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(
        id,
        d.name,
        d.model ?? null,
        d.deviceType ?? null,
        d.category ?? d.deviceType ?? null,
        d.condition || 'good',
        d.purchasePrice || 0,
        d.sellingPrice || 0,
        d.status || 'in_stock',
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
        now,
      );
    return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
  });
  ipcMain.handle('db:used_devices:update', (_, id: string, data: any) => {
    const updates = { ...data };
    if (Object.prototype.hasOwnProperty.call(updates, 'deviceType') && !Object.prototype.hasOwnProperty.call(updates, 'category')) {
      updates.category = updates.deviceType;
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'description') && !Object.prototype.hasOwnProperty.call(updates, 'notes')) {
      updates.notes = updates.description;
    }
    const { sets, values } = buildUpdateSql(updates);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE used_devices SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
  });
  ipcMain.handle('db:used_devices:delete', (_, id: string) => db.prepare('DELETE FROM used_devices WHERE id = ?').run(id).changes > 0);

  // ── Reminders ─────────────────────────────────────────────────────────────
  ipcMain.handle('db:reminders:get', () => db.prepare('SELECT * FROM reminders ORDER BY dueDate ASC').all());
  ipcMain.handle('db:reminders:add', (_, r: any) => {
    const id = r.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, r.title, r.description, r.dueDate, r.priority || 'medium', r.completed ? 1 : 0, r.completedAt, r.recurring, r.category, r.createdAt || now, now);
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  });
  ipcMain.handle('db:reminders:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE reminders SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
  });
  ipcMain.handle('db:reminders:delete', (_, id: string) => db.prepare('DELETE FROM reminders WHERE id = ?').run(id).changes > 0);

  // ── Shift Records ─────────────────────────────────────────────────────────
  ipcMain.handle('db:shifts:get', () => db.prepare('SELECT * FROM shift_records ORDER BY openedAt DESC').all());
  ipcMain.handle('db:shifts:getActive', () => db.prepare('SELECT * FROM shift_records WHERE closedAt IS NULL ORDER BY openedAt DESC LIMIT 1').get());
  ipcMain.handle('db:shifts:open', (_, s: any) => {
    const id = s.id || crypto.randomUUID();
    db.prepare(`INSERT INTO shift_records (id, openedAt, openingBalance, openedBy, notes) VALUES (?, ?, ?, ?, ?)`)
      .run(id, s.openedAt || new Date().toISOString(), s.openingBalance || 0, s.openedBy, s.notes);
    return db.prepare('SELECT * FROM shift_records WHERE id = ?').get(id);
  });
  ipcMain.handle('db:shifts:close', (_, id: string, data: any) => {
    db.prepare(`UPDATE shift_records SET closedAt = ?, closingBalance = ?, totalSales = ?, totalExpenses = ?, closedBy = ?, notes = ? WHERE id = ?`)
      .run(data.closedAt || new Date().toISOString(), data.closingBalance || 0, data.totalSales || 0, data.totalExpenses || 0, data.closedBy, data.notes, id);
    return db.prepare('SELECT * FROM shift_records WHERE id = ?').get(id);
  });

  // ── Atomic Checkout Transaction ──────────────────────────────────────────
  ipcMain.handle('db-sync:checkout:process', (_, { sale, stockMovements, auditEntries }) => {
    try {
      db.transaction(() => {
        // 1. Insert Sale
        db.prepare(`
          INSERT INTO sales (
            id, invoiceNumber, date, subtotal, discount, total, 
            totalCost, grossProfit, marginPct, paymentMethod, employee, idempotencyKey
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          sale.id, sale.invoiceNumber, sale.date, sale.subtotal, sale.discount, sale.total,
          sale.totalCost, sale.grossProfit, sale.marginPct, sale.paymentMethod, sale.employeeId || sale.employee, sale.idempotencyKey
        );

        // 2. Insert Sale Items
        const insertSaleItem = db.prepare(`
          INSERT INTO sale_items (
            id, saleId, productId, name, qty, price, cost, lineDiscount, warehouseId, batches
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of sale.items) {
          insertSaleItem.run(
            item.id, sale.id, item.productId, item.name, item.qty, item.price, item.cost, 
            item.lineDiscount || 0, item.warehouseId, JSON.stringify(item.batches || [])
          );
        }

        // 3. Process Stock Movements & Inventory Quantity Updates
        const insertMovement = db.prepare(`
          INSERT INTO stock_movements (
            id, productId, type, quantityChange, previousQuantity, newQuantity, 
            reason, referenceId, userId, timestamp, warehouseId
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        // using atomic UPDATE to prevent TOCTOU race condition
        const updateStock = db.prepare(`
          UPDATE products SET quantity = quantity + ? WHERE id = ?
        `);
        const updateUnifiedStock = db.prepare(`
          UPDATE inventory_items SET quantity = quantity + ? WHERE id = ?
        `);

        for (const mov of stockMovements) {
          insertMovement.run(
            mov.id, mov.productId, mov.type, mov.quantityChange, mov.previousQuantity, mov.newQuantity,
            mov.reason, mov.referenceId, mov.userId, mov.timestamp, mov.warehouseId
          );
          
          // Apply decrement atomically
          updateStock.run(mov.quantityChange, mov.productId);
          
          // Also try to update unified table if it exists
          try {
            updateUnifiedStock.run(mov.quantityChange, mov.productId);
          } catch(e) {
            // ignore if unified table is not set up correctly yet or record doesn't exist
          }
        }

        // 4. Insert Audit Entries
        const insertAudit = db.prepare(`
          INSERT INTO audit_logs (
            id, userId, action, entityType, entityId, beforeStateJson, afterStateJson, machineId, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const entry of auditEntries || []) {
          insertAudit.run(
            entry.id || crypto.randomUUID(),
            entry.userId,
            entry.action,
            entry.entityType,
            entry.entityId,
            entry.beforeStateJson ? JSON.stringify(entry.beforeStateJson) : null,
            entry.afterStateJson ? JSON.stringify(entry.afterStateJson) : null,
            entry.machineId || 'local',
            entry.timestamp || new Date().toISOString()
          );
        }
      })();
      return { success: true };
    } catch (error: any) {
      console.error('[checkout] Transaction failed:', error);
      // Let the frontend know this idempotency key might be a duplicate or there is a negative stock error
      if (error?.message?.includes('UNIQUE constraint failed: sales.idempotencyKey')) {
        return { success: false, error: 'DUPLICATE_TRANSACTION', message: 'This transaction was already completed.' };
      }
      return { success: false, error: 'TRANSACTION_FAILED', message: error.message };
    }
  });

  // ── DB Stats (for diagnostics page) ────────────────────────────────────────
  ipcMain.handle('db:stats', () => {
    const tables = ['products', 'sales', 'customers', 'suppliers', 'employees', 'expenses',
      'installments', 'repair_tickets', 'repair_parts', 'wallets', 'used_devices',
      'reminders', 'blacklist', 'damaged_items', 'other_revenue', 'partners', 'warehouses'];
    const result: Record<string, number> = {};
    for (const t of tables) {
      try {
        const row = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get() as { c: number };
        result[t] = row.c;
      } catch {
        result[t] = -1;
      }
    }
    return result;
  });

  // ── Danger Zone (Factory Reset) ───────────────────────────────────────────
  ipcMain.handle('db:factory-reset', () => {
    try {
      db.transaction(() => {
        const tablesQuery = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
        const tables = tablesQuery.map(row => row.name);

        for (const t of tables) {
          if (t === 'settings' || t === 'users' || t === 'sqlite_sequence' || t === 'sqlite_stat1') {
            continue;
          }
          try {
            db.prepare(`DELETE FROM ${t}`).run();
          } catch { /* ignore */ }
        }
      })();
      return true;
    } catch (e) {
      console.error('Factory reset failed:', e);
      return false;
    }
  });
}
