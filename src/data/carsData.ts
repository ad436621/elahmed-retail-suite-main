// ============================================================
// Cars Inventory — Data Layer
// ============================================================

import { CarItem } from '@/domain/types';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

const KEY = 'gx_cars';

export function getCars(): CarItem[] {
    return getStorageItem<CarItem[]>(KEY, []);
}

export function saveCars(items: CarItem[]): void {
    setStorageItem(KEY, items);
}

export function addCar(item: Omit<CarItem, 'id' | 'createdAt' | 'updatedAt'>): CarItem {
    const all = getCars();
    const newItem: CarItem = {
        ...item,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    saveCars([...all, newItem]);
    return newItem;
}

export function updateCar(id: string, updates: Partial<CarItem>): void {
    saveCars(getCars().map(c =>
        c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
    ));
}

export function deleteCar(id: string): void {
    saveCars(getCars().filter(c => c.id !== id));
}

export function getNewCars(): CarItem[] {
    return getCars().filter(c => c.condition === 'new');
}

export function getUsedCars(): CarItem[] {
    return getCars().filter(c => c.condition === 'used');
}

export function getCarsCapital(): number {
    return getCars().reduce((sum, car) => sum + car.purchasePrice, 0);
}

export function getCarsProfit(): number {
    const sold = getCars().filter(c => c.salePrice > 0);
    return sold.reduce((sum, car) => sum + (car.salePrice - car.purchasePrice), 0);
}
