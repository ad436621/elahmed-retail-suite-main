import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

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

// ─── Setup All Handlers ───────────────────────────────────────────────────────

export function setupIpcHandlers(db: DB) {

  // ── Partners ─────────────────────────────────────────────────────────────
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
    db.prepare(`INSERT INTO wallets (id, name, type, balance, isDefault, color, notes, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, w.name, w.type || 'cash', w.balance || 0, w.isDefault ? 1 : 0, w.color, w.notes, w.createdAt || now, now);
    return db.prepare('SELECT * FROM wallets WHERE id = ?').get(id);
  });
  ipcMain.handle('db:wallets:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
    if (!sets.length) return true;
    sets.push('updatedAt = ?'); values.push(new Date().toISOString()); values.push(id);
    db.prepare(`UPDATE wallets SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM wallets WHERE id = ?').get(id);
  });
  ipcMain.handle('db:wallets:delete', (_, id: string) => db.prepare('DELETE FROM wallets WHERE id = ?').run(id).changes > 0);

  // ── Used Devices ──────────────────────────────────────────────────────────
  ipcMain.handle('db:used_devices:get', () => db.prepare('SELECT * FROM used_devices ORDER BY createdAt DESC').all());
  ipcMain.handle('db:used_devices:add', (_, d: any) => {
    const id = d.id || crypto.randomUUID(); const now = new Date().toISOString();
    db.prepare(`INSERT INTO used_devices (id, name, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, d.name, d.category, d.condition || 'good', d.purchasePrice || 0, d.sellingPrice || 0, d.status || 'in_stock', d.serialNumber, d.color, d.storage, d.notes, d.image, d.soldAt, d.purchasedFrom, d.soldTo, d.createdAt || now, now);
    return db.prepare('SELECT * FROM used_devices WHERE id = ?').get(id);
  });
  ipcMain.handle('db:used_devices:update', (_, id: string, data: any) => {
    const { sets, values } = buildUpdateSql(data);
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
}
