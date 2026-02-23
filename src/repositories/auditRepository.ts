// ============================================================
// ELAHMED RETAIL OS — Audit Repository
// IMMUTABLE — audit logs can only be created, never deleted
// ============================================================

import { AuditEntry } from '@/domain/types';

let auditStore: AuditEntry[] = [];

/** Append-only: no update or delete operations */
export function saveAuditEntry(entry: AuditEntry): void {
  auditStore.push(Object.freeze(entry));
}

export function saveAuditEntries(entries: AuditEntry[]): void {
  entries.forEach(e => saveAuditEntry(e));
}

export function getAllAuditEntries(): readonly AuditEntry[] {
  return [...auditStore];
}

export function getAuditByEntity(entityType: string, entityId: string): readonly AuditEntry[] {
  return auditStore.filter(e => e.entityType === entityType && e.entityId === entityId);
}

export function getAuditByUser(userId: string): readonly AuditEntry[] {
  return auditStore.filter(e => e.userId === userId);
}
