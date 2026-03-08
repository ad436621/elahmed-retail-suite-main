// ============================================================
// subInventoryData.ts — Generic factory for sub-inventory data
// ============================================================
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { SubItem } from '@/components/SubSectionPage';

export function createSubInventory(storageKey: string) {
    const get = (): SubItem[] => getStorageItem<SubItem[]>(storageKey, []);
    const save = (items: SubItem[]): void => setStorageItem(storageKey, items);

    const add = (item: Omit<SubItem, 'id' | 'createdAt' | 'updatedAt'>): SubItem => {
        const all = get();
        const newItem: SubItem = {
            name: item.name,
            quantity: item.quantity,
            costPrice: item.costPrice,
            salePrice: item.salePrice,
            ...item,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        save([...all, newItem]);
        return newItem;
    };

    const update = (id: string, updates: Partial<SubItem>): void => {
        save(get().map(i => i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i));
    };

    const remove = (id: string): void => {
        save(get().filter(i => i.id !== id));
    };

    const capital = (): number => get().reduce((s, i) => s + i.costPrice * i.quantity, 0);

    return { get, add, update, remove, capital };
}

// ─── Mobile sub-sections ───────────────────────────────────
import { STORAGE_KEYS } from '@/config';

export const mobileSparePartsDB = createSubInventory(STORAGE_KEYS.MOBILE_SPARE_PARTS);

// ─── Computer sub-sections ─────────────────────────────────
export const computerAccessoriesDB = createSubInventory(STORAGE_KEYS.COMPUTER_ACCESSORIES_SA);
export const computerSparePartsDB = createSubInventory(STORAGE_KEYS.COMPUTER_SPARE_PARTS);

// ─── Device sub-sections ───────────────────────────────────
export const deviceAccessoriesDB = createSubInventory(STORAGE_KEYS.DEVICE_ACCESSORIES_SA);
export const deviceSparePartsDB = createSubInventory(STORAGE_KEYS.DEVICE_SPARE_PARTS);
