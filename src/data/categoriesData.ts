import { STORAGE_KEYS } from '@/config';
import { callElectronSync, emitDataChange, hasElectronIpc, readElectronSync } from '@/lib/electronDataBridge';
import { getStorageItem, setStorageItem } from '@/lib/localStorageHelper';

export type CategorySection = 'mobile' | 'computer' | 'device';
export type CategoryType = 'device' | 'accessory';

export interface DynamicCategory {
  id: string;
  section: CategorySection;
  name: string;
  type: CategoryType;
}

interface CategoryRow {
  id: string;
  name: string;
  inventoryType: string;
}

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
  'Phones',
  'Accessories',
  'Cases',
  'Chargers',
  'Cables',
  'Headphones',
  'Screen Protectors',
  'Tablets',
];

let categoriesCache: DynamicCategory[] | null = null;
const stringListsCache = new Map<string, string[]>();

function parseInventoryType(value: unknown): { section: CategorySection; type: CategoryType } {
  const normalized = String(value ?? 'mobile_device').trim();
  const [rawSection, rawType] = normalized.split('_');
  const section = rawSection === 'computer' || rawSection === 'device' ? rawSection : 'mobile';
  const type = rawType === 'accessory' ? 'accessory' : 'device';
  return { section, type };
}

function toInventoryType(category: DynamicCategory): string {
  return `${category.section}_${category.type}`;
}

function normalizeCategoryRow(row: Partial<CategoryRow>): DynamicCategory {
  const { section, type } = parseInventoryType(row.inventoryType);
  return {
    id: String(row.id ?? crypto.randomUUID()),
    section,
    name: String(row.name ?? '').trim(),
    type,
  };
}

function normalizeDynamicCategory(category: Partial<DynamicCategory>): DynamicCategory {
  return {
    id: String(category.id ?? crypto.randomUUID()),
    section: category.section === 'computer' || category.section === 'device' ? category.section : 'mobile',
    name: String(category.name ?? '').trim(),
    type: category.type === 'accessory' ? 'accessory' : 'device',
  };
}

function toCategoryRow(category: DynamicCategory): CategoryRow {
  return {
    id: category.id,
    name: category.name,
    inventoryType: toInventoryType(category),
  };
}

function sortDynamicCategories(categories: DynamicCategory[]): DynamicCategory[] {
  return [...categories].sort((left, right) => (
    left.section.localeCompare(right.section)
    || left.type.localeCompare(right.type)
    || left.name.localeCompare(right.name, 'ar')
  ));
}

