// ============================================================
// Blacklist Data Layer - IMEI & Device Blacklist
// ============================================================

import { STORAGE_KEYS } from '@/config';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';

const KEY = STORAGE_KEYS.BLACKLIST;

export type BlacklistReason = 'stolen' | 'lost' | 'fraud' | 'other';

export interface BlacklistedDevice {
  id: string;
  imei: string;
  deviceName: string;
  ownerName?: string;
  ownerPhone?: string;
  reason: BlacklistReason;
  reportedDate: string;
  status: 'active' | 'resolved';
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface BlacklistRow {
  id: string;
  imei?: string | null;
  deviceName?: string | null;
  ownerName?: string | null;
  ownerPhone?: string | null;
  reason?: string | null;
  reportedDate?: string | null;
  status?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  name?: string | null;
  phone?: string | null;
  nationalId?: string | null;
  addedBy?: string | null;
}

export const REASON_LABELS: Record<BlacklistReason, string> = {
  stolen: 'مسروق',
  lost: 'مفقود',
  fraud: 'احتيال',
  other: 'أخرى',
};

function normalizeReason(value: unknown): BlacklistReason {
  return value === 'stolen' || value === 'lost' || value === 'fraud' ? value : 'other';
}

function normalizeStatus(value: unknown): BlacklistedDevice['status'] {
  return value === 'resolved' ? 'resolved' : 'active';
}

function normalizeEntry(row: Partial<BlacklistRow>): BlacklistedDevice {
  const now = new Date().toISOString();
  return {
    id: String(row.id ?? crypto.randomUUID()),
    imei: String(row.imei ?? row.nationalId ?? '').replace(/\s/g, ''),
    deviceName: String(row.deviceName ?? row.name ?? '').trim(),
    ownerName: row.ownerName ? String(row.ownerName) : undefined,
    ownerPhone: row.ownerPhone ? String(row.ownerPhone) : row.phone ? String(row.phone) : undefined,
    reason: normalizeReason(row.reason),
    reportedDate: String(row.reportedDate ?? (row.createdAt || now).slice(0, 10)),
    status: normalizeStatus(row.status),
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.createdBy ?? row.addedBy ?? 'system'),
    createdAt: String(row.createdAt ?? now),
    updatedAt: String(row.updatedAt ?? row.createdAt ?? now),
  };
}

function toBlacklistRow(entry: BlacklistedDevice): BlacklistRow {
  return {
    id: entry.id,
    imei: entry.imei,
    deviceName: entry.deviceName,
    ownerName: entry.ownerName ?? null,
    ownerPhone: entry.ownerPhone ?? null,
    reason: entry.reason,
    reportedDate: entry.reportedDate,
    status: entry.status,
    notes: entry.notes ?? null,
    createdBy: entry.createdBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function loadLocalBlacklist(): BlacklistedDevice[] {
  const saved = getStorageItem<BlacklistedDevice[]>(KEY, []);
  return (Array.isArray(saved) ? saved : []).map(normalizeEntry);
}

function persistElectronBlacklist(entries: BlacklistedDevice[]): void {
  const existing = new Map(getBlacklist().map((entry) => [entry.id, entry]));
  const nextIds = new Set(entries.map((entry) => entry.id));

  for (const entry of entries.map(normalizeEntry)) {
    const payload = toBlacklistRow(entry);
    if (existing.has(entry.id)) {
      callElectronSync('db-sync:blacklist:update', entry.id, payload);
    } else {
      callElectronSync('db-sync:blacklist:add', payload);
    }
  }

  for (const id of existing.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:blacklist:delete', id);
    }
  }

  emitDataChange(KEY);
}

export function getBlacklist(): BlacklistedDevice[] {
  if (hasElectronIpc()) {
    const rows = readElectronSync<BlacklistRow[]>('db-sync:blacklist:get', []);
    return rows.map(normalizeEntry);
  }

  return loadLocalBlacklist();
}

export function saveBlacklist(list: BlacklistedDevice[]): void {
  const normalized = list.map(normalizeEntry);

  if (hasElectronIpc()) {
    persistElectronBlacklist(normalized);
    return;
  }

  setStorageItem(KEY, normalized);
}

export function addToBlacklist(data: Omit<BlacklistedDevice, 'id' | 'createdAt' | 'updatedAt'>): BlacklistedDevice {
  const entry = normalizeEntry({
    ...data,
    id: crypto.randomUUID(),
    imei: data.imei.replace(/\s/g, ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<BlacklistRow>('db-sync:blacklist:add', toBlacklistRow(entry));
    emitDataChange(KEY);
    return normalizeEntry(saved ?? entry);
  }

  saveBlacklist([...loadLocalBlacklist(), entry]);
  return entry;
}

export function updateBlacklistEntry(id: string, data: Partial<BlacklistedDevice>): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:blacklist:update', id, {
      ...data,
      imei: data.imei ? data.imei.replace(/\s/g, '') : undefined,
      updatedAt: new Date().toISOString(),
    });
    emitDataChange(KEY);
    return;
  }

  const updated = loadLocalBlacklist().map((entry) =>
    entry.id === id ? normalizeEntry({ ...entry, ...data, updatedAt: new Date().toISOString() }) : entry,
  );
  setStorageItem(KEY, updated);
}

export function removeFromBlacklist(id: string): void {
  if (hasElectronIpc()) {
    callElectronSync('db-sync:blacklist:delete', id);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, loadLocalBlacklist().filter((entry) => entry.id !== id));
}

export function checkIMEI(imei: string): BlacklistedDevice | null {
  const clean = imei.replace(/\s/g, '');
  if (!clean) return null;
  return getBlacklist().find((entry) => entry.imei === clean && entry.status === 'active') ?? null;
}
