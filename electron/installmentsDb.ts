import Database from 'better-sqlite3';

type DB = ReturnType<typeof Database>;
type UnknownRecord = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(Math.max(0, parsed) * 100) / 100;
}

function asInteger(value: unknown, fallback = 0, minimum = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(minimum, fallback);
  return Math.max(minimum, Math.round(parsed));
}

function asText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableText(value: unknown): string | null {
  const text = asText(value).trim();
  return text ? text : null;
}

function asBooleanInt(value: unknown): number {
  return value ? 1 : 0;
}

function normalizeStatus(value: unknown): 'active' | 'completed' | 'overdue' | 'cancelled' {
  if (value === 'completed' || value === 'overdue' || value === 'cancelled') return value;
  return 'active';
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

function serializeJson(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return JSON.stringify(value);
}

function ensureCustomerRecord(db: DB, contract: UnknownRecord): string | null {
  const explicitCustomerId = asNullableText(contract.customerId);
  if (explicitCustomerId) {
    const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(explicitCustomerId) as { id: string } | undefined;
    if (existing) return existing.id;
  }

  const customerName = asText(contract.customerName).trim();
  if (!customerName) return null;

  const customerPhone = asNullableText(contract.customerPhone);
  const customerAddress = asNullableText(contract.customerAddress);
  const customerNationalId = asNullableText(contract.customerIdCard);

  const byPhone = customerPhone
    ? (db.prepare('SELECT id FROM customers WHERE phone = ? LIMIT 1').get(customerPhone) as { id: string } | undefined)
    : undefined;
  if (byPhone) {
    db.prepare(`
      UPDATE customers
      SET name = ?, address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(customerName, customerAddress, customerNationalId, new Date().toISOString(), byPhone.id);
    return byPhone.id;
  }

  const byName = db.prepare('SELECT id FROM customers WHERE name = ? LIMIT 1').get(customerName) as { id: string } | undefined;
  if (byName) {
    db.prepare(`
      UPDATE customers
      SET phone = COALESCE(?, phone), address = COALESCE(?, address), nationalId = COALESCE(?, nationalId), updatedAt = ?
      WHERE id = ?
    `).run(customerPhone, customerAddress, customerNationalId, new Date().toISOString(), byName.id);
    return byName.id;
  }

  const id = explicitCustomerId || crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO customers (id, name, phone, address, nationalId, notes, totalPurchases, balance, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
  `).run(id, customerName, customerPhone, customerAddress, customerNationalId, 'Auto-created from installment contract', now, now);

  return id;
}

function ensureProductRecord(db: DB, contract: UnknownRecord): string | null {
  const productId = asNullableText(contract.productId);
  if (!productId) return null;

  const existing = db.prepare('SELECT id FROM products WHERE id = ?').get(productId) as { id: string } | undefined;
  if (existing) return existing.id;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO products (
      id, name, barcode, category, condition, quantity,
      oldCostPrice, newCostPrice, salePrice, supplier, source,
      notes, createdAt, updatedAt, deletedAt
    ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?, ?, NULL)
  `).run(
    productId,
    asText(contract.productName, 'Installment Product'),
    productId,
    asNullableText(contract.contractType) || 'installment',
    'new',
    asNumber(contract.installmentPrice),
    'installment_snapshot',
    'Auto-created from installment contract',
    now,
    now,
  );

  return productId;
}

function hydrateSchedules(db: DB) {
  const rows = db.prepare(`
    SELECT id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    FROM installment_schedules
    ORDER BY contractId ASC, monthNumber ASC, dueDate ASC
  `).all() as Array<{
    id: string;
    contractId: string;
    monthNumber: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    penalty: number;
    paid: number;
    remainingAfter: number | null;
    note: string | null;
  }>;

  const grouped = new Map<string, UnknownRecord[]>();
  for (const row of rows) {
    const items = grouped.get(row.contractId) || [];
    items.push({
      id: row.id,
      month: row.monthNumber,
      dueDate: row.dueDate,
      amount: asNumber(row.amount),
      paidAmount: asNumber(row.paidAmount),
      penalty: asNumber(row.penalty),
      paid: Boolean(row.paid),
      remainingAfter: row.remainingAfter === null ? undefined : asNumber(row.remainingAfter),
      note: row.note || '',
    });
    grouped.set(row.contractId, items);
  }

  return grouped;
}

function hydratePayments(db: DB) {
  const allocations = db.prepare(`
    SELECT paymentId, scheduleItemId, amount
    FROM installment_payment_allocations
    ORDER BY paymentId ASC
  `).all() as Array<{ paymentId: string; scheduleItemId: string; amount: number }>;

  const allocationsByPayment = new Map<string, Array<{ scheduleItemId: string; amount: number }>>();
  for (const allocation of allocations) {
    const items = allocationsByPayment.get(allocation.paymentId) || [];
    items.push({
      scheduleItemId: allocation.scheduleItemId,
      amount: asNumber(allocation.amount),
    });
    allocationsByPayment.set(allocation.paymentId, items);
  }

  const paymentRows = db.prepare(`
    SELECT id, contractId, amount, date, note, createdAt
    FROM installment_payments
    ORDER BY contractId ASC, date ASC, createdAt ASC
  `).all() as Array<{
    id: string;
    contractId: string;
    amount: number;
    date: string;
    note: string | null;
    createdAt: string;
  }>;

  const grouped = new Map<string, UnknownRecord[]>();
  for (const row of paymentRows) {
    const items = grouped.get(row.contractId) || [];
    items.push({
      id: row.id,
      amount: asNumber(row.amount),
      date: row.date,
      note: row.note || '',
      allocations: allocationsByPayment.get(row.id) || [],
    });
    grouped.set(row.contractId, items);
  }

  return grouped;
}

export function readInstallmentContracts(db: DB): UnknownRecord[] {
  const schedulesByContract = hydrateSchedules(db);
  const paymentsByContract = hydratePayments(db);

  const rows = db.prepare(`
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
  `).all() as Array<UnknownRecord>;

  return rows.map((row) => ({
    id: row.id,
    contractNumber: row.contractNumber,
    contractType: row.contractType || 'product',
    customerId: row.customerId || undefined,
    customerName: row.customerName,
    customerIdCard: row.customerIdCard || '',
    guarantorName: row.guarantorName || '',
    guarantorIdCard: row.guarantorIdCard || '',
    guarantorPhone: row.guarantorPhone || '',
    guarantorAddress: row.guarantorAddress || '',
    customerPhone: row.customerPhone || '',
    customerAddress: row.customerAddress || '',
    productName: row.productName,
    productId: row.productId || undefined,
    transferType: row.transferType || undefined,
    cashPrice: asNumber(row.cashPrice),
    installmentPrice: asNumber(row.installmentPrice),
    downPayment: asNumber(row.downPayment),
    months: asInteger(row.months, 1, 1),
    monthlyInstallment: asNumber(row.monthlyInstallment),
    firstInstallmentDate: asText(row.firstInstallmentDate),
    schedule: schedulesByContract.get(asText(row.id)) || [],
    payments: paymentsByContract.get(asText(row.id)) || [],
    paidTotal: asNumber(row.paidTotal),
    remaining: asNumber(row.remaining),
    notes: row.notes || '',
    customFields: parseJsonArray(row.customFieldsJson),
    status: normalizeStatus(row.status),
    settledEarly: Boolean(row.settledEarly),
    settlementDiscount: asNumber(row.settlementDiscount),
    createdAt: asText(row.createdAt, new Date().toISOString()),
    updatedAt: asText(row.updatedAt, asText(row.createdAt, new Date().toISOString())),
  }));
}

export function replaceInstallmentContracts(db: DB, contracts: UnknownRecord[]): UnknownRecord[] {
  const insertContract = db.prepare(`
    INSERT INTO installments (
      id, contractNumber, contractType, customerId, customerName, customerPhone, customerAddress,
      customerIdCard, guarantorName, guarantorIdCard, guarantorPhone, guarantorAddress,
      productId, productName, transferType, cashPrice, installmentPrice, downPayment,
      months, monthlyInstallment, paidTotal, remaining, firstInstallmentDate, notes,
      customFieldsJson, status, settledEarly, settlementDiscount, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSchedule = db.prepare(`
    INSERT INTO installment_schedules (
      id, contractId, monthNumber, dueDate, amount, paidAmount, penalty, paid, remainingAfter, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPayment = db.prepare(`
    INSERT INTO installment_payments (id, contractId, amount, date, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertAllocation = db.prepare(`
    INSERT INTO installment_payment_allocations (id, paymentId, scheduleItemId, amount)
    VALUES (?, ?, ?, ?)
  `);

  const now = new Date().toISOString();

  db.transaction((records: UnknownRecord[]) => {
    db.prepare('DELETE FROM installment_payment_allocations').run();
    db.prepare('DELETE FROM installment_payments').run();
    db.prepare('DELETE FROM installment_schedules').run();
    db.prepare('DELETE FROM installments').run();

    for (const contract of records) {
      const contractId = asText(contract.id, crypto.randomUUID());
      const customerId = ensureCustomerRecord(db, contract);
      const productId = ensureProductRecord(db, contract);
      const schedule = Array.isArray(contract.schedule) ? (contract.schedule as UnknownRecord[]) : [];
      const payments = Array.isArray(contract.payments) ? (contract.payments as UnknownRecord[]) : [];
      const createdAt = asText(contract.createdAt, now);
      const updatedAt = asText(contract.updatedAt, createdAt);

      insertContract.run(
        contractId,
        asText(contract.contractNumber, `INS-${Date.now()}`),
        asText(contract.contractType, 'product'),
        customerId,
        asText(contract.customerName),
        asNullableText(contract.customerPhone),
        asNullableText(contract.customerAddress),
        asNullableText(contract.customerIdCard),
        asNullableText(contract.guarantorName),
        asNullableText(contract.guarantorIdCard),
        asNullableText(contract.guarantorPhone),
        asNullableText(contract.guarantorAddress),
        productId,
        asText(contract.productName),
        asNullableText(contract.transferType),
        asNumber(contract.cashPrice),
        asNumber(contract.installmentPrice),
        asNumber(contract.downPayment),
        asInteger(contract.months, schedule.length || 1, 1),
        asNumber(contract.monthlyInstallment),
        asNumber(contract.paidTotal),
        asNumber(contract.remaining),
        asNullableText(contract.firstInstallmentDate),
        asNullableText(contract.notes),
        serializeJson(contract.customFields),
        normalizeStatus(contract.status),
        asBooleanInt(contract.settledEarly),
        asNumber(contract.settlementDiscount),
        createdAt,
        updatedAt,
      );

      schedule
        .slice()
        .sort((left, right) => asInteger(left.month, 0, 0) - asInteger(right.month, 0, 0) || asText(left.dueDate).localeCompare(asText(right.dueDate)))
        .forEach((item, index) => {
          const scheduleItemId = asText(item.id, crypto.randomUUID());
          insertSchedule.run(
            scheduleItemId,
            contractId,
            asInteger(item.month, index + 1, 1),
            asText(item.dueDate),
            asNumber(item.amount),
            asNumber(item.paidAmount),
            asNumber(item.penalty),
            asBooleanInt(item.paid),
            item.remainingAfter === undefined ? null : asNumber(item.remainingAfter),
            asNullableText(item.note),
          );
        });

      for (const payment of payments) {
        const paymentId = asText(payment.id, crypto.randomUUID());
        insertPayment.run(
          paymentId,
          contractId,
          asNumber(payment.amount),
          asText(payment.date, createdAt.slice(0, 10)),
          asNullableText(payment.note),
          createdAt,
        );

        const allocations = Array.isArray(payment.allocations) ? (payment.allocations as UnknownRecord[]) : [];
        for (const allocation of allocations) {
          const scheduleItemId = asNullableText(allocation.scheduleItemId);
          if (!scheduleItemId) continue;

          insertAllocation.run(
            crypto.randomUUID(),
            paymentId,
            scheduleItemId,
            asNumber(allocation.amount),
          );
        }
      }
    }
  })(contracts);

  return readInstallmentContracts(db);
}
