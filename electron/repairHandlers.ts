import { ipcMain } from 'electron';
import Database from 'better-sqlite3';

type DB = ReturnType<typeof Database>;

export function setupRepairHandlers(db: DB) {

  // ── Repair Tickets ──────────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getTickets', (_, filters: any = {}) => {
    let query = 'SELECT * FROM repair_tickets WHERE 1=1';
    const params: any[] = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.customerId) {
      query += ' AND client_id = ?';
      params.push(filters.customerId);
    }
    if (filters.search) {
      query += ' AND (customer_name LIKE ? OR customer_phone LIKE ? OR ticket_no LIKE ?)';
      const q = `%${filters.search}%`;
      params.push(q, q, q);
    }

    query += ' ORDER BY createdAt DESC';
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('db:repairs:getTicket', (_, id: string) => {
    return db.prepare('SELECT * FROM repair_tickets WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:addTicket', (_, ticket: any) => {
    const id = ticket.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const ticketNo = ticket.ticket_no || `TKT-${Date.now()}`;

    db.prepare(`
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
      ticket.customer_name || 'عميل نقدي',
      ticket.customer_phone || null,
      ticket.device_category || 'mobile',
      ticket.device_brand || ticket.deviceBrand || null,
      ticket.device_model || ticket.deviceModel || null,
      ticket.imei_or_serial || ticket.serial || null,
      ticket.issue_description || ticket.problemDesc || '',
      ticket.accessories_received || ticket.accessories || null,
      ticket.device_passcode || ticket.password || null,
      ticket.status || 'received',
      ticket.package_price ?? ticket.expectedCost ?? null,
      ticket.warranty_days ?? null,
      ticket.assigned_tech_name || ticket.techName || null,
      ticket.tech_bonus_type || null,
      ticket.tech_bonus_value ?? null,
      ticket.createdAt || now,
      ticket.createdBy || null,
      now,
      ticket.updatedBy || null
    );

    return db.prepare('SELECT * FROM repair_tickets WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:updateTicket', (_, id: string, data: any) => {
    const EXCLUDED = ['id', 'createdAt', 'createdBy', 'ticket_no'];
    const sets: string[] = [];
    const values: any[] = [];

    for (const [key, val] of Object.entries(data)) {
      if (!EXCLUDED.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val === undefined ? null : val);
      }
    }
    if (sets.length === 0) return db.prepare('SELECT * FROM repair_tickets WHERE id = ?').get(id);

    sets.push('updatedAt = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE repair_tickets SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM repair_tickets WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:deleteTicket', (_, id: string) => {
    // CASCADE FK handles related rows, but we delete explicitly as a safety measure
    db.prepare('DELETE FROM repair_ticket_parts WHERE ticket_id = ?').run(id);
    db.prepare('DELETE FROM repair_events WHERE ticket_id = ?').run(id);
    db.prepare('DELETE FROM repair_payments WHERE ticket_id = ?').run(id);
    db.prepare('DELETE FROM repair_status_history WHERE ticket_id = ?').run(id);
    return db.prepare('DELETE FROM repair_tickets WHERE id = ?').run(id).changes > 0;
  });

  // ── Repair Status History ────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getHistory', (_, ticketId: string) => {
    return db.prepare('SELECT * FROM repair_status_history WHERE ticket_id = ? ORDER BY createdAt DESC').all(ticketId);
  });

  ipcMain.handle('db:repairs:addHistory', (_, entry: any) => {
    const id = entry.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO repair_status_history (id, ticket_id, from_status, to_status, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, entry.ticket_id, entry.from_status || null, entry.to_status, entry.note || null, now, entry.createdBy || null);
    return db.prepare('SELECT * FROM repair_status_history WHERE id = ?').get(id);
  });

  // ── Repair Events ────────────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getEvents', (_, ticketId: string) => {
    return db.prepare('SELECT * FROM repair_events WHERE ticket_id = ? ORDER BY createdAt DESC').all(ticketId);
  });

  ipcMain.handle('db:repairs:addEvent', (_, event: any) => {
    const id = event.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO repair_events (id, ticket_id, event_type, from_status, to_status, note, createdBy, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, event.ticket_id, event.event_type,
      event.from_status || event.old_status || null,
      event.to_status || event.new_status || null,
      event.note || event.notes || null,
      event.createdBy || event.user_name || null,
      now
    );
    return db.prepare('SELECT * FROM repair_events WHERE id = ?').get(id);
  });

  // ── Repair Payments ──────────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getPayments', (_, ticketId: string) => {
    return db.prepare('SELECT * FROM repair_payments WHERE ticket_id = ? ORDER BY createdAt DESC').all(ticketId);
  });

  ipcMain.handle('db:repairs:addPayment', (_, payment: any) => {
    const id = payment.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO repair_payments (id, ticket_id, kind, amount, wallet_type, note, createdAt, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, payment.ticket_id, payment.kind || 'deposit',
      payment.amount, payment.wallet_type || 'cash',
      payment.note || null, now, payment.createdBy || null
    );
    return db.prepare('SELECT * FROM repair_payments WHERE id = ?').get(id);
  });

  // ── Repair Parts Inventory ───────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getParts', () => {
    return db.prepare('SELECT * FROM repair_parts ORDER BY name ASC').all();
  });

  ipcMain.handle('db:repairs:getPart', (_, id: string) => {
    return db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:addPart', (_, part: any) => {
    const id = part.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
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
    return db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:updatePart', (_, id: string, data: any) => {
    const EXCLUDED = ['id', 'createdAt'];
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (!EXCLUDED.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(id);
    values.push(id);
    db.prepare(`UPDATE repair_parts SET ${sets.join(', ')} WHERE id = ?`).run(...values);
    return db.prepare('SELECT * FROM repair_parts WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:deletePart', (_, id: string) => {
    return db.prepare('DELETE FROM repair_parts WHERE id = ?').run(id).changes > 0;
  });

  // ── Ticket → Parts (used parts per ticket) ──────────────────────────────────

  ipcMain.handle('db:repairs:getTicketParts', (_, ticketId: string) => {
    return db.prepare(`
      SELECT tp.*, rp.name as partName FROM repair_ticket_parts tp
      LEFT JOIN repair_parts rp ON tp.part_id = rp.id
      WHERE tp.ticket_id = ?
    `).all(ticketId);
  });

  ipcMain.handle('db:repairs:addTicketPart', (_, tpart: any) => {
    const id = tpart.id || crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO repair_ticket_parts (id, ticket_id, part_id, qty, unit_cost, status, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, tpart.ticket_id, tpart.part_id,
      tpart.qty || tpart.quantity || 1,
      tpart.unit_cost || tpart.cost_price || 0,
      tpart.status || 'used',
      now, now
    );

    // Decrease stock from repair_parts
    db.prepare('UPDATE repair_parts SET qty = MAX(0, qty - ?) WHERE id = ?').run(
      tpart.qty || tpart.quantity || 1,
      tpart.part_id
    );

    // Log movement
    db.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, 'usage', ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(), tpart.part_id, tpart.ticket_id,
      tpart.qty || 1, tpart.unit_cost || 0,
      `استخدام في تذكرة ${tpart.ticket_id}`, now
    );

    return db.prepare('SELECT * FROM repair_ticket_parts WHERE id = ?').get(id);
  });

  ipcMain.handle('db:repairs:removeTicketPart', (_, id: string) => {
    const tpart = db.prepare('SELECT * FROM repair_ticket_parts WHERE id = ?').get(id) as any;
    if (tpart) {
      // Restore stock
      db.prepare('UPDATE repair_parts SET qty = qty + ? WHERE id = ?').run(tpart.qty, tpart.part_id);
    }
    return db.prepare('DELETE FROM repair_ticket_parts WHERE id = ?').run(id).changes > 0;
  });

  // ── Repair Invoices ──────────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getInvoices', (_, ticketId?: string) => {
    if (ticketId) return db.prepare('SELECT * FROM repair_invoices WHERE ticket_id = ? ORDER BY createdAt DESC').all(ticketId);
    return db.prepare('SELECT * FROM repair_invoices ORDER BY createdAt DESC').all();
  });

  ipcMain.handle('db:repairs:addInvoice', (_, invoice: any) => {
    const id = invoice.id || crypto.randomUUID();
    const now = new Date().toISOString();
    const invoiceNo = invoice.invoice_no || `INV-${Date.now()}`;

    db.prepare(`
      INSERT INTO repair_invoices (id, invoice_no, ticket_id, createdAt, deliveredAt,
        subtotal_labor, subtotal_parts, discount, tax, total, paid_total, remaining,
        payment_summary_json, createdBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, invoiceNo, invoice.ticket_id, now,
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

    // Insert invoice items if provided
    if (Array.isArray(invoice.items)) {
      for (const item of invoice.items) {
        db.prepare(`
          INSERT INTO repair_invoice_items (id, invoice_id, type, ref_id, name, qty, unit_price, line_total)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(), id,
          item.type, item.ref_id || null, item.name,
          item.qty || 1, item.unit_price || 0,
          (item.qty || 1) * (item.unit_price || 0)
        );
      }
    }

    return db.prepare('SELECT * FROM repair_invoices WHERE id = ?').get(id);
  });

  // ── Parts Movements Log ───────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:getPartMovements', (_, partId: string) => {
    return db.prepare('SELECT * FROM repair_parts_movements WHERE part_id = ? ORDER BY createdAt DESC').all(partId);
  });

  ipcMain.handle('db:repairs:addPartMovement', (_, movement: any) => {
    const id = movement.id || crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO repair_parts_movements (id, part_id, ticket_id, type, qty, unit_cost, note, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, movement.part_id, movement.ticket_id || null,
      movement.type, movement.qty, movement.unit_cost || 0,
      movement.note || null, now
    );

    // Update stock based on movement type
    const delta = ['purchase', 'return', 'adjustment_add'].includes(movement.type) ? movement.qty : -movement.qty;
    db.prepare('UPDATE repair_parts SET qty = MAX(0, qty + ?) WHERE id = ?').run(delta, movement.part_id);

    return db.prepare('SELECT * FROM repair_parts_movements WHERE id = ?').get(id);
  });

  // ── Dashboard Stats ───────────────────────────────────────────────────────────

  ipcMain.handle('db:repairs:stats', () => {
    const statuses = ['received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered', 'cancelled'];
    const result: Record<string, number> = {};
    for (const s of statuses) {
      const row = db.prepare('SELECT COUNT(*) as c FROM repair_tickets WHERE status = ?').get(s) as { c: number };
      result[s] = row.c;
    }
    const overdue = db.prepare("SELECT COUNT(*) as c FROM repair_tickets WHERE status NOT IN ('delivered','cancelled')").get() as { c: number };
    result['active'] = overdue.c;
    return result;
  });
}
