// ============================================================
// ELAHMED RETAIL OS — Audit Repository
// IMMUTABLE — audit logs can only be created, never deleted
// ============================================================

import { AuditEntry } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const AUDIT_STORAGE_KEY = STORAGE_KEYS.AUDIT_LOGS;

function loadAuditLogs(): AuditEntry[] {
  return getStorageItem<AuditEntry[]>(AUDIT_STORAGE_KEY, []);
}

let auditStore: AuditEntry[] = loadAuditLogs();

function saveToStorage() {
  setStorageItem(AUDIT_STORAGE_KEY, auditStore);
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
