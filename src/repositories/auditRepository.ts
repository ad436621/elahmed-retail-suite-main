// ============================================================
// ELAHMED RETAIL OS — Audit Repository
// IMMUTABLE — audit logs can only be created, never deleted
// ============================================================

import { AuditEntry } from '@/domain/types';

const AUDIT_STORAGE_KEY = 'elahmed_audit_logs';

function loadAuditLogs(): AuditEntry[] {
  try {
    const data = localStorage.getItem(AUDIT_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

let auditStore: AuditEntry[] = loadAuditLogs();

function saveToStorage() {
  localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditStore));
}

/** Append-only: no update or delete operations */
export function saveAuditEntry(entry: AuditEntry): void {
  auditStore.push(Object.freeze({ ...entry }));
  saveToStorage();
}

export function saveAuditEntries(entries: AuditEntry[]): void {
  entries.forEach(e => auditStore.push(Object.freeze({ ...e })));
  saveToStorage();
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
