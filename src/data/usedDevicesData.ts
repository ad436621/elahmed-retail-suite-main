// ============================================================
// Used Devices Data Layer
// ============================================================

import { STORAGE_KEYS } from '@/config';
import type { UsedDevice, UsedDeviceType } from '@/domain/types';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { addBatch } from './batchesData';

const KEY = STORAGE_KEYS.USED_DEVICES;

interface UsedDeviceRow {
  id: string;
  name: string;
  model?: string | null;
  deviceType?: string | null;
  category?: string | null;
  condition?: string | null;
  salePrice?: number | null;
  purchasePrice?: number | null;
  sellingPrice?: number | null;
  serialNumber?: string | null;
  color?: string | null;
  storage?: string | null;
  ram?: string | null;
  description?: string | null;
  notes?: string | null;
  image?: string | null;
  warehouseId?: string | null;
  isArchived?: number | boolean | null;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let usedDevicesCache: UsedDevice[] | null = null;

function normalizeDeviceType(value: unknown): UsedDeviceType {
  return value === 'mobile' || value === 'tablet' || value === 'computer' || value === 'laptop' ? value : 'other';
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortUsedDevices(items: UsedDevice[]): UsedDevice[] {
  return [...items].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt) || right.updatedAt.localeCompare(left.updatedAt),
  );
}

function normalizeUsedDevice(row: Partial<UsedDeviceRow>): UsedDevice {
  const createdAt = String(row.createdAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String(row.model ?? ''),
    deviceType: normalizeDeviceType(row.deviceType ?? row.category),
    serialNumber: String(row.serialNumber ?? ''),
    color: String(row.color ?? ''),
    storage: String(row.storage ?? ''),
    ram: String(row.ram ?? ''),
    condition: String(row.condition ?? ''),
    purchasePrice: toNumber(row.purchasePrice),
    salePrice: toNumber(row.salePrice ?? row.sellingPrice),
    description: String(row.description ?? row.notes ?? ''),
    image: row.image ? String(row.image) : undefined,
    warehouseId: row.warehouseId ? String(row.warehouseId) : undefined,
    isArchived: Boolean(row.isArchived),
    deletedAt: row.deletedAt ? String(row.deletedAt) : null,
    createdAt,
    updatedAt: String(row.updatedAt ?? createdAt),
  };
}

function toUsedDeviceRow(item: UsedDevice): UsedDeviceRow {
  return {
    id: item.id,
    name: item.name,
    model: item.model,
    deviceType: item.deviceType,
    category: item.deviceType,
    condition: item.condition,
    purchasePrice: item.purchasePrice,
    sellingPrice: item.salePrice,
    serialNumber: item.serialNumber,
    color: item.color,
    storage: item.storage,
    ram: item.ram,
    description: item.description,
    notes: item.description,
    image: item.image ?? null,
    warehouseId: item.warehouseId ?? null,
    isArchived: item.isArchived ?? false,
    deletedAt: item.deletedAt ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function setUsedDevicesState(items: UsedDevice[]): void {
  usedDevicesCache = sortUsedDevices(items.map(normalizeUsedDevice));
}

function loadLocalUsedDevices(): UsedDevice[] {
  const saved = getStorageItem<UsedDevice[]>(KEY, []);
  return sortUsedDevices((Array.isArray(saved) ? saved : []).map(normalizeUsedDevice));
}

function refreshElectronUsedDevices(): UsedDevice[] {
  const rows = readElectronSync<UsedDeviceRow[]>('db-sync:used_devices:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setUsedDevicesState(rowsArray.map(normalizeUsedDevice));
  return usedDevicesCache ?? [];
}

function persistElectronUsedDevices(items: UsedDevice[]): void {
  const current = new Map(getUsedDevices().map((item) => [item.id, item]));
  const nextIds = new Set(items.map((item) => item.id));

  for (const item of items) {
    const payload = toUsedDeviceRow(item);
    if (current.has(item.id)) {
      callElectronSync('db-sync:used_devices:update', item.id, payload);
    } else {
      callElectronSync('db-sync:used_devices:add', payload);
    }
  }

  for (const id of current.keys()) {
    if (!nextIds.has(id)) {
      callElectronSync('db-sync:used_devices:delete', id);
    }
  }
}

export function getUsedDevices(): UsedDevice[] {
  const all = usedDevicesCache ?? (hasElectronIpc() ? refreshElectronUsedDevices() : (setUsedDevicesState(loadLocalUsedDevices()), usedDevicesCache ?? []));
  return all.filter((item) => !item.isArchived && !item.deletedAt);
}

export function saveUsedDevices(items: UsedDevice[]): void {
  const normalized = sortUsedDevices(items.map(normalizeUsedDevice));

  if (hasElectronIpc()) {
    persistElectronUsedDevices(normalized);
    setUsedDevicesState(normalized);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, normalized);
  setUsedDevicesState(normalized);
  emitDataChange(KEY);
}

export function addUsedDevice(item: Omit<UsedDevice, 'id' | 'createdAt' | 'updatedAt'>): UsedDevice {
  const newItem = normalizeUsedDevice({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const saved = hasElectronIpc()
    ? normalizeUsedDevice(callElectronSync<UsedDeviceRow>('db-sync:used_devices:add', toUsedDeviceRow(newItem)) ?? newItem)
    : newItem;

  if (hasElectronIpc()) {
    refreshElectronUsedDevices();
    emitDataChange(KEY);
  } else {
    saveUsedDevices([...getUsedDevices(), saved]);
  }

  addBatch({
    productId: saved.id,
    inventoryType: 'used_device',
    productName: saved.name,
    costPrice: saved.purchasePrice,
    salePrice: saved.salePrice,
    quantity: 1,
    remainingQty: 1,
    purchaseDate: saved.createdAt,
    supplier: '',
    notes: `Used device - serial ${saved.serialNumber}`,
  });

  return saved;
}

export function updateUsedDevice(id: string, updates: Partial<UsedDevice>): void {
  if (hasElectronIpc()) {
    const current = getUsedDevices().find((item) => item.id === id);
    const next = normalizeUsedDevice({ ...(current ?? { id, name: '' }), ...updates, updatedAt: new Date().toISOString() });
    callElectronSync('db-sync:used_devices:update', id, toUsedDeviceRow(next));
    setUsedDevicesState(getUsedDevices().map((item) => (item.id === id ? next : item)));
    emitDataChange(KEY);
    return;
  }

  saveUsedDevices(getUsedDevices().map((item) => (
    item.id === id ? normalizeUsedDevice({ ...item, ...updates, updatedAt: new Date().toISOString() }) : item
  )));
}

export function deleteUsedDevice(id: string): void {
  updateUsedDevice(id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
  });
}
