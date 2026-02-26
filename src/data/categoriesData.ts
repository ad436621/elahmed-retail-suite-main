export type CategorySection = 'mobile' | 'computer' | 'device';
export type CategoryType = 'device' | 'accessory';

export interface DynamicCategory {
    id: string;
    section: CategorySection;
    name: string;
    type: CategoryType;
}

const CATEGORIES_KEY = 'gx_categories_v1';

const DEFAULT_CATEGORIES: DynamicCategory[] = [
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

export function getCategories(): DynamicCategory[] {
    try {
        const raw = localStorage.getItem(CATEGORIES_KEY);
        if (!raw) {
            saveCategories(DEFAULT_CATEGORIES);
            return DEFAULT_CATEGORIES;
        }
        return JSON.parse(raw);
    } catch {
        return DEFAULT_CATEGORIES;
    }
}

export function saveCategories(categories: DynamicCategory[]): void {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function getCategoriesBySection(section: CategorySection): DynamicCategory[] {
    return getCategories().filter(c => c.section === section);
}

export function addCategory(category: Omit<DynamicCategory, 'id'>): DynamicCategory {
    const all = getCategories();
    const newCat = { ...category, id: crypto.randomUUID() };
    saveCategories([...all, newCat]);
    return newCat;
}

export function deleteCategory(id: string): void {
    const all = getCategories();
    saveCategories(all.filter(c => c.id !== id));
}
