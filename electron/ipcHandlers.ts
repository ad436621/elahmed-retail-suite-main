import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

export function setupIpcHandlers(db: ReturnType<typeof Database>) {
  // --- Partners ---
  ipcMain.handle('db:partners:get', () => {
    return db.prepare('SELECT * FROM partners ORDER BY createdAt DESC').all();
  });

  ipcMain.handle('db:partners:add', (_, partner: any) => {
    const stmt = db.prepare(`
      INSERT INTO partners (id, name, phone, address, partnershipType, sharePercent, profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const id = partner.id || crypto.randomUUID();
    const now = new Date().toISOString();
    stmt.run(
      id, partner.name, partner.phone, partner.address, partner.partnershipType,
      partner.sharePercent || 0, partner.profitShareDevices || 0, partner.profitShareAccessories || 0,
      partner.capitalAmount || 0, partner.active ? 1 : 0, partner.notes, partner.createdAt || now, now
    );
    return db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
  });

  ipcMain.handle('db:partners:update', (_, id: string, data: any) => {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (key !== 'id' && key !== 'createdAt') {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return true;
    sets.push(`updatedAt = ?`);
    values.push(new Date().toISOString());
    values.push(id);

    const stmt = db.prepare(`UPDATE partners SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
    return db.prepare('SELECT * FROM partners WHERE id = ?').get(id);
  });

  ipcMain.handle('db:partners:delete', (_, id: string) => {
    return db.prepare('DELETE FROM partners WHERE id = ?').run(id).changes > 0;
  });

  // --- Partner Transactions ---
  ipcMain.handle('db:partner_transactions:get', (_, partnerId: string) => {
    return db.prepare('SELECT * FROM partner_transactions WHERE partnerId = ? ORDER BY createdAt DESC').all(partnerId);
  });

  ipcMain.handle('db:partner_transactions:add', (_, trx: any) => {
    const id = trx.id || crypto.randomUUID();
    const now = trx.createdAt || new Date().toISOString();
    db.prepare(`
      INSERT INTO partner_transactions (id, partnerId, type, amount, description, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, trx.partnerId, trx.type, trx.amount, trx.description, now);
    return db.prepare('SELECT * FROM partner_transactions WHERE id = ?').get(id);
  });

  // --- Warehouses ---
  ipcMain.handle('db:warehouses:get', () => {
    return db.prepare('SELECT * FROM warehouses ORDER BY name ASC').all();
  });

  ipcMain.handle('db:warehouses:add', (_, warehouse: any) => {
    const stmt = db.prepare(`
      INSERT INTO warehouses (id, name, location, isDefault, notes)
      VALUES (?, ?, ?, ?, ?)
    `);
    const id = warehouse.id || crypto.randomUUID();
    stmt.run(id, warehouse.name, warehouse.location, warehouse.isDefault ? 1 : 0, warehouse.notes);
    return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  });

  ipcMain.handle('db:warehouses:update', (_, id: string, data: any) => {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (key !== 'id') {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return true;
    values.push(id);

    db.prepare(`UPDATE warehouses SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM warehouses WHERE id = ?').get(id);
  });

  ipcMain.handle('db:warehouses:delete', (_, id: string) => {
    return db.prepare('DELETE FROM warehouses WHERE id = ?').run(id).changes > 0;
  });

  // --- Safe Transactions ---
  ipcMain.handle('db:safe_transactions:get', () => {
    return db.prepare('SELECT * FROM safe_transactions ORDER BY createdAt DESC').all();
  });

  ipcMain.handle('db:safe_transactions:add', (_, trx: any) => {
    const id = trx.id || crypto.randomUUID();
    const now = trx.createdAt || new Date().toISOString();
    db.prepare(`
      INSERT INTO safe_transactions (id, walletId, type, subType, amount, category, description, paymentMethod, affectsCapital, affectsProfit, createdBy, relatedId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, trx.walletId, trx.type, trx.subType, trx.amount, trx.category, trx.description,
      trx.paymentMethod, trx.affectsCapital ? 1 : 0, trx.affectsProfit ? 1 : 0, trx.createdBy, trx.relatedId, now
    );
    return db.prepare('SELECT * FROM safe_transactions WHERE id = ?').get(id);
  });
}
