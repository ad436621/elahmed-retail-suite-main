// ============================================================
// ELAHMED RETAIL OS — Audit Domain Logic
// Immutable audit log creation — logs CANNOT be deleted
// ============================================================

import { AuditAction, AuditEntry } from './types';
import { STORAGE_KEYS } from '@/config';

let machineId: string | null = null;

function getMachineId(): string {
  if (!machineId) {
    machineId = localStorage.getItem(STORAGE_KEYS.MACHINE_ID);
    if (!machineId) {
      machineId = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEYS.MACHINE_ID, machineId);
    }
  }
  return machineId;
}

/** Create an immutable audit log entry */
export function createAuditEntry(
  userId: string,
  action: AuditAction,
  entityType: string,
  entityId: string,
  beforeState: Record<string, unknown> | null = null,
  afterState: Record<string, unknown> | null = null
): AuditEntry {
  return {
    id: crypto.randomUUID(),
    userId,
    action,
    entityType,
    entityId,
    beforeState,
    afterState,
    machineId: getMachineId(),
    timestamp: new Date().toISOString(),
  };
}

/** Create a price change audit with before/after snapshots */
export function createPriceChangeAudit(
  userId: string,
  productId: string,
  oldCost: number,
  newCost: number,
  oldSelling: number,
  newSelling: number
): AuditEntry {
  return createAuditEntry(
    userId,
    'price_changed',
    'product',
    productId,
    { costPrice: oldCost, sellingPrice: oldSelling },
    { costPrice: newCost, sellingPrice: newSelling }
  );
}

/** Create a void audit — void reason is mandatory */
export function createVoidAudit(
  userId: string,
  saleId: string,
  reason: string
): AuditEntry {
  if (!reason || reason.trim().length === 0) {
    throw new Error('Void reason is mandatory');
  }
  return createAuditEntry(
    userId,
    'sale_voided',
    'sale',
    saleId,
    null,
    { reason: reason.trim() }
  );
}
