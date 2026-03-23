import Database from 'better-sqlite3';

type DB = ReturnType<typeof Database>;

// ─── Helpers ──────────────────────────────────────────────
function getSettingsJson(db: DB, key: string): any[] | null {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    if (!row) return null;
    try { return JSON.parse(row.value); } catch { return null; }
}

function tableIsEmpty(db: DB, table: string): boolean {
    const row = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
    return row.c === 0;
}

// ─── Main Migration ──────────────────────────────────────
export function runDataMigration(db: DB) {
    console.log('[migration] Running data migration check...');
    try {
        migratePartners(db);
        migrateAccessories(db);
        migrateCustomers(db);
        migrateSuppliers(db);
        migrateEmployees(db);
        migrateExpenses(db);
        migrateBlacklist(db);
        migrateDamagedItems(db);
        migrateOtherRevenue(db);
        migrateWallets(db);
        migrateUsedDevices(db);
        migrateReminders(db);
        migrateRepairs(db);
        migrateRepairParts(db);
        console.log('[migration] All migrations complete.');
    } catch (err) {
        console.error('[migration] Error:', err);
    }
}

// ─── Individual Migrations ────────────────────────────────

function migratePartners(db: DB) {
    if (!tableIsEmpty(db, 'partners')) return;
    const data = getSettingsJson(db, 'gx_partners');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO partners (id, name, phone, address, partnershipType, sharePercent, 
            profitShareDevices, profitShareAccessories, capitalAmount, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const p of data) {
            stmt.run(p.id, p.name, p.phone || null, p.address || null, p.partnershipType || 'other',
                p.sharePercent || 0, p.profitShareDevices || 0, p.profitShareAccessories || 0,
                p.capitalAmount || 0, p.active ? 1 : 0, p.notes || null,
                p.createdAt || new Date().toISOString(), p.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Partners: ${data.length} records migrated.`);
}

function migrateAccessories(db: DB) {
    if (!tableIsEmpty(db, 'accessories')) return;
    const keysToMigrate = [
        { key: 'gx_mobile_accessories', type: 'mobile_accessory' },
        { key: 'gx_mobile_spare_parts', type: 'mobile_spare_part' },
        { key: 'gx_computer_accessories_sa', type: 'computer_accessory' },
        { key: 'gx_computer_spare_parts', type: 'computer_spare_part' },
        { key: 'gx_device_accessories_sa', type: 'device_accessory' },
        { key: 'gx_device_spare_parts', type: 'device_spare_part' }
    ];
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO accessories (id, inventoryType, name, category, subcategory, model, 
            barcode, quantity, costPrice, salePrice, minStock, condition, supplier, color, notes, image, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const km of keysToMigrate) {
            const items = getSettingsJson(db, km.key);
            if (!items?.length) continue;
            for (const item of items) {
                stmt.run(item.id, km.type, item.name, item.category || null, null, item.model || null,
                    item.barcode || null, item.quantity || 0,
                    item.newCostPrice || item.costPrice || item.oldCostPrice || 0,
                    item.salePrice || 0, item.minStock || 0, item.condition || 'new',
                    item.supplier || null, item.color || null, item.notes || null,
                    item.image || null,
                    item.createdAt || new Date().toISOString(), item.updatedAt || new Date().toISOString());
            }
            console.log(`[migration] Accessories (${km.type}): migrated ${items.length} records.`);
        }
    })();
}

function migrateCustomers(db: DB) {
    if (!tableIsEmpty(db, 'customers')) return;
    const data = getSettingsJson(db, 'gx_customers') || getSettingsJson(db, 'retail_customers');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO customers (id, name, phone, email, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const c of data) {
            stmt.run(c.id, c.name, c.phone || null, c.email || null, c.address || null,
                c.nationalId || null, c.notes || null, c.totalPurchases || 0, c.balance || 0,
                c.createdAt || new Date().toISOString(), c.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Customers: ${data.length} records migrated.`);
}

function migrateSuppliers(db: DB) {
    if (!tableIsEmpty(db, 'suppliers')) return;
    const data = getSettingsJson(db, 'gx_suppliers') || getSettingsJson(db, 'retail_suppliers');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO suppliers (id, name, phone, email, address, category, balance, notes, active, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const s of data) {
            stmt.run(s.id, s.name, s.phone || null, s.email || null, s.address || null,
                s.category || null, s.balance || 0, s.notes || null, s.active ?? 1,
                s.createdAt || new Date().toISOString(), s.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Suppliers: ${data.length} records migrated.`);
}

function migrateEmployees(db: DB) {
    if (!tableIsEmpty(db, 'employees')) return;
    const data = getSettingsJson(db, 'gx_employees') || getSettingsJson(db, 'retail_employees');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO employees (id, name, phone, role, salary, commissionRate, hireDate, active, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const e of data) {
            stmt.run(e.id, e.name, e.phone || null, e.role || null, e.salary || 0,
                e.commissionRate || 0, e.hireDate || null, e.active ?? 1, e.notes || null,
                e.createdAt || new Date().toISOString(), e.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Employees: ${data.length} records migrated.`);
}

function migrateExpenses(db: DB) {
    if (!tableIsEmpty(db, 'expenses')) return;
    const data = getSettingsJson(db, 'gx_expenses') || getSettingsJson(db, 'retail_expenses');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO expenses (id, category, description, amount, date, paymentMethod, employee, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const e of data) {
            stmt.run(e.id, e.category, e.description || null, e.amount, e.date,
                e.paymentMethod || 'cash', e.employee || null, e.notes || null,
                e.createdAt || new Date().toISOString(), e.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Expenses: ${data.length} records migrated.`);
}

function migrateBlacklist(db: DB) {
    if (!tableIsEmpty(db, 'blacklist')) return;
    const data = getSettingsJson(db, 'gx_blacklist') || getSettingsJson(db, 'retail_blacklist');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO blacklist (id, name, phone, nationalId, reason, notes, addedBy, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const b of data) {
            stmt.run(b.id, b.name, b.phone || null, b.nationalId || null, b.reason, b.notes || null,
                b.addedBy || null, b.createdAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Blacklist: ${data.length} records migrated.`);
}

function migrateDamagedItems(db: DB) {
    if (!tableIsEmpty(db, 'damaged_items')) return;
    const data = getSettingsJson(db, 'gx_damaged') || getSettingsJson(db, 'retail_damaged');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO damaged_items (id, productName, productId, inventoryType, quantity, reason, estimatedLoss, reportedBy, date, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const d of data) {
            stmt.run(d.id, d.productName || d.name, d.productId || null, d.inventoryType || null,
                d.quantity || 1, d.reason || null, d.estimatedLoss || d.value || 0,
                d.reportedBy || null, d.date, d.notes || null, d.createdAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Damaged items: ${data.length} records migrated.`);
}

function migrateOtherRevenue(db: DB) {
    if (!tableIsEmpty(db, 'other_revenue')) return;
    const data = getSettingsJson(db, 'gx_other_revenue') || getSettingsJson(db, 'retail_other_revenue');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO other_revenue (id, source, description, amount, date, paymentMethod, notes, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const r of data) {
            stmt.run(r.id, r.source || r.category, r.description || null, r.amount, r.date,
                r.paymentMethod || 'cash', r.notes || null, r.createdAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Other revenue: ${data.length} records migrated.`);
}

function migrateWallets(db: DB) {
    if (!tableIsEmpty(db, 'wallets')) return;
    const data = getSettingsJson(db, 'gx_wallets') || getSettingsJson(db, 'retail_wallets');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO wallets (id, name, type, balance, isDefault, color, notes, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const w of data) {
            stmt.run(w.id, w.name, w.type || 'cash', w.balance || 0, w.isDefault ? 1 : 0,
                w.color || null, w.notes || null,
                w.createdAt || new Date().toISOString(), w.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Wallets: ${data.length} records migrated.`);
}

function migrateUsedDevices(db: DB) {
    if (!tableIsEmpty(db, 'used_devices')) return;
    const data = getSettingsJson(db, 'gx_used_inventory') || getSettingsJson(db, 'retail_used_inventory');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO used_devices (id, name, category, condition, purchasePrice, sellingPrice, status, serialNumber, color, storage, notes, image, soldAt, purchasedFrom, soldTo, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const u of data) {
            stmt.run(u.id, u.name, u.category || null, u.condition || 'good',
                u.purchasePrice || u.buyPrice || 0, u.sellingPrice || u.salePrice || 0,
                u.status || 'in_stock', u.serialNumber || null, u.color || null, u.storage || null,
                u.notes || null, u.image || null, u.soldAt || null, u.purchasedFrom || null, u.soldTo || null,
                u.createdAt || new Date().toISOString(), u.updatedAt || new Date().toISOString());
        }
    })();
    console.log(`[migration] Used devices: ${data.length} records migrated.`);
}

function migrateReminders(db: DB) {
    if (!tableIsEmpty(db, 'reminders')) return;
    const data = getSettingsJson(db, 'gx_reminders') || getSettingsJson(db, 'retail_reminders');
    if (!data?.length) return;
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO reminders (id, title, description, dueDate, priority, completed, completedAt, recurring, category, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const r of data) {
            stmt.run(r.id, r.title, r.description || null, r.dueDate, r.priority || 'medium',
                r.completed ? 1 : 0, r.completedAt || null, r.recurring || null, r.category || null,
                r.createdAt || new Date().toISOString(), r.updatedAt || new Date().toISOString());
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
            issue_description, status, package_price, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
        for (const r of data) {
            const status = ['received', 'diagnosing', 'repairing', 'ready', 'delivered', 'cancelled'].includes(r.status) ? r.status : 
                           r.status === 'done' ? 'delivered' : 
                           r.status === 'in_progress' ? 'repairing' : 'received';
            stmt.run(
                r.id, r.orderNumber || r.ticket_no || `TKT-${Math.random().toString(36).slice(2, 7)}`,
                r.customerName || r.customer_name, r.customerPhone || r.customer_phone || null,
                r.deviceCategory || r.device_category || 'other', r.deviceName || r.device_model || 'Unknown',
                r.issueDescription || r.issue_description || r.problem_desc || '',
                status, r.totalSale || r.package_price || 0,
                r.createdAt || r.created_at || new Date().toISOString(),
                r.updatedAt || r.updated_at || new Date().toISOString()
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
                p.id, p.name, p.category || null, p.sku || p.part_no || null,
                p.unit_cost || p.cost_price || 0, p.selling_price || 0,
                p.qty || p.current_stock || 0, p.min_qty || p.min_stock || 0,
                p.active ?? 1, p.createdAt || p.created_at || new Date().toISOString()
            );
        }
    })();
    console.log(`[migration] Repair Parts: ${data.length} records migrated.`);
}
