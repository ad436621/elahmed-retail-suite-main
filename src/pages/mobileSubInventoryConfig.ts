import { MobileAccessory, MobileSparePart, ProductCondition } from '@/domain/types';

type MobileSubInventoryItem = MobileAccessory | MobileSparePart;
type MobileSubInventoryDraft<T extends MobileSubInventoryItem> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

const toText = (value: unknown) => typeof value === 'string' ? value : '';
const toOptionalText = (value: unknown) => {
    const text = toText(value).trim();
    return text || undefined;
};
const toNumberValue = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};
const toBooleanValue = (value: unknown) => value === true || value === 'true';
const toConditionValue = (value: unknown): ProductCondition => {
    if (value === 'new' || value === 'like_new' || value === 'used' || value === 'broken') {
        return value;
    }

    return 'new';
};

export function buildMobileSubInventoryItem<T extends MobileSubInventoryItem>(
    row: Record<string, unknown>,
): MobileSubInventoryDraft<T> {
    return {
        name: toText(row.name),
        barcode: toOptionalText(row.barcode),
        category: toOptionalText(row.category),
        condition: toConditionValue(row.condition),
        quantity: toNumberValue(row.quantity),
        subcategory: toText(row.subcategory),
        model: toText(row.model),
        color: toText(row.color),
        brand: toOptionalText(row.brand),
        supplier: toOptionalText(row.supplier),
        oldCostPrice: toNumberValue(row.oldCostPrice),
        newCostPrice: toNumberValue(row.newCostPrice),
        salePrice: toNumberValue(row.salePrice),
        profitMargin: toNumberValue(row.profitMargin),
        minStock: toNumberValue(row.minStock),
        serialNumber: toOptionalText(row.serialNumber),
        imei2: toOptionalText(row.imei2),
        boxNumber: toOptionalText(row.boxNumber),
        source: toOptionalText(row.source),
        taxExcluded: toBooleanValue(row.taxExcluded),
        notes: toText(row.notes),
        description: toText(row.description),
        image: toOptionalText(row.image),
    } as MobileSubInventoryDraft<T>;
}