function normalizeDynamicCategories(categories: DynamicCategory[]): DynamicCategory[] {
  const seen = new Set<string>();
  const normalized: DynamicCategory[] = [];

  for (const category of categories.map(normalizeDynamicCategory)) {
    if (!category.name) continue;
    const key = `${category.section}:${category.type}:${category.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(category);
  }

  return sortDynamicCategories(normalized);
}

function normalizeStringList(values: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function setCategoriesState(categories: DynamicCategory[]): void {
  categoriesCache = normalizeDynamicCategories(categories);
}

function setStringListState(key: string, values: string[]): void {
  stringListsCache.set(key, normalizeStringList(values));
}

function loadLocalDynamicCategories(): DynamicCategory[] {
  const stored = getStorageItem<DynamicCategory[] | null>(DYNAMIC_CATEGORIES_KEY, null);
  return stored ? normalizeDynamicCategories(stored) : [];
}

function loadLocalStringList(key: string, defaults: string[]): string[] {
  return normalizeStringList(getStorageItem<string[]>(key, [...defaults]));
}

function refreshElectronCategories(): DynamicCategory[] {
  const rows = readElectronSync<CategoryRow[]>('db-sync:categories:get', []);
  setCategoriesState(rows.map(normalizeCategoryRow));
  return categoriesCache ?? [];
}

function readElectronStringList(key: string, defaults: string[]): string[] {
  const value = readElectronSync<unknown>('db-sync:settings:get-json', null, key);
  const normalized = Array.isArray(value) ? normalizeStringList(value as string[]) : normalizeStringList(defaults);
  setStringListState(key, normalized);
  return normalized;
}

export function getCategories(): DynamicCategory[] {
  if (categoriesCache) return categoriesCache;

  if (hasElectronIpc()) {
    const categories = refreshElectronCategories();
    if (categories.length > 0) return categories;

    setCategoriesState(DEFAULT_DYNAMIC_CATEGORIES);
    setTimeout(() => saveCategories(DEFAULT_DYNAMIC_CATEGORIES), 0);
    return categoriesCache ?? [];
  }

  const localCategories = loadLocalDynamicCategories();
  if (localCategories.length > 0) {
    setCategoriesState(localCategories);
    return categoriesCache ?? [];
  }

  setCategoriesState(DEFAULT_DYNAMIC_CATEGORIES);
  setTimeout(() => saveCategories(DEFAULT_DYNAMIC_CATEGORIES), 0);
  return categoriesCache ?? [];
}

export function saveCategories(categories: DynamicCategory[]): void {
  const normalized = normalizeDynamicCategories(categories);

  if (hasElectronIpc()) {
    const rows = callElectronSync<CategoryRow[]>('db-sync:categories:replaceAll', normalized.map(toCategoryRow));
    setCategoriesState(Array.isArray(rows) ? rows.map(normalizeCategoryRow) : normalized);
    emitDataChange(DYNAMIC_CATEGORIES_KEY);
    return;
  }

  setStorageItem(DYNAMIC_CATEGORIES_KEY, normalized);
  setCategoriesState(normalized);
  emitDataChange(DYNAMIC_CATEGORIES_KEY);
}

export function getCategoriesBySection(section: CategorySection): DynamicCategory[] {
  return getCategories().filter((category) => category.section === section);
}

export function addCategory(category: Omit<DynamicCategory, 'id'>): DynamicCategory {
  const newCategory: DynamicCategory = {
    ...category,
    id: crypto.randomUUID(),
  };
  saveCategories([...getCategories(), newCategory]);
  return newCategory;
}

export function deleteCategory(id: string): void {
  saveCategories(getCategories().filter((category) => category.id !== id));
}

export function getLegacyCategories(): string[] {
  if (stringListsCache.has(LEGACY_CATEGORIES_KEY)) {
    return [...(stringListsCache.get(LEGACY_CATEGORIES_KEY) ?? [])];
  }

  if (hasElectronIpc()) {
    return readElectronStringList(LEGACY_CATEGORIES_KEY, DEFAULT_LEGACY_CATEGORIES);
  }

  const categories = loadLocalStringList(LEGACY_CATEGORIES_KEY, DEFAULT_LEGACY_CATEGORIES);
  setStringListState(LEGACY_CATEGORIES_KEY, categories);
  return categories;
}

export function saveLegacyCategories(cats: string[]): void {
  saveCats(LEGACY_CATEGORIES_KEY, cats);
}

export function loadCats(key: string, defaults: string[] = []): string[] {
  if (stringListsCache.has(key)) {
    return [...(stringListsCache.get(key) ?? [])];
  }

  if (hasElectronIpc()) {
    return readElectronStringList(key, defaults);
  }

  const categories = loadLocalStringList(key, defaults);
  setStringListState(key, categories);
  return categories;
}

export function saveCats(key: string, cats: string[]): void {
  const normalized = normalizeStringList(cats);

  if (hasElectronIpc()) {
    callElectronSync('db-sync:settings:set-json', key, normalized);
    setStringListState(key, normalized);
    emitDataChange(key);
    return;
  }

  localStorage.setItem(key, JSON.stringify(normalized));
  setStringListState(key, normalized);
  emitDataChange(key);
}
