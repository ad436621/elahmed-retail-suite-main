// ============================================================
// Categories Data Layer — Dynamic + Legacy categories
// ============================================================

import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';
import { STORAGE_KEYS } from '@/config';

// ─── Types ──────────────────────────────────────────────────

export type CategorySection = 'mobile' | 'computer' | 'device';
export type CategoryType = 'device' | 'accessory';

export interface DynamicCategory {
    id: string;
    section: CategorySection;
    name: string;
    type: CategoryType;
}

// ─── Constants ──────────────────────────────────────────────

const DYNAMIC_CATEGORIES_KEY = STORAGE_KEYS.CATEGORIES;
const LEGACY_CATEGORIES_KEY = STORAGE_KEYS.LEGACY_CATEGORIES;

const DEFAULT_DYNAMIC_CATEGORIES: DynamicCategory[] = [
    { id: 'cat-mob-1', section: 'mobile', name: 'موبايلات', type: 'device' },
    { id: 'cat-mob-2', section: 'mobile', name: 'تابلت', type: 'device' },
    { id: 'cat-macc-1', section: 'mobile', name: 'سماعات سلك', type: 'accessory' },
    { id: 'cat-macc-2', section: 'mobile', name: 'سماعات بلوتوث', type: 'accessory' },
    { id: 'cat-macc-3', section: 'mobile', name: 'شواحن', type: 'accessory' },

    { id: 'cat-comp-1', section: 'computer', name: 'لابتوبات', type: 'device' },
    { id: 'cat-comp-2', section: 'computer', name: 'كمبيوترات مكتبية', type: 'device' },
    { id: 'cat-cacc-1', section: 'computer', name: 'ماوسات', type: 'accessory' },
    { id: 'cat-cacc-2', section: 'computer', name: 'كيبوردات', type: 'accessory' },

    { id: 'cat-dev-1', section: 'device', name: 'شاشات', type: 'device' },
    { id: 'cat-dev-2', section: 'device', name: 'أجهزة ألعاب', type: 'device' },
    { id: 'cat-dacc-1', section: 'device', name: 'أذرع تحكم', type: 'accessory' },
];

const DEFAULT_LEGACY_CATEGORIES: string[] = [
    'Phones', 'Accessories', 'Cases', 'Chargers',
    'Cables', 'Headphones', 'Screen Protectors', 'Tablets',
];

// ─── Dynamic Categories (section-based) ─────────────────────

/** Get all dynamic categories. Initializes defaults on first call. */
export function getCategories(): DynamicCategory[] {
    const stored = getStorageItem<DynamicCategory[] | null>(DYNAMIC_CATEGORIES_KEY, null);
    if (!stored) {
        saveCategories(DEFAULT_DYNAMIC_CATEGORIES);
        return DEFAULT_DYNAMIC_CATEGORIES;
    }
    return stored;
}

/** Save dynamic categories. */
export function saveCategories(categories: DynamicCategory[]): void {
    setStorageItem(DYNAMIC_CATEGORIES_KEY, categories);
}

/** Get categories filtered by section (mobile/computer/device). */
export function getCategoriesBySection(section: CategorySection): DynamicCategory[] {
    return getCategories().filter(c => c.section === section);
}

/** Add a new dynamic category. */
export function addCategory(category: Omit<DynamicCategory, 'id'>): DynamicCategory {
    const all = getCategories();
    const newCat: DynamicCategory = { ...category, id: crypto.randomUUID() };
    saveCategories([...all, newCat]);
    return newCat;
}

/** Delete a dynamic category by ID. */
export function deleteCategory(id: string): void {
    saveCategories(getCategories().filter(c => c.id !== id));
}

// ─── Legacy Categories (simple string list) ─────────────────

/** Get legacy string-based categories (used by Settings & Inventory pages). */
export function getLegacyCategories(): string[] {
    return getStorageItem<string[]>(LEGACY_CATEGORIES_KEY, [...DEFAULT_LEGACY_CATEGORIES]);
}

/** Save legacy string-based categories. */
export function saveLegacyCategories(cats: string[]): void {
    setStorageItem(LEGACY_CATEGORIES_KEY, cats);
}
