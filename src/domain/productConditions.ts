export const PRODUCT_CONDITION_VALUES = ['new', 'like_new', 'used', 'broken'] as const;

export type ProductConditionValue = (typeof PRODUCT_CONDITION_VALUES)[number];

export interface ProductConditionOption {
  value: ProductConditionValue;
  label: string;
}

export const PRODUCT_CONDITION_OPTIONS: ProductConditionOption[] = [
  { value: 'new', label: 'جديد' },
  { value: 'like_new', label: 'كالجديد' },
  { value: 'used', label: 'مستعمل' },
  { value: 'broken', label: 'معطل' },
];

const PRODUCT_CONDITION_LABELS: Record<ProductConditionValue, string> = {
  new: 'جديد',
  like_new: 'كالجديد',
  used: 'مستعمل',
  broken: 'معطل',
};

export function getProductConditionLabel(condition?: string): string {
  if (!condition) return PRODUCT_CONDITION_LABELS.new;
  return PRODUCT_CONDITION_LABELS[condition as ProductConditionValue] ?? condition;
}

export function getProductConditionBadgeClass(condition?: string): string {
  if (condition === 'used' || condition === 'broken') {
    return 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400';
  }

  if (condition === 'like_new') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400';
  }

  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400';
}
