// ============================================================
// ELAHMED RETAIL OS - Audit Repository
// Immutable audit logs with SQLite bridge in Electron
// ============================================================

import { AuditEntry } from '@/domain/types';
import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const AUDIT_STORAGE_KEY = STORAGE_KEYS.AUDIT_LOGS;

interface AuditRow {
  id?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  beforeState?: Record<string, unknown> | null;
  beforeStateJson?: string | null;
  afterState?: Record<string, unknown> | null;
  afterStateJson?: string | null;
  machineId?: string | null;
  timestamp?: string | null;
}

let auditStore: AuditEntry[] | null = null;

function parseJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeAuditEntry(entry: Partial<AuditRow>): AuditEntry {
  return {
    id: String(entry.id ?? crypto.randomUUID()),
    userId: String(entry.userId ?? 'system'),
    action: String(entry.action ?? 'settings_changed') as AuditEntry['action'],
    entityType: String(entry.entityType ?? 'unknown'),
    entityId: String(entry.entityId ?? 'unknown'),
    beforeState: parseJson(entry.beforeState ?? entry.beforeStateJson),
    afterState: parseJson(entry.afterState ?? entry.afterStateJson),
    machineId: String(entry.machineId ?? 'unknown-machine'),
    timestamp: String(entry.timestamp ?? new Date().toISOString()),
  };
}

function sortAuditEntries(entries: AuditEntry[]): AuditEntry[] {
  return [...entries].sort((left, right) => right.timestamp.localeCompare(left.timestamp) || right.id.localeCompare(left.id));
}

function setAuditState(entries: AuditEntry[]): void {
  auditStore = sortAuditEntries(entries.map(normalizeAuditEntry));
}

function loadAuditLogs(): AuditEntry[] {
  const saved = getStorageItem<AuditEntry[]>(AUDIT_STORAGE_KEY, []);
  return sortAuditEntries((Array.isArray(saved) ? saved : []).map(normalizeAuditEntry));
}

function refreshElectronAudit(): AuditEntry[] {
  const rows = readElectronSync<AuditRow[]>('db-sync:audit_logs:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setAuditState(rowsArray.map(normalizeAuditEntry));
  return auditStore ?? [];
}

function syncStore(): AuditEntry[] {
  if (hasElectronIpc()) {
    if (auditStore) return auditStore;
    return refreshElectronAudit();
  }

  const entries = loadAuditLogs();
  setAuditState(entries);
  return auditStore ?? [];
}

function saveToStorage(entries: AuditEntry[]): void {
  setStorageItem(AUDIT_STORAGE_KEY, entries);
  setAuditState(entries);
  emitDataChange(AUDIT_STORAGE_KEY);
}

export function saveAuditEntry(entry: AuditEntry): void {
  const normalized = Object.freeze({ ...normalizeAuditEntry(entry) });

  if (hasElectronIpc()) {
    callElectronSync('db-sync:audit_logs:add', normalized);
    refreshElectronAudit();
    emitDataChange(AUDIT_STORAGE_KEY);
    return;
  }

  saveToStorage([...syncStore(), normalized]);
}

export function saveAuditEntries(entries: AuditEntry[]): void {
  const normalized = entries.map((entry) => Object.freeze({ ...normalizeAuditEntry(entry) }));

  if (hasElectronIpc()) {
    callElectronSync('db-sync:audit_logs:addBulk', normalized);
    refreshElectronAudit();
    emitDataChange(AUDIT_STORAGE_KEY);
    return;
  }

  saveToStorage([...syncStore(), ...normalized]);
}

export function getAllAuditEntries(): readonly AuditEntry[] {
  return [...syncStore()];
}

export function getAuditByEntity(entityType: string, entityId: string): readonly AuditEntry[] {
  return syncStore().filter((entry) => entry.entityType === entityType && entry.entityId === entityId);
}

export function getAuditByUser(userId: string): readonly AuditEntry[] {
  return syncStore().filter((entry) => entry.userId === userId);
}
