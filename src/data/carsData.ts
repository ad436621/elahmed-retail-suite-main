import { STORAGE_KEYS } from '@/config';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { CarItem } from '@/domain/types';

const KEY = STORAGE_KEYS.CARS;

interface CarRow {
  id: string;
  name: string;
  model: string;
  year?: number | null;
  color?: string | null;
  plateNumber?: string | null;
  licenseExpiry?: string | null;
  condition?: string | null;
  category?: string | null;
  purchasePrice?: number | null;
  salePrice?: number | null;
  notes?: string | null;
  image?: string | null;
  warehouseId?: string | null;
  isArchived?: number | boolean | null;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

let carsCache: CarItem[] | null = null;

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortCars(items: CarItem[]): CarItem[] {
  return [...items].sort((left, right) => (
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  ));
}

function normalizeCar(row: Partial<CarRow> | Partial<CarItem>): CarItem {
  const createdAt = String((row as CarRow).createdAt ?? (row as CarItem).createdAt ?? new Date().toISOString());
  return {
    id: String(row.id ?? crypto.randomUUID()),
    name: String(row.name ?? '').trim(),
    model: String((row as CarRow).model ?? (row as CarItem).model ?? '').trim(),
    year: Math.max(0, Math.round(toNumber((row as CarRow).year ?? (row as CarItem).year))),
    color: String((row as CarRow).color ?? (row as CarItem).color ?? ''),
    plateNumber: String((row as CarRow).plateNumber ?? (row as CarItem).plateNumber ?? ''),
    licenseExpiry: String((row as CarRow).licenseExpiry ?? (row as CarItem).licenseExpiry ?? ''),
    condition: (String((row as CarRow).condition ?? (row as CarItem).condition ?? 'used') as CarItem['condition']),
    category: (row as CarRow).category ? String((row as CarRow).category) : (row as CarItem).category,
    purchasePrice: toNumber((row as CarRow).purchasePrice ?? (row as CarItem).purchasePrice),
    salePrice: toNumber((row as CarRow).salePrice ?? (row as CarItem).salePrice),
    notes: String((row as CarRow).notes ?? (row as CarItem).notes ?? ''),
    image: (row as CarRow).image ? String((row as CarRow).image) : (row as CarItem).image,
    warehouseId: (row as CarRow).warehouseId ? String((row as CarRow).warehouseId) : (row as CarItem).warehouseId,
    isArchived: Boolean((row as CarRow).isArchived ?? (row as CarItem).isArchived ?? false),
    deletedAt: (row as CarRow).deletedAt ? String((row as CarRow).deletedAt) : ((row as CarItem).deletedAt ?? null),
    createdAt,
    updatedAt: String((row as CarRow).updatedAt ?? (row as CarItem).updatedAt ?? createdAt),
  };
}

function toCarRow(car: CarItem): CarRow {
  return {
    id: car.id,
    name: car.name,
    model: car.model,
    year: car.year,
    color: car.color,
    plateNumber: car.plateNumber,
    licenseExpiry: car.licenseExpiry,
    condition: car.condition,
    category: car.category ?? null,
    purchasePrice: car.purchasePrice,
    salePrice: car.salePrice,
    notes: car.notes,
    image: car.image ?? null,
    warehouseId: car.warehouseId ?? null,
    isArchived: car.isArchived ?? false,
    deletedAt: car.deletedAt ?? null,
    createdAt: car.createdAt,
    updatedAt: car.updatedAt,
  };
}

function setCarsState(items: CarItem[]): void {
  carsCache = sortCars(items.map(normalizeCar));
}

function loadLocalCars(): CarItem[] {
  const saved = getStorageItem<CarItem[]>(KEY, []);
  return sortCars((Array.isArray(saved) ? saved : []).map(normalizeCar));
}

function refreshElectronCars(): CarItem[] {
  const rows = readElectronSync<CarRow[]>('db-sync:cars:get', []);
  const rowsArray = Array.isArray(rows) ? rows : [];
  setCarsState(rowsArray.map(normalizeCar));
  return carsCache ?? [];
}

export function getCars(): CarItem[] {
  const allCars = carsCache ?? (hasElectronIpc() ? refreshElectronCars() : (setCarsState(loadLocalCars()), carsCache ?? []));
  return allCars.filter((car) => !car.isArchived && !car.deletedAt);
}

export function saveCars(items: CarItem[]): void {
  const normalized = sortCars(items.map(normalizeCar));

  if (hasElectronIpc()) {
    const current = new Map((carsCache ?? refreshElectronCars()).map((car) => [car.id, car]));
    const nextIds = new Set(normalized.map((car) => car.id));

    for (const car of normalized) {
      const payload = toCarRow(car);
      if (current.has(car.id)) {
        callElectronSync('db-sync:cars:update', car.id, payload);
      } else {
        callElectronSync('db-sync:cars:add', payload);
      }
    }

    for (const id of current.keys()) {
      if (!nextIds.has(id)) {
        callElectronSync('db-sync:cars:delete', id);
      }
    }

    setCarsState(normalized);
    emitDataChange(KEY);
    return;
  }

  setStorageItem(KEY, normalized);
  setCarsState(normalized);
  emitDataChange(KEY);
}

export function addCar(item: Omit<CarItem, 'id' | 'createdAt' | 'updatedAt'>): CarItem {
  const car = normalizeCar({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (hasElectronIpc()) {
    const saved = callElectronSync<CarRow>('db-sync:cars:add', toCarRow(car));
    const next = normalizeCar(saved ?? car);
    const allCars = refreshElectronCars();
    emitDataChange(KEY);
    return allCars.find((entry) => entry.id === next.id) ?? next;
  }

  saveCars([...(carsCache ?? loadLocalCars()), car]);
  return car;
}

export function updateCar(id: string, updates: Partial<CarItem>): void {
  if (hasElectronIpc()) {
    const current = (carsCache ?? refreshElectronCars()).find((car) => car.id === id);
    const next = normalizeCar({ ...(current ?? { id, name: '', model: '' }), ...updates, updatedAt: new Date().toISOString() });
    callElectronSync('db-sync:cars:update', id, toCarRow(next));
    setCarsState((carsCache ?? []).map((car) => (car.id === id ? next : car)));
    emitDataChange(KEY);
    return;
  }

  saveCars((carsCache ?? loadLocalCars()).map((car) => (
    car.id === id ? normalizeCar({ ...car, ...updates, updatedAt: new Date().toISOString() }) : car
  )));
}

export function deleteCar(id: string): void {
  const current = (carsCache ?? (hasElectronIpc() ? refreshElectronCars() : loadLocalCars())).find((car) => car.id === id);
  if (!current) return;

  updateCar(id, {
    isArchived: true,
    deletedAt: new Date().toISOString(),
  });
}

export function getNewCars(): CarItem[] {
  return getCars().filter((car) => car.condition === 'new');
}

export function getUsedCars(): CarItem[] {
  return getCars().filter((car) => car.condition === 'used');
}

export function getCarsCapital(): number {
  return getCars().reduce((sum, car) => sum + car.purchasePrice, 0);
}

export function getCarsProfit(): number {
  const sold = getCars().filter((car) => car.salePrice > 0);
  return sold.reduce((sum, car) => sum + (car.salePrice - car.purchasePrice), 0);
}
